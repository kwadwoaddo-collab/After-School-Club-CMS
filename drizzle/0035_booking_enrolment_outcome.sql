-- 0035_booking_enrolment_outcome.sql
-- Idempotent DDL & Backfill for Booking <-> Registration Enrolment Outcome Loop-Closure

DO $$ BEGIN
  CREATE TYPE "public"."booking_enrolment_outcome" AS ENUM('awaiting_outcome', 'signed_up', 'did_not_sign_up');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "enrolment_outcome" "booking_enrolment_outcome";
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "enrolment_outcome_reason" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "enrolment_outcome_at" timestamptz;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "enrolment_outcome_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "linked_registration_id" uuid REFERENCES "registrations"("id") ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "bookings_enrolment_outcome_idx" ON "bookings" ("centre_id", "enrolment_outcome");
CREATE INDEX IF NOT EXISTS "registrations_booking_idx" ON "registrations" ("booking_id");
--> statement-breakpoint

-- 1. Backfill bookings.enrolment_outcome = 'signed_up' and linked_registration_id
--    where an attendee child shares a 'signed_up' registration in the same centre.
WITH matched_reg AS (
  SELECT DISTINCT ON (b.id)
    b.id AS booking_id,
    r.id AS registration_id,
    COALESCE(r.updated_at, r.submitted_at, r.created_at, now()) AS outcome_at
  FROM "bookings" b
  INNER JOIN "booking_attendees" ba ON ba.booking_id = b.id
  INNER JOIN "registration_children" rc ON rc.child_id = ba.child_id
  INNER JOIN "registrations" r ON r.id = rc.registration_id
  WHERE r.status = 'signed_up'
    AND (r.centre_id IS NULL OR r.centre_id = b.centre_id)
    AND b.status <> 'cancelled'
  ORDER BY b.id, r.created_at DESC
)
UPDATE "bookings" b
SET
  "enrolment_outcome" = 'signed_up',
  "enrolment_outcome_reason" = COALESCE(b.enrolment_outcome_reason, 'Backfilled from signed_up registration'),
  "enrolment_outcome_at" = COALESCE(b.enrolment_outcome_at, matched_reg.outcome_at),
  "linked_registration_id" = COALESCE(b.linked_registration_id, matched_reg.registration_id)
FROM matched_reg
WHERE b.id = matched_reg.booking_id
  AND b.enrolment_outcome IS NULL;
--> statement-breakpoint

-- 2. Backfill bookings.enrolment_outcome = 'signed_up' where an attendee child has is_registered = true
UPDATE "bookings" b
SET
  "enrolment_outcome" = 'signed_up',
  "enrolment_outcome_reason" = COALESCE(b.enrolment_outcome_reason, 'Backfilled from registered student'),
  "enrolment_outcome_at" = COALESCE(b.enrolment_outcome_at, b.updated_at, now())
WHERE b.enrolment_outcome IS NULL
  AND b.status <> 'cancelled'
  AND EXISTS (
    SELECT 1
    FROM "booking_attendees" ba
    INNER JOIN "children" c ON c.id = ba.child_id
    WHERE ba.booking_id = b.id
      AND c.is_registered = true
      AND c.deleted_at IS NULL
  );
--> statement-breakpoint

-- 3. Backfill remaining status = 'completed' bookings where enrolment_outcome IS NULL to 'awaiting_outcome'
UPDATE "bookings" b
SET
  "enrolment_outcome" = 'awaiting_outcome'
WHERE b.status = 'completed'
  AND b.enrolment_outcome IS NULL;
--> statement-breakpoint

-- 4. Backfill registrations.booking_id from bookings.linked_registration_id where booking_id IS NULL
UPDATE "registrations" r
SET "booking_id" = b.id
FROM "bookings" b
WHERE b.linked_registration_id = r.id
  AND r.booking_id IS NULL;
