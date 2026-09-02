# SprintScale CMS — Functional Manual: Academic-Year Roll & Data Maintenance
## Academic-Year Rollover, Soft Deletion, Recovery Bin, 30-Day Purging & Maintenance Controls

---

## 1. What Academic-Year & Data Maintenance Covers

This manual outlines the annual academic progression of pupil records and the data retention lifecycle within SprintScale CMS:

- **Academic Year Progression:** How pupil school years advance from Reception through Year 13 to Graduated status.
- **Automated September 1st Rollover Cron:** The serverless background cron service (`/api/cron/school-year-roll`) that advances pupil year groups annually with durable idempotency and concurrency guards.
- **Soft Deletion & Recovery Bin:** Moving archived family accounts to the Recovery Bin (`/dashboard/parents/bin`).
- **Record Restoration:** Restoring soft-deleted parents and children back to active rosters.
- **30-Day Purge Eligibility & Permanent Deletion:** Hard-deleting records lazily or permanently destroying records (Owner only).

---

## 2. Pupil School Year Structure & Progression Rules

In SprintScale, pupil school years are stored as strings on the `children.schoolYear` field.

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
│  `Graduated`  ──►  `Graduated` (stable terminal state)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. The September 1st Rollover Cron (`/api/cron/school-year-roll`)

SprintScale executes annual grade advancement via an automated serverless cron endpoint:

1. **Execution Schedule:** Scheduled annually on **September 1st at 00:00 UTC**.
2. **Security:** Guarded by an `Authorization: Bearer <CRON_SECRET>` header.
3. **Transactional Advisory Lock:** Uses a PostgreSQL transaction advisory lock (`pg_try_advisory_xact_lock`) to prevent concurrent duplicate invocations.
4. **Durable Idempotency Guard:** Checks the `auditEvents` table for a completed `school_year_rollover_completed` record for the target rollover year. If a rollover for that year has already completed, subsequent runs safely exit as no-ops (`skipped: true`).
5. **Database Progression:** Advances all pupil records globally across all organisations and increments their `schoolYear` according to the progression matrix above.
6. **Historical Record Integrity:** Updating a child's current school year does **not** alter past attendance registers, session logs, or historical invoices.

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
│  3. Family is hidden from active rosters and moves to the   │
│     **Recovery Bin** (`/dashboard/parents/bin`).            │
│                                                             │
│  4. Authorised staff can restore the record via             │
│     `restoreParent` (`deletedAt` reset to `null`).          │
│                                                             │
│  5. Records become eligible for purge after 30 days.        │
│     `purgeStaleBinItems` lazily purges expired items on     │
│     Recovery Bin page loads (`deletedAt < NOW() - 30 days`).│
│                                                             │
│  6. Permanent on-demand purge (`hardDeleteParent`) is       │
│     strictly restricted to Organisation Owners.             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Who Can Access the Recovery Bin & Permanently Purge

| Role | Move to Bin (`softDeleteParent`) | Restore Family (`restoreParent`) | Permanent Purge (`hardDeleteParent`) |
|---|---|---|---|
| **Organisation Owner (`ORG_OWNER`)** | ✅ Allowed | ✅ Allowed | ✅ **Allowed (Owner Only)** |
| **Centre Manager (`MANAGER`)** | ✅ Allowed | ✅ Allowed | ❌ **Blocked** |
| **Front Desk (`FRONT_DESK`)** | ✅ Allowed | ✅ Allowed | ❌ **Blocked** |
| **Tutor (`TUTOR`)** | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Parent (`PARENT`)** | ❌ Blocked | ❌ Blocked | ❌ Blocked |

---

## 6. Step-by-Step Procedures

### Procedure 1: Moving a Family to the Recovery Bin
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk

**Steps:**
1. Open the parent's profile at `Sidebar → Parents → [Select Family]`.
2. Scroll to the bottom of the profile card and click **Delete Family** (`DeleteParentButton.tsx`).
3. In the confirmation dialog, review the warning: *"This will move [Parent Name] and their children to the Recovery Bin. You have 30 days to restore them before they are permanently deleted."*
4. Click **Confirm Delete**.

**Expected Result:**
The parent and children are timestamped with `deletedAt`. They are immediately hidden from active student directories and attendance lists.

---

### Procedure 2: Restoring a Family from the Recovery Bin
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Parents → Recovery Bin` (`/dashboard/parents/bin`).
2. Locate the family in the deleted items table.
3. Review the **Deleted on** date and **Expires in** counter.
4. Click **Restore Family**.

**Expected Result:**
The system resets `deletedAt = null` for the parent and all children deleted at the same time. The family reappears on active student rosters, attendance registers, and parent lists immediately.

---

### Procedure 3: Permanently Purging a Family Record
**Who Can Do This:** Organisation Owner (`ORG_OWNER`) Only

> [!CAUTION]
> **Permanent Deletion Warning:**
> Permanently purging a record deletes the parent and cascades to children, medical records, and registration histories. **This action is irreversible.** For safety, this button is visible and executable strictly by Organisation Owners.

**Steps:**
1. Log in as an Organisation Owner and open `/dashboard/parents/bin`.
2. Locate the record and click **Delete forever** (red trash can).
3. Confirm the irreversible purge in the dialog.
4. The record is permanently deleted from PostgreSQL via `hardDeleteParent`.
