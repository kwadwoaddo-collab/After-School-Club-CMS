-- =============================================================================
-- Migration: Attendance Phase A — Additive Schema Only
-- Date: 2026-05-17
-- Target table: booking_attendees
-- Purpose: Add nullable per-child attendance tracking columns.
--          No UI/write behaviour changes. No booking status logic changes.
--
-- SAFETY:
--   ✅ Safe to run multiple times — uses IF NOT EXISTS / DO $$ guards
--   ✅ All columns are nullable — no DEFAULT, no NOT NULL constraints
--   ✅ Existing rows unaffected (columns will be NULL)
--   ✅ No indexes added (deferred to Phase B when queries exist)
--   ✅ No triggers, no constraints beyond the enum type
--
-- HOW TO RUN:
--   Copy/paste into Neon SQL console, or:
--   psql $DATABASE_URL -f src/scripts/add-attendance-columns.sql
-- =============================================================================

-- Step 1: Create the enum type (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'no_show', 'excused');
  END IF;
END
$$;

-- Step 2: Add columns (idempotent — each guarded individually)
DO $$
BEGIN
  -- attendance_status: granular per-child status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_attendees' AND column_name = 'attendance_status'
  ) THEN
    ALTER TABLE booking_attendees ADD COLUMN attendance_status attendance_status;
  END IF;

  -- attendance_note: free-text context for the status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_attendees' AND column_name = 'attendance_note'
  ) THEN
    ALTER TABLE booking_attendees ADD COLUMN attendance_note TEXT;
  END IF;

  -- attendance_marked_at: when staff recorded the attendance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_attendees' AND column_name = 'attendance_marked_at'
  ) THEN
    ALTER TABLE booking_attendees ADD COLUMN attendance_marked_at TIMESTAMPTZ;
  END IF;

  -- attendance_marked_by: which staff user recorded it (FK to users.id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_attendees' AND column_name = 'attendance_marked_by'
  ) THEN
    ALTER TABLE booking_attendees ADD COLUMN attendance_marked_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- Step 3: Verify (optional — returns the new columns)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'booking_attendees'
  AND column_name IN ('attendance_status', 'attendance_note', 'attendance_marked_at', 'attendance_marked_by')
ORDER BY ordinal_position;


-- =============================================================================
-- ROLLBACK SQL (run manually if you need to revert)
-- =============================================================================
-- ALTER TABLE booking_attendees DROP COLUMN IF EXISTS attendance_status;
-- ALTER TABLE booking_attendees DROP COLUMN IF EXISTS attendance_note;
-- ALTER TABLE booking_attendees DROP COLUMN IF EXISTS attendance_marked_at;
-- ALTER TABLE booking_attendees DROP COLUMN IF EXISTS attendance_marked_by;
-- DROP TYPE IF EXISTS attendance_status;
-- =============================================================================
