-- Migration: 0027_billing_obligation_concurrency.sql
-- PM-2C.B: Enforce database-level partial unique index on invoices for recurring billing obligations
-- Excludes voided invoices to preserve legitimate void/reissue workflows.

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_config_period_uniq" 
  ON "invoices" ("billing_config_id", "billing_period_start") 
  WHERE "status" != 'void' AND "billing_config_id" IS NOT NULL;
