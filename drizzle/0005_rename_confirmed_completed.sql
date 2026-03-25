-- Migration 0005: Rename booking_status enum values
-- 'confirmed' → 'booked'
-- 'completed' → 'attended'
--
-- PostgreSQL doesn't have ALTER TYPE ... RENAME VALUE until PG 10+.
-- We use the PG 10+ syntax here (safe for Neon / Supabase / modern PG).

ALTER TYPE booking_status RENAME VALUE 'confirmed' TO 'booked';
ALTER TYPE booking_status RENAME VALUE 'completed' TO 'attended';

-- Also update the default value on the bookings.status column
ALTER TABLE bookings ALTER COLUMN status SET DEFAULT 'booked';
