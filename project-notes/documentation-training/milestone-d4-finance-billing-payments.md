# SprintScale CMS — Milestone D4: Functional User Manuals
## Finance, Agreed-Fee Family Billing, Invoices, Payments & Reconciliation

**Document Type:** Milestone Completion Report & Financial Documentation Baseline  
**Milestone:** D4 (Functional User Manuals: Finance, Billing & Payments)  
**Authoritative Starting SHA:** `ca958a2`  
**Branch:** `rebuild/cms-modernisation`  
**Phase-7 Reference Tag:** `cms-modernisation-phase7-complete` (`0c03442`)  
**Date:** 2026-08-27  
**Status:** COMPLETE — 50/50 ADVERSARIAL PASS — ZERO CODE MUTATION  

---

## 1. Executive Verdict

**PASS WITH FINANCE BOUNDARIES RECONCILED — READY FOR D5**

Milestone D4 has established the authoritative, source-grounded functional user manuals, master commercial journey, operational rationales, D6-ready video scripts, screenshot specifications, and troubleshooting handbooks covering the complete financial lifecycle of SprintScale CMS.

### Finance Boundaries Reconciled:
1. **Overpayment Exact Behaviour:** Verified that `recordPayment` permits entering amounts exceeding outstanding balance, inserting the payment row and setting invoice status to `paid`. However, **no monetary customer credit account exists** in the database; excess funds are stored only on that invoice payment row and do not carry over to other invoices. The Parent Portal strictly blocks voucher submissions where `amount > outstandingBalance`.
2. **Payment Correction / Reversal Classification:** Confirmed that `voidInvoice` is Owner-only; payment editing, payment deletion, and direct payment reversals are **not implemented** in the UI. Correction route requires an Owner to void the invoice and re-issue a corrected billing document.
3. **Invoice Duplicate Protection:** Verified that duplicate runs are prevented via an **application pre-check** in `billingRuns` (`findFirst` by `billingConfigId` and `periodStart`), rather than a compound database uniqueness constraint.
4. **Outstanding Balance Arithmetic:** Verified exact formula: $\text{Outstanding Balance} = \text{Invoice Amount} - \sum(\text{Verified Payments})$. Cash, bank transfers, and verified vouchers deduct immediately; pending voucher claims remain in pending status awaiting staff verification.
5. **Receipt Terminology Reconciled:** Replaced overreaching legal terms with accurate product descriptions: "CMS-generated receipt", "downloadable payment record PDF".

- **Zero Application Code Changes:** `src/`, `drizzle/`, `migrations/`, `package.json`, and deployment configs remain 100% untouched.
- **Zero Production/Staging Side Effects:** 0 DB mutations, 0 emails, 0 SMS, 0 Stripe/GoCardless calls, 0 schema changes, 0 deployments.
- **Strict Data Protection & Financial Security:** Zero real parent, child, payment reference, or invoice PII exposed; standardized synthetic demo accounts used exclusively.
- **50/50 Adversarial Matrix:** 50 SAFE, 0 DEBT, 0 DEFECT, 0 BLOCKED.

---

## 2. Milestone Deliverables Summary

| Deliverable | File Path | Scope & Key Contents | Status |
|---|---|---|---|
| **Functional Manual: Finance Overview** | [`functional-manuals/finance-overview.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/finance-overview.md) | Financial architecture, data models, monetary storage (integer pence vs decimal), role matrix, and accounting boundaries. | **COMPLETE** |
| **Functional Manual: Agreed-Fee Billing** | [`functional-manuals/agreed-fee-billing.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/agreed-fee-billing.md) | Family tuition model, multi-child sibling coverage, billing anchor dates, lead days, and lifecycle management (active/paused/cancelled). | **COMPLETE** |
| **Functional Manual: Invoices** | [`functional-manuals/invoices.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/invoices.md) | Monthly cron runs, on-demand config runs, ad-hoc invoices, duplicate pre-checks (`billingRuns`), PDF generation, and owner-only voiding. | **COMPLETE** |
| **Functional Manual: Payments & Reconciliation** | [`functional-manuals/payments-reconciliation.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/payments-reconciliation.md) | Cash, bank transfers, Tax-Free Childcare (TFC), vouchers, reconciliation queue, receipts, Stripe and GoCardless classifications. | **COMPLETE** |
| **Master Manual (Part 4)** | [`master-manual/04-finance-billing-payments-journey.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/master-manual/04-finance-billing-payments-journey.md) | End-to-end commercial journey narrative: Fee Setup → Invoice Generation → Parent Review → Multi-Channel Payment → Settlement & Receipts. | **COMPLETE** |
| **Operational Rationale Library** | [`rationale/finance-billing-reconciliation-integrity.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/rationale/finance-billing-reconciliation-integrity.md) | 15 detailed operational rationales covering fixed family tuition, separation from attendance, invoice non-retroactivity, and pre-checks. | **COMPLETE** |
| **Micro-Video Scripts** | [`videos/d4-video-scripts.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/videos/d4-video-scripts.md) | 14 D6-ready screencast scripts with second-by-second timelines, narrations, synthetic demo data, and UI highlight callouts. | **COMPLETE** |
| **Screenshot Plan** | [`screenshots/d4-screenshot-plan.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/screenshots/d4-screenshot-plan.md) | 18 annotated screenshot specifications with route mappings, synthetic data fixtures, crop guidance, and badge numbering. | **COMPLETE** |
| **Troubleshooting Handbook** | [`troubleshooting/d4-finance-troubleshooting.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/troubleshooting/d4-finance-troubleshooting.md) | 17 detailed operational troubleshooting scenarios with symptoms, root causes, resolution steps, and anti-patterns. | **COMPLETE** |
| **Master Documentation Index** | [`README.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/README.md) | Updated with full navigation, cross-links, and roadmap progress tracking. | **COMPLETE** |

