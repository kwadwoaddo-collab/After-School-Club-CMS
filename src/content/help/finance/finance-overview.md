# SprintScale CMS — Functional Manual: Finance Overview
## Architecture, Financial Data Model, Monetary Storage & Ledger Controls

---

## 1. What the Finance Module Does

![Figure — Executive Finance Dashboard showing collected fees, pending balances, and overdue totals](/training/assets/screenshots/annotated/SS-D6-S026.png)
*Figure 9.1 — Executive Finance Overview Dashboard*

The **Finance Module** manages the internal commercial and billing lifecycle of your club organisation:

- **Family-Level Agreed Fees:** Setting fixed recurring monthly tuition agreements for enrolled families.
- **Automated & Manual Invoice Runs:** Generating monthly tuition invoices using deterministic billing periods and application-level duplicate checks.
- **Multi-Channel Payment Recording:** Logging cash, bank transfers, Tax-Free Childcare (TFC), childcare vouchers, and online card payments.
- **Voucher & TFC Reconciliation Queue:** Reviewing and verifying or rejecting pending parent voucher submissions on a dedicated reconciliation screen.
- **Financial Auditability & Receipts:** Logging payment timestamps, audit events, downloadable invoice PDFs, and CMS-generated payment record receipts.

---

## 2. "How the System Thinks About Money"

SprintScale CMS is engineered around five fundamental financial rules:

