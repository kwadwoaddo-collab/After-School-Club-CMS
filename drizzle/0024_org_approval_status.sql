-- Migration 0024: PM-1.2 — Organisation approval lifecycle
-- Safe 5-step sequence for PostgreSQL/Drizzle:
-- 1. Create enum (idempotent guard)
-- 2. Add columns nullable (no default) — avoids full-table rewrite
-- 3. Backfill ALL pre-existing rows to ACTIVE
-- 4. Set column default to PENDING + enforce NOT NULL
-- 5. Add index for platform admin list view

-- Step 1: Create enum type (idempotent)
DO $$ BEGIN
  CREATE TYPE "organisation_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Add columns nullable, no default
-- (Avoids a full table rewrite on large tables; each ADD is a metadata operation)
ALTER TABLE "organisations"
  ADD COLUMN IF NOT EXISTS "approval_status"   "organisation_status",
  ADD COLUMN IF NOT EXISTS "approved_at"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "approved_by"        UUID,
  ADD COLUMN IF NOT EXISTS "rejection_reason"   TEXT;

-- Step 3: Backfill every pre-existing row to ACTIVE
-- These are tenants that existed before the approval feature; they must remain operational.
UPDATE "organisations"
  SET "approval_status" = 'ACTIVE'
  WHERE "approval_status" IS NULL;

-- Step 4: Apply final schema invariants — default PENDING, NOT NULL
ALTER TABLE "organisations"
  ALTER COLUMN "approval_status" SET DEFAULT 'PENDING',
  ALTER COLUMN "approval_status" SET NOT NULL;

-- Step 5: Index for platform admin org list (filter/sort by status)
CREATE INDEX IF NOT EXISTS "orgs_approval_status_idx"
  ON "organisations"("approval_status");

-- Verification (run after migration to confirm correctness):
-- SELECT column_default FROM information_schema.columns
--   WHERE table_name = 'organisations' AND column_name = 'approval_status';
-- Expected: 'PENDING'
--
-- SELECT COUNT(*) FROM organisations WHERE approval_status != 'ACTIVE';
-- Expected: 0  (all pre-existing rows are ACTIVE)
