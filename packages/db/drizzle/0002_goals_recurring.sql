ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "start_date" text;
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "duration_months" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "pace_status" text DEFAULT 'on_track' NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'expense' NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "day_of_month" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "last_posted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "notify_hours_before" integer DEFAULT 24 NOT NULL;
--> statement-breakpoint
ALTER TABLE "scheduled_expenses" ADD COLUMN IF NOT EXISTS "created_by" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_expenses" ADD CONSTRAINT "scheduled_expenses_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_expenses_space_active" ON "scheduled_expenses" USING btree ("space_id","active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_expenses_due" ON "scheduled_expenses" USING btree ("next_due_at","active");
