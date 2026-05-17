-- Phase 1, Task 1.1: Composite Database Indexes
-- Run against production Neon database via console or drizzle-kit
-- Safe to run multiple times — IF NOT EXISTS prevents duplicates
-- Rollback: DROP INDEX <name>;

-- === Bookings (most queried table) ===
-- Covers: centre filtering + status filtering + date sorting
CREATE INDEX IF NOT EXISTS idx_bookings_centre_status_start
  ON bookings (centre_id, status, start_at);

-- Covers: parent lookup (invoice generation, portal)
CREATE INDEX IF NOT EXISTS idx_bookings_parent
  ON bookings (parent_id);

-- Covers: date range queries (dashboard stats, weekly/monthly views)
CREATE INDEX IF NOT EXISTS idx_bookings_created_at
  ON bookings (created_at DESC);

-- === Students / Children ===
-- Covers: parent → children lookup (sibling detection, family view)
CREATE INDEX IF NOT EXISTS idx_children_parent
  ON children (parent_id);

-- === Parents ===
-- Covers: org-scoped parent queries
CREATE INDEX IF NOT EXISTS idx_parents_org
  ON parents (organisation_id);

-- Covers: email lookup (deduplication, portal login)
CREATE INDEX IF NOT EXISTS idx_parents_email
  ON parents (email);

-- === Registrations ===
-- Covers: org + status filtering on registrations list
CREATE INDEX IF NOT EXISTS idx_registrations_org_status
  ON registrations (organisation_id, status);

-- Covers: legacy registrations filtered by centre
CREATE INDEX IF NOT EXISTS idx_student_registrations_centre_status
  ON student_registrations (centre_id, status);

-- === Invoices ===
-- Covers: org-scoped invoice queries + status filtering
CREATE INDEX IF NOT EXISTS idx_invoices_org_status
  ON invoices (organisation_id, status);

-- Covers: parent → invoices lookup (family ledger)
CREATE INDEX IF NOT EXISTS idx_invoices_parent
  ON invoices (parent_id);

-- === Centre Memberships ===
-- Covers: user → centres permission lookup
CREATE INDEX IF NOT EXISTS idx_centre_memberships_user
  ON centre_memberships (user_id);

-- Covers: centre → users lookup
CREATE INDEX IF NOT EXISTS idx_centre_memberships_centre
  ON centre_memberships (centre_id);

-- === Booking Attendees ===
-- Covers: booking → children lookup
CREATE INDEX IF NOT EXISTS idx_booking_attendees_booking
  ON booking_attendees (booking_id);

-- Covers: child → bookings lookup (student profile)
CREATE INDEX IF NOT EXISTS idx_booking_attendees_child
  ON booking_attendees (child_id);

-- === Student Notes ===
-- Covers: child → notes lookup (medical/safeguarding badges)
CREATE INDEX IF NOT EXISTS idx_student_notes_child
  ON student_notes (child_id);

-- === Audit Events ===
-- Covers: org-scoped audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_events_org
  ON audit_events (organisation_id, created_at DESC);

-- === Users ===
-- Covers: org-scoped user queries
CREATE INDEX IF NOT EXISTS idx_users_org
  ON users (organisation_id);
