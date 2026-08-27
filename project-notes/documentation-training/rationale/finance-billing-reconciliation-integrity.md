# SprintScale CMS — Operational Rationale
## Foundations of Agreed Fees, Invoicing, Payment Integrity & Reconciliation

---

## 1. Why Family-Level Agreed Fees Provide Operational Stability

In after-school and holiday club settings, calculating tuition purely by multiplying fluctuating daily attendance hours creates unpredictable cash flow for clubs and confusing bills for parents.
- The **Family-Level Agreed Monthly Fee Model** establishes a fixed recurring monthly commitment agreed upon during registration.
- Covering multiple siblings under one family agreement simplifies administration into a single monthly invoice.

---

## 2. Why Daily Attendance Is Separated from Invoice Generation

Attendance is a real-time record of physical arrival, presence, and child safety. Invoicing is a commercial contract.
- Automatically rewriting issued invoices every time a child arrives late or misses a session would corrupt double-entry accounting records, invalidate sent PDFs, and create bookkeeping confusion.
- Attendance absences are managed in the **Session Credit Ledger**, allowing managers to grant attendance allowances or catch-up sessions without modifying issued financial invoices.

---

## 3. Why Changing an Agreed Fee Does Not Alter Existing Invoices

When an agreed fee is updated, the CMS applies the new fee to **future invoice runs only**.
- Invoices generated in previous billing periods remain unchanged.
- This ensures that past billing periods and parent payment receipts remain historically consistent.

---

## 4. Why Payment Transaction References Are Recorded

Recording reference codes (e.g. BACS bank reference, Cash Receipt #, or HMRC TFC Code) creates an administrative link between the club's bank account statement and the internal CMS ledger. In an audit or parent payment enquiry, staff can match the CMS transaction directly to their external bank line item.

---

## 5. Why Duplicate Billing Run Protection Is Enforced

If an automated billing cron job executes multiple times or staff trigger manual invoice generation twice on the same day:
- The `billingRuns` application pre-check detects the completed run for that billing period and halts duplicate generation.
- This prevents duplicate invoices from being issued to parents.

---

## 6. Why Server-Side Balance Calculation Is Mandatory

Client-side calculations in browsers can be manipulated or affected by network latency.
- In SprintScale, outstanding balances are recalculated server-side within atomic database transactions:
  $$\text{Balance} = \text{Invoice Amount} - \sum(\text{Verified Payments})$$
- This ensures payments cannot result in incorrect ledger statuses.

---

## 7. Why Webhook Cryptographic Signatures Are Verified

When online payment providers (such as Stripe) notify the system of a completed payment:
- The webhook endpoint verifies the cryptographic payload signature using `STRIPE_INVOICE_WEBHOOK_SECRET`.
- This ensures that third parties cannot forge payment notifications or falsely mark invoices as paid.

---

## 8. Why Parent Financial Isolation Is Strictly Enforced

Under data protection principles, financial information is sensitive personal data.
- The Parent Portal queries invoices strictly scoped to `invoices.parentId = currentParent.id`.
- Parents cannot view, query, or pay invoices belonging to other families.

---

## 9. Why Offline Payments Require Manual Administrative Reconciliation

Because SprintScale does not connect directly to banking open-APIs:
- Recording a cash or bank transfer payment represents an administrative log entry made by an authorised staff member.
- Staff must confirm that funds have cleared in their external bank account before verifying voucher claims on the Reconciliation screen.

---

## 10. Why Session Credits Are Distinct from Monetary Cash Credits

Session credits track attendance allowances (e.g. granting 1 catch-up session for an excused absence).
- A session credit is an operational allowance; it does not represent monetary cash (£) or a bank refund.
- Keeping session credits distinct from invoices protects revenue reconciliation.

---

## 11. Why Invoice Deletion Is Blocked When Payments Exist

If an invoice has recorded payments:
- The system blocks deletion (`deleteInvoice` throws an error).
- This prevents orphan payments and preserves the financial audit trail. If an invoice was issued in error after payment, staff must follow proper adjustment or voiding procedures.

---

## 12. Why Voiding Is Restricted Strictly to Organisation Owners

Voiding cancels an issued invoice and zeros out the parent's liability. To prevent unauthorized write-offs or accounting tampering, voiding is restricted exclusively to the `ORG_OWNER` role.

---

## 13. Why Integer Pence Is Used for Recurring Configurations

Recurring configurations store amounts in integer pence (e.g. `25000` for £250.00). Floating-point decimal arithmetic in software can accumulate fractional rounding errors over time; integer pence guarantees mathematical precision during recurring calculations.

---

## 14. Why Voucher Submissions Enter a Pending State

When a parent submits a Tax-Free Childcare or voucher reference in the portal:
- The payment enters `pending` status and does not automatically mark the invoice `paid`.
- Childcare voucher payments typically take 2–4 business days to clear into the club's bank account. Holding the payment in `pending` alerts staff to verify the funds on `/dashboard/finance/reconciliation` before final settlement.

---

## 15. Why SprintScale Distinguishes Invoicing from General Bookkeeping

SprintScale focuses on childcare-specific tuition invoicing, payment recording, and family balance management. It does not attempt to be a general bookkeeping software, payroll engine, or tax submission platform. Clubs export or reconcile their revenue figures with external accounting packages (e.g. Xero, QuickBooks).
