# Production Data Cleanup Guide

This guide explains how to safely delete test data from your production database on Vercel.

## 🎯 What This Cleans Up

The script will delete all data associated with these test email addresses:
- `dagenham@sydenhamasc.co.uk`
- `dagenhamafterschoolclub@gmail.com`

Including:
- User accounts and authentication data (accounts, sessions)
- Organisations they own
- All centres under these organisations
- All parents, children, and bookings
- Centre memberships, staff invites, registrations
- Audit events and notifications

## 📋 Step-by-Step Instructions

### Step 1: Get Your Production Database URL

1. Go to your Vercel project settings:
   ```
   https://vercel.com/kwadwo-addos-projects/after-school-club-cms/settings/environment-variables
   ```

2. Find the `DATABASE_URL` environment variable for **Production**

3. Click the eye icon to reveal the value and copy it
   - It should look like: `postgres://username:password@host:port/database?sslmode=require`

### Step 2: Preview What Will Be Deleted (SAFE - No Changes)

Run this command with your production database URL:

```bash
DATABASE_URL="your-production-database-url-here" ./cleanup-production-data.sh
```

This will show you:
- How many users will be deleted
- Which organisations will be removed
- Count of parents, children, and bookings affected

**Example output:**
```
🔍 Production Database Cleanup Tool
========================================
Target emails:
  - dagenham@sydenhamasc.co.uk
  - dagenhamafterschoolclub@gmail.com

⚠️  WARNING: This will connect to your PRODUCTION database!

📋 PREVIEW MODE - No data will be deleted

Step 1: Finding users...
Found 2 users

Step 2: Finding related organisations...
Found 1 organisation

📊 Centres: 1
📊 Children: 3
📊 Bookings: 5
```

### Step 3: Execute the Deletion (IRREVERSIBLE)

⚠️ **ONLY proceed if you're sure you want to delete this data!**

```bash
DATABASE_URL="your-production-database-url-here" ./cleanup-production-data.sh --confirm
```

The script will:
1. Give you a 10-second countdown to cancel (press Ctrl+C)
2. Execute the deletion in a database transaction
3. Verify the deletion was successful
4. Show confirmation

## ⚠️ Important Safety Notes

1. **Test First**: Always run in preview mode first (without `--confirm`)
2. **Database Backup**: Consider taking a database backup before deletion
3. **Production Impact**: This deletes real production data - there's no undo!
4. **SSL Required**: Make sure your DATABASE_URL includes SSL parameters if required

## 🔒 Security Tips

- **Don't commit**: Never commit files containing your DATABASE_URL
- **Use temporarily**: Copy the URL, use it, then clear your terminal history
- **Environment variable**: Alternatively, export it as an env var:
  ```bash
  export DATABASE_URL="your-url-here"
  ./cleanup-production-data.sh        # Preview
  ./cleanup-production-data.sh --confirm  # Execute
  ```

## 📊 Alternative: Using Vercel's Database Dashboard

If you prefer a GUI approach:

1. Go to your Vercel project
2. Navigate to the "Storage" tab
3. Open your database
4. Use the SQL editor to run queries manually
5. Use the SQL from `cleanup-test-data.sql` file

## ❓ Need Help?

If you encounter any issues:
- Check that your DATABASE_URL is correct
- Ensure you have `psql` installed (PostgreSQL client)
- Verify network access to your database
- Check that SSL mode is correct in the connection string
