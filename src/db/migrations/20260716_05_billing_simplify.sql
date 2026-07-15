-- Migration: 20260716_05_billing_simplify.sql
-- Redesign billing_configs to a simple family-level agreed-fee model.
-- All billing is per parent per centre; no UC/Non-UC split; no sessions.

-- ─── 1. Drop columns that no longer exist in the new model ───────────────────
ALTER TABLE billing_configs
  DROP COLUMN IF EXISTS child_id,
  DROP COLUMN IF EXISTS billing_type,
  DROP COLUMN IF EXISTS sessions_per_week,
  DROP COLUMN IF EXISTS agreed_rate_pence,
  DROP COLUMN IF EXISTS uc_period_start_day,
  DROP COLUMN IF EXISTS uc_agreed_amount_pence;

-- ─── 2. Add the single agreed monthly fee column ──────────────────────────────
ALTER TABLE billing_configs
  ADD COLUMN IF NOT EXISTS agreed_monthly_pence bigint NOT NULL DEFAULT 0;

-- ─── 3. Unique constraint: one config per parent per centre ───────────────────
DO $$ BEGIN
  ALTER TABLE billing_configs
    ADD CONSTRAINT billing_configs_parent_centre_unique UNIQUE (parent_id, centre_id);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN duplicate_object THEN NULL;
END $$;

-- ─── 4. Create billing_config_children junction table ────────────────────────
CREATE TABLE IF NOT EXISTS billing_config_children (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id  uuid NOT NULL REFERENCES billing_configs(id) ON DELETE CASCADE,
  child_id   uuid NOT NULL REFERENCES children(id)        ON DELETE CASCADE,
  added_at   timestamp NOT NULL DEFAULT now(),
  UNIQUE (config_id, child_id)
);

CREATE INDEX IF NOT EXISTS bcc_config_idx ON billing_config_children(config_id);
CREATE INDEX IF NOT EXISTS bcc_child_idx  ON billing_config_children(child_id);

-- ─── 5. Snapshot column on invoices (records children at invoice time) ────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS covered_children_json jsonb;

-- ─── 6. Drop old billing_type enum (no longer used) ──────────────────────────
-- Note: DROP TYPE CASCADE would drop dependents; we use IF EXISTS and check
-- for references first. The enum column was dropped in step 1, so this is safe.
DROP TYPE IF EXISTS billing_type;

-- ─── 7. Drop non_uc_rate_table (no longer needed) ────────────────────────────
DROP TABLE IF EXISTS non_uc_rate_table;

-- ─── 8. Simplify billing_runs (drop rate columns, they belong on invoices) ───
ALTER TABLE billing_runs
  DROP COLUMN IF EXISTS rate_applied_pence,
  DROP COLUMN IF EXISTS rate_source;

-- Done.
