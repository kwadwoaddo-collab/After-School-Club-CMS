# SprintScale CMS — Master User Manual
## Part 4: The End-to-End Finance, Agreed-Fee Billing & Payment Journey

---

## 1. Overview of the Complete Financial Journey

![Figure — Executive Finance Dashboard showing collected fees, pending balances, and overdue totals](/training/assets/screenshots/annotated/SS-D6-S026.png)
*Figure MM-4.1 — Executive Finance Dashboard*

This master journey maps the commercial and billing lifecycle of a family within SprintScale CMS — from initial fee configuration through monthly invoice generation, parent notification, multi-channel payment collection, voucher reconciliation, and receipt delivery.

```
┌─────────────────────────────────────────────────────────────┐
│               STAGE 1: AGREED FEE SETUP                     │
│  Staff configure monthly family tuition & assessment dates  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│     STAGE 2: ADVANCE INVOICE PREPARATION (1 MONTH AHEAD)    │
│  Cron / manual run prepares `draft` 1 calendar month ahead  │
│  `Due Date` is Day 1 of the covered Assessment period       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│       STAGE 3: ISSUANCE, MANUAL EMAIL & 4-STATE PORTAL      │
│  Staff issue invoice (`sent`) & manually send email notice  │
│  Blue (Upcoming) → Amber (In period · Due) → Red (Overdue)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [OFFLINE PAYMENT CHANNELS]      [VOUCHER / TFC CLAIMS]
   Staff log Cash / Bank Transfer   Parent submits HMRC/Voucher code;
   in `/dashboard/finance/invoices`.Appears in Reconciliation queue.
               │                               │
               │                    [STAFF RECONCILIATION]
               │                    Staff verify bank cleared funds;
               │                    Click "Verify" on `/reconciliation`.
               │                               │
               └───────────────┬───────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│        STAGE 4: GREEN SETTLEMENT (`Paid in full`)           │
│  Verified payments reach £0.00 remaining; receipt available │
│  Audit events logged & revenue reflected in dashboard KPIs  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Stage 1: Family Agreed-Fee Setup

![Figure — Agreed-Fee Billing Setup Card with monthly rate, anchor day, and lead days](/training/assets/screenshots/annotated/SS-D6-S027.png)
*Figure MM-4.2 — Family Agreed-Fee Billing Config*

📹 **Video Walkthrough:** [Watch: Setting up Agreed Monthly Family Tuition Fee](/training/assets/videos/SS-D6-V013.mp4)

When a new family registers or enrolls:
1. Staff navigate to the student profile or parent record.
2. Under **Family Billing**, staff configure the **Agreed Monthly Fee** (e.g. £250.00) and link all enrolled siblings.
3. Staff set the **Billing Anchor Date** defining the family's recurring **Assessment period** (e.g. 1st of every month).
4. The agreement is saved in `active` status.

---

## 3. Stage 2: Advance Preparation & Duplicate Prevention

![Figure — Monthly Invoice Batch Generation Run preview modal with total count and value](/training/assets/screenshots/annotated/SS-D6-S029.png)
*Figure MM-4.3 — Monthly Invoicing Batch Run Preview*

📹 **Video Walkthrough:** [Watch: Executing Monthly Invoicing Batch Run](/training/assets/videos/SS-D6-V014.mp4)

Invoices are prepared **1 calendar month in advance** of each **Assessment period**:
1. **Advance Draft Preparation:** Automated daily runs and manual batch runs prepare the upcoming month's invoice 1 calendar month ahead, setting `Due Date` to Day 1 (the start) of the covered **Assessment period**.
2. **Duplicate Run Protection:** The system records an entry in the `billingRuns` table. An application pre-check prevents generating duplicate invoices for the same period.
3. **Draft Isolation & No Auto-Email:** Invoices are created in `draft` status, stamped with an invoice number (`INV-XXXXXX`), and populate `coveredChildrenJson` with all linked siblings. Drafts are hidden from parents and never trigger automatic emails.

---

## 4. Stage 3: Issuance, Deliberate Manual Emails & the 4-State Lifecycle

Once staff review and issue a `draft` invoice (`status: 'sent'`):
1. **Deliberate Manual Email Action:** Financial emails are always deliberate manual actions by authorised staff (Owner or Centre Manager). Clicking **Send / Resend Email** dispatches the invoice summary (including the **Assessment Period** and neutral `Due Date`) with audited provider status tracking.
2. **4-State Collection Lifecycle:** Both the staff Finance Directory and the Parent Portal (`/portal` and `/portal/billing`) track every issued invoice across four clear visual states:
   - **Blue (`Upcoming`):** Issued in advance, before Day 1 of the **Assessment period**. Session booking in the Parent Portal remains fully active.
   - **Yellow / Amber (`In period · Due` / `Assessment period · Payment due`):** Inside the active **Assessment period** (Day 1 through `billingPeriodEnd`). Tracked actively for payment, **never** branded "Overdue", and session booking remains unobstructed. Logged Childcare Voucher / Tax-Free Childcare references show an explicit *"awaiting centre verification"* acknowledgement while HMRC funds clear.
   - **Red (`Overdue · Past period` / `Overdue · Past assessment period`):** Strictly *after* the **Assessment period** ends with an unpaid balance remaining.
   - **Green (`Paid in full`):** Verified payments cover 100% of the invoice total (`£0.00` remaining).

---

## 5. Stage 4: Multi-Channel Payment & Reconciliation

![Figure — Voucher Reconciliation Queue showing pending vouchers against matching invoices](/training/assets/screenshots/annotated/SS-D6-S034.png)
*Figure MM-4.4 — Childcare Voucher & TFC Reconciliation Queue*

📹 **Video Walkthrough:** [Watch: Reconciling Childcare Vouchers & TFC](/training/assets/videos/SS-D6-V017.mp4)

Parents settle their invoices through one of four primary pathways:

- **Pathway A: Direct Bank Transfer (BACS / Faster Payments):** Parent transfers funds to the club's bank account using their invoice number as reference. Staff verify receipt on bank statement and click **Record Payment** in the CMS.
- **Pathway B: Cash at Reception:** Parent pays physical cash at the front desk. Staff click **Record Payment**, select `Cash`, and enter the amount received.
- **Pathway C: Tax-Free Childcare (TFC) & Vouchers:** Parent transfers funds via their HMRC Childcare Account or voucher provider (e.g. Edenred, Care-4, Computershare), then submits their reference code in the Parent Portal. Staff review the submission on `/dashboard/finance/reconciliation` and click **Verify Payment**.
- **Pathway D: Online Card Payment (Stripe):** When enabled, parents click **Pay with Card** in the portal to settle instantly via credit/debit card.

---

## 6. Stage 5: Settlement, Receipts & Financial Reporting

When verified payments equal or exceed the total invoice amount:
1. Invoice status transitions automatically from `draft`/`partially_paid` to **`paid`**.
2. A payment receipt email is dispatched to the parent.
3. The invoice details page updates the remaining balance to **£0.00**.
4. Both staff and parents can download PDF copies of the invoice and downloadable payment record receipt at any time.
5. Revenue is aggregated into financial dashboard overview metrics for Organisation Owners (organisation-wide) and Centre Managers (for their assigned venues).
