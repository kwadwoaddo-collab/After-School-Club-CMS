# SprintScale CMS — Micro-Video Training Scripts
## Milestone D4: Finance, Agreed-Fee Billing, Invoices, Payments & Reconciliation

**Scope:** Authoritative recording scripts for Milestone D6 video production.  
**Video Target Duration:** 30 seconds – 2 minutes per focused task.  
**Standard Production Rules:** British English narration, clean synthetic demo accounts only, zero real parent/child/financial PII, 1440×900 desktop viewport, synchronized captions (SRT/VTT).

---

## Master Video Script Index

| Video ID | Title | Primary Audience | Importance | Target Duration |
|---|---|---|---|---|
| **D4-V01** | Setting Up an Agreed Monthly Family Fee | Front Desk / Managers / Owners | **ESSENTIAL** | 60 Seconds |
| **D4-V02** | Adding a Sibling to a Family Agreement | Front Desk / Managers / Owners | STANDARD | 45 Seconds |
| **D4-V03** | Generating Invoices from Billing Configs | Managers / Owners | **ESSENTIAL** | 60 Seconds |
| **D4-V04** | Creating a Custom / Ad-Hoc Invoice | Front Desk / Managers / Owners | STANDARD | 60 Seconds |
| **D4-V05** | Navigating Invoice Details & Status Lifecycle | All Staff | **ESSENTIAL** | 45 Seconds |
| **D4-V06** | Recording a Cash Payment at Reception | Front Desk / Managers / Owners | **ESSENTIAL** | 45 Seconds |
| **D4-V07** | Recording a Direct Bank Transfer | Front Desk / Managers / Owners | **ESSENTIAL** | 45 Seconds |
| **D4-V08** | Parent Submitting a Voucher / TFC Claim | Parents / Front Desk | **ESSENTIAL** | 60 Seconds |
| **D4-V09** | Reconciling & Verifying a Voucher Payment | Managers / Owners | **ESSENTIAL** | 60 Seconds |
| **D4-V10** | Rejecting an Unverified Voucher Submission | Managers / Owners | STANDARD | 45 Seconds |
| **D4-V11** | Managing Partial Payments & Outstanding Balance | Front Desk / Managers / Owners | **ESSENTIAL** | 45 Seconds |
| **D4-V12** | Downloading Invoice and Receipt PDFs | All Staff / Parents | STANDARD | 45 Seconds |
| **D4-V13** | Voiding an Invoice with Audit Trail | Owners (`ORG_OWNER`) | STANDARD | 45 Seconds |
| **D4-V14** | Understanding Session Credits vs Monetary Cash | Tutors / Managers / Owners | STANDARD | 45 Seconds |

---

## Detailed Script Specifications

### D4-V01: Setting Up an Agreed Monthly Family Fee
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `Sidebar → Students → [Jamie Example]`
- **Synthetic Data:** Parent "Alex Example", Child "Jamie Example", Fee £250.00, Anchor Date `2026-09-01`, Lead Days `7`.
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "How to configure a family agreed monthly tuition agreement."
  - `00:10 - 00:25`: Open Jamie Example's profile. Scroll to the **Family Billing** card. Click `Configure Billing`.
  - `00:25 - 00:45`: Enter Agreed Monthly Fee: `250.00`. Set Anchor Date: `2026-09-01`. Select Lead Days: `7`. Check Jamie Example in Covered Children list.
  - `00:45 - 01:00`: Click `Save Billing Configuration`. Show the card update to `Active` with `£250.00/month`.

---

### D4-V06: Recording a Cash Payment at Reception
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 45s
- **Starting Screen:** `/dashboard/finance/invoices/[id]`
- **Synthetic Data:** Invoice `INV-DEMO-001`, Total £150.00, Cash Amount £150.00.
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "Recording a cash tuition payment in under one minute."
  - `00:10 - 00:25`: Open invoice `INV-DEMO-001`. Click `Record Payment` in action bar.
  - `00:25 - 00:38`: Select Method `Cash`. Enter Amount `150.00`. Reference `Cash Receipt #412`.
  - `00:38 - 00:45`: Click `Save Payment`. Show status transition from `Draft` to green `PAID` with remaining balance `£0.00`.

---

### D4-V08: Parent Submitting a Voucher / TFC Claim
- **Audience:** Parents, Front Desk Staff
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/portal/billing` (Parent View)
- **Synthetic Data:** Invoice `INV-DEMO-002`, Amount Due £200.00, TFC Reference `EXAMPLE-12345-TFC`.
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "How parents submit Tax-Free Childcare & voucher references."
  - `00:10 - 00:25`: Open `/portal/billing`. Point cursor to Outstanding Invoices card.
  - `00:25 - 00:45`: Click `Pay by childcare voucher`. Enter Amount `200.00`. Enter Reference `EXAMPLE-12345-TFC`.
  - `00:45 - 01:00`: Click `Submit Voucher Payment`. Show invoice status update to `Partial` (Pending Verification).

---

### D4-V09: Reconciling & Verifying a Voucher Payment
- **Audience:** Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/finance/reconciliation`
- **Synthetic Data:** Pending submission for Alex Example, Amount £200.00, Ref `EXAMPLE-12345-TFC`.
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "Reconciling and verifying voucher payments."
  - `00:10 - 00:25`: Navigate to `Sidebar → Finance → Reconciliation`. Point cursor to pending voucher queue.
  - `00:25 - 00:45`: Explain: "Check your club's bank statement or voucher account to confirm funds cleared."
  - `00:45 - 01:00`: Click green `Verify Payment` button. Show item disappear from pending queue, and explain automated parent confirmation email.
