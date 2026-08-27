# SprintScale CMS — Functional Manual: Academic-Year Roll & Data Maintenance
## Academic-Year Rollover, Soft Deletion, Recovery Bin, 30-Day Purging & Maintenance Controls

---

## 1. What Academic-Year & Data Maintenance Covers

This manual outlines the annual academic progression of pupil records and the data retention lifecycle within SprintScale CMS:

- **Academic Year Progression:** How pupil school years advance from Reception through Year 13 to Graduated status.
- **Automated September 1st Rollover:** The background cron service that automatically rolls pupil year groups forward annually.
- **Soft Deletion & Recovery Bin:** Moving deleted family accounts to the 30-day Recovery Bin (`/dashboard/parents/bin`).
- **Record Restoration:** Restoring soft-deleted parents and children back to active rosters.
- **Permanent Purge:** Hard-deleting records after the 30-day grace period.

---

## 2. Pupil School Year Structure & Progression Rules

In SprintScale, pupil school years are stored on the `children.schoolYear` field.

The progression cycle follows the standard UK national education framework:

```
┌─────────────────────────────────────────────────────────────┐
│                 PUPIL YEAR GROUP PROGRESSION                │
├─────────────────────────────────────────────────────────────┤
│  `Nursery`    ──►  `Reception`                              │
│  `Reception`  ──►  `Year 1` (stored as `'1'`)               │
│  `Year 1`     ──►  `Year 2`                                 │
│      ...      ──►      ...                                  │
│  `Year 12`    ──►  `Year 13`                                │
│  `Year 13`+   ──►  `Graduated`                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The September 1st Rollover Cron (`/api/cron/school-year-roll`)

SprintScale manages annual grade advancement automatically via a dedicated serverless cron endpoint:

1. **Execution Schedule:** Triggers annually on **September 1st**.
2. **Security:** Guarded by an `Authorization: Bearer <CRON_SECRET>` header.
3. **Database Transaction:** Evaluates all pupil records across all organisations and increments their `schoolYear` according to the progression matrix above.
4. **Historical Record Integrity:** Updating a child's current school year does **not** rewrite historical attendance registers, session logs, or past financial invoices from previous school years.

---

## 4. Soft Deletion, Recovery Bin & 30-Day Purge

SprintScale protects against accidental data loss through a two-stage deletion lifecycle:

```
┌─────────────────────────────────────────────────────────────┐
│                 DATA DELETION & RECOVERY PIPELINE           │
├─────────────────────────────────────────────────────────────┤
│  1. Staff click "Delete Family" on parent profile.          │
│                                                             │
│  2. `softDeleteParent` sets `deletedAt = NOW()` on the      │
│     parent and all linked children.                         │
│                                                             │
│  3. Family disappears from active rosters and moves to the  │
│     **Recovery Bin** (`/dashboard/parents/bin`).            │
│                                                             │
│  4. Staff have **30 days** to restore the record with one   │
│     click via `restoreParent`.                              │
│                                                             │
│  5. After 30 days, `purgeStaleBinItems` permanently deletes │
│     the record (`deletedAt < NOW() - 30 days`).             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Step-by-Step Procedures

### Procedure 1: Moving a Family to the Recovery Bin
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. Open the parent's profile at `Sidebar → Parents → [Select Family]`.
2. Scroll to the bottom of the profile card and click **Delete Family** (`DeleteParentButton.tsx`).
3. In the confirmation dialog, review the warning: *"This will move [Parent Name] and their children to the Recovery Bin. You have 30 days to restore them."*
4. Click **Confirm Delete**.

**Expected Result:**
The parent and children are timestamped with `deletedAt`. They are immediately hidden from active student directories and attendance lists.

---

### Procedure 2: Restoring a Family from the Recovery Bin
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. Navigate to: `Sidebar → Parents → Recovery Bin` (`/dashboard/parents/bin`).
2. Locate the family in the deleted items table.
3. Review the **Deleted on** date and **Expires in** counter.
4. Click **Restore Family**.

**Expected Result:**
The system resets `deletedAt = null` for the parent and all children deleted at the same time. The family reappears on active student rosters, attendance registers, and parent lists immediately.

---

### Procedure 3: Permanently Purging a Family Record
> [!CAUTION]
> **Permanent Deletion Warning:**
> Permanently purging a record deletes the parent and cascades to children, medical records, and registration histories. **This action cannot be undone.**

**Steps:**
1. Open the Recovery Bin at `/dashboard/parents/bin`.
2. Locate the record and click **Permanently Delete** (red trash can).
3. Confirm the irreversible purge.
4. The record is permanently removed from the PostgreSQL database.

---

## 6. Distinguishing User Administration from Developer Maintenance

| Activity | Performed By | Interface | Purpose |
|---|---|---|---|
| **Soft Delete & Restore** | Owners, Managers, Front Desk | Recovery Bin UI | Everyday operational archiving and accidental deletion recovery. |
| **Manual Year Update** | Owners, Managers, Front Desk | Student Profile Form | Correcting a child's school year group if misclassified. |
| **Annual Year Rollover** | Automated Server Cron | `/api/cron/school-year-roll` | Bulk annual grade advancement across the organisation. |
| **Emergency Database Seed / Reset** | Software Engineers / Operators | Terminal CLI Scripts (`reset-db.ts`, `seed.ts`) | Development, staging provisioning, and disaster recovery. **Never run in live production.** |
