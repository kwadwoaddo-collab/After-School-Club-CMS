-- ============================================================
-- Phase 2: Backfill organisationId from parents (all children)
-- Phase 2: Backfill centreId from most recent booking
--          (unambiguous children only — those in exactly 1 centre)
-- Phase 3: Backfill centreId from registrations
--          (for booking-less students where a registration centreId exists)
-- Phase 4: Apply most-recent-centre policy to conflicted children
--          (those with bookings across ≥2 centres)
--
-- Idempotent: each UPDATE uses IS NULL guards so re-runs are safe.
-- Run phases in order. Wrap in a transaction for safety.
-- ============================================================

BEGIN;

-- ── PHASE 2A: organisationId from parents (all children) ──────────────────
UPDATE children c
SET organisation_id = p.organisation_id
FROM parents p
WHERE c.parent_id = p.id
  AND c.organisation_id IS NULL;

-- ── PHASE 2B: centreId from most recent booking (unambiguous children) ────
-- Excludes children who have bookings in more than one distinct centre.
UPDATE children c
SET centre_id = subq.centre_id
FROM (
    SELECT DISTINCT ON (ba.child_id)
        ba.child_id,
        b.centre_id
    FROM booking_attendees ba
    JOIN bookings b ON ba.booking_id = b.id
    WHERE b.centre_id IS NOT NULL
    ORDER BY ba.child_id, b.start_at DESC
) subq
WHERE c.id = subq.child_id
  AND c.centre_id IS NULL
  -- Exclude conflicted children from this pass
  AND c.id NOT IN (
      SELECT ba2.child_id
      FROM booking_attendees ba2
      JOIN bookings b2 ON ba2.booking_id = b2.id
      WHERE b2.centre_id IS NOT NULL
      GROUP BY ba2.child_id
      HAVING COUNT(DISTINCT b2.centre_id) > 1
  );

-- ── PHASE 3: centreId from linked registration (booking-less students) ────
-- Picks up registration-only students who were never booked.
UPDATE children c
SET centre_id = r.centre_id
FROM registration_children rc
JOIN registrations r ON rc.registration_id = r.id
WHERE rc.child_id = c.id
  AND c.centre_id IS NULL
  AND r.centre_id IS NOT NULL;

-- ── PHASE 4: Most-recent-centre policy for conflicted children ────────────
-- Children with bookings across ≥2 centres get the most recent booking's centre.
-- These are flagged in the conflict report (see migration plan) for operator review.
UPDATE children c
SET centre_id = subq.centre_id
FROM (
    SELECT DISTINCT ON (ba.child_id)
        ba.child_id,
        b.centre_id
    FROM booking_attendees ba
    JOIN bookings b ON ba.booking_id = b.id
    WHERE b.centre_id IS NOT NULL
    ORDER BY ba.child_id, b.start_at DESC
) subq
WHERE c.id = subq.child_id
  AND c.centre_id IS NULL;  -- Only touches any remaining NULL (the conflicted set)

-- ── POST-BACKFILL VALIDATION QUERIES (check before committing) ───────────
-- Run these SELECTs to verify before COMMIT:

-- Should be 0 after Phase 2A:
-- SELECT COUNT(*) FROM children WHERE organisation_id IS NULL;

-- May be > 0 (staff-added students with no bookings/registrations — acceptable):
-- SELECT COUNT(*) FROM children WHERE centre_id IS NULL;

-- Conflict survivors flagged for operator review:
-- SELECT c.id, c.first_name, c.last_name, c.centre_id,
--        ARRAY_AGG(DISTINCT b.centre_id) AS all_booking_centres
-- FROM children c
-- JOIN booking_attendees ba ON ba.child_id = c.id
-- JOIN bookings b ON ba.booking_id = b.id
-- WHERE b.centre_id IS NOT NULL
-- GROUP BY c.id, c.first_name, c.last_name, c.centre_id
-- HAVING COUNT(DISTINCT b.centre_id) > 1;

COMMIT;
