-- Per-family service type (Childcare / Tuition). Additive only: no data rewrite.
-- Existing and new rows default to 'childcare', so current output is unchanged.
-- billing_configs.service_type = the family's current setting.
-- invoices.service_type = snapshot taken when the invoice is generated, so
-- already-issued invoices/receipts never change if the family toggle changes later.
ALTER TABLE "billing_configs" ADD COLUMN IF NOT EXISTS "service_type" varchar(20) DEFAULT 'childcare' NOT NULL;
--> statement-breakpoint
ALTER TABLE "billing_configs" DROP CONSTRAINT IF EXISTS "billing_configs_service_type_check";
--> statement-breakpoint
ALTER TABLE "billing_configs" ADD CONSTRAINT "billing_configs_service_type_check" CHECK ("service_type" IN ('childcare', 'tuition'));
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "service_type" varchar(20) DEFAULT 'childcare' NOT NULL;
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_service_type_check";
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_type_check" CHECK ("service_type" IN ('childcare', 'tuition'));
