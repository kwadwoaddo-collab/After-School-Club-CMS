-- ============================================================
-- Cleanup Script for Test Email Addresses
-- ============================================================
-- This script removes all data associated with:
-- 1. dagenham@sydenhamasc.co.uk
-- 2. dagenhamafterschoolclub@gmail.com
-- 
-- WARNING: This action is IRREVERSIBLE. Review carefully before executing.
-- ============================================================

BEGIN;

-- Step 1: Find and display user IDs for these email addresses (for verification)
SELECT 
  id, 
  email, 
  name, 
  role, 
  organisation_id,
  created_at
FROM users 
WHERE email IN ('dagenham@sydenhamasc.co.uk', 'dagenhamafterschoolclub@gmail.com');

-- Step 2: Find and display organisation IDs owned by these users
SELECT DISTINCT
  o.id,
  o.name,
  o.slug,
  o.contact_email,
  o.created_at
FROM organisations o
JOIN users u ON u.organisation_id = o.id
WHERE u.email IN ('dagenham@sydenhamasc.co.uk', 'dagenhamafterschoolclub@gmail.com');

-- Step 3: Find parents associated with these organisations
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
  WHERE u.email IN ('dagenham@sydenhamasc.co.uk', 'dagenhamafterschoolclub@gmail.com')
);

-- ============================================================
-- DELETE OPERATIONS (Comment out the SELECT statements above 
-- and uncomment the DELETE statements below when ready to execute)
-- ============================================================

-- Delete organisations (CASCADE will handle centres, bookings, parents, children, etc.)
-- UNCOMMENT TO EXECUTE:
-- DELETE FROM organisations 
-- WHERE id IN (
--   SELECT DISTINCT o.id
--   FROM organisations o
--   JOIN users u ON u.organisation_id = o.id
--   WHERE u.email IN ('dagenham@sydenhamasc.co.uk', 'dagenhamafterschoolclub@gmail.com')
-- );

-- Delete user accounts directly (this will also cascade to accounts/sessions)
-- UNCOMMENT TO EXECUTE:
-- DELETE FROM users 
-- WHERE email IN ('dagenham@sydenhamasc.co.uk', 'dagenhamafterschoolclub@gmail.com');

-- Verify deletion (should return 0 rows)
-- SELECT COUNT(*) as remaining_users 
-- FROM users 
-- WHERE email IN ('dagenham@sydenhamasc.co.uk', 'dagenhamafterschoolclub@gmail.com');

-- SELECT COUNT(*) as remaining_organisations 
-- FROM organisations o
-- JOIN users u ON u.organisation_id = o.id
-- WHERE u.email IN ('dagenham@sydenhamasc.co.uk', 'dagenhamafterschoolclub@gmail.com');

ROLLBACK;
-- Change to COMMIT; when you're ready to execute the deletes
