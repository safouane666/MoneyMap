ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "duration_unit" text DEFAULT 'forever' NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "duration_count" integer;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "ends_at" timestamp with time zone;
