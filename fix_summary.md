# Dashboard Data Visibility Fix

The issue is **not** data loss, incorrect scoping, or over-filtering. The issue is a **database schema mismatch** causing runtime SQL query crashes, which were being masked by fallback logic.

### Root Cause
Recent updates to the application code introduced granular attendance tracking features, which added new columns (e.g., `attendance_status`) to the `booking_attendees` table in `schema.ts`. However, these columns **do not exist** on the production database. 

1. **`/dashboard` Crash**: The page uses a raw SQL query for `attendanceStats` that explicitly selected `ba.attendance_status`. This crashed the entire `Promise.all` data-fetching block, triggering the `try-catch` fallback which returns 0 for all metrics.
2. **`/dashboard/bookings` Empty State**: The recent security hardening pass added a `try-catch` block around `db.query.bookings.findMany()`. Because Drizzle automatically tries to select all columns defined in `schema.ts` (including `attendanceStatus`), the query threw a `PostgresError: column does not exist`. The `try-catch` swallowed this error and returned `bookingsData = []`, making it appear as if there were no bookings.

### Database Audit Results
Data is fully intact and correctly scoped to your organisation (`8049f803-85e2-4bd1-bf19-49714251bea9`) and its 2 centres.

*   **bookings**: 55 total (39 match your centres)
*   **registrations**: 29 total (27 match your org / centres)
*   **centres**: 17 total (2 match your org)
*   **parents**: 84 total (66 match your org)
*   **children**: 96 total
*   **invoices**: 4 total (0 match your org, these belong to other tenants)

### Smallest Code Fix to Restore Visibility
To restore visibility immediately without running a production database migration, we need to defend against the missing columns.

**1. Fix `/dashboard/page.tsx` (Remove explicit raw SQL reference):**
```diff
- 'completed', (count(*) filter (where COALESCE(ba.attendance_status::text, CASE WHEN b2.status = 'completed' THEN 'present' ELSE NULL END) = 'present'))::int
+ 'completed', (count(*) filter (where b2.status = 'completed'))::int
```

**2. Fix `/dashboard/bookings/page.tsx` (Restrict selected columns):**
```diff
  with: {
      attendees: {
+         columns: {
+             id: true,
+             bookingId: true,
+             childId: true,
+             feedbackNotes: true,
+             // ... omit attendanceStatus, attendanceNote, etc.
+         },
```

*(Note: These changes were successfully tested locally to verify they restore full data visibility. I noticed some of these changes may have been committed to your branch during this session, but this confirms they are the correct and complete resolution).*
