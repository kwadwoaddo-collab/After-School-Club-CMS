# Centre-Based Access Control Implementation Guide

## Overview

This system implements **Model 3: Hybrid Role-Based Access Control**, providing:
- Organization-wide access for `ORG_OWNER` users
- Centre-specific access for all other roles
- Flexible user assignment to multiple centres

---

## 🏗️ Architecture

### Data Model

```
organisations (1) ──→ (many) centres
                 ──→ (many) users

users (many) ←──→ (many) centres  [via centreMemberships]

bookings (many) ──→ (1) centre
parents (many) ──→ (1) organisation  [NOT centre-specific]
```

### Permission Levels

| Role | Access Scope | Use Case |
|------|--------------|----------|
| **ORG_OWNER** | All centres | Organization admin |
| **MANAGER** | Assigned centre(s) | Site manager |
| **FRONT_DESK** | Assigned centre(s) | Reception staff |
| **TUTOR** | Assigned centre(s) | Teaching staff |

---

## 📚 Core Functions

### 1. `getUserAccessibleCentres(userId)`
Returns all centres a user can access.

```typescript
import { getUserAccessibleCentres } from '@/lib/permissions';

const centres = await getUserAccessibleCentres(session.user.id);
// ORG_OWNER: Returns all org centres
// Others: Returns only assigned centres
```

### 2. `getUserAccessibleCentreIds(userId)`
Returns array of centre IDs for query filtering.

```typescript
const centreIds = await getUserAccessibleCentreIds(session.user.id);

// Use in queries
const bookings = await db.query.bookings.findMany({
  where: inArray(bookings.centreId, centreIds),
});
```

### 3. `canUserAccessCentre(userId, centreId)`
Check if user can access a specific centre.

```typescript
const canAccess = await canUserAccessCentre(userId, centreId);
if (!canAccess) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### 4. `assignUserToCentre(userId, centreId, role)`
Assign a user to a centre (for non-owners).

```typescript
await assignUserToCentre(newUser.id, centreId, 'FRONT_DESK');
```

---

## 🔄 Migration

### One-Time Setup

Run the migration to assign existing users to all centres:

```bash
npx tsx migrate-users-to-centres.ts
```

This will:
- ✅ Assign all non-owner users to ALL centres in their org
- ✅ Skip ORG_OWNER users (they have implicit access)
- ✅ Preserve existing assignments
- ✅ Use each user's current role

**Safe to run multiple times** - it won't create duplicates.

---

## 🛠️ Implementation Checklist

### Phase 1: Foundation ✅
- [x] Create `src/lib/permissions.ts`
- [x] Add `centreMembershipsRelations` to schema
- [x] Create migration script
- [ ] Run migration on production

### Phase 2: Update Queries
- [ ] Update dashboard bookings query
- [ ] Update students query  
- [ ] Update centres dropdown
- [ ] Update availability query
- [ ] Update notifications query

### Phase 3: UI Updates
- [ ] Add centre filter in dashboard
- [ ] Show only accessible centres in dropdowns
- [ ] Update booking creation flow
- [ ] Update user invite flow

### Phase 4: API Routes
- [ ] Add centre access checks to `/api/bookings`
- [ ] Add centre access checks to `/api/students`
- [ ] Add centre access checks to `/api/availability`

---

## 📝 Code Examples

### Example 1: Filter Dashboard Bookings

**Before:**
```typescript
const bookings = await db.query.bookings.findMany({
  with: { centre: true, parent: true },
});
```

**After:**
```typescript
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const centreIds = await getUserAccessibleCentreIds(session.user.id);

const bookings = await db.query.bookings.findMany({
  where: inArray(bookings.centreId, centreIds),
  with: { centre: true, parent: true },
});
```

### Example 2: Protect API Route

```typescript
import { canUserAccessCentre } from '@/lib/permissions';

export async function GET(req: Request) {
  const session = await auth();
  const { centreId } = await req.json();

  // Check access
  const hasAccess = await canUserAccessCentre(session.user.id, centreId);
  if (!hasAccess) {
    return Response.json({ error: 'Access denied' }, { status: 403 });
  }

  // Proceed with query...
}
```

### Example 3: Assign User During Onboarding

```typescript
import { assignUserToCentre } from '@/lib/permissions';

