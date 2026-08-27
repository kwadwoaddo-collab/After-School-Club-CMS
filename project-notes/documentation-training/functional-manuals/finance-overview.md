# SprintScale CMS — Functional Manual: Finance Overview
## Architecture, Financial Data Model, Monetary Storage & Ledger Controls

---

## 1. What the Finance Module Does

The **Finance Module** manages the end-to-end commercial and billing lifecycle of your club organisation:

- **Family-Level Agreed Fees:** Setting fixed recurring monthly tuition agreements for enrolled families.
- **Automated & Manual Invoice Runs:** Generating monthly tuition invoices using deterministic billing periods and idempotency controls.
- **Multi-Channel Payment Recording:** Logging cash, bank transfers, Tax-Free Childcare (TFC), childcare vouchers, and online card payments.
- **Voucher & TFC Reconciliation:** Verifying or rejecting pending parent voucher submissions on a dedicated reconciliation screen.
- **Financial Auditability & Receipts:** Tracking exact payment timestamps, audit logs, on-demand PDF invoices, and payment receipts.

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
│  3. STRICT RECORD IMMUTABILITY: Issued invoices are never   │
│     silently rewritten; payments are appended to a ledger.  │
│                                                             │
│  4. SESSION CREDITS ≠ CASH: Session ledger absence credits  │
│     track attendance allowances, not monetary bank refunds. │
│                                                             │
│  5. MANUAL EXTERNAL RECONCILIATION: Recording a bank or TFC │
│     payment documents a receipt; it does not call HMRC/banks│
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Financial Data Model & Entities

| Entity / Table | Primary Responsibility | Key Fields & Monetary Types | Ownership & Scoping |
|---|---|---|---|
| **`billingConfigs`** | Stores the agreed monthly fee and schedule for a family. | `agreedMonthlyPence` (Integer Pence), `billingAnchorDate` (String 'YYYY-MM-DD'), `invoiceLeadDays` (Integer), `status` (`active`, `paused`, `cancelled`). | Belongs to `parentId` at `centreId` within `organisationId`. |
| **`billingConfigChildren`** | Junction table mapping covered siblings to a billing config. | `configId`, `childId`. | Maps 1 billing config to multiple children. |
| **`invoices`** | The immutable issued billing document. | `amount` (String decimal, e.g. `'250.00'`), `status` (`draft`, `sent`, `partially_paid`, `paid`, `void`), `invoiceNumber` (`INV-XXXXXX`), `invoiceDate`, `dueDate`, `billingPeriodStart`, `billingPeriodEnd`, `coveredChildrenJson`. | Belongs to `parentId`, optionally `childId`, at `centreId` within `organisationId`. |
| **`payments`** | Individual financial transactions applied against an invoice. | `amount` (String decimal), `method` (`cash`, `bank_transfer`, `stripe`, `voucher`, `other`), `status` (`verified`, `pending`, `failed`), `transactionReference`, `recordedAt`. | Linked directly to `invoiceId`. |
| **`billingRuns`** | Idempotency record tracking completed monthly invoice runs. | `billingConfigId`, `periodStart`, `periodEnd`, `invoiceId`, `amountPence`, `runBy`, `success`. | Guarantees duplicate invoices are never generated for the same period. |
| **`sessionCredits`** | Administrative attendance forgiveness balance. | `childId`, `sessionsAmount` (Integer), `notes`, `createdBy`. | Tracks attendance allowances; strictly separate from financial invoices. |

---

## 4. Role & Permission Matrix for Finance

SprintScale enforces strict server-side permission gates for all financial actions:

| Financial Capability / Action | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) | Evidence Source |
|---|---|---|---|---|---|---|
| **Global Finance Dashboard (`/dashboard/finance`)** | ✅ Full Access | ❌ Blocked (Redirect) | ❌ Blocked (Redirect) | ❌ Blocked | ❌ No Access | `src/app/dashboard/finance/page.tsx` |
| **View Centre Invoices** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `src/features/finance/actions.ts` |
| **Create / Update Agreed Fee Config** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `src/features/billing/actions.ts` |
| **Generate Monthly Invoices (Run)** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `generateInvoiceFromConfig` |
| **Record Offline Payment (Cash/Bank/TFC)**| ✅ Full Access | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `recordPayment` |
| **Reconcile Voucher Submissions** | ✅ Full Access | ✅ Assigned Centres | ✅ Assigned Centres | ❌ No Access | ❌ No Access | `verifyPayment` / `failPayment` |
| **Void an Issued Invoice** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ No Access | ❌ No Access | `voidInvoice` |
| **Delete an Invoice (No Payments)** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ No Access | ❌ No Access | `deleteInvoice` |
| **Resend Invoice Notification Email** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ No Access | ❌ No Access | `resendInvoiceEmail` |
| **Parent Portal Billing (`/portal/billing`)** | ❌ Admin View | ❌ Admin View | ❌ Admin View | ❌ No Access | ✅ **Own Invoices Only** | `src/app/portal/billing/page.tsx` |

---

## 5. Monetary Arithmetic & Precision

- **Configuration Storage:** Agreed fees in `billingConfigs` are stored in **integer pence** (e.g. `25000` = £250.00) to eliminate floating-point rounding errors during calculation.
- **Invoice & Payment Storage:** Stored as PostgreSQL numeric/string decimals (e.g. `'250.00'`) for precise accounting display.
- **Outstanding Balance Formula:**
  $$\text{Outstanding Balance} = \text{Invoice Amount} - \sum(\text{Verified Payments})$$
- **Invoice Status Transitions:**
  - If $\sum(\text{Payments}) = 0 \implies \text{Status: } \mathbf{draft} \text{ or } \mathbf{sent}$
  - If $0 < \sum(\text{Payments}) < \text{Invoice Amount} \implies \text{Status: } \mathbf{partially\_paid}$
  - If $\sum(\text{Payments}) \ge \text{Invoice Amount} \implies \text{Status: } \mathbf{paid}$

---

## 6. What SprintScale Finance Is NOT

To maintain regulatory and operational clarity:

> [!IMPORTANT]
> **Operational & Accounting Boundaries:**
> - **Not General Ledger Bookkeeping:** SprintScale is a childcare club tuition invoicing and payment logging tool. It does not replace double-entry accounting software (e.g. Xero, QuickBooks).
> - **Not an Automatic Bank Feed:** The CMS does not connect directly to banking open-APIs. Recording a bank transfer or TFC receipt reflects an administrative entry made by staff.
> - **No Automatic Tax/VAT Reporting:** SprintScale issues standard club tuition invoices. VAT or corporate tax returns must be managed through your external accountant or bookkeeping software.
