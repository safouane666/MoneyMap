CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  locale text NOT NULL DEFAULT 'en',
  default_currency text NOT NULL DEFAULT 'USD',
  timezone text NOT NULL DEFAULT 'UTC',
  week_starts_on integer NOT NULL DEFAULT 1,
  setup_completed_at timestamptz,
  plan text NOT NULL DEFAULT 'free',
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS spaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  timezone text NOT NULL DEFAULT 'UTC',
  owner_id text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS spaces_owner_idx ON spaces(owner_id);

CREATE TABLE IF NOT EXISTS memberships (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_space_user ON memberships(space_id, user_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);

CREATE TABLE IF NOT EXISTS invitations (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  invited_by text NOT NULL REFERENCES "user"(id),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  space_id text REFERENCES spaces(id) ON DELETE CASCADE,
  stable_key text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id),
  type text NOT NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  category_id text REFERENCES categories(id),
  description text,
  occurred_at timestamptz NOT NULL,
  occurred_offset text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL REFERENCES "user"(id),
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'confirmed',
  idempotency_key text,
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS txn_idempotency ON transactions(space_id, idempotency_key);
CREATE INDEX IF NOT EXISTS txn_space_occurred ON transactions(space_id, occurred_at);
CREATE INDEX IF NOT EXISTS txn_created_by ON transactions(created_by);

CREATE TABLE IF NOT EXISTS attachments (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id),
  transaction_id text REFERENCES transactions(id),
  storage_key text NOT NULL,
  content_type text NOT NULL,
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS goals (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id),
  name text NOT NULL,
  target_minor integer NOT NULL,
  saved_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL,
  target_date text NOT NULL,
  planned_contribution_minor integer NOT NULL DEFAULT 0,
  notification_policy text NOT NULL DEFAULT 'weekly',
  status text NOT NULL DEFAULT 'active',
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS contributions (
  id text PRIMARY KEY,
  goal_id text NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  kind text NOT NULL DEFAULT 'contribution',
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_expenses (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id),
  name text NOT NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  next_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id),
  transaction_id text REFERENCES transactions(id),
  body text NOT NULL,
  created_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS approvals (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES spaces(id),
  transaction_id text NOT NULL REFERENCES transactions(id),
  status text NOT NULL DEFAULT 'pending',
  decided_by text REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY,
  space_id text REFERENCES spaces(id),
  actor_id text REFERENCES "user"(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_summary text,
  after_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_customers (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES "user"(id),
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id),
  plan text NOT NULL,
  status text NOT NULL,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_counters (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES "user"(id),
  receipt_scans integer NOT NULL DEFAULT 0,
  ai_requests integer NOT NULL DEFAULT 0,
  generated_reports integer NOT NULL DEFAULT 0,
  active_members integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  space_id text REFERENCES spaces(id),
  user_id text REFERENCES "user"(id),
  payload jsonb NOT NULL DEFAULT '{}',
  result jsonb,
  error text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES "user"(id),
  enabled boolean NOT NULL DEFAULT false,
  categories jsonb NOT NULL DEFAULT '[]',
  quiet_hours_start integer NOT NULL DEFAULT 22,
  quiet_hours_end integer NOT NULL DEFAULT 7,
  preferred_hour integer NOT NULL DEFAULT 9,
  max_daily integer NOT NULL DEFAULT 1,
  max_weekly_reviews integer NOT NULL DEFAULT 1,
  preview_mode text NOT NULL DEFAULT 'generic',
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now()
);