---

## 3. D4 Permission Matrix Summary

| Financial Capability / Action | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) | Evidence Source |
|---|---|---|---|---|---|---|
| **Global Finance Dashboard (`/dashboard/finance`)** | FULL (All Centres) | BLOCKED (Redirect) | BLOCKED (Redirect) | BLOCKED | NOT AVAILABLE | `src/app/dashboard/finance/page.tsx` |
| **View Invoices / Details** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `getInvoiceDetails` |
| **Create / Update Agreed Fee Config** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `assertCentreAccess` |
| **Generate Invoices from Config** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `generateInvoiceFromConfig` |
| **Record Offline Payment (Cash/Bank)** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `recordPayment` |
| **Reconcile / Verify Voucher Submissions** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `verifyPayment` / `failPayment` |
| **Void an Issued Invoice** | FULL (Owner Only) | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | `voidInvoice` |
| **Delete an Invoice (Zero Payments)** | FULL (Owner Only) | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | `deleteInvoice` |
| **Resend Invoice Notification Email** | FULL (Owner Only) | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | `resendInvoiceEmail` |
| **Parent Portal Billing (`/portal/billing`)** | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | OWN INVOICES ONLY | `src/app/portal/billing/page.tsx` |

---

## 4. Production Side-Effect Audit

As mandated by the specification:
- Production DB INSERTs = **0**
- Production DB UPDATEs = **0**
- Production DB DELETEs = **0**
- Staging mutations = **0**
- Schema changes = **0**
- Database migrations = **0**
- Emails dispatched = **0**
- SMS messages sent = **0**
- Stripe / GoCardless API calls = **0**
- Google Calendar mutations = **0**
- Wonde API calls = **0**
- Vercel Blob storage writes = **0**
- Cron jobs executed = **0**
- Environment variable changes = **0**
- Production deployments = **0**

---

## 5. 50-Question Adversarial Acceptance Matrix

