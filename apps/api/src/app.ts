import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { and, desc, eq, gte, ilike, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  createId,
  createIdempotencyKey,
  computePeriodTotals,
  busiestSpendingHour,
  highestSpendingWeekday,
  lateEntryInsight,
  hourBuckets,
  weekdayBuckets,
  computeSafeToSpend,
  canCreateSpace,
  canInviteMember,
  canUseFeature,
  defaultLimitsForPlan,
  maxActiveGoalsForPlan,
  requiresConfirmation,
  filterVisibleEntries,
  type PlanId,
  type SpaceRole,
  type LedgerTransaction,
} from '@clear-money/domain';
import {
  user,
  spaces,
  memberships,
  transactions,
  goals,
  categories,
  invitations,
  auditLog,
  jobs,
  usageCounters,
  notificationPreferences,
  scheduledExpenses,
  attachments,
  subscriptions,
  billingCustomers,
  pennyTurns,
} from '@clear-money/db';
import { billingPublicConfig, config } from './config.js';
import { getAuth } from './auth.js';
import { db, requireMembership, requirePermission } from './db.js';
import { rateLimit } from './rate-limit.js';
import { maskEmail } from './mask-email.js';

type Variables = { userId: string };
type TxnRow = typeof transactions.$inferSelect;

const SPACE_ROLES = new Set<SpaceRole>(['owner', 'admin', 'contributor', 'viewer', 'child']);

async function optionalSessionUserId(
  c: import('hono').Context<{ Variables: Variables }>,
): Promise<string | null> {
  try {
    const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
    if (session?.user?.id) return session.user.id;
  } catch {
    /* public path */
  }
  if (config.appEnv !== 'production') {
    const devUser = c.req.header('x-user-id');
    if (devUser) return devUser;
  }
  return null;
}

function s3Client() {
  return new S3Client({
    region: config.s3Region,
    endpoint: config.s3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3SecretKey,
    },
  });
}