```
┌─────────────────────────────────────────────────────────────┐
│                 5 CORE FINANCIAL ARCHITECTURE RULES          │
├─────────────────────────────────────────────────────────────┤
│  1. FAMILY-LEVEL BILLING: Fees are configured per parent    │
│     account at a specific centre, covering 1+ children.     │
│                                                             │
│  2. FIXED AGREED TUITION: Monthly invoice amounts reflect   │
│     the agreed tuition, not a raw count of attended hours.  │
│                                                             │
│  3. NON-RETROACTIVE INVOICES: Updating an agreed fee applies│
│     to future runs; it does not rewrite issued invoices.    │
│                                                             │
│  4. SESSION CREDITS ≠ CASH: Session ledger absence credits  │
│     track attendance allowances, not monetary bank refunds. │
│                                                             │
│  5. MANUAL RECONCILIATION: Recording a bank or TFC payment  │
│     is an internal log entry; it does not query HMRC/banks. │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Financial Data Model & Entities

| Entity / Table | Primary Responsibility | Key Fields & Monetary Types | Ownership & Scoping |
|---|---|---|---|
| **`billingConfigs`** | Stores the agreed monthly fee and schedule for a family. | `agreedMonthlyPence` (Integer Pence), `billingAnchorDate` (String 'YYYY-MM-DD'), `invoiceLeadDays` (Integer), `status` (`active`, `paused`, `cancelled`). | Belongs to `parentId` at `centreId` within `organisationId`. |
| **`billingConfigChildren`** | Junction table mapping covered siblings to a billing config. | `configId`, `childId`. | Maps 1 billing config to multiple children. |
| **`invoices`** | The issued billing document. | `amount` (String decimal, e.g. `'250.00'`), `status` (`draft`, `sent`, `partially_paid`, `paid`, `void`), `invoiceNumber` (`INV-XXXXXX`), `invoiceDate`, `dueDate`, `billingPeriodStart`, `billingPeriodEnd`, `coveredChildrenJson`. | Belongs to `parentId`, optionally `childId`, at `centreId` within `organisationId`. |
| **`payments`** | Individual financial transactions applied against an invoice. | `amount` (String decimal), `method` (`cash`, `bank_transfer`, `stripe`, `voucher`, `other`), `status` (`verified`, `pending`, `failed`), `transactionReference`, `recordedAt`. | Linked directly to `invoiceId`. |
| **`billingRuns`** | Audit log tracking completed monthly invoice runs. | `billingConfigId`, `periodStart`, `periodEnd`, `invoiceId`, `amountPence`, `runBy`, `success`. | Supports application pre-checks to prevent duplicate runs for the same period. |
| **`sessionCredits`** | Administrative attendance forgiveness balance. | `childId`, `sessionsAmount` (Integer), `notes`, `createdBy`. | Tracks attendance allowances; strictly separate from financial invoices. |

---

## 4. Role & Permission Matrix for Finance

SprintScale enforces granular server-side permission gates for all financial actions:

| Financial Capability / Action | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) | Evidence Source |
|---|---|---|---|---|---|---|
| **Global Finance Dashboard (`/dashboard/finance`)** | ✅ Full Access | ❌ Blocked (Redirect) | ❌ Blocked (Redirect) | ❌ Blocked | ❌ No Access | `src/app/dashboard/finance/page.tsx` |
| **View Invoices / Details** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `getInvoiceDetails` |
| **Create / Update Agreed Fee Config** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `assertCentreAccess` |
| **Generate Monthly Invoices (Run)** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `generateInvoiceFromConfig` |
| **Record Offline Payment (Cash/Bank)** | ✅ Full Access | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `recordPayment` |
| **Reconcile Voucher Submissions** | ✅ Full Access | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `verifyPayment` / `failPayment` |
| **Void an Issued Invoice** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ No Access | ❌ No Access | `voidInvoice` |
| **Delete an Invoice (Zero Payments)** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ No Access | ❌ No Access | `deleteInvoice` |
| **Resend Invoice Notification Email** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ No Access | ❌ No Access | `resendInvoiceEmail` |
| **Parent Portal Billing (`/portal/billing`)** | ❌ Admin View | ❌ Admin View | ❌ Admin View | ❌ No Access | ✅ **Own Invoices Only** | `src/app/portal/billing/page.tsx` |

---

## 5. Monetary Arithmetic & Precision

- **Configuration Storage:** Agreed fees in `billingConfigs` are stored in **integer pence** (e.g. `25000` = £250.00) to eliminate floating-point decimal accumulation errors during recurring schedule calculations.
- **Invoice & Payment Storage:** Stored as decimal strings in PostgreSQL (e.g. `'250.00'`).
- **Outstanding Balance Formula:**
  $$\text{Outstanding Balance} = \text{Invoice Amount} - \sum(\text{Verified Payments})$$
- **Invoice Status Transitions:**
  - If $\sum(\text{Payments}) = 0 \implies \text{Status: } \mathbf{draft} \text{ or } \mathbf{sent}$
  - If $0 < \sum(\text{Payments}) < \text{Invoice Amount} \implies \text{Status: } \mathbf{partially\_paid}$
  - If $\sum(\text{Payments}) \ge \text{Invoice Amount} \implies \text{Status: } \mathbf{paid}$

---

## 6. Financial Reporting & CSV Ledger Export

![Figure — Finance CSV Export Button on the main financial overview ledger](/training/assets/screenshots/annotated/SS-D6-S076.png)
*Figure 9.2 — Finance CSV Export Action*

📹 **Video Walkthrough:** [Watch: Exporting Finance & Invoicing CSV](/training/assets/videos/SS-D6-V043.mp4)

## 7. Overpayment & Correction Rules

- **No Monetary Family Credit Balance:** SprintScale does NOT have a customer credit ledger or surplus balance account. If staff record a payment larger than the invoice amount (e.g. recording £300 on a £250 invoice), the invoice status marks `paid`, but the £50 excess is stored solely as a payment row on that invoice; it does not automatically carry over to other invoices. Staff should record only the amount attributable to the invoice.
- **Parent Portal Overpayment Guard:** When parents submit voucher claims in the portal, the application strictly blocks amounts greater than the remaining balance (`amount > outstandingBalance`).
- **Payment Immutability:** Existing payment rows cannot be edited or deleted in the UI. If a payment was recorded in error, an Owner must void the invoice and re-issue the correct billing record.

---

## 7. What SprintScale Finance Is NOT

To maintain operational clarity:

> [!IMPORTANT]
> **Operational & Accounting Boundaries:**
> - **Not General Ledger Bookkeeping:** SprintScale is a childcare club tuition invoicing and payment logging tool. It does not replace external double-entry accounting software (e.g. Xero, QuickBooks).
> - **Not an Automatic Bank Feed:** The CMS does not connect to banking open-APIs. Recording a bank transfer or TFC receipt reflects an administrative entry made by staff.
> - **No Automatic Tax/VAT Reporting:** SprintScale issues standard club tuition invoices. VAT or corporate tax returns must be managed through your external accountant or bookkeeping software.