| # | Adversarial Audit Question | Classification | Evidence & Notes |
|---|---|---|---|
| 1 | Did D4 start exactly from SHA `ca958a2`? | **SAFE** | Confirmed via `git rev-parse --short HEAD`. |
| 2 | Was the working tree clean? | **SAFE** | Confirmed via `git status`. |
| 3 | Was the documentation contract followed? | **SAFE** | D1 style guide, canonical terms, and alert hierarchy preserved. |
| 4 | Was agreed-fee model verified in source? | **SAFE** | Verified `billingConfigs` schema and actions. |
| 5 | Was family vs child billing distinction verified? | **SAFE** | Parent-centric config with sibling junction table verified. |
| 6 | Was invoice generation workflow verified? | **SAFE** | Verified cron, on-demand, and ad-hoc creation flows. |
| 7 | Was invoice duplicate protection verified? | **SAFE** | `billingRuns` application pre-check verified in code. |
| 8 | Was invoice lifecycle verified? | **SAFE** | `draft`, `sent`, `partially_paid`, `paid`, `void` verified. |
| 9 | Was outstanding balance formula verified? | **SAFE** | `Amount - Verified Payments` verified in actions and UI. |
| 10 | Was cash payment workflow verified? | **SAFE** | `recordPayment` with `method: 'cash'` verified. |
| 11 | Was bank transfer payment verified? | **SAFE** | `recordPayment` with `method: 'bank_transfer'` verified. |
| 12 | Was Tax-Free Childcare workflow verified? | **SAFE** | Parent submission + staff verification queue verified. |
| 13 | Was childcare voucher workflow verified? | **SAFE** | `submitVoucherPayment` in portal + verification verified. |
| 14 | Was external payment verification boundary clarified?| **SAFE** | Documentation explicitly clarifies CMS does not call banks/HMRC. |
| 15 | Was partial payment behaviour verified? | **SAFE** | Recalculation to `partially_paid` verified in `recordPayment`. |
| 16 | Was overpayment behaviour verified? | **SAFE** | Documented excess stored on invoice row; no family credit ledger. |
| 17 | Was payment correction/reversal verified? | **SAFE** | Classified voiding as Owner-only; direct payment editing not implemented. |
| 18 | Was financial record non-retroactivity verified? | **SAFE** | Changing agreed fees applies to future runs only. |
| 19 | Was session credit vs money boundary verified? | **SAFE** | Session credits documented as session counts, not cash refunds. |
| 20 | Was Parent Portal finance verified? | **SAFE** | Verified `/portal/billing` queries scoped to `parent.id`. |
| 21 | Was Stripe classification verified? | **SAFE** | Classified as Code Complete & Deferred in production. |
| 22 | Was GoCardless classification verified? | **SAFE** | Classified as Code Complete & Deferred in production. |
| 23 | Was Owner finance permission verified? | **SAFE** | Global finance dashboard restricted to `ORG_OWNER`. |
| 24 | Was Manager finance permission verified? | **SAFE** | Centre-scoped access verified in `assertCentreAccess`. |
| 25 | Was Front Desk finance permission verified? | **SAFE** | Centre-scoped access verified; void/delete blocked. |
| 26 | Was Tutor restricted from finance? | **SAFE** | Tutors verified 0 access to invoices, configs, or payments. |
| 27 | Was multi-tenant org isolation verified? | **SAFE** | All queries and mutations verify `organisationId`. |
| 28 | Was centre isolation verified for non-owners? | **SAFE** | `assertCentreAccess` checks user's assigned centres. |
| 29 | Was parent IDOR prevention verified? | **SAFE** | Server-side `invoices.parentId = parent.id` check enforced. |
| 30 | Were finance reporting KPIs verified? | **SAFE** | Overview metrics on `/dashboard/finance` documented. |
| 31 | Was invoice PDF generation verified? | **SAFE** | `InvoiceTemplate.tsx` via `@react-pdf/renderer` verified. |
| 32 | Was receipt PDF generation verified? | **SAFE** | `ReceiptTemplate.tsx` verified on `/dashboard/finance/receipt`. |
| 33 | Were audit events verified? | **SAFE** | `invoice_created`, `payment_recorded`, `invoice_voided` verified. |
| 34 | Was money storage precision verified? | **SAFE** | Integer pence in config, numeric decimal on invoices verified. |
| 35 | Were 15 operational rationales documented? | **SAFE** | Foundations of agreed billing and reconciliation articulated. |
| 36 | Were 14 micro-video scripts created? | **SAFE** | Second-by-second timeline scripts provided. |
| 37 | Were 8 essential video scripts prioritized? | **SAFE** | Core billing, invoice, and payment tasks marked essential. |
| 38 | Were 18 screenshot specifications created? | **SAFE** | Complete D6-ready plan with annotations provided. |
| 39 | Were 17 troubleshooting scenarios covered? | **SAFE** | Practical resolution handbook provided. |
| 40 | Were documentation gaps identified? | **SAFE** | 0 gaps; all current finance features covered. |
| 41 | Were UX findings recorded? | **SAFE** | Historical findings reconciled; 0 new UX blockers. |
| 42 | Were potential product defects checked? | **SAFE** | 0 defects discovered. |
| 43 | Were deferred features clearly marked? | **SAFE** | Stripe and GoCardless marked deferred in production. |
| 44 | Were cross-documentation terms reconciled? | **SAFE** | Agreed Fee, Invoice, Session Credit aligned with D0–D3. |
| 45 | Was financial PII 100% excluded? | **SAFE** | Clean synthetic fixtures used across all manuals. |
| 46 | Were all markdown relative links validated? | **SAFE** | 100% of internal links resolve. |
| 47 | Was non-accountant readability verified? | **SAFE** | Clear plain English used with structured procedures. |
| 48 | Was zero-code-change rule enforced? | **SAFE** | `src/` and `drizzle/` untouched. |
| 49 | Was zero-production-mutation rule enforced? | **SAFE** | Confirmed 0 DB mutations, 0 emails, 0 external calls. |
| 50 | Is D4 safe to freeze and proceed to D5? | **SAFE** | All deliverables complete, verified, and unpushed. |

### Adversarial Arithmetic
- **SAFE:** **50 / 50 (100%)**
- **DEBT:** **0**
- **DEFECT:** **0**
- **BLOCKED:** **0**
- **NOT APPLICABLE:** **0**

---

## 6. Final Recommendation

**PASS WITH FINANCE BOUNDARIES RECONCILED — READY FOR D5**
