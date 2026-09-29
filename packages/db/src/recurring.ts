import { and, eq, lte } from 'drizzle-orm';
import {
  advanceNextDueAt,
  createId,
  recurringIdempotencyKey,
  wasPostedThisCalendarMonth,
} from '@clear-money/domain';
import type { Database } from './client.js';
import { scheduledExpenses, spaces, transactions } from './schema/index.js';

export type PostDueRecurringResult = {
  posted: number;
  skipped: number;
  transactionIds: string[];
};

/**
 * Post confirmed ledger rows for due recurring salary/subscriptions.
 * Idempotent per UTC calendar month via last_posted_at (+ txn idempotency key).
 */
export async function postDueRecurring(
  db: Database,
  opts: {
    now?: Date;
    spaceId?: string;
    /** Fallback createdBy when scheduled row has none (e.g. legacy). */
    actorUserId?: string | null;
  } = {},
): Promise<PostDueRecurringResult> {
  const now = opts.now ?? new Date();
  const conditions = [
    eq(scheduledExpenses.active, true),
    lte(scheduledExpenses.nextDueAt, now),
  ];
  if (opts.spaceId) {
    conditions.push(eq(scheduledExpenses.spaceId, opts.spaceId));
  }

  const due = await db
    .select()
    .from(scheduledExpenses)
    .where(and(...conditions))
    .limit(500);

  let posted = 0;
  let skipped = 0;
  const transactionIds: string[] = [];

  for (const row of due) {
    if (wasPostedThisCalendarMonth(row.lastPostedAt, now)) {
      skipped += 1;
      continue;
    }

    const kind = row.kind === 'income' ? 'income' : 'expense';
    const dayOfMonth = row.dayOfMonth ?? 1;
    const dueAt = row.nextDueAt ?? now;

    let createdBy = row.createdBy ?? opts.actorUserId ?? null;
    if (!createdBy) {
      const space = (
        await db.select().from(spaces).where(eq(spaces.id, row.spaceId)).limit(1)
      )[0];
      createdBy = space?.ownerId ?? null;
    }
    if (!createdBy) {
      skipped += 1;
      continue;
    }

    const idempotencyKey = recurringIdempotencyKey(row.id, now);
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.spaceId, row.spaceId),
          eq(transactions.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(scheduledExpenses)
        .set({
          lastPostedAt: now,
          nextDueAt: advanceNextDueAt(dueAt, dayOfMonth),
        })
        .where(eq(scheduledExpenses.id, row.id));
      skipped += 1;
      continue;
    }

    const txnId = createId('txn');
    await db.insert(transactions).values({
      id: txnId,
      spaceId: row.spaceId,
      type: kind,
      amountMinor: row.amountMinor,
      currency: row.currency,
      categoryId: null,
      description: row.name,
      occurredAt: dueAt,
      occurredOffset: '+00:00',
      createdBy,
      source: 'import',
      status: 'confirmed',
      idempotencyKey,
    });

    await db
      .update(scheduledExpenses)
      .set({
        lastPostedAt: now,
        nextDueAt: advanceNextDueAt(dueAt, dayOfMonth),
      })
      .where(eq(scheduledExpenses.id, row.id));

    posted += 1;
    transactionIds.push(txnId);
  }

  return { posted, skipped, transactionIds };
}
