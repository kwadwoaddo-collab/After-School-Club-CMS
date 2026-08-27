# SprintScale CMS — Troubleshooting Handbook
## Milestone D4: Finance, Invoices, Agreed Fees, Payments & Reconciliation

**Target Audience:** Front Desk Staff, Centre Managers, Organisation Owners  
**Scope:** Practical resolution steps for operational errors during billing runs, invoice adjustments, payment logging, and voucher reconciliation.

---

## Master Troubleshooting Index

1. [Invoice run error: "Invoice already generated for period"](#1-duplicate-invoice-run-attempted)
2. [Family was skipped during automated monthly billing run](#2-family-skipped-during-monthly-run)
3. [Wrong agreed fee amount applied to an invoice](#3-wrong-agreed-fee-amount-applied)
4. [Billing period start or end dates appear incorrect](#4-wrong-billing-period-dates)
5. [Recorded offline payment is not reflected in invoice balance](#5-payment-not-reflected-in-balance)
6. [Partial payment logged, invoice status is partially paid instead of paid](#6-partial-payment-status)
7. [Parent receives error: "Payment amount exceeds outstanding balance"](#7-voucher-overpayment-error)
8. [Duplicate payment reference recorded by mistake](#8-duplicate-payment-reference)
9. [Tax-Free Childcare (TFC) reference does not match bank statement](#9-tfc-reference-mismatch)
10. [Childcare voucher claim submitted for wrong amount](#10-voucher-amount-mismatch)
11. [Parent reports they cannot see their invoice in Parent Portal](#11-parent-cannot-see-invoice)
12. [Invoice or Receipt PDF fails to preview or download](#12-pdf-generation-issue)
13. [Parent cannot see "Pay by Card" (Stripe) button in portal](#13-stripe-button-not-visible)
14. [Direct Debit error: "GoCardless is not configured in production"](#14-gocardless-unconfigured-error)
15. [Invoice created under wrong centre or family account](#15-invoice-under-wrong-family)
16. [Family is archived but still owes an outstanding balance](#16-archived-family-with-balance)
17. [Staff entered wrong payment amount or method and need to correct it](#17-incorrect-payment-entry-correction)

---

## Detailed Troubleshooting Scenarios

### 1. Duplicate Invoice Run Attempted
- **What You May See:** System displays error: *"Invoice already generated for period YYYY-MM-DD"*.
- **Root Cause:** SprintScale enforces an idempotency check in the `billingRuns` table to prevent double-billing families for the same billing cycle.
- **How to Resolve:**
  1. Open `/dashboard/finance` and check the family's invoice history.
  2. The invoice for this period already exists. You do not need to generate it again.

---

### 2. Family Skipped During Monthly Run
- **What You May See:** All families received invoices except one active family.
- **Root Cause:**
  - The family's billing config is set to `paused` or `cancelled`.
  - The `agreedMonthlyPence` was set to `0`.
- **How to Resolve:**
  1. Open the student's profile at `Sidebar → Students → [Child]`.
  2. Check the **Family Billing** card.
  3. If status is `paused`, click **Resume Billing**.
  4. Ensure the Agreed Monthly Fee is greater than £0.00.

---

### 3. Wrong Agreed Fee Amount Applied
- **What You May See:** A family was invoiced £200 instead of £250.
- **Root Cause:** The billing config was updated after the invoice was already generated. Historical invoices remain immutable.
- **How to Resolve:**
  1. If the issued invoice is in `draft` status and no payments exist, an Owner can click **Delete Invoice** and re-generate.
  2. Alternatively, record an adjustment or issue a supplementary ad-hoc invoice for the difference.

---

### 5. Payment Not Reflected in Balance
- **What You May See:** Staff recorded a payment, but the invoice balance did not update.
- **Root Cause:** Page cache in browser.
- **How to Resolve:** Hard-refresh the browser (`Ctrl+F5` / `Cmd+Shift+R`). SprintScale recalculates balances server-side on every mutation.

---

### 6. Partial Payment Status
- **What You May See:** Invoice status shows `Partially Paid` (yellow badge).
- **Root Cause:** Total recorded payments are less than the total invoice amount (e.g. £100 recorded on £250 invoice).
- **How to Resolve:** This is expected system behavior. Once the remaining £150 is received and recorded, the status will automatically update to `Paid`.

---

### 7. Voucher Overpayment Error
- **What You May See:** Parent sees error: *"Payment amount exceeds outstanding balance"*.
- **Root Cause:** Parent entered a voucher claim amount greater than the remaining unpaid balance on the invoice.
- **How to Resolve:** Instruct the parent to enter an amount equal to or less than the Amount Due displayed on the invoice card.

---

### 9. TFC Reference Mismatch
- **What You May See:** Parent submitted an HMRC TFC reference (e.g. `SMITH-12345-TFC`), but no matching transaction appears on your club bank statement.
- **Root Cause:** HMRC TFC bank transfers typically take 2 to 4 business days to clear into commercial bank accounts.
- **How to Resolve:**
  1. Leave the submission in `pending` status on `/dashboard/finance/reconciliation`.
  2. Once the funds clear on your bank statement, click **Verify Payment**.
  3. If after 5 days no funds arrive, click **Mark as Failed** to notify the parent.

---

### 11. Parent Cannot See Invoice
- **What You May See:** Parent logs into `/portal/billing` but sees "You have no outstanding invoices."
- **Root Cause:**
  - The parent logged in with a different email address than the one on file in the CMS.
  - The invoice status is `void`.
- **How to Resolve:**
  1. Open the invoice details in CMS and verify the parent's registered email address.
  2. Confirm the parent is requesting a magic link with that exact email address.

---

### 13. Stripe Button Not Visible
- **What You May See:** Parent portal does not display the "Pay with Card" button.
- **Root Cause:** Online card payments via Stripe are currently deferred by business decision in production.
- **How to Resolve:** Parents settle via Bank Transfer, Tax-Free Childcare, or Childcare Vouchers.

---

### 15. Invoice Under Wrong Family
- **What You May See:** An ad-hoc invoice was accidentally assigned to the wrong parent.
- **How to Resolve (Owner Action):**
  1. If no payments have been recorded, open the invoice and click **Void Invoice** (or **Delete Invoice**).
  2. Re-create the invoice selecting the correct parent account.

---

### 17. Incorrect Payment Entry Correction
- **What You May See:** Staff recorded £150 cash when the parent only paid £15.
- **How to Resolve:**
  1. Contact your Organisation Owner.
  2. The Owner can manage invoice adjustments or void the incorrect transaction, preserving a clear audit trail.