export function createApp() {
  const app = new Hono<{ Variables: Variables }>();

  app.use(
    '*',
    cors({
      origin: config.webOrigins,
      credentials: true,
    }),
  );

  app.get('/health', (c) => c.json({ ok: true, service: 'clear-money-api' }));

  app.get('/public/billing-config', (c) => c.json(billingPublicConfig()));

  app.use('/cm-api/auth/*', async (c, next) => {
    if (!rateLimit(`auth:${c.req.header('x-forwarded-for') ?? 'local'}`, 30, 60_000)) {
      return c.json({ error: 'Rate limited' }, 429);
    }
    return next();
  });
  // Same-origin web proxy path (required for phones — only port 8259 is exposed)
  app.on(['POST', 'GET'], '/cm-api/auth/*', (c) => getAuth().handler(c.req.raw));
  // Legacy direct API path (dev tools)
  app.on(['POST', 'GET'], '/auth/*', (c) => getAuth().handler(c.req.raw));

  app.use('/me', authMiddleware);
  app.use('/me/*', authMiddleware);
  app.use('/spaces', authMiddleware);
  app.use('/spaces/*', authMiddleware);
  app.use('/invitations/:inviteId/accept', authMiddleware);
  app.use('/categories', authMiddleware);
  app.use('/categories/*', authMiddleware);
  app.use('/jobs/*', authMiddleware);
  app.use('/billing/checkout', authMiddleware);
  app.use('/billing/config', authMiddleware);
  app.use('/billing/subscription', authMiddleware);
  app.use('/billing/subscribe', authMiddleware);
  app.use('/billing/cancel', authMiddleware);
  app.use('/ai/*', authMiddleware);
  app.use('/account/*', authMiddleware);

  app.get('/me', async (c) => {
    const userId = c.get('userId');
    const rows = await db().select().from(user).where(eq(user.id, userId)).limit(1);
    const profile = rows[0] ?? null;
    if (!profile) return c.json(null);
    return c.json({
      ...profile,
      setupSession: {
        completed: Boolean(profile.setupCompletedAt),
        needsPersonalSpace: !profile.setupCompletedAt,
      },
    });
  });

  app.patch('/me', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
      locale?: string;
      defaultCurrency?: string;
      timezone?: string;
      weekStartsOn?: number;
      name?: string;
    }>();
    await db()
      .update(user)
      .set({
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.defaultCurrency !== undefined ? { defaultCurrency: body.defaultCurrency } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.weekStartsOn !== undefined ? { weekStartsOn: body.weekStartsOn } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
    const rows = await db().select().from(user).where(eq(user.id, userId)).limit(1);
    return c.json(rows[0]);
  });

  app.post('/me/setup-complete', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
      locale?: string;
      defaultCurrency?: string;
      notificationEnabled?: boolean;
    }>();
    const profile = (
      await db().select().from(user).where(eq(user.id, userId)).limit(1)
    )[0];
    if (!profile) return c.json({ error: 'User not found' }, 404);

    const chosenCurrency = body.defaultCurrency
      ? body.defaultCurrency.trim().toUpperCase()
      : null;
    const currency = chosenCurrency ?? profile.defaultCurrency;

    await db()
      .update(user)
      .set({
        locale: body.locale ?? profile.locale,
        defaultCurrency: currency,
        setupCompletedAt: profile.setupCompletedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    const membershipRows = await db()
      .select({
        membership: memberships,
        space: spaces,
      })
      .from(memberships)
      .innerJoin(spaces, eq(spaces.id, memberships.spaceId))
      .where(
        and(
          eq(memberships.userId, userId),
          isNull(memberships.deletedAt),
          isNull(spaces.deletedAt),
        ),
      );

    let personalSpace = membershipRows.find((r) => r.space.type === 'personal')?.space;
    let personalSpaceId = personalSpace?.id ?? membershipRows[0]?.space.id;

    if (!personalSpaceId) {
      personalSpaceId = createId('space');
      await db().insert(spaces).values({
        id: personalSpaceId,
        name: 'Personal',
        type: 'personal',
        currency,
        timezone: profile.timezone,
        ownerId: userId,
      });
      await db().insert(memberships).values({
        id: createId('mem'),
        spaceId: personalSpaceId,
        userId,
        role: 'owner',
      });
      await db()
        .insert(usageCounters)
        .values({ id: createId('user'), userId })
        .onConflictDoNothing();
    } else if (chosenCurrency && personalSpace && personalSpace.currency !== chosenCurrency) {
      // Re-apply setup currency when the personal ledger is still empty (OAuth bootstrap
      // often creates the space with USD before the setup session currency is sent).
      const txnRows = await db()
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.spaceId, personalSpaceId), isNull(transactions.deletedAt)))
        .limit(1);
      if (txnRows.length === 0) {
        await db()
          .update(spaces)
          .set({ currency: chosenCurrency, updatedAt: new Date() })
          .where(eq(spaces.id, personalSpaceId));
      }
    }

    if (body.notificationEnabled !== undefined) {
      await db()
        .insert(notificationPreferences)
        .values({
          id: createId('user'),
          userId,
          enabled: body.notificationEnabled,
          categories: [
            'daily_mini_report',
            'weekly_review',
            'savings_goal',
            'gentle_inactivity',
          ],
          timezone: profile.timezone,
        })
        .onConflictDoNothing();
    }

    return c.json({ spaceId: personalSpaceId, setupCompleted: true });
  });

  app.get('/spaces', async (c) => {
    const userId = c.get('userId');
    const rows = await db()
      .select({
        membership: memberships,
        space: spaces,
      })
      .from(memberships)
      .innerJoin(spaces, eq(spaces.id, memberships.spaceId))
      .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt), isNull(spaces.deletedAt)));
    return c.json(
      rows.map((r) => ({
        ...r.space,
        role: r.membership.role,
      })),
    );
  });

  app.get('/categories', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.query('spaceId');
    const membershipsRows = await db()
      .select({ spaceId: memberships.spaceId })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)));
    const allowed = new Set(membershipsRows.map((m) => m.spaceId));
    if (spaceId && !allowed.has(spaceId)) {
      return c.json({ error: 'Not a member of this Space' }, 403);
    }
    const rows = await db().select().from(categories);
    const visible = rows.filter(
      (row) =>
        row.spaceId === null ||
        (spaceId ? row.spaceId === spaceId : allowed.has(row.spaceId)),
    );
    return c.json(visible);
  });

  app.post('/categories', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{
      name: string;
      type: 'income' | 'expense';
      spaceId?: string | null;
    }>();
    const spaceId = body.spaceId ?? null;
    if (spaceId) await requirePermission(userId, spaceId, 'create');
    const name = body.name.trim();
    if (!name) return c.json({ error: 'Name required' }, 400);
    const id = createId('cat');
    const stableKey = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'cat'}_${id.slice(-6)}`;
    await db().insert(categories).values({
      id,
      spaceId,
      stableKey,
      name,
      type: body.type,
    });
    return c.json({ id, name, type: body.type, spaceId }, 201);
  });

  app.post('/spaces', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ name: string; type: string; currency?: string }>();
    const allowedSpaceTypes = new Set(['personal', 'project', 'family', 'company']);
    if (!body.name?.trim()) {
      return c.json({ error: 'name is required' }, 400);
    }
    if (!allowedSpaceTypes.has(body.type)) {
      return c.json(
        { error: 'type must be personal, project, family, or company' },
        400,
      );
    }
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;
    // Count spaces this user owns (personal allotment), not every membership.
    const owned = await db()
      .select({ id: spaces.id, type: spaces.type })
      .from(spaces)
      .where(and(eq(spaces.ownerId, userId), isNull(spaces.deletedAt)));
    const personalSpaceCount = owned.filter((s) => s.type === 'personal').length;
    const decision = canCreateSpace({
      plan: profile.plan as PlanId,
      personalSpaceCount,
      totalSpaceCount: owned.length,
      usage: { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers: 1 },
      limits: defaultLimitsForPlan(profile.plan as PlanId),
    });
    if (!decision.ok) {
      return c.json({ error: decision.reason }, 402);
    }
    // Free: prefer personal first, then one shared-style space (project/family/company).
    if (profile.plan === 'free' && body.type === 'personal' && personalSpaceCount >= 1) {
      return c.json({ error: 'Free already includes one personal space. Create a shared space to invite someone.' }, 402);
    }

    const id = createId('space');
    await db().insert(spaces).values({
      id,
      name: body.name,
      type: body.type,
      currency: body.currency ?? profile.defaultCurrency,
      timezone: profile.timezone,
      ownerId: userId,
    });
    await db().insert(memberships).values({
      id: createId('mem'),
      spaceId: id,
      userId,
      role: 'owner',
    });
    return c.json(
      {
        id,
        name: body.name,
        type: body.type,
        currency: body.currency ?? profile.defaultCurrency,
        role: 'owner' as const,
      },
      201,
    );
  });

  app.get('/spaces/:spaceId/transactions', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const membership = await requireMembership(userId, spaceId);
    const from = c.req.query('from');
    const to = c.req.query('to');
    const status = c.req.query('status');
    const conditions = [
      eq(transactions.spaceId, spaceId),
      isNull(transactions.deletedAt),
    ];
    if (from) conditions.push(gte(transactions.occurredAt, new Date(from)));
    if (to) conditions.push(lte(transactions.occurredAt, new Date(to)));
    if (status) conditions.push(eq(transactions.status, status));

    const rows = await db()
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt))
      .limit(200);

    const visible = filterVisibleEntries(
      membership.role as SpaceRole,
      userId,
      rows as TxnRow[],
    );
    return c.json(visible);
  });

  app.post('/spaces/:spaceId/transactions', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'create');
    const body = await c.req.json<{
      type: 'income' | 'expense' | 'transfer';
      amountMinor: number;
      currency: string;
      categoryId?: string | null;
      description?: string | null;
      occurredAt: string;
      source?: 'manual' | 'voice' | 'receipt' | 'import';
      idempotencyKey?: string;
      confirm?: boolean;
    }>();

    const allowedTypes = new Set(['income', 'expense', 'transfer']);
    if (!allowedTypes.has(body.type)) {
      return c.json({ error: 'Invalid transaction type' }, 400);
    }
    if (!Number.isFinite(body.amountMinor) || body.amountMinor <= 0) {
      return c.json({ error: 'amountMinor must be a positive integer' }, 400);
    }
    if (!body.currency || typeof body.currency !== 'string') {
      return c.json({ error: 'currency is required' }, 400);
    }
    if (!body.occurredAt || Number.isNaN(Date.parse(body.occurredAt))) {
      return c.json({ error: 'occurredAt must be a valid ISO date' }, 400);
    }

    const spaceRow = (
      await db().select().from(spaces).where(eq(spaces.id, spaceId)).limit(1)
    )[0];
    if (!spaceRow) return c.json({ error: 'Space not found' }, 404);
    if (body.currency !== spaceRow.currency) {
      return c.json(
        { error: `currency must match space currency (${spaceRow.currency})` },
        400,
      );
    }

    const idempotencyKey = body.idempotencyKey ?? createIdempotencyKey();
    const existing = await db()
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.spaceId, spaceId),
          eq(transactions.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) return c.json(existing[0]);

    const source = body.source ?? 'manual';
    const needsConfirm = requiresConfirmation(source) && !body.confirm;
    const offsetMatch = body.occurredAt.match(/([+-]\d{2}:\d{2}|Z)$/);
    const id = createId('txn');
    const row = {
      id,
      spaceId,
      type: body.type,
      amountMinor: Math.trunc(body.amountMinor),
      currency: body.currency,
      categoryId: body.categoryId ?? null,
      description: body.description ?? null,
      occurredAt: new Date(body.occurredAt),
      occurredOffset: offsetMatch?.[1] === 'Z' ? '+00:00' : (offsetMatch?.[1] ?? '+00:00'),
      createdBy: userId,
      source,
      status: needsConfirm ? 'draft' : 'confirmed',
      idempotencyKey,
    };
    await db().insert(transactions).values(row);
    return c.json(row, 201);
  });

  app.post('/spaces/:spaceId/transactions/:txnId/confirm', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const txnId = c.req.param('txnId');
    await requirePermission(userId, spaceId, 'create');
    const body = await c.req.json<{
      amountMinor?: number;
      categoryId?: string | null;
      description?: string | null;
      type?: string;
    }>();
    await db()
      .update(transactions)
      .set({
        status: 'confirmed',
        ...(body.amountMinor !== undefined ? { amountMinor: body.amountMinor } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, txnId), eq(transactions.spaceId, spaceId)));
    const rows = await db().select().from(transactions).where(eq(transactions.id, txnId)).limit(1);
    return c.json(rows[0]);
  });

  app.delete('/spaces/:spaceId/transactions/:txnId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const txnId = c.req.param('txnId');
    await requireMembership(userId, spaceId);
    const row = (
      await db()
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, txnId), eq(transactions.spaceId, spaceId)))
        .limit(1)
    )[0];
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.createdBy === userId) {
      await requirePermission(userId, spaceId, 'delete_own');
    } else {
      await requirePermission(userId, spaceId, 'delete_all');
    }
    await db()
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(and(eq(transactions.id, txnId), eq(transactions.spaceId, spaceId)));
    await db().insert(auditLog).values({
      id: createId('aud'),
      spaceId,
      actorId: userId,
      action: 'delete',
      entityType: 'transaction',
      entityId: txnId,
      beforeSummary: `${row.type} ${row.amountMinor}`,
    });
    return c.json({ ok: true });
  });

  app.get('/spaces/:spaceId/reports', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const membership = await requireMembership(userId, spaceId);
    const timezone = c.req.query('timezone') ?? 'UTC';
    const currency = c.req.query('currency');
    const space = (
      await db().select().from(spaces).where(eq(spaces.id, spaceId)).limit(1)
    )[0]!;
    const rows = await db()
      .select()
      .from(transactions)
      .where(and(eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)));

    const visible = filterVisibleEntries(membership.role as SpaceRole, userId, rows as TxnRow[]);
    const ledger: LedgerTransaction[] = visible.map((r) => ({
      id: r.id,
      spaceId: r.spaceId,
      type: r.type as LedgerTransaction['type'],
      amountMinor: r.amountMinor,
      currency: r.currency,
      categoryId: r.categoryId,
      description: r.description,
      occurredAt: r.occurredAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
      source: r.source as LedgerTransaction['source'],
      status: r.status as LedgerTransaction['status'],
    }));

    const cur = currency ?? space.currency;
    const totals = computePeriodTotals(ledger, cur);
    return c.json({
      totals,
      insights: {
        busiestHour: busiestSpendingHour(ledger, timezone),
        highestWeekday: highestSpendingWeekday(ledger, timezone),
        lateEntries: lateEntryInsight(ledger),
      },
      hourBuckets: hourBuckets(ledger, timezone),
      weekdayBuckets: weekdayBuckets(ledger, timezone),
      summary: `Income ${totals.incomeMinor}, expenses ${totals.expenseMinor}, net ${totals.netMinor} ${cur}. Transfers ${totals.transferMinor} excluded from net.`,
    });
  });

  app.get('/spaces/:spaceId/goals', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requireMembership(userId, spaceId);
    const rows = await db()
      .select()
      .from(goals)
      .where(and(eq(goals.spaceId, spaceId), isNull(goals.deletedAt)));
    return c.json(rows);
  });

  app.post('/spaces/:spaceId/goals', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'create');
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;
    const usage = await getUsageForUser(userId);
    const decision = canUseFeature(entitlementCtx(profile.plan as PlanId, usage), 'goals');
    if (!decision.ok) return c.json({ error: decision.reason }, 402);

    const activeCount = (
      await db()
        .select()
        .from(goals)
        .where(
          and(eq(goals.spaceId, spaceId), eq(goals.status, 'active'), isNull(goals.deletedAt)),
        )
    ).length;
    // Free plan: count goals across all memberships for the user (cap is per account)
    const allMemberships = await db()
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt)));
    let accountActiveGoals = 0;
    for (const m of allMemberships) {
      const rows = await db()
        .select()
        .from(goals)
        .where(
          and(eq(goals.spaceId, m.spaceId), eq(goals.status, 'active'), isNull(goals.deletedAt)),
        );
      accountActiveGoals += rows.length;
    }
    void activeCount;
    const maxGoals = maxActiveGoalsForPlan(profile.plan as PlanId);
    if (maxGoals !== null && accountActiveGoals >= maxGoals) {
      return c.json(
        { error: `Free plan allows ${maxGoals} active goals. Upgrade to Plus for more.` },
        402,
      );
    }

    const body = await c.req.json<{
      name: string;
      targetMinor: number;
      currency: string;
      targetDate: string;
      plannedContributionMinor?: number;
    }>();
    const id = createId('goal');
    await db().insert(goals).values({
      id,
      spaceId,
      name: body.name,
      targetMinor: body.targetMinor,
      savedMinor: 0,
      currency: body.currency,
      targetDate: body.targetDate,
      plannedContributionMinor: body.plannedContributionMinor ?? 0,
      createdBy: userId,
    });
    const row = (await db().select().from(goals).where(eq(goals.id, id)).limit(1))[0]!;
    return c.json(row, 201);
  });

  app.get('/spaces/:spaceId/safe-to-spend', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const membership = await requireMembership(userId, spaceId);
    const space = (await db().select().from(spaces).where(eq(spaces.id, spaceId)).limit(1))[0]!;
    const txnRows = await db()
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.spaceId, spaceId),
          eq(transactions.status, 'confirmed'),
          isNull(transactions.deletedAt),
        ),
      );
    const txns = filterVisibleEntries(membership.role as SpaceRole, userId, txnRows as TxnRow[]);
    const ledger: LedgerTransaction[] = txns.map((r) => ({
      id: r.id,
      spaceId: r.spaceId,
      type: r.type as LedgerTransaction['type'],
      amountMinor: r.amountMinor,
      currency: r.currency,
      categoryId: r.categoryId,
      description: r.description,
      occurredAt: r.occurredAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy,
      source: r.source as LedgerTransaction['source'],
      status: r.status as LedgerTransaction['status'],
    }));
    const totals = computePeriodTotals(ledger, space.currency);
    const activeGoals = await db()
      .select()
      .from(goals)
      .where(and(eq(goals.spaceId, spaceId), eq(goals.status, 'active'), isNull(goals.deletedAt)));
    const planned = activeGoals.reduce((s, g) => s + g.plannedContributionMinor, 0);
    const scheduled = await db()
      .select()
      .from(scheduledExpenses)
      .where(eq(scheduledExpenses.spaceId, spaceId));
    const scheduledMinor = scheduled.reduce((s, g) => s + g.amountMinor, 0);
    const hasRequiredInputs = totals.incomeMinor > 0 || txns.length > 0;
    return c.json(
      computeSafeToSpend({
        incomeMinor: totals.incomeMinor,
        expenseMinor: totals.expenseMinor,
        plannedContributionMinor: planned,
        scheduledExpenseMinor: scheduledMinor,
        bufferMinor: 0,
        currency: space.currency,
        hasRequiredInputs,
      }),
    );
  });

  app.post('/spaces/:spaceId/members/invite', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'invite');
    if (!rateLimit(`invite:${userId}`, 20, 60_000)) {
      return c.json({ error: 'Rate limited' }, 429);
    }
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;
    const memberRows = await db()
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.spaceId, spaceId), isNull(memberships.deletedAt)));
    const pendingInvites = await db()
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.spaceId, spaceId), eq(invitations.status, 'pending')));
    // Count seats already taken (members + outstanding invites).
    const activeMembers = memberRows.length + pendingInvites.length;
    const decision = canInviteMember({
      plan: profile.plan as PlanId,
      personalSpaceCount: 1,
      totalSpaceCount: 1,
      usage: { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers },
      limits: defaultLimitsForPlan(profile.plan as PlanId),
    });
    if (!decision.ok) {
      return c.json({ error: decision.reason }, 402);
    }

    const body = await c.req.json<{ email: string; role?: string }>();
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) return c.json({ error: 'Valid email required' }, 400);
    const role = body.role ?? 'contributor';
    const allowedRoles = new Set(['admin', 'contributor', 'viewer', 'child']);
    if (!allowedRoles.has(role)) return c.json({ error: 'Invalid role' }, 400);

    const id = createId('inv');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    await db().insert(invitations).values({
      id,
      spaceId,
      email,
      role,
      invitedBy: userId,
      status: 'pending',
      expiresAt,
    });
    await db().insert(auditLog).values({
      id: createId('aud'),
      spaceId,
      actorId: userId,
      action: 'invite',
      entityType: 'invitation',
      entityId: id,
      afterSummary: `${email} as ${role}`,
    });
    return c.json(
      {
        id,
        email,
        role,
        expiresAt: expiresAt.toISOString(),
        acceptPath: `/invite/${id}`,
      },
      201,
    );
  });

  app.get('/invitations/:inviteId', async (c) => {
    const inviteId = c.req.param('inviteId');
    const row = (await db().select().from(invitations).where(eq(invitations.id, inviteId)).limit(1))[0];
    if (!row) return c.json({ error: 'Invite not found' }, 404);
    const space = (await db().select().from(spaces).where(eq(spaces.id, row.spaceId)).limit(1))[0];

    // Public GET: do not leak full invitee email unless the signed-in user matches.
    let revealEmail = false;
    const sessionUserId = await optionalSessionUserId(c);
    if (sessionUserId) {
      const profile = (await db().select().from(user).where(eq(user.id, sessionUserId)).limit(1))[0];
      if (profile && profile.email.toLowerCase() === row.email.toLowerCase()) {
        revealEmail = true;
      }
    }

    return c.json({
      id: row.id,
      email: revealEmail ? row.email : maskEmail(row.email),
      emailMasked: !revealEmail,
      role: row.role,
      status: row.status,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      space: space ? { id: space.id, name: space.name } : null,
    });
  });

  app.post('/invitations/:inviteId/accept', async (c) => {
    const userId = c.get('userId');
    const inviteId = c.req.param('inviteId');
    const row = (await db().select().from(invitations).where(eq(invitations.id, inviteId)).limit(1))[0];
    if (!row) return c.json({ error: 'Invite not found' }, 404);
    if (row.status !== 'pending') return c.json({ error: 'Invite is no longer pending' }, 409);
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      await db().update(invitations).set({ status: 'expired' }).where(eq(invitations.id, inviteId));
      return c.json({ error: 'Invite expired' }, 410);
    }

    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0];
    if (!profile) return c.json({ error: 'User not found' }, 404);
    if (profile.email.toLowerCase() !== row.email.toLowerCase()) {
      return c.json(
        { error: `Sign in as ${row.email} to accept this invite` },
        403,
      );
    }

    const existing = await db()
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.spaceId, row.spaceId),
          eq(memberships.userId, userId),
          isNull(memberships.deletedAt),
        ),
      )
      .limit(1);
    if (!existing.length) {
      await db().insert(memberships).values({
        id: createId('mem'),
        spaceId: row.spaceId,
        userId,
        role: row.role,
      });
    }
    await db().update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, inviteId));
    await db().insert(auditLog).values({
      id: createId('aud'),
      spaceId: row.spaceId,
      actorId: userId,
      action: 'invite_accepted',
      entityType: 'invitation',
      entityId: inviteId,
      afterSummary: `${profile.email} joined as ${row.role}`,
    });
    return c.json({ ok: true, spaceId: row.spaceId, role: row.role });
  });

  app.get('/spaces/:spaceId/invitations', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'invite');
    const rows = await db()
      .select()
      .from(invitations)
      .where(and(eq(invitations.spaceId, spaceId), eq(invitations.status, 'pending')))
      .orderBy(desc(invitations.createdAt));
    return c.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? null,
        acceptPath: `/invite/${r.id}`,
      })),
    );
  });

  app.get('/spaces/:spaceId/members', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requireMembership(userId, spaceId);
    const rows = await db()
      .select({
        membership: memberships,
        member: user,
      })
      .from(memberships)
      .innerJoin(user, eq(user.id, memberships.userId))
      .where(and(eq(memberships.spaceId, spaceId), isNull(memberships.deletedAt)));
    return c.json(
      rows.map((r) => ({
        id: r.membership.id,
        userId: r.member.id,
        name: r.member.name,
        email: r.member.email,
        role: r.membership.role,
      })),
    );
  });

  app.patch('/spaces/:spaceId/members/:memberId/role', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const memberId = c.req.param('memberId');
    await requirePermission(userId, spaceId, 'manage_members');
    const body = await c.req.json<{ role: string }>();
    if (!SPACE_ROLES.has(body.role as SpaceRole)) {
      return c.json(
        { error: 'role must be owner, admin, contributor, viewer, or child' },
        400,
      );
    }
    const existing = (
      await db()
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.id, memberId),
            eq(memberships.spaceId, spaceId),
            isNull(memberships.deletedAt),
          ),
        )
        .limit(1)
    )[0];
    if (!existing) return c.json({ error: 'Member not found' }, 404);
    await db()
      .update(memberships)
      .set({ role: body.role })
      .where(and(eq(memberships.id, memberId), eq(memberships.spaceId, spaceId)));
    return c.json({ ok: true, role: body.role });
  });

  app.delete('/spaces/:spaceId/members/:memberId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const memberId = c.req.param('memberId');
    await requirePermission(userId, spaceId, 'manage_members');
    await db()
      .update(memberships)
      .set({ deletedAt: new Date() })
      .where(and(eq(memberships.id, memberId), eq(memberships.spaceId, spaceId)));
    return c.json({ ok: true });
  });

  app.get('/spaces/:spaceId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const membership = await requireMembership(userId, spaceId);
    const space = (await db().select().from(spaces).where(eq(spaces.id, spaceId)).limit(1))[0];
    if (!space || space.deletedAt) return c.json({ error: 'Not found' }, 404);
    return c.json({ ...space, role: membership.role });
  });

  app.patch('/spaces/:spaceId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'manage_settings');
    const body = await c.req.json<{ name?: string; currency?: string; timezone?: string }>();
    await db()
      .update(spaces)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.currency !== undefined ? { currency: body.currency } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        updatedAt: new Date(),
      })
      .where(eq(spaces.id, spaceId));
    const row = (await db().select().from(spaces).where(eq(spaces.id, spaceId)).limit(1))[0];
    return c.json(row);
  });

  app.delete('/spaces/:spaceId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'manage_settings');
    await db().update(spaces).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(spaces.id, spaceId));
    return c.json({ ok: true });
  });

  app.get('/spaces/:spaceId/activity', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const membership = await requireMembership(userId, spaceId);
    const q = c.req.query('q');
    const type = c.req.query('type');
    const status = c.req.query('status');
    const currency = c.req.query('currency');
    const cursor = c.req.query('cursor');
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);

    const conditions = [eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)];
    if (type) conditions.push(eq(transactions.type, type));
    if (status) conditions.push(eq(transactions.status, status));
    if (currency) conditions.push(eq(transactions.currency, currency.toUpperCase()));
    if (q) conditions.push(ilike(transactions.description, `%${q}%`));
    if (cursor) {
      const cursorRow = (
        await db().select().from(transactions).where(eq(transactions.id, cursor)).limit(1)
      )[0];
      if (cursorRow) {
        conditions.push(
          or(
            lt(transactions.occurredAt, cursorRow.occurredAt),
            and(eq(transactions.occurredAt, cursorRow.occurredAt), lt(transactions.id, cursorRow.id)),
          )!,
        );
      }
    }

    const rows = await db()
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.occurredAt), desc(transactions.id))
      .limit(limit + 1);

    const visible = filterVisibleEntries(membership.role as SpaceRole, userId, rows as TxnRow[]);
    const page = visible.slice(0, limit);
    return c.json({
      items: page,
      nextCursor: visible.length > limit ? page[page.length - 1]?.id ?? null : null,
    });
  });

  app.post('/spaces/:spaceId/attachments/upload-url', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'create');
    const body = await c.req.json<{
      contentType: string;
      filename?: string;
      transactionId?: string;
    }>();
    const id = createId('att');
    const storageKey = `${spaceId}/${id}/${body.filename ?? 'upload'}`;
    const command = new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: storageKey,
      ContentType: body.contentType,
    });
    const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: 900 });
    await db().insert(attachments).values({
      id,
      spaceId,
      transactionId: body.transactionId ?? null,
      storageKey,
      contentType: body.contentType,
      createdBy: userId,
    });
    return c.json({ attachmentId: id, storageKey, uploadUrl }, 201);
  });

  app.patch('/spaces/:spaceId/goals/:goalId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const goalId = c.req.param('goalId');
    await requirePermission(userId, spaceId, 'edit_own');
    const body = await c.req.json<{
      name?: string;
      targetMinor?: number;
      savedMinor?: number;
      plannedContributionMinor?: number;
      status?: string;
      notificationPolicy?: string;
    }>();
    await db()
      .update(goals)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.targetMinor !== undefined ? { targetMinor: body.targetMinor } : {}),
        ...(body.savedMinor !== undefined ? { savedMinor: body.savedMinor } : {}),
        ...(body.plannedContributionMinor !== undefined
          ? { plannedContributionMinor: body.plannedContributionMinor }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notificationPolicy !== undefined
          ? { notificationPolicy: body.notificationPolicy }
          : {}),
      })
      .where(and(eq(goals.id, goalId), eq(goals.spaceId, spaceId)));
    const row = (await db().select().from(goals).where(eq(goals.id, goalId)).limit(1))[0];
    return c.json(row);
  });

  app.delete('/spaces/:spaceId/goals/:goalId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const goalId = c.req.param('goalId');
    await requirePermission(userId, spaceId, 'delete_own');
    await db()
      .update(goals)
      .set({ deletedAt: new Date() })
      .where(and(eq(goals.id, goalId), eq(goals.spaceId, spaceId)));
    return c.json({ ok: true });
  });

  app.patch('/spaces/:spaceId/transactions/:txnId', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const txnId = c.req.param('txnId');
    const membership = await requireMembership(userId, spaceId);
    const row = (
      await db().select().from(transactions).where(eq(transactions.id, txnId)).limit(1)
    )[0];
    if (!row || row.spaceId !== spaceId) return c.json({ error: 'Not found' }, 404);
    if (row.createdBy === userId) await requirePermission(userId, spaceId, 'edit_own');
    else await requirePermission(userId, spaceId, 'edit_all');
    const body = await c.req.json<{
      amountMinor?: number;
      description?: string | null;
      categoryId?: string | null;
      type?: string;
    }>();
    await db()
      .update(transactions)
      .set({
        ...(body.amountMinor !== undefined ? { amountMinor: body.amountMinor } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, txnId));
    void membership;
    const updated = (
      await db().select().from(transactions).where(eq(transactions.id, txnId)).limit(1)
    )[0];
    return c.json(updated);
  });

  app.post('/spaces/:spaceId/exports', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'export');
    if (!rateLimit(`export:${userId}`, 10, 60_000)) {
      return c.json({ error: 'Rate limited' }, 429);
    }
    const body = await c.req.json<{ format: 'csv' | 'xlsx' | 'pdf' }>();
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;

    // PDF/XLSX enqueue a job that records metadata only (no file bytes / download URL yet).
    // Web ExportDialog intentionally uses client-side CSV and does not poll these jobs.
    if (body.format === 'pdf' || body.format === 'xlsx') {
      const decision = canUseFeature(
        {
          plan: profile.plan as PlanId,
          personalSpaceCount: 1,
          totalSpaceCount: 1,
          usage: { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers: 1 },
          limits: defaultLimitsForPlan(profile.plan as PlanId),
        },
        body.format === 'pdf' ? 'pdf_export' : 'basic_reports',
      );
      if (body.format === 'pdf' && !decision.ok) {
        return c.json({ error: decision.reason }, 402);
      }
      const jobId = createId('job');
      await db().insert(jobs).values({
        id: jobId,
        type: body.format === 'pdf' ? 'export_pdf' : 'export_xlsx',
        status: 'queued',
        spaceId,
        userId,
        payload: { format: body.format },
        idempotencyKey: createIdempotencyKey(),
      });
      return c.json(
        {
          jobId,
          status: 'queued',
          bytesAvailable: false,
          message: 'Export job queued; file bytes are not produced yet. Use CSV for downloads.',
        },
        202,
      );
    }

    // CSV sync — apply child visibility filter (same as list endpoints)
    const membership = await requireMembership(userId, spaceId);
    const allRows = await db()
      .select()
      .from(transactions)
      .where(and(eq(transactions.spaceId, spaceId), isNull(transactions.deletedAt)));
    const rows = filterVisibleEntries(membership.role as SpaceRole, userId, allRows as TxnRow[]);
    // One ISO column (occurred_at) — keep header in sync with row shape
    const header =
      'id,occurred_at,type,amount_minor,currency,category,description,creator,source,status';
    const lines = rows.map(
      (r) =>
        `${r.id},${r.occurredAt.toISOString()},${r.type},${r.amountMinor},${r.currency},${r.categoryId ?? ''},${JSON.stringify(r.description ?? '')},${r.createdBy},${r.source},${r.status}`,
    );
    return c.text([header, ...lines].join('\n'), 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="clear-money-${spaceId}.csv"`,
    });
  });

  app.get('/jobs/:jobId', async (c) => {
    const userId = c.get('userId');
    const jobId = c.req.param('jobId');
    const row = (await db().select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
    if (!row || row.userId !== userId) return c.json({ error: 'Not found' }, 404);
    return c.json(row);
  });

  app.post('/ai/voice-draft', async (c) => {
    const userId = c.get('userId');
    if (!rateLimit(`ai:${userId}`, 30, 60_000)) return c.json({ error: 'Rate limited' }, 429);
    const body = await c.req.json<{ spaceId: string; transcript: string }>();
    await requirePermission(userId, body.spaceId, 'create');
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;
    const usage = await getUsageForUser(userId);
    const decision = canUseFeature(entitlementCtx(profile.plan as PlanId, usage), 'penny_chat');
    if (!decision.ok) return c.json({ error: decision.reason }, 402);
    await consumePennyCredit(userId);
    return c.json({
      draft: true,
      requiresConfirmation: true,
      type: 'expense',
      amountMinor: 0,
      currency: 'USD',
      description: body.transcript,
      source: 'voice',
      label: 'AI generated — confirm before saving',
    });
  });

  app.get('/ai/usage', async (c) => {
    const userId = c.get('userId');
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0];
    if (!profile) return c.json({ error: 'User not found' }, 404);
    const usage = await getUsageForUser(userId);
    const limits = defaultLimitsForPlan(profile.plan as PlanId);
    const used = usage.aiRequests;
    return c.json({
      plan: profile.plan,
      used,
      limit: limits.aiRequests,
      remaining: Math.max(0, limits.aiRequests - used),
    });
  });

  app.post('/ai/penny/consume', async (c) => {
    const userId = c.get('userId');
    if (!rateLimit(`penny:${userId}`, 60, 60_000)) return c.json({ error: 'Rate limited' }, 429);
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0];
    if (!profile) return c.json({ error: 'User not found' }, 404);
    const usage = await getUsageForUser(userId);
    const ctx = entitlementCtx(profile.plan as PlanId, usage);
    const decision = canUseFeature(ctx, 'penny_chat');
    if (!decision.ok) return c.json({ error: decision.reason }, 402);
    const next = await consumePennyCredit(userId);
    const limits = defaultLimitsForPlan(profile.plan as PlanId);
    return c.json({
      ok: true,
      used: next,
      limit: limits.aiRequests,
      remaining: Math.max(0, limits.aiRequests - next),
      plan: profile.plan,
    });
  });

  /** Persist Penny turns (text only) for abuse control and behavior tracking. */
  app.post('/ai/penny/log', async (c) => {
    const userId = c.get('userId');
    if (!rateLimit(`penny-log:${userId}`, 120, 60_000)) return c.json({ error: 'Rate limited' }, 429);
    const body = await c.req.json<{
      turns?: Array<{
        role: 'user' | 'assistant';
        content: string;
        source?: 'text' | 'voice';
        locale?: string;
        model?: string;
        latencyMs?: number;
        status?: 'ok' | 'error' | 'blocked';
        errorCode?: string;
        flags?: Record<string, unknown>;
      }>;
      spaceId?: string | null;
      sessionId?: string;
    }>();

    const turns = Array.isArray(body.turns) ? body.turns : [];
    if (!turns.length) return c.json({ error: 'turns required' }, 400);
    if (turns.length > 8) return c.json({ error: 'Too many turns' }, 400);

    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim().slice(0, 80)
        : createId('psess');
    const spaceId =
      typeof body.spaceId === 'string' && body.spaceId.trim() ? body.spaceId.trim() : null;
    if (spaceId) {
      try {
        await requireMembership(userId, spaceId);
      } catch {
        return c.json({ error: 'Not a member of this space' }, 403);
      }
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const inserted: string[] = [];

    for (const turn of turns) {
      if (turn.role !== 'user' && turn.role !== 'assistant') continue;
      const raw = typeof turn.content === 'string' ? turn.content : '';
      const tooLong = raw.length > 4000;
      const content = raw.slice(0, 4000);
      if (!content.trim() && turn.role === 'user') continue;

      const flags: Record<string, unknown> = { ...(turn.flags ?? {}) };
      if (tooLong) flags.too_long = true;

      if (turn.role === 'user' && content.trim()) {
        const recentSame = await db()
          .select({ id: pennyTurns.id })
          .from(pennyTurns)
          .where(
            and(
              eq(pennyTurns.userId, userId),
              eq(pennyTurns.role, 'user'),
              eq(pennyTurns.content, content),
              gte(pennyTurns.createdAt, hourAgo),
            ),
          )
          .limit(5);
        if (recentSame.length >= 3) flags.repeated = true;
      }

      const id = createId('pturn');
      await db().insert(pennyTurns).values({
        id,
        userId,
        spaceId,
        sessionId,
        role: turn.role,
        content: content || '(empty)',
        source: turn.source === 'voice' ? 'voice' : 'text',
        locale: turn.locale?.slice(0, 16) ?? null,
        model: turn.model?.slice(0, 120) ?? null,
        latencyMs: typeof turn.latencyMs === 'number' ? Math.round(turn.latencyMs) : null,
        status: turn.status === 'error' || turn.status === 'blocked' ? turn.status : 'ok',
        errorCode: turn.errorCode?.slice(0, 80) ?? null,
        flags,
      });
      inserted.push(id);
    }

    return c.json({ ok: true, ids: inserted, sessionId }, 201);
  });

  app.get('/ai/penny/turns', async (c) => {
    const userId = c.get('userId');
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit') ?? 10) || 10));
    const beforeRaw = c.req.query('before');
    const conditions = [eq(pennyTurns.userId, userId)];
    if (beforeRaw) {
      const beforeDate = new Date(beforeRaw);
      if (!Number.isNaN(beforeDate.getTime())) {
        conditions.push(lt(pennyTurns.createdAt, beforeDate));
      }
    }
    const rows = await db()
      .select({
        id: pennyTurns.id,
        spaceId: pennyTurns.spaceId,
        sessionId: pennyTurns.sessionId,
        role: pennyTurns.role,
        content: pennyTurns.content,
        source: pennyTurns.source,
        locale: pennyTurns.locale,
        status: pennyTurns.status,
        flags: pennyTurns.flags,
        createdAt: pennyTurns.createdAt,
      })
      .from(pennyTurns)
      .where(and(...conditions))
      .orderBy(desc(pennyTurns.createdAt))
      .limit(limit);
    return c.json({
      turns: rows,
      hasMore: rows.length >= limit,
      nextBefore: rows.length
        ? new Date(rows[rows.length - 1]!.createdAt).toISOString()
        : null,
    });
  });

  app.post('/ai/receipt-draft', async (c) => {
    const userId = c.get('userId');
    if (!rateLimit(`ocr:${userId}`, 20, 60_000)) return c.json({ error: 'Rate limited' }, 429);
    const body = await c.req.json<{ spaceId: string; storageKey: string }>();
    await requirePermission(userId, body.spaceId, 'create');
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;
    const usage = (
      await db().select().from(usageCounters).where(eq(usageCounters.userId, userId)).limit(1)
    )[0];
    const decision = canUseFeature(
      {
        plan: profile.plan as PlanId,
        personalSpaceCount: 1,
        totalSpaceCount: 1,
        usage: {
          receiptScans: usage?.receiptScans ?? 0,
          aiRequests: usage?.aiRequests ?? 0,
          generatedReports: usage?.generatedReports ?? 0,
          activeMembers: usage?.activeMembers ?? 1,
        },
        limits: defaultLimitsForPlan(profile.plan as PlanId),
      },
      'receipt_scanning',
    );
    if (!decision.ok) return c.json({ error: decision.reason }, 402);

    const jobId = createId('job');
    await db().insert(jobs).values({
      id: jobId,
      type: 'ocr_receipt',
      status: 'queued',
      spaceId: body.spaceId,
      userId,
      payload: { storageKey: body.storageKey },
    });
    return c.json({
      jobId,
      draft: true,
      requiresConfirmation: true,
      fields: {
        amountMinor: { value: 0, confidence: 0 },
        merchant: { value: '', confidence: 0 },
      },
      label: 'AI generated — confirm before saving',
    });
  });

  app.post('/ai/monthly-report', async (c) => {
    const userId = c.get('userId');
    if (!rateLimit(`ai:${userId}`, 30, 60_000)) return c.json({ error: 'Rate limited' }, 429);
    const body = await c.req.json<{ spaceId: string; period: string }>();
    await requireMembership(userId, body.spaceId);
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;
    const usage = (
      await db().select().from(usageCounters).where(eq(usageCounters.userId, userId)).limit(1)
    )[0];
    const decision = canUseFeature(
      {
        plan: profile.plan as PlanId,
        personalSpaceCount: 1,
        totalSpaceCount: 1,
        usage: {
          receiptScans: usage?.receiptScans ?? 0,
          aiRequests: usage?.aiRequests ?? 0,
          generatedReports: usage?.generatedReports ?? 0,
          activeMembers: usage?.activeMembers ?? 1,
        },
        limits: defaultLimitsForPlan(profile.plan as PlanId),
      },
      'ai_monthly_report',
    );
    if (!decision.ok) return c.json({ error: decision.reason }, 402);
    const jobId = createId('job');
    await db().insert(jobs).values({
      id: jobId,
      type: 'ai_monthly_report',
      status: 'queued',
      spaceId: body.spaceId,
      userId,
      payload: { period: body.period },
    });
    return c.json({ jobId, status: 'queued', label: 'AI generated' }, 202);
  });

  app.get('/billing/config', (c) => c.json(billingPublicConfig()));

  app.get('/billing/subscription', async (c) => {
    const userId = c.get('userId');
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0];
    const subs = await db()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(5);
    const active = subs.find((s) => s.status === 'active' || s.status === 'trialing') ?? null;
    return c.json({
      plan: (profile?.plan as PlanId) || 'free',
      subscription: active,
      history: subs,
      billing: billingPublicConfig(),
      canManageLocally: config.appEnv !== 'production' || billingPublicConfig().billingMode === 'free',
    });
  });

  app.post('/billing/subscribe', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ plan?: PlanId }>().catch(() => ({ plan: 'free' as PlanId }));
    const plan = (body.plan || 'free') as PlanId;
    if (plan !== 'free' && plan !== 'plus') {
      return c.json({ error: 'Only free and plus are available in local billing mode' }, 400);
    }
    if (plan === 'plus' && config.appEnv === 'production' && !config.stripeSecretKey) {
      return c.json({ error: 'Plus requires Stripe in production' }, 400);
    }

    const existing = await db()
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .limit(1);
    if (existing[0]) {
      await db()
        .update(subscriptions)
        .set({ status: 'canceled' })
        .where(eq(subscriptions.id, existing[0].id));
    }

    const customers = await db()
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);
    if (!customers[0]) {
      await db().insert(billingCustomers).values({
        id: createId('bill'),
        userId,
      });
    }

    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    const subId = createId('sub');
    await db().insert(subscriptions).values({
      id: subId,
      userId,
      plan,
      status: 'active',
      currentPeriodEnd: periodEnd,
    });
    await db().update(user).set({ plan, updatedAt: new Date() }).where(eq(user.id, userId));

    return c.json({
      ok: true,
      plan,
      subscriptionId: subId,
      status: 'active',
      message: plan === 'free' ? 'Free plan activated' : 'Plus plan activated (local test)',
    });
  });

  app.post('/billing/cancel', async (c) => {
    const userId = c.get('userId');
    const active = await db()
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .limit(1);

    if (active[0]) {
      await db()
        .update(subscriptions)
        .set({ status: 'canceled' })
        .where(eq(subscriptions.id, active[0].id));
    }

    await db().update(user).set({ plan: 'free', updatedAt: new Date() }).where(eq(user.id, userId));

    return c.json({
      ok: true,
      plan: 'free',
      canceledSubscriptionId: active[0]?.id ?? null,
      message: 'Subscription canceled. You are on Free.',
    });
  });

  app.post('/billing/checkout', async (c) => {
    const cfg = billingPublicConfig();
    if (!cfg.showPaymentUi) {
      // Local / free mode: activate Plus without Stripe for demos
      if (config.appEnv !== 'production') {
        return c.json({
          stub: true,
          useLocalSubscribe: true,
          message: 'Use POST /billing/subscribe with plan plus for local demos',
        });
      }
      return c.json({ error: 'Billing disabled in this environment' }, 400);
    }
    if (config.appEnv === 'production' && process.env.BILLING_MODE === 'sandbox') {
      return c.json({ error: 'Sandbox credentials cannot be used in production' }, 400);
    }
    if (!config.stripeSecretKey) {
      return c.json({
        stub: true,
        url: `${config.webUrl}/billing/stub-checkout`,
        message: 'Checkout stub — set STRIPE_SECRET_KEY for live sessions',
      });
    }
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(config.stripeSecretKey);
    const userId = c.get('userId');
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0];
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      success_url: `${config.webUrl}/billing/success`,
      cancel_url: `${config.webUrl}/billing/cancel`,
      customer_email: profile?.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(Number(process.env.PLAN_PLUS_MONTHLY_PRICE ?? 4.99) * 100),
            recurring: { interval: 'month' },
            product_data: { name: 'Clear Money Plus' },
          },
        },
      ],
    });
    return c.json({ url: session.url, sessionId: session.id });
  });

  app.post('/billing/webhook', async (c) => {
    // Stripe webhook stub — verifies mode, never trusts client entitlements
    const mode = process.env.BILLING_MODE;
    if (mode === 'live' && config.appEnv !== 'production') {
      return c.json({ error: 'Live webhooks only in production' }, 400);
    }
    return c.json({ received: true });
  });

  app.get('/account/export', async (c) => {
    const userId = c.get('userId');
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0];
    const mine = await db()
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId));
    return c.json({ profile, memberships: mine, exportedAt: new Date().toISOString() });
  });

  app.post('/account/delete', async (c) => {
    const userId = c.get('userId');
    await db()
      .update(user)
      .set({ deletedAt: new Date(), email: `deleted+${userId}@clearmoney.invalid`, name: 'Deleted' })
      .where(eq(user.id, userId));
    return c.json({ ok: true });
  });

  app.onError((err, c) => {
    const status = (err as Error & { status?: number }).status ?? 500;
    return c.json({ error: err.message }, status as 400);
  });

  return app;
}

