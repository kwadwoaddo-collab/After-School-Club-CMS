-- Category B — Billing Scheduler Extensions & Skip Cycle
-- Migration: 0029_category_b_billing_scheduler
--
-- Adds:
-- 1. lead_time_unit enum ('DAYS', 'CALENDAR_MONTHS')
-- 2. payment_day_of_month, lead_time_unit, lead_time_value to billing_configs
-- 3. billing_runs unique index on (billing_config_id, period_start)
-- 4. billing_cycle_skips table for business state of skipped cycles

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_time_unit') THEN
    CREATE TYPE "public"."lead_time_unit" AS ENUM('DAYS', 'CALENDAR_MONTHS');
  END IF;
END $$;

ALTER TABLE "billing_configs" ADD COLUMN IF NOT EXISTS "payment_day_of_month" integer;
ALTER TABLE "billing_configs" ADD COLUMN IF NOT EXISTS "lead_time_unit" "public"."lead_time_unit";
ALTER TABLE "billing_configs" ADD COLUMN IF NOT EXISTS "lead_time_value" integer;

CREATE UNIQUE INDEX IF NOT EXISTS "billing_runs_config_period_uniq"
  ON "billing_runs" ("billing_config_id", "period_start");

CREATE TABLE IF NOT EXISTS "billing_cycle_skips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "billing_config_id" uuid NOT NULL REFERENCES "billing_configs"("id") ON DELETE CASCADE,
  "period_start" date NOT NULL,
  "skipped_at" timestamp with time zone DEFAULT now() NOT NULL,
  "skipped_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "skip_reason" text NOT NULL,
  CONSTRAINT "bcs_config_period_unique" UNIQUE("billing_config_id", "period_start")
);

CREATE INDEX IF NOT EXISTS "bcs_config_idx" ON "billing_cycle_skips" ("billing_config_id");
