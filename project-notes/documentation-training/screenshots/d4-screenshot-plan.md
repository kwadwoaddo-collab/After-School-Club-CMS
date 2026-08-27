# SprintScale CMS — Annotated Screenshot Plan
## Milestone D4: Finance, Agreed-Fee Billing, Invoices, Payments & Reconciliation

**Scope:** Authoritative visual asset specifications for Milestone D6 screenshot production.  
**Production Rules:** Clean 1440×900 desktop viewport, synthetic demo accounts only, zero real parent/child/financial PII, high-contrast rounded rectangular highlight boxes, numbered circular badges (`①`, `②`, `③`).

---

## Master Screenshot Specifications Index

| Screenshot ID | Manual & Section | Target Route / Page | Target Role | Key Visible UI Elements & Highlights |
|---|---|---|---|---|
| **D4-S01** | `finance-overview.md` §1 | `/dashboard/finance` | Owner (`ORG_OWNER`) | Financial summary header, revenue KPIs, status filters, invoice data grid. |
| **D4-S02** | `finance-overview.md` §4 | `/dashboard/centres/[id]/billing`| Owner (`ORG_OWNER`) | Centre billing form: Bank name, sort code, account number, billing email. |
| **D4-S03** | `agreed-fee-billing.md` §1 | `/dashboard/students/[id]` | Front Desk / Manager | Family Billing card showing active agreement, agreed monthly fee, anchor date. |
| **D4-S04** | `agreed-fee-billing.md` §4 | Configure Billing Modal | Front Desk / Manager | Agreed monthly fee input (£), anchor date picker, sibling checkboxes. |
| **D4-S05** | `invoices.md` §1 | Invoices Data Grid | Owner (`ORG_OWNER`) | Filtered table showing invoice numbers, parent names, amounts, status badges. |
| **D4-S06** | `invoices.md` §5 | Create Invoice Modal | Front Desk / Manager | Ad-hoc invoice form: Centre dropdown, parent search, child name, amount. |
| **D4-S07** | `invoices.md` §4 | `/dashboard/finance/invoices/[id]`| Front Desk / Manager | Unpaid invoice details: Invoice #, amount, remaining balance, action bar. |
| **D4-S08** | `invoices.md` §4 | Paid Invoice Details | Front Desk / Manager | Settled invoice: Green PAID badge, remaining balance £0.00, payment history. |
| **D4-S09** | `payments-reconciliation.md` §3| Record Payment Modal | Front Desk / Manager | Payment method dropdown (`Cash`, `Bank Transfer`), amount, reference field. |
| **D4-S10** | `payments-reconciliation.md` §3| Payment History Table | Front Desk / Manager | Chronological payment entries: Date, method badge, amount paid, reference. |
| **D4-S11** | `invoices.md` §5 | PDF Preview Modal | All Staff | High-fidelity invoice PDF document preview with club branding. |
| **D4-S12** | `payments-reconciliation.md` §3| Receipt Preview Modal | All Staff | Official payment receipt PDF preview showing settlement acknowledgement. |
| **D4-S13** | `invoices.md` §5 | Void Invoice Modal | Owner (`ORG_OWNER`) | Confirmation dialog with warning message and Confirm Void button. |
| **D4-S14** | `payments-reconciliation.md` §3| `/dashboard/finance/reconciliation`| Manager / Owner | Pending voucher table with parent name, amount, reference, Verify button. |
| **D4-S15** | `payments-reconciliation.md` §3| `/portal/billing` | Parent (`PARENT`) | Parent billing overview: Total outstanding balance, outstanding invoices list. |
| **D4-S16** | `payments-reconciliation.md` §3| Voucher Submission Form | Parent (`PARENT`) | Parent voucher input: Amount due, HMRC / voucher reference text box. |
| **D4-S17** | `payments-reconciliation.md` §3| Payment History on Portal | Parent (`PARENT`) | Historical paid and void invoices list with date stamps and amounts. |
| **D4-S18** | `finance-overview.md` §3 | Invoice Audit Events | Owner (`ORG_OWNER`) | Audit trail log on invoice details showing `payment_recorded` and staff ID. |

---

## Detailed Visual Specifications

### D4-S01: Finance Overview Dashboard
- **Filename:** `owner-finance-01-dashboard-overview.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/finance`
- **Role:** Owner (`ORG_OWNER`)
- **Required Synthetic Data:** Total Invoices `12`, Filter `All Centres`, Status `All`.
- **Annotations:**
  - Box ① around the top **Centre Selector & Status Filter**.
  - Box ② around the **+ Create Invoice** action button.
  - Box ③ around the **Invoice Data Grid Table**.

---

### D4-S04: Configure Agreed Fee Modal
- **Filename:** `manager-finance-04-agreed-fee-modal.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/students/demo-child-id`
- **Role:** Manager / Front Desk
- **Required Synthetic Data:** Child "Jamie Example", Parent "Alex Example", Amount `250.00`, Anchor `2026-09-01`.
- **Annotations:**
  - Box ① around the **Agreed Monthly Fee (£)** input field.
  - Box ② around the **Billing Anchor Date** and **Invoice Lead Days** fields.
  - Box ③ around the **Covered Children Checkboxes**.

---

### D4-S09: Record Payment Modal
- **Filename:** `frontdesk-finance-09-record-payment-modal.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/finance/invoices/demo-inv-id`
- **Role:** Front Desk / Manager
- **Required Synthetic Data:** Invoice `INV-DEMO-001`, Amount `150.00`, Method `Cash`.
- **Annotations:**
  - Box ① around the **Payment Method Dropdown** showing `Cash`.
  - Box ② around the **Amount Paid (£)** input.
  - Box ③ around the **Transaction Reference** text box.

---

### D4-S14: Voucher Reconciliation Queue
- **Filename:** `manager-finance-14-reconciliation-queue.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/finance/reconciliation`
- **Role:** Manager / Owner
- **Required Synthetic Data:** 1 pending voucher submission for Alex Example, Amount `£200.00`, Reference `EXAMPLE-12345-TFC`.
- **Annotations:**
  - Box ① around the **Pending Submission Row** showing reference code.
  - Box ② around the green **Verify Payment** action button.
  - Box ③ around the red **Mark as Failed** action button.
