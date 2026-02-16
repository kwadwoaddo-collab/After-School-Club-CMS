# 🔄 Migration Instructions: Assign Users to Centres

## ⚠️ Important: Production-Only Migration

This migration should be run **against production database** only, not locally.

---

## 🚀 **Option 1: Run via Vercel (Recommended)**

### Step 1: Create API endpoint for migration

We'll create a protected API endpoint that runs the migration.

**File:** `src/app/api/admin/migrate-users/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, centres, centreMemberships } from '@/db/schema';
import { eq, ne, and } from 'drizzle-orm';

export async function POST(req: Request) {
  // Check authentication
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only allow ORG_OWNER to run migration
  const currentUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (currentUser?.role !== 'ORG_OWNER') {
    return NextResponse.json({ error: 'Only organization owners can run migrations' }, { status: 403 });
  }

  try {
    // Get all users except ORG_OWNERs
    const allUsers = await db.query.users.findMany({
      where: ne(users.role, 'ORG_OWNER'),
    });

    let assignmentsCreated = 0;
    let assignmentsSkipped = 0;

    for (const user of allUsers) {
      if (!user.organisationId) {
        continue;
      }

      // Get all centres in the user's organization
      const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, user.organisationId),
      });

      // Assign user to each centre with their current role
      for (const centre of orgCentres) {
        // Check if assignment already exists
        const existing = await db.query.centreMemberships.findFirst({
          where: and(
            eq(centreMemberships.userId, user.id),
            eq(centreMemberships.centreId, centre.id)
          ),
        });

        if (existing) {
          assignmentsSkipped++;
          continue;
        }

        // Create assignment
        await db.insert(centreMemberships).values({
          userId: user.id,
          centreId: centre.id,
          role: user.role,
        });

        assignmentsCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed: allUsers.length,
      assignmentsCreated,
      assignmentsSkipped,
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

### Step 2: Access the endpoint

1. Deploy the code with the API endpoint
2. Log into production as an ORG_OWNER
3. Use browser console or API client:

```javascript
// In browser console on production site
fetch('/api/admin/migrate-users', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => console.log('Migration result:', data));
```

Or use curl:
```bash
curl -X POST https://after-school-club-live.vercel.app/api/admin/migrate-users \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_COOKIE"
```

---

## 🚀 **Option 2: Vercel CLI (Advanced)**

If you have Vercel CLI installed:

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your project
vercel link

# Run migration script remotely
vercel env pull .env.local
npx tsx migrate-users-to-centres.ts
```

---

## 🚀 **Option 3: Manual Assignment (Testing)**

For testing or if you prefer manual control:

```sql
-- SQL to run in production database console
INSERT INTO centre_memberships (centre_id, user_id, role, created_at)
SELECT 
  c.id as centre_id,
  u.id as user_id,
  u.role,
  NOW() as created_at
FROM centres c
CROSS JOIN users u
WHERE u.organisation_id = c.organisation_id
  AND u.role != 'ORG_OWNER'
  AND NOT EXISTS (
    SELECT 1 FROM centre_memberships cm
    WHERE cm.centre_id = c.id AND cm.user_id = u.id
  );
```

---

## ✅ **Verify Migration Succeeded**

After running the migration, verify:

```sql
-- Check centre memberships were created
SELECT 
  u.email,
  u.role,
  c.name as centre_name,
  cm.created_at
FROM centre_memberships cm
JOIN users u ON cm.user_id = u.id
JOIN centres c ON cm.centre_id = c.id
ORDER BY u.email, c.name;
```

You should see:
- ✅ All non-ORG_OWNER users assigned to centres
- ✅ No ORG_OWNER users in the list (they don't need assignments)
- ✅ Each user assigned to all centres in their organization

---

## 🔄 **After Migration**

Once migration is complete, proceed with updating the dashboard queries to use the new permissions.

---

**Recommended Approach:** Option 1 (API endpoint) - safest and easiest for production