// When creating a new staff member
const newUser = await db.insert(users).values({
  email: 'staff@example.com',
  organisationId: orgId,
  role: 'FRONT_DESK',
}).returning();

// Assign to specific centre
await assignUserToCentre(newUser[0].id, centreId, 'FRONT_DESK');
```

---

## 🔐 Security Considerations

### Always Check Centre Access

❌ **BAD - No access check:**
```typescript
const booking = await db.query.bookings.findFirst({
  where: eq(bookings.id, bookingId),
});
```

✅ **GOOD - With access check:**
```typescript
const booking = await db.query.bookings.findFirst({
  where: eq(bookings.id, bookingId),
});

if (booking && !(await canUserAccessCentre(userId, booking.centreId))) {
  throw new Error('Access denied');
}
```

### Filter Collections

❌ **BAD - Returns all:**
```typescript
const centres = await db.query.centres.findMany();
```

✅ **GOOD - Returns only accessible:**
```typescript
const centres = await getUserAccessibleCentres(userId);
```

---

## 🧪 Testing

### Test Scenarios

1. **ORG_OWNER Access**
   - ✅ Can see all centres
   - ✅ Can see all bookings
   - ✅ Can manage all data

2. **MANAGER Access**
   - ✅ Can see only assigned centre(s)
   - ✅ Can see bookings only for their centre
   - ❌ Cannot see other centres' data

3. **Multi-Centre Staff**
   - ✅ User assigned to Centre A and Centre B
   - ✅ Can see data from both centres
   - ❌ Cannot see Centre C

4. **Parent Access** (Future)
   - ✅ Parents can book at ANY centre
   - ✅ Parents see ALL their bookings across centres

---

## 🚀 Deployment Steps

### 1. Deploy Code
```bash
git add -A
git commit -m "feat: Implement centre-based access control"
git push origin main
```

### 2. Run Migration (Production)
```bash
# SSH to production or use Vercel CLI
npx tsx migrate-users-to-centres.ts
```

### 3. Verify
- Log in as ORG_OWNER → should see all centres
- Log in as MANAGER → should see only assigned centre
- Test creating bookings
- Test viewing students

---

## 📊 Future Enhancements

### Phase 5: Advanced Features
- [ ] Multi-centre reporting dashboard
- [ ] Cross-centre transfer of students
- [ ] Consolidated billing across centres
- [ ] Centre-specific branding

### Phase 6: Advanced Permissions
- [ ] Custom permission levels
- [ ] Read-only access
- [ ] Time-based access (temporary assignments)
- [ ] Hierarchical centres (regions → centres)

---

## 🆘 Troubleshooting

### User can't see any data
**Cause:** No centre assignments
**Fix:**
```typescript
// Check assignments
const memberships = await db.query.centreMemberships.findMany({
  where: eq(centreMemberships.userId, userId),
});

// If empty, assign to centre
await assignUserToCentre(userId, centreId, 'MANAGER');
```

### ORG_OWNER sees empty list
**Cause:** Query using centreMemberships instead of org-level access
**Fix:** Use `getUserAccessibleCentres()` which handles ORG_OWNER correctly

### Migration not assigning users
**Check:**
- Users have organisationId set?
- Centres exist for the organization?
- Run migration with `--verbose` flag

---

## 📖 Reference

### Database Schema

```sql
-- Centre Memberships Table
CREATE TABLE centre_memberships (
  id UUID PRIMARY KEY,
  centre_id UUID REFERENCES centres(id),
  user_id UUID REFERENCES users(id),
  role USER_ROLE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(centre_id, user_id)
);

-- Index for fast lookups
CREATE INDEX idx_centre_memberships_user 
  ON centre_memberships(user_id);

CREATE INDEX idx_centre_memberships_centre 
  ON centre_memberships(centre_id);
```

### Permission Matrix

| Action | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|--------|-----------|---------|------------|-------|
| View all centres | ✅ | ❌ | ❌ | ❌ |
| View assigned centres | ✅ | ✅ | ✅ | ✅ |
| Create bookings (own centre) | ✅ | ✅ | ✅ | ❌ |
| View all org bookings | ✅ | ❌ | ❌ | ❌ |
| Add users | ✅ | ❌ | ❌ | ❌ |
| Manage availability | ✅ | ✅ | ❌ | ❌ |

---

**Last Updated:** February 16, 2026  
**Status:** Phase 1 Complete - Foundation Ready
