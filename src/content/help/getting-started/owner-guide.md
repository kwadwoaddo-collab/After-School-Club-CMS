# SprintScale CMS — Role Guide: Organisation Owner
## Complete Operational & Administrative Manual for Organisation Owners

---

## 1. Owner Role Overview

![Figure — Dashboard Home & Navigation Overview showing key operational metrics and sidebar modules](/training/assets/screenshots/annotated/SS-D6-S001.png)
*Figure O.1 — Owner Dashboard Overview*

As an **Organisation Owner**, you hold top-level administrative, operational, and financial authority over your entire childcare organisation across all physical club centres.

### Key Responsibilities
- **Multi-Centre Stewardship:** Creating and configuring club centres, opening hours, capacity, and venue bank accounts.
- **Team Governance:** Inviting staff members, assigning centres, and managing role permissions (`Manager`, `Front Desk`, `Tutor`).
- **Financial & Billing Control:** Setting family agreed monthly fees, generating monthly billing cycles, reconciling bank transfers and Tax-Free Childcare vouchers, and issuing payment receipts.
- **Compliance & Safeguarding Oversight:** Reviewing safeguarding logs, maintaining custodial records, and supporting Ofsted record-keeping requirements.
- **Organisation Brand & Settings:** Managing logo branding, terms & conditions, Wonde school integrations, and year-end school grade roll-forwards.

---

## 2. Operational Cadence: Daily, Weekly, Monthly & Occasional

