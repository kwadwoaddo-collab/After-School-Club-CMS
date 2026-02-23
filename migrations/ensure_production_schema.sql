-- =====================================================================
-- Ensure Production Schema — Idempotent
-- Run against Neon to make sure all enums, tables, and columns exist
-- =====================================================================

-- 1. Enums
DO $$ BEGIN CREATE TYPE notification_type AS ENUM (
  'booking_created','booking_cancelled','booking_rescheduled','assessment_reminder','system'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE funding_type AS ENUM (
  'tax_free_childcare','childcare_vouchers','student_finance','self_funded','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE registration_status_v2 AS ENUM (
  'pending','approved','rejected','waitlisted'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE student_source AS ENUM (
  'assessment','registration','both'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE parent_relationship AS ENUM (
  'mother','father','guardian','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tables that may be missing
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title varchar(255) NOT NULL,
  message text NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  event_type varchar(100) NOT NULL,
  event_data text,
  created_at timestamp DEFAULT now() NOT NULL
);

-- 3. New columns on existing tables
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS registration_terms text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS session_slots text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS registration_pricing text;
ALTER TABLE parents ADD COLUMN IF NOT EXISTS relationship varchar(50);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS address_line1 varchar(255);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS address_line2 varchar(255);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS city varchar(100);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS postcode varchar(20);
ALTER TABLE children ADD COLUMN IF NOT EXISTS source student_source DEFAULT 'assessment';
ALTER TABLE children ADD COLUMN IF NOT EXISTS is_registered boolean DEFAULT false;
ALTER TABLE children ADD COLUMN IF NOT EXISTS registered_at timestamp;

-- 4. New registration tables
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  status registration_status_v2 NOT NULL DEFAULT 'pending',
  start_date timestamp,
  funding_types text[],
  funding_other text,
  has_special_needs boolean DEFAULT false,
  special_needs_details text,
  emergency_contact_name varchar(255),
  emergency_contact_phone varchar(50),
  emergency_contact_relationship varchar(100),
  terms_agreed boolean NOT NULL DEFAULT false,
  submitted_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS registration_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE SET NULL,
  submitted_first_name varchar(100) NOT NULL,
  submitted_last_name varchar(100) NOT NULL,
  submitted_date_of_birth timestamp,
  submitted_school_year varchar(20),
  was_matched boolean DEFAULT false,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS registration_parents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES parents(id) ON DELETE SET NULL,
  is_primary boolean DEFAULT false,
  submitted_first_name varchar(100),
  submitted_last_name varchar(100),
  submitted_email varchar(255),
  submitted_phone varchar(50),
  submitted_relationship varchar(50),
  was_matched boolean DEFAULT false,
  created_at timestamp DEFAULT now() NOT NULL
);

-- 5. Migrate registration status enum to new values
-- Add new values (safe to run multiple times)
DO $$ BEGIN ALTER TYPE registration_status_v2 ADD VALUE IF NOT EXISTS 'awaiting_confirmation'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE registration_status_v2 ADD VALUE IF NOT EXISTS 'signed_up';             EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE registration_status_v2 ADD VALUE IF NOT EXISTS 'not_interested';        EXCEPTION WHEN others THEN NULL; END $$;

-- Migrate existing rows to new values
UPDATE registrations SET status = 'awaiting_confirmation' WHERE status = 'pending';
UPDATE registrations SET status = 'signed_up'             WHERE status = 'approved';
UPDATE registrations SET status = 'not_interested'        WHERE status = 'rejected';

-- Update column default
ALTER TABLE registrations ALTER COLUMN status SET DEFAULT 'awaiting_confirmation';
