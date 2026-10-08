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
  defaultCategoryRows,
  maxActiveGoalsForPlan,
  requiresConfirmation,
  filterVisibleEntries,
  addMonthsToIsoDate,
  monthlyTargetMinor,
  evaluateGoalPace,
  clampDayOfMonth,
  computeNextDueAt,
  type Goal,
  type PlanId,
  type SpaceRole,
  type LedgerTransaction,
  type RecurringKind,
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
  postDueRecurring,
} from '@clear-money/db';
import { billingPublicConfig, config } from './config.js';
import { getAuth } from './auth.js';
import { db, requireMembership, requirePermission } from './db.js';
import { rateLimit } from './rate-limit.js';
import { maskEmail } from './mask-email.js';
import { gateBillingWebhook } from './billing-webhook.js';
import { publicInternalError, sanitizeJobError } from './public-errors.js';

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
  app.get('/public/auth-config', (c) =>
    c.json({
      googleEnabled: Boolean(config.googleClientId && config.googleClientSecret),
    }),
  );

  /**
   * Native Google OAuth start (system browser).
   * Sets Better Auth state cookies in THIS browser jar, then 302 → Google.
   * Query: `to` = deep link (penny://… / clearmoney://… / exp://…), optional `migrate=1`.
   */
  app.get('/public/mobile-google-oauth', async (c) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      return c.json({ error: 'Google sign-in unavailable' }, 503);
    }
    const to = c.req.query('to')?.trim() || '';
    if (
      !to.startsWith('penny://') &&
      !to.startsWith('clearmoney://') &&
      !to.startsWith('exp://') &&
      !to.startsWith('exps://')
    ) {
      return c.json({ error: 'Invalid deep link' }, 400);
    }
    const migrate = c.req.query('migrate') === '1';

    let publicOrigin: string;
    try {
      publicOrigin = new URL(config.authUrl).origin;
    } catch {
      publicOrigin = config.webUrl.replace(/\/$/, '');
    }
    const done = new URL(`${publicOrigin}/cm-api/public/mobile-google-done`);
    done.searchParams.set('to', to);
    if (migrate) done.searchParams.set('migrate', '1');

    const auth = getAuth();
    const upstream = await auth.handler(
      new Request(`${publicOrigin}/cm-api/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: publicOrigin,
        },
        body: JSON.stringify({
          provider: 'google',
          callbackURL: done.toString(),
        }),
      }),
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return c.json(
        { error: 'Google sign-in unavailable', detail: detail.slice(0, 200) },
        502,
      );
    }

    let data: { url?: string };
    try {
      data = (await upstream.json()) as { url?: string };
    } catch {
      return c.json({ error: 'Invalid auth response' }, 502);
    }
    if (!data.url) return c.json({ error: 'Google sign-in unavailable' }, 502);

    let google: URL;
    try {
      google = new URL(data.url);
    } catch {
      return c.json({ error: 'Invalid Google URL' }, 502);
    }
    if (
      google.hostname !== 'accounts.google.com' &&
      !google.hostname.endsWith('.google.com')
    ) {
      return c.json({ error: 'Non-Google OAuth URL rejected' }, 502);
    }

    const headers = new Headers();
    headers.set('Location', google.toString());
    const setCookies =
      typeof upstream.headers.getSetCookie === 'function'
        ? upstream.headers.getSetCookie()
        : [];
    if (setCookies.length > 0) {
      for (const cookie of setCookies) headers.append('Set-Cookie', cookie);
    } else {
      const single = upstream.headers.get('set-cookie');
      if (single) headers.append('Set-Cookie', single);
    }
    return new Response(null, { status: 302, headers });
  });

  /** After Google → Better Auth: hand session cookie to the native deep link. */
  app.get('/public/mobile-google-done', (c) => {
    const to = c.req.query('to')?.trim() || 'penny://auth/callback';
    if (
      !to.startsWith('penny://') &&
      !to.startsWith('clearmoney://') &&
      !to.startsWith('exp://') &&
      !to.startsWith('exps://')
    ) {
      return c.html(
        `<!doctype html><html><body><p>Invalid return link.</p></body></html>`,
        400,
      );
    }

    const rawCookie = c.req.header('cookie') || '';
    const secureMatch = rawCookie.match(
      /(?:^|;\s*)__Secure-better-auth\.session_token=([^;]+)/,
    );
    const plainMatch = rawCookie.match(
      /(?:^|;\s*)better-auth\.session_token=([^;]+)/,
    );
    const token = secureMatch?.[1] || plainMatch?.[1];
    const cookieName = secureMatch
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token';

    if (!token) {
      return c.html(
        `<!doctype html><html><body style="font-family:system-ui;padding:2rem;text-align:center">
          <p><strong>Sign-in did not finish</strong></p>
          <p>No session cookie was found. Close this tab and try again from the app.</p>
        </body></html>`,
        401,
      );
    }

    const base = to.split('?')[0] || to;
    const qs = new URLSearchParams();
    qs.set('session', `${cookieName}=${decodeURIComponent(token)}`);
    if (c.req.query('migrate') === '1') qs.set('migrate', '1');
    const href = `${base}?${qs.toString()}`;

    return c.html(`<!doctype html><html><head><meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <title>Opening Penny</title></head>
      <body style="font-family:system-ui;padding:2rem;text-align:center;background:#F7F8FA;color:#111">
        <p style="font-size:1.125rem;font-weight:600">Opening Penny…</p>
        <p style="color:#666;font-size:0.875rem">You can close this tab after the app opens.</p>
        <p style="margin-top:1.5rem"><a href="${href.replace(/"/g, '&quot;')}"
          style="display:inline-block;background:#1EC569;color:#fff;padding:0.6rem 1rem;border-radius:10px;text-decoration:none;font-weight:600">Open app</a></p>
        <script>try{location.replace(${JSON.stringify(href)})}catch(e){}
        setTimeout(function(){try{location.href=${JSON.stringify(href)}}catch(e){}},400);</script>
      </body></html>`);
  });

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
            'daily_log_reminder',
            'weekly_review',
            'month_end_report',
            'subscription_due',
            'salary_due',
            'savings_goal',
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

    // Ensure global default catalog exists (idempotent by stableKey).
    const existingDefaults = await db()
      .select()
      .from(categories)
      .where(isNull(categories.spaceId));
    const have = new Set(existingDefaults.map((r) => r.stableKey));
    const missing = defaultCategoryRows().filter((row) => !have.has(row.stableKey));
    if (missing.length) {
      await db().insert(categories).values(
        missing.map((row) => ({
          id: row.id,
          spaceId: null,
          stableKey: row.stableKey,
          name: row.name,
          type: row.type,
        })),
      );
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
    // Custom categories are always space-scoped so they stay personal to that space.
    const spaceId = body.spaceId?.trim() || null;
    if (!spaceId) return c.json({ error: 'spaceId is required for custom categories' }, 400);
    await requirePermission(userId, spaceId, 'create');
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
    return c.json({ id, name, type: body.type, spaceId, stableKey }, 201);
  });

  app.patch('/categories/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const row = (await db().select().from(categories).where(eq(categories.id, id)).limit(1))[0];
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.spaceId) await requirePermission(userId, row.spaceId, 'create');
    const body = await c.req.json<{ name?: string }>();
    const name = body.name?.trim();
    if (!name) return c.json({ error: 'Name required' }, 400);
    const stableKey = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || 'cat'}_${id.slice(-6)}`;
    await db()
      .update(categories)
      .set({ name, stableKey })
      .where(eq(categories.id, id));
    return c.json({ id, name, type: row.type, spaceId: row.spaceId });
  });

  app.delete('/categories/:id', async (c) => {
    const userId = c.get('userId');
    const id = c.req.param('id');
    const row = (await db().select().from(categories).where(eq(categories.id, id)).limit(1))[0];
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.spaceId) await requirePermission(userId, row.spaceId, 'create');
    // Detach transactions so FK does not block the delete.
    await db()
      .update(transactions)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(eq(transactions.categoryId, id));
    await db().delete(categories).where(eq(categories.id, id));
    return c.json({ ok: true, id });
  });

  app.post('/spaces', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json<{ name: string; type: string; currency?: string }>();
    const allowedSpaceTypes = new Set([
      'personal',
      'household',
      'shared',
      'project',
      'family',
      'company',
    ]);
    if (!body.name?.trim()) {
      return c.json({ error: 'name is required' }, 400);
    }
    if (!allowedSpaceTypes.has(body.type)) {
      return c.json(
        { error: 'type must be personal, household, shared, project, family, or company' },
        400,
      );
    }
    const profile = (await db().select().from(user).where(eq(user.id, userId)).limit(1))[0]!;
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
      targetDate?: string;
      startDate?: string;
      durationMonths?: number;
      plannedContributionMinor?: number;
    }>();
    const durationMonths =
      body.durationMonths !== undefined && body.durationMonths >= 1
        ? Math.floor(body.durationMonths)
        : 1;
    const startDate = body.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const targetDate =
      body.targetDate?.slice(0, 10) ?? addMonthsToIsoDate(startDate, durationMonths);
    const plannedContributionMinor =
      body.plannedContributionMinor !== undefined && body.plannedContributionMinor > 0
        ? body.plannedContributionMinor
        : monthlyTargetMinor({
            targetMinor: body.targetMinor,
            durationMonths,
            plannedContributionMinor: 0,
          });
    const id = createId('goal');
    await db().insert(goals).values({
      id,
      spaceId,
      name: body.name,
      targetMinor: body.targetMinor,
      savedMinor: 0,
      currency: body.currency,
      startDate,
      durationMonths,
      targetDate,
      plannedContributionMinor,
      paceStatus: 'on_track',
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
      .where(
        and(
          eq(scheduledExpenses.spaceId, spaceId),
          eq(scheduledExpenses.active, true),
          eq(scheduledExpenses.kind, 'expense'),
        ),
      );
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

  app.get('/spaces/:spaceId/recurring', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requireMembership(userId, spaceId);
    const includeInactive = c.req.query('includeInactive') === '1';
    const conditions = [eq(scheduledExpenses.spaceId, spaceId)];
    if (!includeInactive) conditions.push(eq(scheduledExpenses.active, true));
    const rows = await db()
      .select()
      .from(scheduledExpenses)
      .where(and(...conditions))
      .orderBy(desc(scheduledExpenses.createdAt));
    return c.json(rows);
  });

  app.post('/spaces/:spaceId/recurring', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'create');
    const body = await c.req.json<{
      name: string;
      amountMinor: number;
      currency?: string;
      kind: RecurringKind;
      dayOfMonth: number;
      notifyHoursBefore?: number;
    }>();

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ error: 'name is required' }, 400);
    }
    if (!Number.isFinite(body.amountMinor) || body.amountMinor <= 0) {
      return c.json({ error: 'amountMinor must be a positive integer' }, 400);
    }
    if (body.kind !== 'income' && body.kind !== 'expense') {
      return c.json({ error: 'kind must be income or expense' }, 400);
    }
    if (!Number.isFinite(body.dayOfMonth) || body.dayOfMonth !== Math.trunc(body.dayOfMonth) || body.dayOfMonth < 1 || body.dayOfMonth > 28) {
      return c.json({ error: 'dayOfMonth must be 1..28' }, 400);
    }
    const dayOfMonth = clampDayOfMonth(body.dayOfMonth);

    const spaceRow = (
      await db().select().from(spaces).where(eq(spaces.id, spaceId)).limit(1)
    )[0];
    if (!spaceRow) return c.json({ error: 'Space not found' }, 404);
    const currency = body.currency ?? spaceRow.currency;
    if (currency !== spaceRow.currency) {
      return c.json(
        { error: `currency must match space currency (${spaceRow.currency})` },
        400,
      );
    }

    const id = createId('sched');
    const nextDueAt = computeNextDueAt(dayOfMonth);
    await db().insert(scheduledExpenses).values({
      id,
      spaceId,
      name: body.name.trim(),
      amountMinor: Math.trunc(body.amountMinor),
      currency,
      kind: body.kind,
      dayOfMonth,
      nextDueAt,
      active: true,
      notifyHoursBefore:
        body.notifyHoursBefore !== undefined && Number.isFinite(body.notifyHoursBefore)
          ? Math.max(0, Math.trunc(body.notifyHoursBefore))
          : 24,
      createdBy: userId,
    });
    const row = (
      await db().select().from(scheduledExpenses).where(eq(scheduledExpenses.id, id)).limit(1)
    )[0]!;
    return c.json(row, 201);
  });

  /** Manual test: post due recurring items for this space now. */
  app.post('/spaces/:spaceId/recurring/tick', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    await requirePermission(userId, spaceId, 'create');
    const result = await postDueRecurring(db(), {
      spaceId,
      actorUserId: userId,
      now: new Date(),
    });
    return c.json(result);
  });

  app.patch('/spaces/:spaceId/recurring/:id', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const id = c.req.param('id');
    const row = (
      await db()
        .select()
        .from(scheduledExpenses)
        .where(and(eq(scheduledExpenses.id, id), eq(scheduledExpenses.spaceId, spaceId)))
        .limit(1)
    )[0];
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.createdBy === userId) await requirePermission(userId, spaceId, 'edit_own');
    else await requirePermission(userId, spaceId, 'edit_all');

    const body = await c.req.json<{
      name?: string;
      amountMinor?: number;
      kind?: RecurringKind;
      dayOfMonth?: number;
      active?: boolean;
      notifyHoursBefore?: number;
    }>();

    const patch: Partial<typeof scheduledExpenses.$inferInsert> = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) return c.json({ error: 'name is required' }, 400);
      patch.name = body.name.trim();
    }
    if (body.amountMinor !== undefined) {
      if (!Number.isFinite(body.amountMinor) || body.amountMinor <= 0) {
        return c.json({ error: 'amountMinor must be a positive integer' }, 400);
      }
      patch.amountMinor = Math.trunc(body.amountMinor);
    }
    if (body.kind !== undefined) {
      if (body.kind !== 'income' && body.kind !== 'expense') {
        return c.json({ error: 'kind must be income or expense' }, 400);
      }
      patch.kind = body.kind;
    }
    if (body.dayOfMonth !== undefined) {
      if (
        !Number.isFinite(body.dayOfMonth) ||
        body.dayOfMonth < 1 ||
        body.dayOfMonth > 28 ||
        body.dayOfMonth !== Math.trunc(body.dayOfMonth)
      ) {
        return c.json({ error: 'dayOfMonth must be 1..28' }, 400);
      }
      const dayOfMonth = clampDayOfMonth(body.dayOfMonth);
      patch.dayOfMonth = dayOfMonth;
      patch.nextDueAt = computeNextDueAt(dayOfMonth);
    }
    if (body.active !== undefined) patch.active = Boolean(body.active);
    if (body.notifyHoursBefore !== undefined) {
      if (!Number.isFinite(body.notifyHoursBefore) || body.notifyHoursBefore < 0) {
        return c.json({ error: 'notifyHoursBefore must be >= 0' }, 400);
      }
      patch.notifyHoursBefore = Math.trunc(body.notifyHoursBefore);
    }

    await db()
      .update(scheduledExpenses)
      .set(patch)
      .where(and(eq(scheduledExpenses.id, id), eq(scheduledExpenses.spaceId, spaceId)));
    const updated = (
      await db().select().from(scheduledExpenses).where(eq(scheduledExpenses.id, id)).limit(1)
    )[0];
    return c.json(updated);
  });

  app.delete('/spaces/:spaceId/recurring/:id', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const id = c.req.param('id');
    const hard = c.req.query('hard') === '1';
    const row = (
      await db()
        .select()
        .from(scheduledExpenses)
        .where(and(eq(scheduledExpenses.id, id), eq(scheduledExpenses.spaceId, spaceId)))
        .limit(1)
    )[0];
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.createdBy === userId) await requirePermission(userId, spaceId, 'delete_own');
    else await requirePermission(userId, spaceId, 'delete_all');

    if (hard) {
      await db()
        .delete(scheduledExpenses)
        .where(and(eq(scheduledExpenses.id, id), eq(scheduledExpenses.spaceId, spaceId)));
    } else {
      await db()
        .update(scheduledExpenses)
        .set({ active: false })
        .where(and(eq(scheduledExpenses.id, id), eq(scheduledExpenses.spaceId, spaceId)));
    }
    return c.json({ ok: true });
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

    const body = await c.req.json<{ email?: string; role?: string; openLink?: boolean }>();
    // Link-only invites (no outbound email): store a sentinel address and skip match on accept.
    const rawEmail = body.email?.trim().toLowerCase() ?? '';
    const openLink = body.openLink === true || !rawEmail;
    const email = openLink ? `open-${createId('lnk')}@penny.local` : rawEmail;
    if (!openLink && !email.includes('@')) return c.json({ error: 'Valid email required' }, 400);
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
    const openInvite = row.email.toLowerCase().endsWith('@penny.local');
    if (!openInvite && profile.email.toLowerCase() !== row.email.toLowerCase()) {
      return c.json(
        {
          error: 'Sign in with the invited email address to accept this invite',
          code: 'invite_email_mismatch',
          emailHint: maskEmail(row.email),
        },
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
    await requireMembership(userId, spaceId);
    const target = (
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
    if (!target) return c.json({ error: 'Member not found' }, 404);

    const removingSelf = target.userId === userId;
    if (!removingSelf) {
      await requirePermission(userId, spaceId, 'manage_members');
    }

    if (target.role === 'owner') {
      const owners = await db()
        .select({ id: memberships.id })
        .from(memberships)
        .where(
          and(
            eq(memberships.spaceId, spaceId),
            eq(memberships.role, 'owner'),
            isNull(memberships.deletedAt),
          ),
        );
      if (owners.length <= 1) {
        return c.json({ error: 'Cannot remove the last owner from this space' }, 400);
      }
    }

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
      startDate?: string;
      durationMonths?: number;
      targetDate?: string;
      paceStatus?: string;
    }>();
    const durationMonths =
      body.durationMonths !== undefined && body.durationMonths >= 1
        ? Math.floor(body.durationMonths)
        : undefined;
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
        ...(body.startDate !== undefined ? { startDate: body.startDate.slice(0, 10) } : {}),
        ...(durationMonths !== undefined ? { durationMonths } : {}),
        ...(body.targetDate !== undefined ? { targetDate: body.targetDate.slice(0, 10) } : {}),
        ...(body.paceStatus !== undefined ? { paceStatus: body.paceStatus } : {}),
      })
      .where(and(eq(goals.id, goalId), eq(goals.spaceId, spaceId)));
    const row = (await db().select().from(goals).where(eq(goals.id, goalId)).limit(1))[0];
    return c.json(row);
  });

  app.post('/spaces/:spaceId/goals/:goalId/evaluate', async (c) => {
    const userId = c.get('userId');
    const spaceId = c.req.param('spaceId');
    const goalId = c.req.param('goalId');
    await requirePermission(userId, spaceId, 'edit_own');
    const row = (
      await db()
        .select()
        .from(goals)
        .where(and(eq(goals.id, goalId), eq(goals.spaceId, spaceId), isNull(goals.deletedAt)))
        .limit(1)
    )[0];
    if (!row) return c.json({ error: 'Not found' }, 404);
    const body = (await c.req.json().catch(() => ({}))) as { asOfDate?: string };
    const asOfDate = body.asOfDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const domainGoal: Goal = {
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
    const evaluation = evaluateGoalPace(domainGoal, asOfDate);
    await db()
      .update(goals)
      .set({ paceStatus: evaluation.paceStatus })
      .where(and(eq(goals.id, goalId), eq(goals.spaceId, spaceId)));
    const updated = (await db().select().from(goals).where(eq(goals.id, goalId)).limit(1))[0]!;
    return c.json({ goal: updated, evaluation });
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
      occurredAt?: string;
    }>();
    if (body.occurredAt !== undefined && Number.isNaN(Date.parse(body.occurredAt))) {
      return c.json({ error: 'occurredAt must be a valid ISO date' }, 400);
    }
    await db()
      .update(transactions)
      .set({
        ...(body.amountMinor !== undefined ? { amountMinor: body.amountMinor } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.occurredAt !== undefined ? { occurredAt: new Date(body.occurredAt) } : {}),
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
    const safe = sanitizeJobError(row.error);
    return c.json({ ...row, error: safe.error, errorCode: safe.errorCode });
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
            product_data: { name: 'Penny Plus' },
          },
        },
      ],
    });
    return c.json({ url: session.url, sessionId: session.id });
  });

  app.post('/billing/webhook', async (c) => {
    // Never trusts client entitlements. Production rejects unsigned stubs (P7.4).
    const gate = gateBillingWebhook({
      appEnv: config.appEnv,
      billingMode: process.env.BILLING_MODE,
      hasWebhookSecret: Boolean(config.stripeWebhookSecret),
      hasSignature: Boolean(c.req.header('stripe-signature')),
      hasStripeSecret: Boolean(config.stripeSecretKey),
    });

    if (gate.action === 'reject') {
      return c.json({ error: gate.error, code: gate.code }, gate.status);
    }

    if (gate.action === 'allow_stub') {
      return c.json({ received: true, stub: true });
    }

    // verify_stripe — signature required; entitlement flips still need a live handler.
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(config.stripeSecretKey);
      const rawBody = await c.req.text();
      const signature = c.req.header('stripe-signature')!;
      stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
      // Verified receipt only — full entitlement sync is a follow-up when Stripe live is enabled.
      return c.json({ received: true });
    } catch {
      return c.json({ error: 'Invalid webhook signature', code: 'webhook_invalid' }, 400);
    }
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
    if (status >= 500) {
      console.error('[api]', err);
      return c.json(publicInternalError(), status as 500);
    }
    return c.json({ error: err.message, code: 'request_error' }, status as 400);
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
