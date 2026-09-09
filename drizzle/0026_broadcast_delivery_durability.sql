-- Migration: 0026_broadcast_delivery_durability.sql
-- PM-2B: Durable transactional outbox and delivery ledger for broadcast messaging

-- 1. Enhance broadcasts table with status and completed_at
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "status" varchar(30) DEFAULT 'PENDING' NOT NULL;
ALTER TABLE "broadcasts" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "broadcasts_status_idx" ON "broadcasts" ("status");

-- 2. Create broadcast_deliveries ledger table
CREATE TABLE IF NOT EXISTS "broadcast_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "broadcast_id" uuid NOT NULL REFERENCES "broadcasts"("id") ON DELETE CASCADE,
  "parent_id" uuid REFERENCES "parents"("id") ON DELETE SET NULL,
  "recipient_email" varchar(255) NOT NULL,
  "recipient_name" varchar(255),
  "channel" varchar(20) DEFAULT 'email' NOT NULL,
  "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
  "claim_token" varchar(64),
  "claimed_at" timestamp with time zone,
  "lease_expires_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "provider_message_id" varchar(255),
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Idempotency & performance indexes
CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_deliveries_unique_idx" ON "broadcast_deliveries" ("broadcast_id", "recipient_email");
CREATE INDEX IF NOT EXISTS "broadcast_deliveries_org_idx" ON "broadcast_deliveries" ("organisation_id");
CREATE INDEX IF NOT EXISTS "broadcast_deliveries_broadcast_idx" ON "broadcast_deliveries" ("broadcast_id");
CREATE INDEX IF NOT EXISTS "broadcast_deliveries_queue_idx" ON "broadcast_deliveries" ("status", "next_attempt_at");
