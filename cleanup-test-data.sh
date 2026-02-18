#!/bin/bash

# ============================================================
# Cleanup Script for Test Email Addresses
# ============================================================
# This script removes all data associated with:
# - dagenham@sydenhamasc.co.uk
# - dagenhamafterschoolclub@gmail.com
# 
# Usage:
#   ./cleanup-test-data.sh              # Preview mode (shows what will be deleted)
#   ./cleanup-test-data.sh --confirm    # Execute deletion
# ============================================================

DB_NAME="after_school_club"
DB_USER="kwadw"
TEST_EMAIL_1="dagenham@sydenhamasc.co.uk"
TEST_EMAIL_2="dagenhamafterschoolclub@gmail.com"

CONFIRM_DELETE=false
if [[ "$1" == "--confirm" ]]; then
  CONFIRM_DELETE=true
fi

echo "🔍 Cleanup Tool for Test Email Addresses"
echo "========================================"
echo "Test emails:"
echo "  - $TEST_EMAIL_1"
echo "  - $TEST_EMAIL_2"
echo ""

if [[ "$CONFIRM_DELETE" == false ]]; then
  echo "📋 PREVIEW MODE - No data will be deleted"
  echo "   Run with --confirm flag to execute deletion"
  echo ""
  
  # Show what will be deleted
  echo "Step 1: Finding users..."
  psql -U "$DB_USER" -d "$DB_NAME" -c "
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
  psql -U "$DB_USER" -d "$DB_NAME" -c "
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
  psql -U "$DB_USER" -d "$DB_NAME" -c "
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
  psql -U "$DB_USER" -d "$DB_NAME" -c "
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
  psql -U "$DB_USER" -d "$DB_NAME" -c "
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
  psql -U "$DB_USER" -d "$DB_NAME" -c "
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
  echo "   ./cleanup-test-data.sh --confirm"
  
else
  echo "⚠️  DELETION MODE - This will permanently delete data!"
  echo "   Press Ctrl+C within 5 seconds to cancel..."
  sleep 5
  echo ""
  
  echo "🗑️  Executing deletions..."
  echo ""
  
  # Execute deletions in a transaction
  psql -U "$DB_USER" -d "$DB_NAME" << EOF
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
  echo "🎉 Cleanup completed!"
fi

echo ""
echo "Script finished."
