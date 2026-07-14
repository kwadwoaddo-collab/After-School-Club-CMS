-- ============================================================
-- Migration: 20260714_03_attendance_timelog_and_ledger
-- Adds IN/OUT time tracking, session type, absence reason,
-- session credit ledger, and student operational flags.
-- ============================================================

-- 1. New enums
CREATE TYPE session_type AS ENUM ('scheduled', 'extra');
CREATE TYPE absence_reason AS ENUM ('illness', 'holiday', 'family', 'other');

-- 2. Add new columns to booking_attendees
ALTER TABLE booking_attendees
  ADD COLUMN IF NOT EXISTS check_in_time  VARCHAR(5),          -- "HH:mm" e.g. "15:47"
  ADD COLUMN IF NOT EXISTS check_out_time VARCHAR(5),          -- "HH:mm" e.g. "17:05"
  ADD COLUMN IF NOT EXISTS session_type   session_type,        -- scheduled | extra (auto-set by server)
  ADD COLUMN IF NOT EXISTS absence_reason absence_reason,      -- illness | holiday | family | other
  ADD COLUMN IF NOT EXISTS forgiven_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forgiven_at    TIMESTAMP,
  ADD COLUMN IF NOT EXISTS forgiven_note  TEXT;

-- 3. Add operational flags to children
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS flag_homework  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_behaviour BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flag_note      TEXT;

-- 4. New table: session_credits (admin-granted forgiveness)
CREATE TABLE IF NOT EXISTS session_credits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id         UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  academic_year    VARCHAR(9) NOT NULL,    -- e.g. "2025-26"
  sessions_amount  INTEGER NOT NULL DEFAULT 1,
  admin_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  note             TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_credits_child_idx ON session_credits(child_id);
CREATE INDEX IF NOT EXISTS session_credits_year_idx  ON session_credits(academic_year);
