-- CMS-OPS-REMEDIATION-1C V15 — Durable booking email outbox + provider circuit breaker
-- Migration: 0031_booking_email_outbox
-- Additive only. Enum evolution later requires a governed separate migration.
-- Trigger function bodies use the tagged $fn$ dollar quote (E4).

CREATE TYPE "booking_email_outbox_status" AS ENUM (
  'PENDING', 'PROCESSING', 'RETRY_SCHEDULED', 'ACCEPTED', 'ATTENTION', 'FAILED_PERMANENT', 'SUPERSEDED',
  'HELD_PARENT_BINNED', 'HELD_BOOKING_PENDING', 'HELD_PROVIDER_OPERATIONAL',
  'SKIPPED_BINNED_EXPIRED', 'SKIPPED_PENDING_EXPIRED', 'SKIPPED_PAST_SESSION', 'SKIPPED_CANCELLED',
  'SKIPPED_ORPHANED', 'SKIPPED_ROLLBACK'
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "communication_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE "booking_email_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "centre_id" uuid REFERENCES "centres"("id") ON DELETE SET NULL,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
  "transition_version" integer NOT NULL,
  "communication_type" text NOT NULL CHECK ("communication_type" IN ('BOOKING_CONFIRMATION', 'BOOKING_RESCHEDULE', 'BOOKING_CANCELLED')),
  "recipient_email" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "booking_email_outbox_status" DEFAULT 'PENDING' NOT NULL,
  "payload" jsonb,
  "claim_token" uuid,
  "claim_expires_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "first_provider_attempt_at" timestamp with time zone,
  "unknown_outcome_seen" boolean DEFAULT false NOT NULL,
  "link_mode" text CHECK ("link_mode" IN ('WITH_LINK', 'LINK_FREE', 'PORTAL_URL')),
  "first_held_at" timestamp with time zone,
  "held_at" timestamp with time zone,
  "provider_message_id" text,
  "provider_hold_reason" text CHECK ("provider_hold_reason" IN ('CONFIG', 'QUOTA_DAILY', 'QUOTA_MONTHLY', 'RATE_LIMIT', 'CODE_CONTRACT')),
  "provider_hold_scope" text CHECK ("provider_hold_scope" IN ('ROW', 'GLOBAL')),
  "provider_hold_error_name" text,
  "attention_reason" text CHECK ("attention_reason" IN (
    'UNKNOWN_OUTCOME_EXHAUSTED', 'WINDOW_23H', 'IDEMPOTENCY_MISMATCH', 'PROVIDER_HOLD_EXPIRED',
    'DELIVERY_WINDOW_72H', 'LINK_INVALID_AFTER_FREEZE', 'MISSING_PAYLOAD', 'ROLLBACK_PROCESSING_STAMPED',
    'IDEMPOTENCY_KEY_INVALID', 'PROVIDER_CONTRACT_ERROR'
  )),
  "last_error_name" text,
  "last_error_status" smallint,
  "last_error_at" timestamp with time zone,
  "idempotency_epoch" integer DEFAULT 0 NOT NULL,
  "last_unknown_at" timestamp with time zone,
  "last_rate_limited_at" timestamp with time zone,
  "hold_hits" integer DEFAULT 0 NOT NULL,
  "accepted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "booking_email_outbox_idempotency_key_unique" UNIQUE ("idempotency_key"),
  CONSTRAINT "booking_email_outbox_booking_version_unique" UNIQUE ("booking_id", "transition_version")
);
--> statement-breakpoint
CREATE INDEX "booking_email_outbox_due_idx" ON "booking_email_outbox" ("status", "next_attempt_at") WHERE "status" IN ('PENDING', 'RETRY_SCHEDULED');
--> statement-breakpoint
CREATE INDEX "booking_email_outbox_booking_version_idx" ON "booking_email_outbox" ("booking_id", "transition_version");
--> statement-breakpoint
CREATE INDEX "booking_email_outbox_accepted_at_idx" ON "booking_email_outbox" ("accepted_at") WHERE "accepted_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "booking_email_outbox_type_accepted_idx" ON "booking_email_outbox" ("communication_type", "accepted_at") WHERE "status" = 'ACCEPTED';
--> statement-breakpoint
CREATE INDEX "booking_email_outbox_last_unknown_idx" ON "booking_email_outbox" ("last_unknown_at") WHERE "last_unknown_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "booking_email_outbox_last_rate_limited_idx" ON "booking_email_outbox" ("last_rate_limited_at") WHERE "last_rate_limited_at" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "booking_email_provider_state" (
  "id" smallint PRIMARY KEY CHECK ("id" = 1),
  "state" text NOT NULL DEFAULT 'CLOSED' CHECK ("state" IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  "reason" text CHECK ("reason" IN ('CONFIG', 'QUOTA_DAILY', 'QUOTA_MONTHLY', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE')),
  "error_name" text,
  "opened_at" timestamp with time zone,
  "next_probe_at" timestamp with time zone,
  "probe_started_at" timestamp with time zone,
  "probe_outbox_id" uuid,
  "consecutive_failures" integer NOT NULL DEFAULT 0,
  "config_fingerprint" text,
  "last_bulk_release_at" timestamp with time zone,
  "dispatch_window_start" timestamp with time zone,
  "dispatch_window_count" integer NOT NULL DEFAULT 0,
  "ramp_until" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CHECK ("state" <> 'OPEN' OR "next_probe_at" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO "booking_email_provider_state" ("id") VALUES (1) ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION trg_fn_scrub_outbox_on_booking_delete() RETURNS TRIGGER AS $fn$
BEGIN
  IF OLD.booking_id IS NOT NULL AND NEW.booking_id IS NULL THEN
    NEW.payload := NULL;
    NEW.recipient_email := '[REDACTED_DELETED]';
    NEW.claim_token := NULL;
    NEW.held_at := NULL;
    IF NEW.status IN ('PENDING','PROCESSING','RETRY_SCHEDULED','HELD_PARENT_BINNED','HELD_BOOKING_PENDING','HELD_PROVIDER_OPERATIONAL') THEN
      NEW.status := 'SKIPPED_ORPHANED';
    END IF;
  END IF;
  RETURN NEW;
END; $fn$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_scrub_outbox_on_booking_delete BEFORE UPDATE OF booking_id ON booking_email_outbox FOR EACH ROW EXECUTE FUNCTION trg_fn_scrub_outbox_on_booking_delete();
