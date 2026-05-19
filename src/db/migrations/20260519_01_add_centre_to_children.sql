-- ============================================================
-- Phase 1: Add organisationId and centreId to children table
-- Non-breaking: both columns are nullable
-- Safe to re-run (idempotent via IF NOT EXISTS)
-- ============================================================

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES organisations(id),
  ADD COLUMN IF NOT EXISTS centre_id       UUID REFERENCES centres(id);

-- Indexes for fast scoping in visibility queries
CREATE INDEX IF NOT EXISTS idx_children_organisation_id ON children(organisation_id);
CREATE INDEX IF NOT EXISTS idx_children_centre_id       ON children(centre_id);
