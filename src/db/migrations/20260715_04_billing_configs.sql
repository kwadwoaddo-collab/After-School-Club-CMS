-- Migration: Billing Configs, Billing Runs, Non-UC Rate Table
-- Date: 2026-07-15
-- All statements are additive — zero changes to existing data

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE billing_type AS ENUM ('non_uc', 'uc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_status AS ENUM ('active', 'paused', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── billing_configs ────────────────────────────────────────────────────────────
-- Per-student (Non-UC) or per-parent (UC) billing configuration.
-- childId is nullable for UC family invoices.

CREATE TABLE IF NOT EXISTS billing_configs (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       uuid          NOT NULL,
  centre_id             uuid          NOT NULL,
  parent_id             uuid          NOT NULL,
  child_id              uuid,                                         -- NULL for UC family configs

  billing_type          billing_type  NOT NULL DEFAULT 'non_uc',

  -- Non-UC fields
  sessions_per_week     integer,                                      -- drives rate table lookup
  agreed_rate_pence     integer,                                      -- NULL = use standard rate table

  -- UC fields
  uc_period_start_day   integer,                                      -- e.g. 29 → period 29th→28th next month
  uc_agreed_amount_pence integer,                                     -- total agreed, covers all children

  -- Shared schedule
  billing_anchor_date   date          NOT NULL,                       -- first billing date — cycle anchor
  billing_end_date      date,                                         -- set when student leaves
  invoice_lead_days     integer       NOT NULL DEFAULT 7,             -- days before due date to issue invoice
  status                billing_status NOT NULL DEFAULT 'active',
  notes                 text,

  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT uc_start_day_range
    CHECK (uc_period_start_day IS NULL OR uc_period_start_day BETWEEN 1 AND 31),
  CONSTRAINT sessions_per_week_positive
    CHECK (sessions_per_week IS NULL OR sessions_per_week > 0),
  CONSTRAINT invoice_lead_days_positive
    CHECK (invoice_lead_days > 0),
  CONSTRAINT agreed_rate_positive
    CHECK (agreed_rate_pence IS NULL OR agreed_rate_pence > 0),
  CONSTRAINT uc_amount_positive
    CHECK (uc_agreed_amount_pence IS NULL OR uc_agreed_amount_pence > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS billing_configs_org_idx    ON billing_configs (organisation_id);
CREATE INDEX IF NOT EXISTS billing_configs_centre_idx ON billing_configs (centre_id);
CREATE INDEX IF NOT EXISTS billing_configs_parent_idx ON billing_configs (parent_id);
CREATE INDEX IF NOT EXISTS billing_configs_child_idx  ON billing_configs (child_id);

-- Idempotency: only one active config per child (Non-UC)
CREATE UNIQUE INDEX IF NOT EXISTS billing_configs_active_child_uniq
  ON billing_configs (child_id, status)
  WHERE child_id IS NOT NULL AND status = 'active';

-- ── billing_runs ───────────────────────────────────────────────────────────────
-- Audit log for every invoice generation. Prevents double-invoicing.

CREATE TABLE IF NOT EXISTS billing_runs (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_config_id     uuid          NOT NULL REFERENCES billing_configs (id) ON DELETE RESTRICT,

  period_start          date          NOT NULL,
  period_end            date          NOT NULL,
  invoice_id            uuid,                                         -- soft ref to invoices table

  rate_applied_pence    integer       NOT NULL,                       -- snapshot of rate used
  rate_source           text          NOT NULL,                       -- 'standard_table' | 'agreed_override' | 'uc_agreed'

  run_at                timestamptz   NOT NULL DEFAULT now(),
  run_by                uuid,                                         -- NULL = automated, set = staff

  success               boolean       NOT NULL DEFAULT true,
  error_log             text,

  created_at            timestamptz   NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS billing_runs_config_idx  ON billing_runs (billing_config_id);
CREATE INDEX IF NOT EXISTS billing_runs_period_idx  ON billing_runs (period_start);
CREATE INDEX IF NOT EXISTS billing_runs_invoice_idx ON billing_runs (invoice_id);

-- Idempotency: one successful run per config per period
CREATE UNIQUE INDEX IF NOT EXISTS billing_runs_idempotent_uniq
  ON billing_runs (billing_config_id, period_start)
  WHERE success = true;

-- ── non_uc_rate_table ──────────────────────────────────────────────────────────
-- Per-org configurable rate card. Seeded with defaults at deploy time.

CREATE TABLE IF NOT EXISTS non_uc_rate_table (
  id                      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id         uuid    NOT NULL,
  sessions_per_week       integer NOT NULL,                           -- 1–5 (row with 5 covers 5+)
  monthly_rate_pence      integer NOT NULL,                           -- e.g. 20000 = £200
  extra_session_rate_pence integer,                                   -- for the 5+ row: £40 per extra
  effective_from          date    NOT NULL DEFAULT CURRENT_DATE,

  CONSTRAINT monthly_rate_positive CHECK (monthly_rate_pence > 0),

  UNIQUE (organisation_id, sessions_per_week, effective_from)
);

CREATE INDEX IF NOT EXISTS non_uc_rate_org_idx ON non_uc_rate_table (organisation_id);

-- ── Additive columns on invoices ───────────────────────────────────────────────
-- Soft link back to billing config (no FK — existing manual invoices are unaffected)

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_config_id    uuid;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_period_label varchar(100);
