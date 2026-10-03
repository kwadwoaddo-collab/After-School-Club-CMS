-- Remediation 1A — Invoice Record Payment Idempotency & Fingerprint Hardening
-- Migration: 0030_payments_idempotency

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(255);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "request_fingerprint" varchar(255);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_invoice_idempotency_uniq"
  ON "payments" ("invoice_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
