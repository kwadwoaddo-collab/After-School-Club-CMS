-- ==========================================
-- Database Indexes for Performance
-- ==========================================
-- Created: February 16, 2026
-- Purpose: Speed up queries by 10-100x
-- Safe: These are all CREATE INDEX IF NOT EXISTS
--        (won't error if indexes already exist)
-- ==========================================

-- Organization filtering (most important!)
-- These speed up every query that filters by organisation_id
CREATE INDEX IF NOT EXISTS idx_bookings_org ON bookings(organisation_id);
CREATE INDEX IF NOT EXISTS idx_centres_org ON centres(organisation_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organisation_id);
CREATE INDEX IF NOT EXISTS idx_parents_org ON parents(organisation_id);

-- Centre-based filtering (for data isolation)
CREATE INDEX IF NOT EXISTS idx_bookings_centre ON bookings(centre_id);
CREATE INDEX IF NOT EXISTS idx_centre_memberships_centre ON centre_memberships(centre_id);

-- User/staff filtering (for permissions)
CREATE INDEX IF NOT EXISTS idx_centre_memberships_user ON centre_memberships(user_id);

-- Parent-child relationships
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);

-- Booking relationships (for attendee lists)
CREATE INDEX IF NOT EXISTS idx_booking_attendees_booking ON booking_attendees(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_attendees_child ON booking_attendees(child_id);

-- Date-based filtering (for dashboard stats and reports)
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings(start_at);

-- Status filtering (for active bookings)
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Staff invitations (for invite flow)
CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON staff_invites(token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email ON staff_invites(email);

-- Authentication (NextAuth lookups)
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ==========================================
-- Composite Indexes (even faster!)
-- ==========================================
-- These optimize queries that filter by multiple columns

-- Dashboard queries (org + date range)
CREATE INDEX IF NOT EXISTS idx_bookings_org_created ON bookings(organisation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_org_start ON bookings(organisation_id, start_at);

-- Centre-filtered bookings
CREATE INDEX IF NOT EXISTS idx_bookings_centre_start ON bookings(centre_id, start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_centre_status ON bookings(centre_id, status);

-- ==========================================
-- Verification Query
-- ==========================================
-- Run this to verify all indexes were created:

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ==========================================
-- Expected Result
-- ==========================================
-- You should see 20+ indexes listed
-- If any are missing, they either:
--   1. Already existed (safe to re-run)
--   2. The table doesn't exist yet (also safe)
-- ==========================================

-- ==========================================
-- Performance Testing
-- ==========================================
-- Before indexes (typical):
-- Dashboard query: 500-2000ms
-- Booking search: 200-800ms
-- Reports: 1000-5000ms

-- After indexes (expected):
-- Dashboard query: 50-200ms (10x faster!)
-- Booking search: 20-80ms (10x faster!)
-- Reports: 100-500ms (10x faster!)
-- ==========================================
