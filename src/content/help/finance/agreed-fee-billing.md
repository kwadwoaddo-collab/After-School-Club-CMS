# SprintScale CMS — Functional Manual: Agreed-Fee Family Billing
## Family Tuition & Childcare Models, Service Types, Sibling Coverage, Billing Anchors & E-Contracts

---

## 1. What Agreed-Fee Family Billing Is

SprintScale CMS operates a **Family-Level Agreed Monthly Fee Model**.

Instead of invoicing parents for individual hours or ad-hoc daily sessions, clubs configure a fixed recurring monthly fee for the family. This model provides predictable recurring revenue for club operators and consistent monthly billing for parents.

### Core Concepts:
- **Parent-Centric Billing:** The billing agreement is attached to the primary parent account (`parentId`) at a specific centre (`centreId`).
- **Service Type (`Childcare` vs `Tuition`):** Each family billing setup has a **Service type** selector (`Childcare` by default, or `Tuition`). This sets the wording and Ofsted display on all newly generated invoices and receipts for that family, and determines whether a childcare service contract applies.
- **Multi-Child Sibling Coverage:** A single billing agreement can cover one, two, or multiple siblings under one combined monthly fee.
- **Assessment Period & Advance Preparation:** Monthly invoices are prepared **1 calendar month in advance** (or a custom number of days ahead) of the **Assessment period** they cover, with `Due Date` set to Day 1 (the start) of that **Assessment period**.
- **4-State Collection Lifecycle:** Issued invoices move predictably from **Blue (`Upcoming`)** before the assessment period starts, to **Yellow / Amber (`In period · Due`)** throughout the active assessment period (never branded "Overdue"), to **Red (`Overdue · Past assessment period`)** strictly after the assessment period ends if unpaid, and **Green (`Paid in full`)** once verified payments clear 100% of the balance.
- **Deliberate Manual Emails:** Invoice generation and issuance never auto-dispatch emails to parents; staff trigger financial notification emails and contract links as explicit manual actions.

---

## 2. Choosing the Right Service Type: `Childcare` vs `Tuition`

When setting up or editing a family's billing cycle under **Parents → [Select Parent] → Manage billing cycle**, Owners and Centre Managers must select the correct **Service type** before saving or preparing an invoice:

| Setting | Invoice & Receipt Wording | Ofsted Registration Details | Childcare Service E-Contract |
|---|---|---|---|
| **Childcare** *(Default)* | Labelled **Childcare** | **Shown** on invoices and payment receipts | **Enabled** (`Send contract`, `Centre contract details`, `Archive contract`) |
| **Tuition** | Labelled **Tuition** | **Hidden** (all Ofsted lines removed from invoices and receipts) | **Not shown** (childcare service agreements apply only to Childcare families) |

> [!IMPORTANT]
> **Check Service Type Before Generating Any Invoice:**
> Every new family defaults to **Childcare**. When an invoice is generated, its service type (`Childcare` or `Tuition`) is **locked into that invoice** (`invoices.serviceType`) so already-issued invoices and payment receipts never change retroactively if the family's toggle is switched later. Always confirm the right service type is selected **before** clicking **Review / prepare draft invoice** or running a batch billing run.

### Childcare Service Agreements (E-Contracts)
For families set to **Childcare**, Owners and Centre Managers see a **Contract** panel inside `Manage billing cycle`:
- **One-Time Signing Link:** Clicking **Send contract** emails the parent a single-use signing link (`/sign/<token>`, valid for 14 days). Re-sending rotates the link; **Revoke** cancels an unsigned link immediately.
- **Centre Signatory & Provider Details:** Contracts automatically pull the centre's address, phone number, Ofsted registration number, and manager name (`Manager`) from centre settings, or can be overridden under **Centre contract details**. Sending is blocked if any required field or authorised signatory name is missing.
- **Change Detection (No Auto-Send):** If a family's monthly fee or covered children change after a contract is signed, the panel flags **`Amount changed — new contract needed`** or **`Children changed — new contract needed`**. Nothing is sent automatically.
- **Archive, Never Delete:** Signed, expired, or revoked contracts are never deleted. Staff click **Archive contract** to move an old agreement into the collapsed **Archived contracts** list (where signed PDFs remain downloadable) and free the family to receive a fresh contract.

