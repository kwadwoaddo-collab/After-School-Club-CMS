-- WhatsApp Business Platform (Meta Cloud API) — Phase 2. ADDITIVE ONLY.
-- New tables only: no existing table, row or invoice is altered; no backfill.
-- Nothing sends until FF_WHATSAPP_API=true AND a centre row is enabled+active AND the parent has a recorded opt-in.
-- The Meta access token is NEVER stored here (env: WHATSAPP_ACCESS_TOKEN).
--
-- ROLLBACK (safe: only drops objects created below, in dependency order):
--   DROP TABLE IF EXISTS "whatsapp_messages";
--   DROP TABLE IF EXISTS "whatsapp_consents";
--   DROP TABLE IF EXISTS "whatsapp_centre_configs";

-- One row per centre = that centre's own WhatsApp number (phone_number_id from Meta).
CREATE TABLE IF NOT EXISTS "whatsapp_centre_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "centre_id" uuid NOT NULL REFERENCES "centres"("id") ON DELETE CASCADE,
  "phone_number_id" varchar(64),
  "waba_id" varchar(64),
  "display_phone" varchar(30),
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_centre_configs_centre_unique" UNIQUE ("centre_id"),
  CONSTRAINT "whatsapp_centre_configs_status_check" CHECK ("status" IN ('pending', 'active', 'disabled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_centre_configs_phone_number_uniq" ON "whatsapp_centre_configs" ("phone_number_id") WHERE "phone_number_id" IS NOT NULL;
--> statement-breakpoint
-- Append-only consent history; the newest row per parent decides.
CREATE TABLE IF NOT EXISTS "whatsapp_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "parent_id" uuid NOT NULL REFERENCES "parents"("id") ON DELETE CASCADE,
  "status" varchar(12) NOT NULL,
  "source" varchar(40) NOT NULL,
  "recorded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "recorded_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "whatsapp_consents_status_check" CHECK ("status" IN ('opted_in', 'opted_out'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_consents_parent_idx" ON "whatsapp_consents" ("parent_id", "recorded_at" DESC);
--> statement-breakpoint
-- Outbound message log. No message body is stored (templates are fixed in code); inbound replies are not stored.
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "centre_id" uuid NOT NULL REFERENCES "centres"("id") ON DELETE CASCADE,
  "parent_id" uuid NOT NULL REFERENCES "parents"("id") ON DELETE CASCADE,
  "invoice_id" uuid REFERENCES "invoices"("id") ON DELETE SET NULL,
  "template_name" varchar(80) NOT NULL,
  "template_language" varchar(10) NOT NULL,
  "idempotency_key" varchar(120) NOT NULL,
  "wamid" varchar(255),
  "status" varchar(12) DEFAULT 'queued' NOT NULL,
  "error_code" varchar(20),
  "error_message" varchar(300),
  "dry_run" boolean DEFAULT false NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "sent_at" timestamptz,
  "delivered_at" timestamptz,
  "read_at" timestamptz,
  "failed_at" timestamptz,
  CONSTRAINT "whatsapp_messages_idempotency_unique" UNIQUE ("idempotency_key"),
  CONSTRAINT "whatsapp_messages_status_check" CHECK ("status" IN ('queued', 'dry_run', 'sent', 'delivered', 'read', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_messages_wamid_uniq" ON "whatsapp_messages" ("wamid") WHERE "wamid" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_messages_invoice_idx" ON "whatsapp_messages" ("invoice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_messages_org_centre_created_idx" ON "whatsapp_messages" ("organisation_id", "centre_id", "created_at" DESC);