```
┌─────────────────────────────────────────────────────────────┐
│                       DAILY CADENCE                         │
│  • Review Dashboard KPIs, active roll calls & capacity      │
│  • Monitor critical medical alerts and any logged incidents │
│  • Triage new inbound parent registrations                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      WEEKLY CADENCE                         │
│  • Reconcile offline bank transfers & Tax-Free Childcare   │
│  • Review Session Credit Ledgers for attendance arrears     │
│  • Review staff rosters and centre opening hours            │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     MONTHLY CADENCE                         │
│  • Generate recurring monthly invoice run (Billing Cycles)  │
│  • Review outstanding invoices & resend reminders           │
│  • Export financial and attendance CSV reports              │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   OCCASIONAL / ANNUAL                       │
│  • Roll academic school years forward (End of Summer Term)  │
│  • Invite new staff members or update permissions           │
│  • Review and purge soft-deleted records from Recovery Bin  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Actions Strictly Restricted to Organisation Owners

While **Centre Managers** have broad operational management (including invoicing, payments, staff invites, and centre billing for their authorised centres), SprintScale reserves critical legal and platform governance **exclusively for Organisation Owners**:

1. **Invoice Ledger Voiding & Deletion:** Permanently voiding an issued invoice (status transition to 'void' preserving audit history) or deleting an un-paid invoice record (hard deletion, strictly restricted to invoices with zero recorded payments).
2. **Owner Role Governance:** Creating, promoting a user to, or demoting an `Organisation Owner` (`ORG_OWNER`) account.
3. **Cross-Centre Staff Detachment:** Permanently detaching an employee from the organisation container (Managers only remove memberships from their own centres).
4. **Organisation Branding & Identity:** Uploading organisation logos, setting brand colours, and modifying the organisation name, slug, or subdomain.
5. **Annual School Year Rollover:** Bulk advancing enrolled students' school year groups at academic year-end.
6. **Danger Zone & Permanent GDPR Purge:** Irreversibly erasing soft-deleted parent and student data from the Recovery Bin (`hardDeleteParent`), or exporting the full organisation GDPR data archive (JSON). (Routine operational CSV exports remain accessible to Centre Managers for their assigned centres).

> [!NOTE]
> **Delegated Centre Operations:** Centre Managers can view invoices, record payments, reconcile vouchers, invite staff for their assigned centres, configure centre bank details, and edit operational settings (Registration Terms & Discount Rules).

---

## 4. Step-by-Step Procedures for Owners

![Figure — Executive Finance Dashboard showing collected fees, pending balances, and overdue totals](/training/assets/screenshots/annotated/SS-D6-S026.png)
*Figure O.2 — Executive Finance Overview*

📹 **Video Walkthrough:** [Watch: Setting up Agreed Monthly Family Tuition Fee](/training/assets/videos/SS-D6-V013.mp4)

### Procedure 1: Setting Up an Agreed-Fee Family Billing Configuration
> [!FINANCIAL CONTROL]
> SprintScale uses a whole-family monthly fee covering all enrolled siblings at a centre, rather than confusing per-session bills.

1. Navigate to: `Sidebar → Students → [Select Student]`.
2. Scroll to the **Family Billing** section (`BillingSettingsCard`).
3. Click **Configure Recurring Billing**.
4. Enter the **Agreed Monthly Fee** (e.g. `£250.00`).
5. Select the **Billing Anchor Date** (e.g. 1st of the month).
6. Check all sibling children covered under this single monthly fee.
7. Set **Invoice Lead Days** (default is 7 days before the period starts).
8. Click **Save Billing Config**.

---

### Procedure 2: Running the Monthly Automated Billing Run

📹 **Video Walkthrough:** [Watch: Executing Monthly Invoicing Batch Run](/training/assets/videos/SS-D6-V014.mp4)

📹 **Video Walkthrough:** [Watch: Voiding an Incorrect Invoice](/training/assets/videos/SS-D6-V018.mp4)
1. Navigate to: `Sidebar → Finance → Billing Cycles Tab`.
2. Review the list of active family configurations due for billing.
3. Click **Bulk Generate Cycle Invoices** (or click **Generate Invoice** on an individual family card).
4. Review the billing period dates and invoice totals in the confirmation modal.
5. Click **Confirm & Issue Invoices**.
6. The system generates draft invoices with unique `INV-XXXXXX` numbers and logs the run in the audit history.

> [!NOTE]
> Billing runs are **idempotent**. Running generation multiple times will never create duplicate invoices for the same monthly cycle.

---

### Procedure 3: Reconciling Offline Bank & Childcare Voucher Payments
1. Navigate to: `Sidebar → Finance → Reconciliation`.
2. Locate the invoice matching the parent's bank remittance.
3. Click **Record Payment**.
4. Select the payment method: `Bank Transfer`, `Tax-Free Childcare`, `Voucher`, or `Cash`.
5. Enter the amount received and the payment reference (e.g. parent name or TFC remittance code).
6. Click **Verify & Apply Payment**.
7. The invoice updates immediately to `Paid` (or `Partially Paid`) and a downloadable receipt is generated.

---

### Procedure 4: Inviting a Staff Member & Assigning Centres
1. Navigate to: `Sidebar → Team → [+ Invite Staff]`.
2. Enter the staff member's email address.
3. Select their role: `Manager`, `Front Desk`, or `Tutor`.
4. If assigning `Manager`, `Front Desk`, or `Tutor`, check the specific **Centres** they are permitted to access.
5. Click **Send Invitation**.
6. The staff member receives an email invitation containing a secure link to activate their account.

---

### Procedure 5: Executing the Annual Academic School Year Roll-Forward
> [!WARNING]
> Only execute this procedure at the end of the academic summer term (late July / August).

1. Navigate to: `Sidebar → Settings → Academic Year Tab`.
2. Review the total number of enrolled students across all centres.
3. Click **Roll School Years Forward**.
4. Confirm the action in the security dialog.
5. In a single atomic operation, all students advance one grade (Reception → Year 1, Year 1 → Year 2, Year 13 → Graduated).

---

### Procedure 6: Managing the Recovery Bin & Permanent GDPR Purge
1. Navigate to: `Sidebar → Parents → Recovery Bin` (`/dashboard/parents/bin`).
2. Review records soft-deleted within the last 30 days.
3. **To Restore:** Click **Restore** next to a parent's name to reactivate their account and children. (Front Desk, Managers, and Owners can restore records).
4. **To Permanently Delete (GDPR):** Click **Permanent Purge** (`hardDeleteParent`). Only visible to and executable by Organisation Owners.

> [!CAUTION]
> **Permanent GDPR Purge vs. Soft Deletion:**
> - Soft deletion (`softDeleteParent`) moves parent and child records to the Recovery Bin for 30 days and can be performed by Front Desk, Managers, and Owners.
> - Restoring (`restoreParent`) can be performed by Front Desk, Managers, and Owners.
> - Permanent Purge (`hardDeleteParent`) is completely irreversible and hard-deletes parent and child records from the database table. It is restricted exclusively to Organisation Owners. Only perform this action upon receiving a formal GDPR erasure request.

---

## 5. Owner Troubleshooting Quick Reference

| Issue | Root Cause | Solution |
|---|---|---|
| **Staff cannot see any students on dashboard** | Staff member has not been assigned to any centres. | Open `Sidebar → Staff → [Staff Member]`, check the appropriate centre boxes, and click **Save Centre Assignments**. |
| **Invoice generation button disabled or skipped** | An invoice was already generated for this billing cycle. | Check `Sidebar → Finance → Invoices` to view the existing invoice for this period. |
| **Parent claims they cannot log into portal** | Parent email in DB has a typo or parent was soft-deleted. | Open `Sidebar → Parents`, search for the parent, verify their email address, and resend the magic link. |
| **Parent paid via Tax-Free Childcare but invoice shows unpaid** | Voucher remittances require manual verification. | Open `Sidebar → Finance → Reconciliation`, find the invoice, and click **Record Payment**. |
