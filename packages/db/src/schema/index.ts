import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/** Better Auth compatible user table + Clear Money profile fields. */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  locale: text('locale').notNull().default('en'),
  defaultCurrency: text('default_currency').notNull().default('USD'),
  timezone: text('timezone').notNull().default('UTC'),
  weekStartsOn: integer('week_starts_on').notNull().default(1),
  setupCompletedAt: timestamp('setup_completed_at', { withTimezone: true }),
  plan: text('plan').notNull().default('free'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const spaces = pgTable(
  'spaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(), // personal | project | family | company
    currency: text('currency').notNull().default('USD'),
    timezone: text('timezone').notNull().default('UTC'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('spaces_owner_idx').on(t.ownerId)],
);

export const memberships = pgTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // owner | admin | contributor | viewer | child
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('memberships_space_user').on(t.spaceId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);

export const invitations = pgTable('invitations', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  invitedBy: text('invited_by')
    .notNull()
    .references(() => user.id),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  spaceId: text('space_id').references(() => spaces.id, { onDelete: 'cascade' }),
  stableKey: text('stable_key').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull().default('expense'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id),
    type: text('type').notNull(),
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull(),
    categoryId: text('category_id').references(() => categories.id),
    description: text('description'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    occurredOffset: text('occurred_offset').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id),
    source: text('source').notNull().default('manual'),
    status: text('status').notNull().default('confirmed'),
    idempotencyKey: text('idempotency_key'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('txn_idempotency').on(t.spaceId, t.idempotencyKey),
    index('txn_space_occurred').on(t.spaceId, t.occurredAt),
    index('txn_created_by').on(t.createdBy),
  ],
);

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id),
  transactionId: text('transaction_id').references(() => transactions.id),
  storageKey: text('storage_key').notNull(),
  contentType: text('content_type').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const goals = pgTable('goals', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id),
  name: text('name').notNull(),
  targetMinor: integer('target_minor').notNull(),
  savedMinor: integer('saved_minor').notNull().default(0),
  currency: text('currency').notNull(),
  targetDate: text('target_date').notNull(),
  plannedContributionMinor: integer('planned_contribution_minor').notNull().default(0),
  notificationPolicy: text('notification_policy').notNull().default('weekly'),
  status: text('status').notNull().default('active'),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const contributions = pgTable('contributions', {
  id: text('id').primaryKey(),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  kind: text('kind').notNull().default('contribution'), // contribution | transfer
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scheduledExpenses = pgTable('scheduled_expenses', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id),
  name: text('name').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  nextDueAt: timestamp('next_due_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id),
  transactionId: text('transaction_id').references(() => transactions.id),
  body: text('body').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(),
  spaceId: text('space_id')
    .notNull()
    .references(() => spaces.id),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id),
  status: text('status').notNull().default('pending'),
  decidedBy: text('decided_by').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  spaceId: text('space_id').references(() => spaces.id),
  actorId: text('actor_id').references(() => user.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  beforeSummary: text('before_summary'),
  afterSummary: text('after_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Per-message Penny log for abuse control and behavior tracking (text only — no audio). */
export const pennyTurns = pgTable(
  'penny_turns',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    spaceId: text('space_id').references(() => spaces.id),
    sessionId: text('session_id').notNull(),
    role: text('role').notNull(), // user | assistant
    content: text('content').notNull(),
    source: text('source').notNull().default('text'), // text | voice
    locale: text('locale'),
    model: text('model'),
    latencyMs: integer('latency_ms'),
    status: text('status').notNull().default('ok'), // ok | error | blocked
    errorCode: text('error_code'),
    flags: jsonb('flags').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('penny_turns_user_created').on(t.userId, t.createdAt),
    index('penny_turns_session').on(t.sessionId),
  ],
);

export const billingCustomers = pgTable('billing_customers', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id)
    .unique(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  plan: text('plan').notNull(),
  status: text('status').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usageCounters = pgTable('usage_counters', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id)
    .unique(),
  receiptScans: integer('receipt_scans').notNull().default(0),
  aiRequests: integer('ai_requests').notNull().default(0),
  generatedReports: integer('generated_reports').notNull().default(0),
  activeMembers: integer('active_members').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull().default('queued'),
  spaceId: text('space_id').references(() => spaces.id),
  userId: text('user_id').references(() => user.id),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  result: jsonb('result').$type<Record<string, unknown>>(),
  error: text('error'),
  idempotencyKey: text('idempotency_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id)
    .unique(),
  enabled: boolean('enabled').notNull().default(false),
  categories: jsonb('categories').$type<string[]>().notNull().default([]),
  quietHoursStart: integer('quiet_hours_start').notNull().default(22),
  quietHoursEnd: integer('quiet_hours_end').notNull().default(7),
  preferredHour: integer('preferred_hour').notNull().default(9),
  maxDaily: integer('max_daily').notNull().default(1),
  maxWeeklyReviews: integer('max_weekly_reviews').notNull().default(1),
  previewMode: text('preview_mode').notNull().default('generic'),
  timezone: text('timezone').notNull().default('UTC'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