async function authMiddleware(
  c: import('hono').Context<{ Variables: Variables }>,
  next: () => Promise<void>,
) {
  // Prefer real session cookies when present (multi-user friend demos).
  try {
    const session = await getAuth().api.getSession({ headers: c.req.raw.headers });
    if (session?.user?.id) {
      c.set('userId', session.user.id);
      await next();
      return;
    }
  } catch {
    /* fall through */
  }

  // Dev-only impersonation. Hard-off when APP_ENV=production (no env escape hatch).
  if (config.appEnv !== 'production') {
    const devUser = c.req.header('x-user-id');
    if (devUser) {
      c.set('userId', devUser);
      await next();
      return;
    }
  }

  return c.json({ error: 'Unauthorized' }, 401);
}

type UsageRow = {
  receiptScans: number;
  aiRequests: number;
  generatedReports: number;
  activeMembers: number;
  updatedAt?: Date;
};

function entitlementCtx(plan: PlanId, usage: UsageRow) {
  return {
    plan,
    personalSpaceCount: 1,
    totalSpaceCount: 1,
    usage: {
      receiptScans: usage.receiptScans,
      aiRequests: usage.aiRequests,
      generatedReports: usage.generatedReports,
      activeMembers: usage.activeMembers,
    },
    limits: defaultLimitsForPlan(plan),
  };
}

