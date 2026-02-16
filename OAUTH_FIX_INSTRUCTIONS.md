# OAuth Account Fix Instructions

## Problem
Google OAuth sign-in fails with "OAuthAccountNotLinked" error because there are duplicate user records or the Google account is linked to the wrong user ID.

## Solution Steps

### Step 1: Get Production Database URL

1. Go to https://vercel.com/kwadwo-addos-projects/after-school-club-cms/settings/environment-variables
2. Find the `DATABASE_URL` environment variable
3. Click "Show" to reveal the value
4. Copy the entire connection string

### Step 2: Run Diagnostic (READ-ONLY)

Run this command, replacing `<DATABASE_URL>` with the value you copied:

```bash
DATABASE_URL="<paste-your-database-url-here>" npx tsx fix-oauth-accounts.ts
```

This will:
- Find all users with email `kwadwoaddo@googlemail.com`
- Show which accounts are linked to each user
- Identify duplicate users
- Recommend fixes (but NOT apply them yet)

### Step 3: Review the Diagnostic Output

The script will show you:
- How many duplicate users exist
- Which user should be the "primary" one  
- What accounts are linked to each user
- What fixes are recommended

### Step 4: Apply the Fix (if safe)

If the diagnostic looks good and you want to proceed with the fix:

```bash
DATABASE_URL="<paste-your-database-url-here>" npx tsx fix-oauth-accounts.ts --apply
```

This will:
- Merge duplicate users into one
- Update Google account to link to the correct user
- Delete duplicate user records

### Step 5: Test Google Sign-In

After applying the fix:
1. Go to https://after-school-club-live.vercel.app/login
2. Click "Sign in with Google"
3. Select your account
4. You should now be redirected to the dashboard successfully!

## Safety Notes

- The diagnostic (Step 2) is completely READ-ONLY and safe
- Only Step 4 makes changes to the database
- The script creates backups by moving accounts before deleting users
- You can cancel at any time before running with `--apply`

## Alternative: Manual Database Check

If you prefer to check the database manually via Vercel:

1. Go to https://vercel.com/kwadwo-addos-projects/after-school-club-cms/storage
2. Click on your Postgres database
3. Go to "Data" tab
4. Run this query:

```sql
SELECT id, email, name, organisation_id, role, created_at, password_hash IS NOT NULL as has_password
FROM users 
WHERE email = 'kwadwoaddo@googlemail.com';
```

Then check linked accounts:

```sql
SELECT a.provider, a.provider_account_id, a.user_id, u.email
FROM accounts a
JOIN users u ON a.user_id = u.id
WHERE a.provider = 'google';
```
