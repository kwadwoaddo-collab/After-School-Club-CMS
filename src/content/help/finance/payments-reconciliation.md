# SprintScale CMS — Functional Manual: Payments & Reconciliation
## Offline Payment Recording, Tax-Free Childcare, Vouchers, Receipts & Provider Status

---

## 1. Supported Payment Channels

SprintScale CMS supports multi-channel payment logging and reconciliation across offline and online channels:

```
┌─────────────────────────────────────────────────────────────┐
│                    PAYMENT CHANNELS IN CMS                  │
├─────────────────────────────────────────────────────────────┤
│  • `cash`: Physical currency handed to staff at reception   │
│  • `bank_transfer`: Faster Payments / BACS direct to bank   │
│  • `voucher`: Tax-Free Childcare (TFC) & Childcare Vouchers │
│  • `stripe`: Online debit/credit card via Stripe Checkout   │
│  • `other`: Cheques or custom local authority funding grants│
└─────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Recording vs. External Bank Confirmation:**
> **Recording a payment in SprintScale documents an internal administrative entry.**
> The CMS does not connect to banking open-APIs or HMRC systems to independently verify bank balances. Staff must check their club bank statement or voucher portal, confirm funds have arrived, and then log or verify the payment in SprintScale.

---

## 2. Payment Statuses & Reconciliation Workflow

Payments recorded in the system hold one of three statuses:

- **`verified`:** Confirmed settled payment. Deducted immediately from the invoice's outstanding balance. Cash, bank transfer, and staff-recorded payments default to this status.
- **`pending`:** Unverified parent voucher submission. Awaiting staff review on the Reconciliation screen.
- **`failed`:** Rejected voucher claim. Parent is notified via email to resubmit.

---

## 3. Step-by-Step Procedures

### Procedure 1: Recording an Offline Payment (Cash / Bank Transfer)

![Figure — Offline Cash Payment Dialog with amount and internal receipt note](/training/assets/screenshots/annotated/SS-D6-S032.png)
*Figure 12.1 — Offline Cash Payment Recording Modal*

📹 **Video Walkthrough:** [Watch: Recording an Offline Cash Payment](/training/assets/videos/SS-D6-V015.mp4)

![Figure — Bank Transfer Recording Modal with transaction reference field](/training/assets/screenshots/annotated/SS-D6-S033.png)
*Figure 12.2 — Offline Bank Transfer Recording Modal*

📹 **Video Walkthrough:** [Watch: Recording an Offline Bank Transfer Payment](/training/assets/videos/SS-D6-V016.mp4)
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. Navigate to the invoice at `/dashboard/finance/invoices/[id]`.
2. Click **Record Payment**.
3. Select **Payment Method:** `Cash`, `Bank Transfer`, or `Other`.
4. Enter the **Amount (£):** e.g. `100.00` (can be full or partial amount).
5. (Optional) Enter the **Transaction Reference:** (e.g. Bank statement reference or cash receipt number).
6. Select the **Payment Date:** (defaults to today).
7. Click **Save Payment**.

**What Happens in the System:**
- The payment is inserted into `payments` table with status `verified`.
- The system recalculates total paid: if settled in full, status updates to `paid`; if partially paid, updates to `partially_paid`.
- An audit event (`payment_recorded`) is logged.
- An in-app notification is sent to Organisation Owners.
- An automated payment receipt email is dispatched to the parent.

---

### Procedure 2: Parent Submitting a Childcare Voucher / TFC Reference
**Who Can Do This:** Parent / Guardian via Parent Portal (`/portal/billing`)

**Steps:**
1. Parent logs into the Parent Portal at `/portal/billing`.
2. Locates the outstanding invoice and clicks **Pay by childcare voucher**.
3. Enters the **Amount (£):** (application strictly enforces `amount <= outstandingBalance`).
4. Enters their **Voucher / TFC Reference:** (e.g. HMRC TFC Child Reference `SMITH-12345-TFC` or Edenred reference).
5. Clicks **Submit Voucher Payment**.

**Expected Result:**
The submission is recorded in `payments` with status `pending`. The invoice status marks `partially_paid` (pending verification), and the item appears in the staff reconciliation queue.

---

### Procedure 3: Reconciling & Verifying a Voucher / TFC Payment

![Figure — Voucher Reconciliation Queue showing pending vouchers against matching invoices](/training/assets/screenshots/annotated/SS-D6-S034.png)
*Figure 12.3 — Childcare Voucher & TFC Reconciliation Queue*

![Figure — Childcare Voucher Reconciliation Form with provider reference input](/training/assets/screenshots/annotated/SS-D6-S064.png)
*Figure 12.4 — Childcare Voucher Reconciliation Form*

📹 **Video Walkthrough:** [Watch: Reconciling Childcare Vouchers & TFC](/training/assets/videos/SS-D6-V017.mp4)
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. Navigate to: `Sidebar → Finance → Reconciliation` (`/dashboard/finance/reconciliation`).
2. Review the list of pending voucher submissions showing parent name, child, invoice number, amount, and reference code.
3. Check your club's bank account or childcare voucher provider portal to verify the funds cleared.
4. Click **Verify Payment** (green checkmark).

**What Happens in the System:**
- Payment status transitions to `verified`.
- System recalculates total verified payments on the invoice. If fully settled, invoice status becomes `paid`.
- Parent receives an automated email: *"Your childcare voucher payment of £XXX.XX has been verified."*

---

### Procedure 4: Rejecting / Failing an Invalid Voucher Claim

📹 **Video Walkthrough:** [Watch: Handling Duplicate Childcare Voucher Reconciliation](/training/assets/videos/SS-D6-V045.mp4)
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk (for assigned centres)

**Steps:**
1. On the Reconciliation screen (`/dashboard/finance/reconciliation`), locate the invalid submission (e.g. reference not found in bank account).
2. Click **Mark as Failed** (red X).
3. Status updates to `failed`. The pending amount is removed from the invoice calculations.
4. Parent receives an automated email notification informing them that the voucher reference could not be verified and requesting resubmission.

---

### Procedure 5: Generating and Printing a Payment Receipt PDF

![Figure — Official Payment Receipt PDF layout with organisation branding and payment details](/training/assets/screenshots/annotated/SS-D6-S036.png)
*Figure 12.5 — Payment Confirmation PDF Receipt*
**Who Can Do This:** Organisation Owner, Centre Manager, Front Desk, Parent

**Steps:**
1. On the invoice details page (`/dashboard/finance/invoices/[id]`), scroll to the **Payment History** section.
2. In the top action bar, click **Receipt Preview** or navigate to `/dashboard/finance/receipt?invoiceId=[id]`.
3. Click **Download Receipt PDF**.
4. The generated PDF displays the CMS-generated payment record receipt, organisation details, receipt timestamp, amount paid, and remaining balance.

---

## 4. Overpayment and Payment Immutability Rules

- **No Surplus Credit Roll-Over:** SprintScale does not have a monetary credit balance ledger. If staff record a payment larger than the invoice amount, the £50 excess is stored on that invoice's payment row; it does not carry over to future invoices. Staff should only record the amount attributable to the invoice.
- **Payment Row Immutability:** Existing payment records cannot be edited or deleted in the UI. If a payment was logged incorrectly, an Owner must void the invoice and issue a corrected invoice record.

---

## 5. Online Card Payments via Stripe (Classification & Status)

- **Architecture Status:** **CODE COMPLETE & READY**
- **Production Activation Status:** **DEFERRED BY BUSINESS DECISION**
- **How It Operates When Enabled:**
  1. The Parent Portal renders the **Pay with Card (Stripe)** button (`StripePayButton.tsx`) when `STRIPE_SECRET_KEY` is present.
  2. Clicking the button calls `createInvoicePaymentSession`, generating a secure Stripe-hosted Checkout session in GBP.
  3. Parent completes payment on Stripe's PCI-compliant checkout page.
  4. Stripe sends a webhook to `/api/webhooks/stripe-invoice` containing the event `checkout.session.completed`.
  5. The webhook verifies the cryptographic signature with `STRIPE_INVOICE_WEBHOOK_SECRET`, inserts a `verified` payment into `payments` with method `stripe`, and updates the invoice status to `paid`.

---

## 6. Direct Debit via GoCardless (Classification & Status)

- **Architecture Status:** **CODE COMPLETE & READY**
- **Production Activation Status:** **DEFERRED BY BUSINESS DECISION**
- **How It Operates When Enabled:**
  1. `GoCardlessService` handles customer mandate setup (`createMandateCheckout`) and Direct Debit payment collection (`createPayment`).
  2. If unconfigured in production, the service fails closed with an explicit error (`"GoCardless is not configured in production"`).

---

## 7. Payments Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Parent voucher submission displays "Payment amount exceeds outstanding balance"** | Parent entered an amount higher than the remaining unpaid invoice balance. | Parent must enter an amount less than or equal to the remaining balance due. |
| **Recorded cash payment did not change invoice to Paid** | Payment was a partial amount (e.g. £50 paid on £100 invoice). | Invoice status correctly updates to `partially_paid`. Record the remaining balance when received. |
| **Parent cannot see Stripe card payment button** | Stripe is currently in deferred status in production. | This is expected system behavior until business activation. Parents pay via Bank Transfer, TFC, or Voucher. |
| **Voucher verified in error** | Staff clicked Verify before checking bank account. | Contact your Organisation Owner to void the invoice and re-issue if necessary. |
