# SprintScale CMS — Functional Manual: Agreed-Fee Family Billing
## Family Tuition Models, Sibling Coverage, Billing Anchors & Lifecycle Management

---

## 1. What Agreed-Fee Family Billing Is

SprintScale CMS operates a **Family-Level Agreed Monthly Fee Model**. 

Instead of invoicing parents for individual hours or ad-hoc daily sessions, clubs configure a single, agreed monthly tuition amount for the family. This model provides predictable recurring revenue for club operators and consistent monthly billing for parents.

### Core Concepts:
- **Parent-Centric Billing:** The billing agreement is attached to the primary parent account (`parentId`) at a specific centre (`centreId`).
- **Multi-Child Sibling Coverage:** A single billing agreement can cover one, two, or multiple siblings under one combined monthly tuition fee.
- **Billing Anchor Date:** The baseline monthly due date (e.g. the 1st of every month).
- **Invoice Lead Days:** How many days in advance of the due date the invoice is generated (default: 7 days).

---

## 2. Family Fee vs. Individual Child Attendance

```
┌─────────────────────────────────────────────────────────────┐
│                 AGREED-FEE BILLING (COMMERCIAL)             │
│  • Configured at the family level (`billingConfigs`)        │
│  • Fixed monthly amount agreed in advance (e.g. £250/month) │
│  • Covers all nominated siblings under one regular invoice  │
│  • Generates predictable monthly invoices                   │
└──────────────────────────────┬──────────────────────────────┘
                               │  INDEPENDENT OPERATIONAL TRACKS
┌──────────────────────────────▼──────────────────────────────┐
│                SESSION ATTENDANCE (OPERATIONAL)             │
│  • Recorded in real-time per child (`/dashboard/attendance`)│
│  • Tracks physical arrival, check-in time, and departures   │
│  • Absence reasons feed the Session Credit Ledger           │
│  • Does NOT automatically rewrite monthly agreed fee invoices│
└─────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> Attendance activity and family billing are related operational tracks, but **daily attendance does not automatically alter the fixed monthly agreed fee**. If a child misses a session, the absence is recorded in the **Session Credit Ledger** where administrative forgiveness or make-up sessions can be granted without invalidating issued financial invoices.

---

## 3. Billing Configuration Lifecycle & States

A family billing configuration moves through three administrative states:

```
┌─────────────────────────────────────────────────────────────┐
│                 BILLING CONFIG STATUS LIFECYCLE             │
├─────────────────────────────────────────────────────────────┤
│  • `active`: Included in automated & manual monthly runs    │
│  • `paused`: Temporarily suspended (e.g. extended holiday); │
│              skipped during monthly invoice runs            │
│  • `cancelled`: Permanently terminated; no further runs     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Step-by-Step Procedures

### Procedure 1: Setting Up an Agreed Fee for a Family
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. Navigate to: `Sidebar → Students → [Select Pupil]` (or `Sidebar → Parents → [Select Parent]`).
2. Scroll to the **Family Billing & Agreed Fee** card.
3. Click **Configure Billing**.
4. Enter the **Agreed Monthly Fee (£):** e.g. `250.00` (stored internally as `25000` pence).
5. Set the **Billing Anchor Date:** Select the recurring monthly payment date (e.g. `2026-09-01`).
6. Set the **Invoice Lead Days:** Enter how many days before the anchor date the invoice should be created (default: `7`).
7. **Covered Children:** Check the boxes next to all siblings included under this single monthly agreement.
8. (Optional) Enter internal **Billing Notes** (e.g. "Includes sibling discount for Taylor and Jamie").
9. Click **Save Billing Configuration**.

**Expected Result:**
The billing config is created in `active` status. The family will be included in the next monthly invoice run.

---

### Procedure 2: Adding a Sibling to an Existing Billing Agreement
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. Open the student's profile at `Sidebar → Students → [Select Sibling]`.
2. Locate the Family Billing card.
3. Click **Link to Family Agreement**.
4. Select the primary parent's existing billing configuration.
5. Click **Add Child to Config**.

**Expected Result:**
The child is added to `billingConfigChildren`. Future monthly invoice runs will include this child in the `coveredChildrenJson` line-item breakdown.

---

### Procedure 3: Updating an Agreed Monthly Tuition Amount
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. Open the Family Billing card on the student or parent profile.
2. Click **Edit Billing Configuration**.
3. Enter the revised **Agreed Monthly Fee (£):** e.g. `280.00`.
4. Click **Update Configuration**.

> [!IMPORTANT]
> **Historical Invoices Remain Immutable:**
> Updating the agreed fee changes **future** invoice runs only. Historical invoices generated in past months remain completely unchanged.

---

### Procedure 4: Pausing or Resuming a Family Agreement
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**To Pause:**
1. On the Family Billing card, click **Pause Billing**.
2. Confirm the action. Status updates to `paused`. Automated monthly invoice runs will skip this family while paused.

**To Resume:**
1. On the Family Billing card, click **Resume Billing**.
2. Status updates to `active`. The family will be included in subsequent invoice runs.

---

## 5. What Happens When No Agreed Fee Exists

If a registered family does not have an active billing configuration:
- Automated daily billing cron jobs will safely skip the family (`skipped_no_amount`).
- Staff can generate one-off, single-session, or custom invoices on demand using the **+ Create Invoice** or **+ Ad-Hoc Invoice** workflows in `/dashboard/finance`.

---

## 6. Agreed-Fee Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Family skipped during monthly billing run** | Billing config is set to `paused` or agreed amount is set to £0.00. | Check the Family Billing card on the student profile; ensure status is `active` and amount is greater than £0. |
| **New sibling not listed on monthly invoice** | Sibling was registered after the billing config was created and not linked. | Open the billing config, check the sibling in the Covered Children list, and click save. |
| **Front Desk cannot edit billing config for a venue** | Staff member is not assigned to the venue where the family attends. | Ensure the staff member has centre assignment in `Sidebar → Team`. |
| **Agreed fee change did not update last week's invoice** | System preserves historical invoice immutability. | This is by design. If last week's invoice requires correction, an Owner can void or update the specific invoice. |
