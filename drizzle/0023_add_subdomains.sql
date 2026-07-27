-- Migration 0023: Add subdomain routing columns
-- Adds a clean, short subdomain field to both organisations and centres.
-- This enables per-org (lewisham.sprintscaleit.co.uk) and 
-- per-centre (dagenham.sprintscaleit.co.uk) routing.

ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "subdomain" varchar(63) UNIQUE;
ALTER TABLE "centres" ADD COLUMN IF NOT EXISTS "subdomain" varchar(63) UNIQUE;

-- Seed Sydenham After School Club LTD centres
UPDATE "centres" SET "subdomain" = 'sydenham' 
WHERE "id" = 'f6b53974-d3a1-43d4-bdca-fc9efb074377';

UPDATE "centres" SET "subdomain" = 'dagenham' 
WHERE "id" = 'a2892c09-b0c5-4fbd-ba79-de542759df90';