function sameUtcMonth(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

async function getUsageForUser(userId: string): Promise<UsageRow> {
  const row = (
    await db().select().from(usageCounters).where(eq(usageCounters.userId, userId)).limit(1)
  )[0];
  if (!row) {
    return { receiptScans: 0, aiRequests: 0, generatedReports: 0, activeMembers: 1 };
  }
  const now = new Date();
  if (row.updatedAt && !sameUtcMonth(row.updatedAt, now) && row.aiRequests > 0) {
    await db()
      .update(usageCounters)
      .set({ aiRequests: 0, updatedAt: now })
      .where(eq(usageCounters.userId, userId));
    return {
      receiptScans: row.receiptScans,
      aiRequests: 0,
      generatedReports: row.generatedReports,
      activeMembers: row.activeMembers,
      updatedAt: now,
    };
  }
  return {
    receiptScans: row.receiptScans,
    aiRequests: row.aiRequests,
    generatedReports: row.generatedReports,
    activeMembers: row.activeMembers,
    updatedAt: row.updatedAt,
  };
}

async function consumePennyCredit(userId: string): Promise<number> {
  const usage = await getUsageForUser(userId);
  const next = usage.aiRequests + 1;
  const existing = (
    await db().select().from(usageCounters).where(eq(usageCounters.userId, userId)).limit(1)
  )[0];
  if (!existing) {
    await db().insert(usageCounters).values({
      id: createId('user'),
      userId,
      aiRequests: next,
      updatedAt: new Date(),
    });
  } else {
    await db()
      .update(usageCounters)
      .set({ aiRequests: next, updatedAt: new Date() })
      .where(eq(usageCounters.userId, userId));
  }
  return next;
}

// silence unused sql import warning by referencing
void sql;
