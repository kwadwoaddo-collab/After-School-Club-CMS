-- =====================================================================
-- Registration Feature Migration
-- Applies: new enums, new columns on existing tables, new tables
-- Safe to run multiple times (uses IF NOT EXISTS / DO $$ blocks)
-- =====================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE registration_status_v2 AS ENUM ('pending', 'approved', 'rejected', 'waitlisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE student_source AS ENUM ('assessment', 'registration', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parent_relationship AS ENUM ('mother', 'father', 'guardian', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. organisations — add registration_terms column
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS registration_terms text;

-- 3. parents — add enrichment columns
ALTER TABLE parents ADD COLUMN IF NOT EXISTS relationship varchar(50);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS address_line1 varchar(255);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS address_line2 varchar(255);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS city varchar(100);
ALTER TABLE parents ADD COLUMN IF NOT EXISTS postcode varchar(20);

-- 4. children — add registration tracking columns
ALTER TABLE children ADD COLUMN IF NOT EXISTS source student_source DEFAULT 'assessment';
ALTER TABLE children ADD COLUMN IF NOT EXISTS is_registered boolean DEFAULT false;
ALTER TABLE children ADD COLUMN IF NOT EXISTS registered_at timestamp;

-- 5. registrations table
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

-- 6. registration_children table
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

-- 7. registration_parents table
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
