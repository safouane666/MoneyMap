import { and, eq, isNull } from 'drizzle-orm';
import { evaluateGoalPace, type Goal } from '@clear-money/domain';
import type { Database } from './client.js';
import { goals } from './schema/index.js';

export type EvaluateActiveGoalsResult = {
  evaluated: number;
  completed: number;
};

function rowToDomainGoal(row: typeof goals.$inferSelect): Goal {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    targetMinor: row.targetMinor,
    savedMinor: row.savedMinor,
    currency: row.currency,
    targetDate: row.targetDate,
    startDate: row.startDate ?? undefined,
    durationMonths: row.durationMonths ?? 1,
    plannedContributionMinor: row.plannedContributionMinor,
    notificationPolicy: row.notificationPolicy as Goal['notificationPolicy'],
    status: row.status as Goal['status'],
    paceStatus: (row.paceStatus as Goal['paceStatus']) ?? 'on_track',
  };
}

/**
 * Recompute pace for all active goals and mark completed when won/lost at end date.
 */
export async function evaluateActiveGoals(
  db: Database,
  opts: { now?: Date; spaceId?: string } = {},
): Promise<EvaluateActiveGoalsResult> {
  const now = opts.now ?? new Date();
  const asOfDate = now.toISOString().slice(0, 10);

  const conditions = [eq(goals.status, 'active'), isNull(goals.deletedAt)];
  if (opts.spaceId) {
    conditions.push(eq(goals.spaceId, opts.spaceId));
  }

  const rows = await db
    .select()
    .from(goals)
    .where(and(...conditions))
    .limit(500);

  let evaluated = 0;
  let completed = 0;

  for (const row of rows) {
    const domainGoal = rowToDomainGoal(row);
    const evaluation = evaluateGoalPace(domainGoal, asOfDate);
    const patch: Partial<typeof goals.$inferInsert> = {
      paceStatus: evaluation.paceStatus,
    };
    if (evaluation.paceStatus === 'won' || evaluation.paceStatus === 'lost') {
      patch.status = 'completed';
      completed += 1;
    }
    await db.update(goals).set(patch).where(eq(goals.id, row.id));
    evaluated += 1;
  }

  return { evaluated, completed };
}
