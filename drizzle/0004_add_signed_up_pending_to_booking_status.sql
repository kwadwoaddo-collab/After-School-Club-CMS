-- Migration: add 'pending' and 'signed_up' to the booking_status enum
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block,
-- so we use IF NOT EXISTS (Postgres 9.6+) to make it safe to re-run.

ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'signed_up';
