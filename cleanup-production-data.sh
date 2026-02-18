#!/bin/bash

# ============================================================
# Production Database Cleanup Script
# ============================================================
# This script removes test data from your PRODUCTION database
# 
# Email addresses to clean:
# - dagenham@sydenhamasc.co.uk
# - dagenhamafterschoolclub@gmail.com
# 
# Usage:
#   1. Get your production DATABASE_URL from Vercel:
#      https://vercel.com/kwadwo-addos-projects/after-school-club-cms/settings/environment-variables
#   
#   2. Run in preview mode:
#      DATABASE_URL="your-prod-url" ./cleanup-production-data.sh
#   
#   3. Execute deletion:
#      DATABASE_URL="your-prod-url" ./cleanup-production-data.sh --confirm
# ============================================================

TEST_EMAIL_1="dagenham@sydenhamasc.co.uk"
TEST_EMAIL_2="dagenhamafterschoolclub@gmail.com"

# Check if DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set!"
  echo ""
  echo "📚 How to get your production DATABASE_URL:"
  echo "   1. Go to: https://vercel.com/kwadwo-addos-projects/after-school-club-cms/settings/environment-variables"
  echo "   2. Find and copy the DATABASE_URL value"
  echo "   3. Run this script with:"
  echo "      DATABASE_URL=\"your-production-url\" ./cleanup-production-data.sh"
  echo ""
  exit 1
fi

CONFIRM_DELETE=false
if [[ "$1" == "--confirm" ]]; then
  CONFIRM_DELETE=true
fi

echo "🔍 Production Database Cleanup Tool"
echo "========================================"
echo "Target emails:"
echo "  - $TEST_EMAIL_1"
echo "  - $TEST_EMAIL_2"
echo ""
echo "⚠️  WARNING: This will connect to your PRODUCTION database!"
echo ""

if [[ "$CONFIRM_DELETE" == false ]]; then
  echo "📋 PREVIEW MODE - No data will be deleted"
  echo "   Run with --confirm flag to execute deletion"
  echo ""
  
  # Show what will be deleted
  echo "Step 1: Finding users..."
  psql "$DATABASE_URL" -c "
    SELECT 
      id, 
      email, 
      name, 
      role, 
      organisation_id,
      created_at
    FROM users 
    WHERE email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2');
  "
  
  echo ""
  echo "Step 2: Finding related organisations..."
  psql "$DATABASE_URL" -c "
    SELECT DISTINCT
      o.id,
      o.name,
      o.slug,
      o.contact_email,
      o.created_at
    FROM organisations o
    JOIN users u ON u.organisation_id = o.id
    WHERE u.email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2');
  "
  
  echo ""
  echo "Step 3: Finding related parents..."
  psql "$DATABASE_URL" -c "
    SELECT 
      p.id,
      p.first_name,
      p.last_name,
      p.email,
      p.organisation_id
    FROM parents p
    WHERE p.organisation_id IN (
      SELECT DISTINCT o.id
      FROM organisations o
      JOIN users u ON u.organisation_id = o.id
      WHERE u.email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2')
    );
  "
  
  echo ""
  echo "Step 4: Counting related data..."
  
  echo "📊 Centres:"
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as centre_count
    FROM centres c
    WHERE c.organisation_id IN (
      SELECT DISTINCT o.id
      FROM organisations o
      JOIN users u ON u.organisation_id = o.id
      WHERE u.email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2')
    );
  "
  
  echo "📊 Children:"
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as children_count
    FROM children ch
    WHERE ch.parent_id IN (
      SELECT p.id
      FROM parents p
      WHERE p.organisation_id IN (
        SELECT DISTINCT o.id
        FROM organisations o
        JOIN users u ON u.organisation_id = o.id
        WHERE u.email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2')
      )
    );
  "
  
  echo "📊 Bookings:"
  psql "$DATABASE_URL" -c "
    SELECT COUNT(*) as booking_count
    FROM bookings b
    WHERE b.parent_id IN (
      SELECT p.id
      FROM parents p
      WHERE p.organisation_id IN (
        SELECT DISTINCT o.id
        FROM organisations o
        JOIN users u ON u.organisation_id = o.id
        WHERE u.email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2')
      )
    );
  "
  
  echo ""
  echo "⚠️  To execute deletion, run:"
  echo "   DATABASE_URL=\"\$DATABASE_URL\" ./cleanup-production-data.sh --confirm"
  
else
  echo "⚠️  DELETION MODE - This will permanently delete production data!"
  echo "   Press Ctrl+C within 10 seconds to cancel..."
  sleep 10
  echo ""
  
  echo "🗑️  Executing deletions on PRODUCTION database..."
  echo ""
  
  # Execute deletions in a transaction
  psql "$DATABASE_URL" << EOF
BEGIN;

-- Delete organisations (CASCADE will handle most related data)
DELETE FROM organisations 
WHERE id IN (
  SELECT DISTINCT o.id
  FROM organisations o
  JOIN users u ON u.organisation_id = o.id
  WHERE u.email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2')
);

-- Delete users (CASCADE will handle accounts and sessions)
DELETE FROM users 
WHERE email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2');

COMMIT;

-- Verify deletion
SELECT 
  'Remaining users: ' || COUNT(*) as verification
FROM users 
WHERE email IN ('$TEST_EMAIL_1', '$TEST_EMAIL_2');

EOF
  
  echo ""
  echo "🎉 Production cleanup completed!"
fi

echo ""
echo "Script finished."