---

## 3. Family Fee vs. Individual Child Attendance

```
┌─────────────────────────────────────────────────────────────┐
│                 AGREED-FEE BILLING (COMMERCIAL)             │
│  • Configured at the family level (`billingConfigs`)        │
│  • Fixed monthly amount agreed in advance (e.g. £250/month) │
│  • Service type (`Childcare` or `Tuition`) set per family   │
│  • Covers all nominated siblings under one regular invoice  │
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
> Attendance activity and family billing are related operational tracks, but **daily attendance does not automatically alter the fixed monthly agreed fee**. If a child misses a session, the absence is recorded in the **Session Credit Ledger** where administrative forgiveness or catch-up sessions can be granted without altering issued financial invoices.

---

## 4. Billing Configuration Lifecycle & States

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

## 5. Step-by-Step Procedures

### Procedure 1: Setting Up an Agreed Fee & Service Type for a Family

![Figure — Agreed-Fee Billing Setup Card with monthly rate, anchor day, and lead days](/training/assets/screenshots/annotated/SS-D6-S027.png)
*Figure 10.1 — Agreed-Fee Family Billing Configuration*

📹 **Video Walkthrough:** [Watch: Setting up Agreed Monthly Family Tuition Fee](/training/assets/videos/SS-D6-V013.mp4)
**Who Can Do This:** Organisation Owner, Centre Manager (for assigned centres)

**Steps:**
1. Navigate to: `Sidebar → Parents → [Select Parent]` and click **Manage billing cycle** (or open `Sidebar → Students → [Select Pupil]` and scroll to the Family Billing card).
2. Click **Set up billing** (or **Edit billing settings** on an existing plan).
3. Enter the **Monthly Family Fee (£):** e.g. `250.00` (stored internally as `25000` pence).
4. Set the **First Billing Period Start Date:** Select the start date of the recurring monthly **Assessment period** (e.g. `2026-09-01`).
5. Choose **Invoice Preparation:** Keep **1 calendar month before (Default)** or set **Custom days before period start**.
6. **Children Covered:** Tick all siblings included under this single monthly agreement (and confirm enrolment inline if prompted).
7. **Select Service type (`Childcare` or `Tuition`):**
   - Choose **Childcare** *(default)* if this is regulated childcare — Ofsted details appear on invoices/receipts and the childcare service contract is enabled.
   - Choose **Tuition** if this is academic tuition only — invoices and receipts are labelled **Tuition** and Ofsted lines are omitted.
8. (Optional) Enter internal **Notes** (e.g. "Includes sibling discount for Taylor and Jamie").
9. Click **Save billing cycle**.
10. *(Childcare families only)* In the **Contract** section, verify **Centre contract details** if needed and click **Send contract** when ready to email the parent their signing link.

**Expected Result:**
The billing config is saved in `active` status with the chosen **Service type**. New draft invoices prepared from this setup lock in that service type (`Childcare` or `Tuition`) and follow the 4-state collection lifecycle (**Blue `Upcoming`** → **Yellow/Amber `In period · Due`** → **Red `Overdue · Past assessment period`** → **Green `Paid in full`**), with email notifications sent only when staff explicitly trigger them.

---

### Procedure 2: Adding a Sibling to an Existing Billing Agreement

![Figure — Sibling Coverage Junction checkboxes linking brothers and sisters to a single fee](/training/assets/screenshots/annotated/SS-D6-S028.png)
*Figure 10.2 — Sibling Coverage Junction Mapping*
**Who Can Do This:** Organisation Owner, Centre Manager (for assigned centres)

**Steps:**
1. Open the family's record at `Sidebar → Parents → [Select Parent] → Manage billing cycle` (or the student's profile).
2. Click **Edit billing settings**.
3. Tick the newly enrolled sibling under **Children Covered**.
4. Click **Save billing cycle**.

**Expected Result:**
The child is added to `billingConfigChildren`, and future monthly invoice runs include them in `coveredChildrenJson`. If the family already has a signed childcare contract, the Contract panel displays **`Children changed — new contract needed`** so staff can archive the previous contract and send an updated one when ready.

---

### Procedure 3: Updating an Agreed Monthly Amount or Service Type
**Who Can Do This:** Organisation Owner, Centre Manager (for assigned centres)

**Steps:**
1. Open `Sidebar → Parents → [Select Parent] → Manage billing cycle`.
2. Click **Edit billing settings**.
3. Update the **Monthly Family Fee (£)** or switch **Service type** between **Childcare** and **Tuition**.
4. Click **Save billing cycle**.

> [!IMPORTANT]
> **Changes Apply Only to Future Invoices:**
> Updating the monthly fee or switching between **Childcare** and **Tuition** applies to **new** invoice runs only. Already-issued invoices and receipts keep the amount and service wording they were generated with. If a signed childcare contract exists and the fee changed, the Contract panel will show **`Amount changed — new contract needed`**.

---

### Procedure 4: Pausing or Resuming a Family Agreement
**Who Can Do This:** Organisation Owner, Centre Manager (for assigned centres)

**To Pause:**
1. Under `Manage billing cycle`, click **Pause**.
2. Confirm the action. Status updates to `paused`. Automated monthly invoice runs will skip this family while paused.

**To Resume:**
1. Under `Manage billing cycle`, click **Resume**.
2. Status updates to `active`. The family will be included in subsequent invoice runs.

---

## 6. What Happens When No Agreed Fee Exists

If a registered family does not have an active billing configuration:
- Automated daily billing cron jobs will safely skip the family (`skipped_no_amount`).
- Staff can generate one-off, single-session, or custom invoices on demand using the **+ Create Invoice** or **+ Ad-Hoc Invoice** workflows in `/dashboard/finance`.

---

## 7. Agreed-Fee Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Tuition invoice or receipt still shows Ofsted details (or says Childcare)** | Family's **Service type** was left on the default **Childcare** when the invoice was generated. | Open `Parents → [Parent] → Manage billing cycle → Edit billing settings`, switch **Service type** to **Tuition**, and save (fixes future invoices). For the already-generated invoice, an Owner can delete it (if unpaid) or void it and prepare a fresh invoice. |
| **Contract panel is not visible for a family** | Family's **Service type** is set to **Tuition** (or no billing setup is saved yet). | Childcare contracts apply only to **Childcare** families. Save a billing cycle with **Service type** set to **Childcare** if a childcare agreement is required. |
| **`Send contract` button says centre details are missing** | Centre record or contract override is missing address, phone, Ofsted number, or signatory name. | Expand **Centre contract details** under the Contract panel (or update `Sidebar → Centres → [Centre] → Billing`) so provider name, address, phone, Ofsted number, and signatory name are filled in. |
| **Family skipped during monthly billing run** | Billing config is set to `paused` or agreed amount is set to £0.00. | Check `Manage billing cycle` on the parent profile; ensure status is `active` and amount is greater than £0. |
| **New sibling not listed on monthly invoice** | Sibling was registered after the billing config was created and not linked. | Open `Edit billing settings`, tick the sibling in **Children Covered**, and save. |
| **Agreed fee change did not update last week's invoice** | Changing an agreed fee or service type applies only to future runs. | This is by design. If last week's invoice requires correction, an Owner can void it (or delete it if zero payments exist) and re-issue. |
