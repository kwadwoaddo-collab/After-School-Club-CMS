# SprintScale CMS — Role Guide: Organisation Owner
## Complete Operational & Administrative Manual for Organisation Owners

---

## 1. Owner Role Overview

As an **Organisation Owner**, you hold top-level administrative, operational, and financial authority over your entire childcare organisation across all physical club centres.

### Key Responsibilities
- **Multi-Centre Stewardship:** Creating and configuring club centres, opening hours, capacity, and venue bank accounts.
- **Team Governance:** Inviting staff members, assigning centres, and managing role permissions (`Manager`, `Front Desk`, `Tutor`).
- **Financial & Billing Control:** Setting family agreed monthly fees, generating monthly billing cycles, reconciling bank transfers and Tax-Free Childcare vouchers, and issuing payment receipts.
- **Compliance & Safeguarding Oversight:** Reviewing safeguarding logs, maintaining statutory custodial records, and enforcing Ofsted compliance.
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

## 3. Actions Only an Owner Can Perform

SprintScale CMS enforces strict role gates. The following actions are **strictly restricted to Organisation Owners**:

1. **Finance & Invoicing:** Accessing `/dashboard/finance`, creating agreed-fee family billing configs, running billing cycles, voiding invoices, and recording payments.
2. **Team & Permissions:** Inviting staff members, promoting/demoting user roles, and revoking staff access.
3. **Centre Banking Setup:** Configuring sort codes, account numbers, and billing email headers for each centre (`/dashboard/centres/[id]/billing`).
4. **Organisation Branding & Settings:** Uploading organisation logos, setting primary brand colors, and modifying registration terms.
5. **Annual School Year Roll-Forward:** Advancing enrolled students' school years in bulk.
6. **Wonde School Integration:** Connecting API keys and managing school data synchronization.
7. **Permanent GDPR Purge:** Irreversibly erasing soft-deleted parent data from the Recovery Bin.

---

## 4. Step-by-Step Procedures for Owners

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
3. **To Restore:** Click **Restore** next to a parent's name to reactivate their account and children.
4. **To Permanently Delete (GDPR):** Click **Permanent Purge**.

> [!CAUTION]
> Permanent Purge is completely irreversible. It erases the parent's contact records from the database. Only perform this action upon receiving a formal GDPR erasure request.

---

## 5. Owner Troubleshooting Quick Reference

| Issue | Root Cause | Solution |
|---|---|---|
| **Staff cannot see any students on dashboard** | Staff member has not been assigned to any centres. | Open `Sidebar → Team → [Staff Member]`, check the appropriate centre boxes, and click **Save Assignments**. |
| **Invoice generation button disabled or skipped** | An invoice was already generated for this billing cycle. | Check `Sidebar → Finance → Invoices` to view the existing invoice for this period. |
| **Parent claims they cannot log into portal** | Parent email in DB has a typo or parent was soft-deleted. | Open `Sidebar → Parents`, search for the parent, verify their email address, and resend the magic link. |
| **Parent paid via Tax-Free Childcare but invoice shows unpaid** | Voucher remittances require manual verification. | Open `Sidebar → Finance → Reconciliation`, find the invoice, and click **Record Payment**. |
