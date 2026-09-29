import { eq, and, inArray, sql } from 'drizzle-orm';
import { createDb, evaluateActiveGoals, jobs, postDueRecurring } from '@clear-money/db';
import type { JobRecord } from './types.js';
import { JOB_TYPES } from './types.js';
import { failureMessage, runJobHandler } from './handlers.js';

export type WorkerDb = ReturnType<typeof createDb>;

const RECURRING_SWEEP_MS = Number(process.env.RECURRING_SWEEP_MS ?? 60_000);
const GOAL_EVAL_SWEEP_MS = Number(process.env.GOAL_EVAL_SWEEP_MS ?? 900_000);

function toRecord(row: typeof jobs.$inferSelect): JobRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    spaceId: row.spaceId ?? null,
    userId: row.userId ?? null,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    result: (row.result as Record<string, unknown> | null) ?? null,
    error: row.error ?? null,
    idempotencyKey: row.idempotencyKey ?? null,
  };
}

/**
 * Claim the next queued job of a known type.
 * Uses a conditional update so concurrent workers stay idempotent.
 */
export async function claimNextJob(db: WorkerDb): Promise<JobRecord | null> {
  const candidates = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, 'queued'), inArray(jobs.type, [...JOB_TYPES])))
    .limit(5);

  for (const row of candidates) {
    const updated = await db
      .update(jobs)
      .set({ status: 'running', updatedAt: new Date(), error: null })
      .where(and(eq(jobs.id, row.id), eq(jobs.status, 'queued')))
      .returning();

    const claimed = updated[0];
    if (claimed) return toRecord(claimed);
  }

  return null;
}

/** If a prior run with the same idempotency key already succeeded, reuse it. */
export async function findSucceededByIdempotency(
  db: WorkerDb,
  idempotencyKey: string | null,
): Promise<JobRecord | null> {
  if (!idempotencyKey) return null;
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.idempotencyKey, idempotencyKey), eq(jobs.status, 'succeeded')))
    .limit(1);
  const row = rows[0];
  return row ? toRecord(row) : null;
}

export async function markSucceeded(
  db: WorkerDb,
  jobId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: 'succeeded',
      result,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

export async function markFailed(db: WorkerDb, jobId: string, message: string): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: 'failed',
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Process one job end-to-end with idempotency and status updates.
 * Safe to retry: succeeded jobs are left alone; duplicate idempotency keys copy prior result.
 */
export async function processJob(db: WorkerDb, job: JobRecord): Promise<void> {
  if (job.status === 'succeeded') {
    return;
  }

  const prior = await findSucceededByIdempotency(db, job.idempotencyKey);
  if (prior?.result) {
    await markSucceeded(db, job.id, prior.result);
    return;
  }

  try {
    const result = await runJobHandler(job, { db });
    await markSucceeded(db, job.id, result as unknown as Record<string, unknown>);
  } catch (err) {
    await markFailed(db, job.id, failureMessage(err));
  }
}

export async function pollOnce(db: WorkerDb): Promise<boolean> {
  const job = await claimNextJob(db);
  if (!job) return false;
  await processJob(db, job);
  return true;
}

export function startPollLoop(options: {
  db: WorkerDb;
  intervalMs?: number;
  recurringSweepMs?: number;
  goalEvalSweepMs?: number;
  signal?: AbortSignal;
}): { stop: () => void } {
  const intervalMs = options.intervalMs ?? 2000;
  const recurringSweepMs = options.recurringSweepMs ?? RECURRING_SWEEP_MS;
  const goalEvalSweepMs = options.goalEvalSweepMs ?? GOAL_EVAL_SWEEP_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRecurringSweep = 0;
  let lastGoalEvalSweep = 0;

  const tick = async () => {
    if (stopped || options.signal?.aborted) return;
    try {
      let worked = true;
      while (worked && !stopped) {
        worked = await pollOnce(options.db);
      }

      const now = Date.now();
      if (now - lastRecurringSweep >= recurringSweepMs) {
        lastRecurringSweep = now;
        try {
          const result = await postDueRecurring(options.db, { now: new Date() });
          if (result.posted > 0) {
            console.log(
              `[worker] post_due_recurring posted=${result.posted} skipped=${result.skipped}`,
            );
          }
        } catch (err) {
          console.error('[worker] post_due_recurring sweep error', failureMessage(err));
        }
      }

      if (now - lastGoalEvalSweep >= goalEvalSweepMs) {
        lastGoalEvalSweep = now;
        try {
          const goalResult = await evaluateActiveGoals(options.db, { now: new Date(now) });
          if (goalResult.evaluated > 0) {
            console.log(
              `[worker] evaluate_goals evaluated=${goalResult.evaluated} completed=${goalResult.completed}`,
            );
          }
        } catch (err) {
          console.error('[worker] evaluate_goals sweep error', failureMessage(err));
        }
      }
    } catch (err) {
      console.error('[worker] poll error', failureMessage(err));
    }
    if (!stopped && !options.signal?.aborted) {
      timer = setTimeout(() => {
        void tick();
      }, intervalMs);
    }
  };

  void tick();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

/** Lightweight health ping against Postgres. */
export async function pingDb(db: WorkerDb): Promise<boolean> {
  await db.execute(sql`select 1`);
  return true;
}
