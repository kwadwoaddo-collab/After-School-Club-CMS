-- 0036_did_not_attend_and_funnel_unification.sql
-- 1. Safely add 'did_not_attend' to booking_status enum (must commit before any UPDATE uses it)
ALTER TYPE "public"."booking_status" ADD VALUE IF NOT EXISTS 'did_not_attend';

-- 2. Clear premature backfilled 'signed_up' enrolment_outcome on unattended 'confirmed'/'pending'/'rescheduled' bookings
--    (e.g., when an already-registered student had a separate unattended booking)
UPDATE "public"."bookings" b
SET
  "enrolment_outcome" = NULL,
  "enrolment_outcome_reason" = NULL,
  "enrolment_outcome_at" = NULL
WHERE b."status" IN ('confirmed', 'pending', 'rescheduled')
  AND b."enrolment_outcome" = 'signed_up'
  AND b."enrolment_outcome_reason" IN ('Backfilled from registered student', 'Backfilled from signed_up registration')
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."booking_attendees" ba
    WHERE ba."booking_id" = b."id"
      AND ba."attendance_status" IN ('present', 'late')
  );

-- 3. Promote any 'confirmed'/'pending' booking where all attendees are marked no_show/absent/excused to 'did_not_attend'
UPDATE "public"."bookings" b
SET
  "status" = 'did_not_attend',
  "enrolment_outcome" = CASE
    WHEN b."enrolment_outcome" = 'signed_up'
     AND b."enrolment_outcome_reason" IN ('Backfilled from registered student', 'Backfilled from signed_up registration')
    THEN NULL
    ELSE b."enrolment_outcome"
  END
WHERE b."status" IN ('confirmed', 'pending')
  AND EXISTS (
    SELECT 1
    FROM "public"."booking_attendees" ba
    WHERE ba."booking_id" = b."id"
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "public"."booking_attendees" ba
    WHERE ba."booking_id" = b."id"
      AND (ba."attendance_status" IS NULL OR ba."attendance_status" IN ('present', 'late'))
  );
