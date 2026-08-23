# Milestone 3G — Finance Module: Stage A Audit

**Starting commit:** `b80ce4b` (verified clean, on `rebuild/cms-modernisation`)
**Scope:** Finance module modernisation onto the InvoiceFlow design system, evidenced-defect remediation only. Students, Parents, Staff, Centres, Bookings, Attendance remain frozen.

---

## A. Surface inventory

**Pages (Server Components):**

| Route | File | Role gate | Notes |
|---|---|---|---|
| `/dashboard/finance` | `src/app/dashboard/finance/page.tsx` | `ORG_OWNER` only (page-level redirect) | Main ledger: KPI grid, invoice data grid, billing cycles tab. Org+centre scoped server query. |
| `/dashboard/finance/invoices` | `src/app/dashboard/finance/invoices/page.tsx` | `ORG_OWNER` only | Full invoice history (org-scoped, no centre filter — see G). |
| `/dashboard/finance/invoices/[id]` | `src/app/dashboard/finance/invoices/[id]/page.tsx` | `ORG_OWNER` only | Invoice detail: PDF preview/download, record payment, void/delete, notes/date edit. |
| `/dashboard/finance/reconciliation` | (client component only, no page.tsx role gate found beyond app-level middleware) | — | Reconciliation client posts to `reconcilePayment`, which itself has **no auth check at all** (see L1). |
| `/dashboard/finance/receipt` | `src/app/dashboard/finance/receipt/page.tsx` | Any authenticated org member (no role check) | Cash receipt generator — org-scoped data fetch only, no centre filter. |
| `/dashboard/settings/finance` | `src/app/dashboard/settings/finance/page.tsx` | redirect stub → `/dashboard/settings?tab=finance` | Org Settings module, out of scope. |
| `/portal/billing` | `src/app/portal/billing/page.tsx` | Parent portal auth (`getCurrentParent`) | Parent-scoped invoice list + Stripe/voucher payment. Correctly scoped. |

**Embedded in frozen modules (Finance-owned components rendered by other modules):**

- `src/app/dashboard/parents/[id]/page.tsx` + `ParentProfileClient.tsx` (Parents module, role gate `ORG_OWNER, MANAGER, FRONT_DESK`) renders Finance's `InvoiceTable` (exported from `FinanceDashboardClient.tsx`) — read-only consolidated family ledger, mutation buttons hidden unless `isOwner`.
- `src/features/students/components/StudentProfile.tsx` (Students module, role gate `ORG_OWNER, MANAGER, FRONT_DESK`) renders Finance's `BillingSettingsCard` **unconditionally, with no role gate at all** — this is the most significant finding of Stage A (see L2).

**Server actions (`'use server'`):**

- `src/features/finance/actions.ts` — `getParents`, `getChildrenByParent`, `createInvoice`, `createLegacyFamilyAndInvoice`, `createAdHocInvoice`, `getInvoiceDetails`, `recordPayment`, `updateInvoiceDate`, `updateInvoiceNotes`, `deleteInvoice`, `voidInvoice`, `verifyPayment`, `failPayment`, `resendInvoiceEmail`.
- `src/features/billing/actions.ts` — `createBillingConfig`, `updateBillingConfig`, `addChildToConfig`, `removeChildFromConfig`, `pauseBillingConfig`, `resumeBillingConfig`, `cancelBillingConfig`, `generateInvoiceFromConfig`.
- `src/features/billing/actions/reconcile-payment.ts` — `reconcilePayment`.
- `src/app/portal/billing/actions.ts` — `submitVoucherPayment` (parent-scoped, correct).

**API routes:**

- `POST /api/portal/checkout` (Stripe checkout session creation for parent invoice payment) — not read in full this audit; existing pattern, no evidence of defect.
- `POST /api/webhooks/stripe-invoice` — signature-verified webhook, marks invoice paid on `checkout.session.completed`.
- `GET /api/export/finance` — ORG_OWNER-gated, org-scoped CSV export.
- `POST /api/cron/billing` — `CRON_SECRET`-authenticated automated monthly invoice generation.
- `PATCH /api/centres/[id]` — **not Finance-owned.** `FinancePricingForm.tsx` (fee/bank-detail settings, rendered from Org Settings) posts here. This is Centres-module territory (frozen); confirmed out of scope despite living under a "finance pricing" component name.

**Read-only query modules:**

- `src/features/billing/queries.ts` — `fetchBillingCycles`, `fetchStudentBillingConfig`. Correctly org+centre scoped throughout.

**Services:**

- `src/lib/services/gocardless.ts` (`GoCardlessService`) — instalment/direct-debit provider, real-API + stub branches.
- `src/lib/services/stripe.ts` (`StripeService`) — subscription methods (org SaaS billing, out of scope) + `createInvoicePaymentSession`/`constructInvoiceWebhookEvent` (in scope, parent invoice payment).
- `src/lib/services/credit.ts` (`CreditService`) — `getBalance`, `issueCredit`, `applyCreditToInvoice`. **Confirmed unreachable from any production code path** (only referenced from its own test file).
- `src/lib/services/instalments.ts` (`InstalmentService`) — `createInstalmentPlan`. Also unreachable from production code.
- `src/lib/billing.ts` — pure calculation helpers (`computeNextBillingPeriod`, `penceToPounds`, `poundsToPence`, `previewBillingPeriods`). Clean.

**Terms searched to build this inventory:** finance, payments, invoices, receipts, fees, balances, transactions, billing, childcare payments, refunds, discounts, credits, outstanding, overdue, ledger, revenue, collection, payment method, Stripe, GoCardless. Every Stripe/GoCardless hit was individually classified by consumer (Finance UI vs. org-subscription vs. public booking flow) rather than assumed to belong to Finance.

---

## B. Data model / source of truth

Confirmed from `src/db/schema.ts` (Drizzle), not invented:

- **`invoiceStatusEnum`**: `draft, sent, partially_paid, paid, void`. There is **no stored "overdue" or "unpaid" status** — overdue is always derived (`dueDate < now && status not in (paid, void)`), consistently at every call site (`finance/page.tsx`, `FinanceDataGridClient.tsx`, `FinanceDashboardClient.tsx`, `FilterableInvoiceHistorySection.tsx`, `portal/billing/page.tsx`).
- **`paymentStatusEnum`**: `pending, verified, failed`.
- **`paymentMethodEnum`**: `cash, bank_transfer, stripe, voucher, other, gocardless, tax_free_childcare`.
- **`parentCreditTypeEnum`**: `credit, debit, refund` — refunds are represented as a `parentCredits` row, never as an invoice or payment status. There is no `invoices.status = 'refunded'`.
- **`instalmentStatusEnum`**: `pending, processing, paid, failed`.
- **Invoices** carry `amount` (decimal pounds), `status`, `invoiceDate`, `dueDate`, `billingPeriodStart/End`, `notes`, `coveredChildrenJson` (multi-child snapshot), optional `billingConfigId` link back to a recurring config, optional `childId` (single-child) — `parentId` is always required, `childId`/`coveredChildrenJson` are the two co-existing "who is this for" representations (ad-hoc invoices use neither and store a free-text name).
- **Payments** are a separate table linked to `invoices` — many payments per invoice, each with its own `status`. An invoice's paid/partial/paid status is **derived by summing verified payments**, not stored independently except as the invoice's own `status` field, which `recordPayment`/`verifyPayment` keep in sync transactionally.
- **Money representation is mixed by design, not by accident**: `billingConfigs.agreedMonthlyPence` and `billingRuns.amountPence` are integer minor units (pence); `invoices.amount`, `invoiceLineItems.unitPrice/lineTotal`, `payments.amount`, `parentCredits.amount`, `invoiceInstalments.amount` are all `numeric(10,2)` decimal pounds. The pence→pounds boundary is `String(pence / 100)`, confirmed correct at both call sites that cross it (`generateInvoiceFromConfig`, `/api/cron/billing`).
- **Org/centre ownership**: every finance table carries `organisationId`; invoices and billing configs additionally carry `centreId`. This matches the schema-level isolation model used by every other frozen module.

No accounting terminology beyond what the schema actually supports was used anywhere in this audit or in the fixes below (no "ledger entries", "journal", "GL account", etc. — none of that exists in this schema).

---

## C. Financial lifecycle

Real, evidenced lifecycle (not the idealised one the ticket lists as illustrative — several of the ticket's example lifecycle terms, e.g. "write-off", do not exist in this codebase and are not invented here):

1. **Invoice creation** — two independent paths:
   - **Ad-hoc/manual** (`finance/actions.ts`): `createInvoice` (existing parent+children), `createLegacyFamilyAndInvoice` (new family + invoice in one transaction), `createAdHocInvoice` (free-text child name, no child record created). All three insert a `draft`-status invoice via the shared `insertInvoiceAndLog` helper and log an `invoice_created` audit event.
   - **Recurring/agreed-fee** (`billing/actions.ts`): `generateInvoiceFromConfig`, triggered either by a staff member from `BillingCyclesTab` or automatically by `/api/cron/billing`. Idempotent per `(billingConfigId, periodStart)` via the `billingRuns` table.
2. **Sending** — `createInvoice` fires an "invoice created" email to the parent (fire-and-forget); `resendInvoiceEmail` allows re-sending. There is no explicit "sent" state transition beyond the initial email; the `sent` status appears to be the default post-`draft` state assigned once a payment is recorded that doesn't fully pay the invoice, or is simply the state before any payment (see `recordPayment`'s status derivation: `sent → partially_paid → paid`, never explicitly set to `sent` on creation — invoices are created as `draft` and never observed transitioning to `sent` except through the payment-status-derivation branch in `recordPayment`, which defaults to `'sent'` when `totalPaid` is `0`. This is a real but minor lifecycle quirk, not a defect: a freshly created invoice with zero payments stays `draft` until the first `recordPayment` call, at which point it's re-derived as `sent`/`partially_paid`/`paid`. No confirmed defect here — documented as a lifecycle note for M.)
3. **Payment recording** — `recordPayment` (manual: cash/bank_transfer/voucher/other/stripe), `submitVoucherPayment` (parent portal, always `pending` pending staff verification), Stripe webhook (`/api/webhooks/stripe-invoice`, direct to `paid` on successful checkout).
4. **Payment verification** — `verifyPayment`/`failPayment`, only meaningful for `pending`-status payments (i.e. voucher submissions). Verifying a payment recalculates the invoice's paid total and flips the invoice to `paid` if the total covers the amount.
5. **Void** — `voidInvoice` (ORG_OWNER only), sets `status = 'void'`, preserves payment history, excluded from revenue/overdue calculations everywhere status is checked.
6. **Delete** — `deleteInvoice` (ORG_OWNER only), hard-deletes an invoice **only if it has zero payments** (payments must be removed first — though there is no UI or action to delete an individual payment; in practice this makes `deleteInvoice` usable only immediately after a mistaken creation).
7. **Refund/credit** — `CreditService.issueCredit`/`applyCreditToInvoice` exist and are correctly modelled (a `parentCredits` row, type `credit`/`debit`/`refund`) but are **not wired to any production code path** — confirmed by grep, only referenced from `credit.test.ts`. No UI, no server action, no route calls into `CreditService`. This is a real feature gap, not a defect (nothing is broken; the capability simply isn't exposed) — logged under N/O, not L.
8. **Reconciliation** — `reconcilePayment` (`billing/actions/reconcile-payment.ts`), a separate, parallel payment-recording path from `recordPayment`, idempotent via `transactionReference` uniqueness, correctly blocks against `paid`/`void` invoices and recalculates status with an epsilon tolerance for floating-point amounts.

Two parallel payment-recording code paths exist (`recordPayment` and `reconcilePayment`) with divergent authorization postures — this is the central finding of the audit (L1).

---

## D. Money / calculation semantics

- Money is stored as decimal pounds (`numeric(10,2)`) everywhere it is directly billed/paid, and as integer pence only at the recurring-billing-config layer, converted once via `String(pence / 100)` at invoice-generation time. This conversion was independently re-verified correct in both `generateInvoiceFromConfig` and `/api/cron/billing`.
- `src/lib/billing.ts`'s `penceToPounds`/`poundsToPence` are pure, tested-by-inspection, no defect found.
- UI totals (`Number(invoice.amount).toFixed(2)`, `payments.reduce(...)`) are computed client-side from server-supplied decimal strings — standard `Number()` coercion of a `numeric(10,2)` string is safe for UK childcare-fee magnitudes; no evidence of float-precision failure in the reviewed range.
- `reconcilePayment`'s status recalculation explicitly uses an epsilon tolerance when comparing `totalPaid >= invoiceAmount`, which is the more defensive of the two payment-verification code paths (`recordPayment`/`verifyPayment` use plain `>=` without epsilon — for two-decimal currency this is not itself a confirmed defect, since summed `numeric(10,2)` values round-trip through `Number()` without introducing fractional-penny drift in the reviewed code paths, but it is worth noting as a minor inconsistency between the two paths under N).
- No instance of a UI-displayed total silently diverging from a stored/server-computed total was found. No "fix" was made to money representation — the mixed pence/pounds design is intentional and internally consistent at its one conversion boundary.

**No confirmed money-handling defect.**

---

## E. Parent/child/booking relationships

- Invoices link to a `parentId` (required) and optionally a single `childId`, with `coveredChildrenJson` as a denormalised multi-child snapshot taken at creation time (used for family/sibling invoices). Ad-hoc invoices store a free-text child name in `coveredChildrenJson`/`notes` with no child record at all — this is an intentional, documented feature ("trial sessions, one-offs, or children not yet registered"), not a defect.
- `billingConfigs` link a `parentId` + `centreId` to a set of children via `billingConfigChildren` (many-to-many), independent of any specific booking.
- Neither `finance/actions.ts` nor `billing/actions.ts` reads booking data directly — Finance does not snapshot booking price at invoice-creation time; the two domains (Bookings and Finance) are only loosely coupled through the shared parent/child records, not through direct booking-cost references. No evidence of "invoice amount drifting from booking price" because Finance never derives invoice amounts from booking prices in the first place — amounts are always staff-entered or config-driven.

---

## F. Payment-provider interaction

- **Stripe** serves two genuinely distinct purposes in this codebase, confirmed by direct reading of `src/lib/services/stripe.ts`: org-subscription billing (`createCustomer`, `createCheckoutSession`, `createFreeSubscription`, `getSubscriptionStatus`, `cancelSubscription`, `handleWebhookEvent` — all out of scope, SaaS billing not childcare Finance) and parent invoice payment (`createInvoicePaymentSession`, `constructInvoiceWebhookEvent` — in scope). No defect found in either.
- `/api/webhooks/stripe-invoice/route.ts` — signature-verified, marks the invoice `paid` and inserts a `payments` row with `method: 'stripe', status: 'verified'` on `checkout.session.completed`. **No idempotency guard on the payment insert**, unlike `reconcilePayment`'s explicit `transactionReference` uniqueness check. A Stripe webhook retry (which Stripe's own delivery guarantees make a real, if infrequent, possibility) would insert a duplicate payment row and could push a partially-paid invoice's derived total above its actual amount. Logged as L4 (lower confidence/severity than L1–L3, but real and narrowly fixable).
- **GoCardless** (`src/lib/services/gocardless.ts`) is used exclusively for instalment/direct-debit payments (`invoiceInstalments.gocardlessPaymentId`), never for one-off invoice payment. `InstalmentService`/`CreditService` — and therefore GoCardless itself — are **not reachable from any production code path** (see B/C above). The service's real-API branch and stub branch both exist but neither is exercised at runtime today. The escaped-template-literal bug in this file (see L3) is real and would break the service the moment it becomes reachable, but currently has zero live blast radius.
- No production secrets were used, and no real charge, mandate, or webhook was triggered during this audit — verification of provider code was source-level only, consistent with the ticket's provider-safety requirement.

---

## G. Organisation isolation

Every Finance/billing server action and query was individually checked for whether it verifies `organisationId` before reading or writing:

| Function | File | Org check |
|---|---|---|
| `getParents`, `getChildrenByParent` | finance/actions.ts | ✅ |
| `createInvoice` | finance/actions.ts | ✅ (created invoice always belongs to caller's org — but see L2a: supplied `parentId`/`childIds`/`centreId` are never verified to belong to that org) |
| `createLegacyFamilyAndInvoice` | finance/actions.ts | ✅ (new parent/children always created under caller's org; `centreId` unverified — L2a) |
| `createAdHocInvoice` | finance/actions.ts | ✅ (same pattern — `centreId` unverified — L2a) |
| `getInvoiceDetails` | finance/actions.ts | ✅ (`eq(invoices.organisationId, session.user.organisationId)`) |
| `recordPayment`, `updateInvoiceDate`, `updateInvoiceNotes`, `verifyPayment`, `failPayment` | finance/actions.ts | ✅ |
| `deleteInvoice`, `voidInvoice`, `resendInvoiceEmail` | finance/actions.ts | ✅ |
| `createBillingConfig` … `generateInvoiceFromConfig` | billing/actions.ts | ✅ (via `getOrgId()`) |
| `reconcilePayment` | billing/actions/reconcile-payment.ts | ❌ **`organisationId` is a caller-supplied argument, never derived from the session, and never independently verified** — see L1. |

No cross-org data leak was found in any function *except* `reconcilePayment`, whose lack of any session check at all means org isolation for that one function is not merely weak but **absent**.

---

## H. Centre scoping

Established, evidenced non-owner centre-check pattern (present verbatim in five functions in `finance/actions.ts`):

```ts
const userRole = (session.user as any).role;
if (userRole !== 'ORG_OWNER') {
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    const invoice = await db.query.invoices.findFirst({ where: and(eq(invoices.id, id), eq(invoices.organisationId, orgId)), columns: { centreId: true } });
    if (!invoice || !accessibleCentreIds.includes(invoice.centreId)) throw new Error('Unauthorized: No access to this centre');
}
```

This pattern is present in `recordPayment`, `updateInvoiceDate`, `updateInvoiceNotes`, `verifyPayment`, `failPayment` — and **absent** from `createInvoice`, `createLegacyFamilyAndInvoice`, `createAdHocInvoice`, `getInvoiceDetails`, and **every function in `billing/actions.ts`**.

Page-level server queries are correctly centre-scoped where centre filtering is expected: `finance/page.tsx` applies `resolveActiveCentreId` + `eq(invoices.centreId, activeCentreId)` server-side (not client-side), matching the established pattern from every prior milestone. `finance/invoices/page.tsx` and `finance/receipt/page.tsx` intentionally show the **whole org**, unfiltered by centre — both are ORG_OWNER-only pages, so an org-wide view there is consistent with ORG_OWNER's org-wide authority and not a defect.

The critical centre-scoping finding is **exposure, not display**: `BillingSettingsCard` (Finance) is rendered unconditionally inside `StudentProfile.tsx` (Students, frozen), which is itself viewable by `ORG_OWNER, MANAGER, FRONT_DESK`. Every mutation `BillingSettingsCard` calls (`createBillingConfig`, `updateBillingConfig`, `addChildToConfig`, `removeChildFromConfig`, `pauseBillingConfig`, `resumeBillingConfig`, `cancelBillingConfig`) goes through `billing/actions.ts`'s `getOrgId()` helper, which checks **organisation only** — there is no role check and no centre check anywhere in that file. **Correction from an earlier draft of this section, made after Stage C live verification**: `students/[id]/page.tsx` already carries its own page-level centre check (`accessibleCentreIds.includes(student.centreId)`, else `notFound()`), confirmed live by logging in as a FRONT_DESK user and attempting to view a same-parent sibling child at a centre she has no assignment to — she was correctly blocked with a 404 before `BillingSettingsCard` ever rendered. So the cross-centre case is **not** reachable through the rendered UI today; an earlier version of this document overstated that path as live-UI-reachable. What remains true and confirmed is the exposure at the server-action layer: every function in `billing/actions.ts` is directly callable as its own Server Action, independent of which page currently renders a trigger for it, with no centre check of its own — so a crafted request from an authenticated non-owner, made without going through the Students page's gate at all, can currently create, edit, pause, resume, or cancel **any** family's recurring billing arrangement org-wide, including centres that user has no assignment to and no UI path to reach. See L2.

---

## I. Authorization matrix

Evidence-based only; "—" means no live UI surface currently reaches this action for that role, but the server action itself is independently callable regardless of UI (see caveats below the table).

| Action | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| View finance dashboard / invoice list / invoice detail | ✅ (page-gated) | ❌ (page redirects) | ❌ (page redirects) | ❌ (page redirects) |
| View a family's consolidated invoice ledger (via Parent profile) | ✅ | ✅ (read-only, view-only per client gating) | ✅ (read-only) | ❌ (Parent profile itself is `ORG_OWNER/MANAGER/FRONT_DESK` only) |
| Create invoice (`createInvoice`/legacy/ad-hoc) | ✅ (only role with UI access) | — (server action has no role check — L2a) | — (same) | — (same) |
| Record payment (`recordPayment`) | ✅ (only role with UI access) | — (server action allows centre-scoped non-owner call, but no UI reaches it — dead-but-safe code path, not a defect) | — | — |
| Edit invoice date/notes | ✅ (only role with UI access) | — (same dead-but-safe pattern) | — | — |
| Verify/fail a payment | ✅ (only role with UI access) | — (same) | — | — |
| Void invoice | ✅ (server-enforced ORG_OWNER-only) | ❌ | ❌ | ❌ |
| Delete invoice | ✅ (server-enforced ORG_OWNER-only) | ❌ | ❌ | ❌ |
| Resend invoice email | ✅ (server-enforced ORG_OWNER-only) | ❌ | ❌ | ❌ |
| Generate/download receipt or invoice PDF | ✅ (only role with UI access) | — | — | — |
| Export finance CSV | ✅ (route-enforced ORG_OWNER-only) | ❌ | ❌ | ❌ |
| **Set up / edit / pause / resume / cancel family billing config** (`billing/actions.ts`, via `BillingSettingsCard` on Student profile) | ✅ | ✅ for own-centre students via UI; server action has **no independent centre check — L2** (cross-centre UI path is already blocked by the Students module's own page-level gate, but the action itself is directly callable for any centre without going through that page) | Same as MANAGER | — (Student profile itself is `ORG_OWNER/MANAGER/FRONT_DESK` only, so TUTOR cannot reach it) |
| Generate invoice from billing config (`generateInvoiceFromConfig`) | ✅ (only role with UI access, via Finance dashboard's Billing Cycles tab) | — (server action has no role check) | — | — |
| Reconcile a payment (`reconcilePayment`) | — (page has no role gate; function has **no auth check of any kind** — L1) | — (same) | — (same) | — (same) |
| View/pay own invoices (parent portal) | n/a | n/a | n/a | n/a (parent-only, correctly scoped via `getCurrentParent`) |

**Caveat on every "—" cell**: because these are Next.js Server Actions, each is an independently POST-able endpoint. A page-level role redirect (`if (userRole !== 'ORG_OWNER') return redirect(...)`) blocks *rendering* of the triggering UI, not invocation of the action itself. Per the ticket's own instruction ("do not treat a hidden dropdown or client filtering as authorization"), every "—" for a mutation that has no independent server-side role/org/centre check is treated as a confirmed defect (L1, L2a), not merely a UI-reachability question. Where the underlying function *does* carry its own server-side check consistent with the sibling-function pattern (the `recordPayment`/`updateInvoiceDate`/`updateInvoiceNotes`/`verifyPayment`/`failPayment` group), the "—" is not a defect — it's a dead-but-safe code path, and is left as-is (Stage B does not add new UI to activate it, since doing so would be a new feature, not a defect fix).

No genuine ambiguity was found in this matrix requiring a Stage-A stop: the codebase's own sibling functions establish a clear, consistent intended policy (money-mutating Finance actions require either ORG_OWNER or an explicit centre-membership check for non-owners) that a subset of functions simply fails to implement. Applying that same, already-evidenced policy to the functions that lack it is a defect fix, not a policy invention.

---

## J. Receipts / invoices / documents

- `InvoiceTemplate.tsx`, `ReceiptTemplate.tsx` (React-PDF documents, not read in full this audit — no evidence of defect from their call sites; both receive fully-formed invoice objects and organisation name, no independent data fetching or authorization logic of their own to audit).
- `ReceiptGeneratorClient.tsx` (ad-hoc cash receipt generator, `/dashboard/finance/receipt`) — reachable by any authenticated org member (page has no role check), operates on org-scoped `centres`/`children` lists passed from the server. Lower severity than the billing-config finding since receipt generation doesn't mutate financial records; noted under M as a minor authorization looseness worth a decision, not fixed in Stage B (visual-parity/no-role-check on a *display/print* surface does not carry the same risk as a money-mutating surface, and the ticket's own examples of "material ambiguity" are specifically about money/deletion/voiding/refunding/access-to-financial-info/provider-behaviour — this is arguably "access to financial info" and is flagged, but is judged non-blocking given receipts require the same org-scoped data any of these roles could already see via the Parents module).
- No numbering-collision, org/centre-identity-mixing, or immutable-vs-regenerated defect found. Existing invoice-number generation (`INV-${nanoid(6)}`) is not sequential/legally-numbered but this is pre-existing behaviour, not something Stage 3G introduces or was asked to redesign.

---

## K. Exports

`GET /api/export/finance` — ORG_OWNER-gated, `eq(invoices.organisationId, ...)`-scoped, correct CSV escaping (verified by direct read). On-screen access to the same data is also ORG_OWNER-only, so there is no discrepancy between export authorization and on-screen authorization to document here.

---

## L. Confirmed defects

### L1 — `reconcilePayment` has no authentication check at all (most severe)

- **Problem**: `src/features/billing/actions/reconcile-payment.ts`'s `reconcilePayment(organisationId, staffId, input)` never calls `auth()`. `organisationId` is a caller-supplied argument, trusted without verification against any session. It is invoked from `reconciliation-client.tsx` (a Client Component) with a **hardcoded literal `staffId = 'staff-user'`** — not even the real staff member's ID.
- **Impact**: any request that can reach this server action endpoint — authenticated or not — can reconcile a payment against an arbitrary `organisationId`/`invoiceId`, with no record of which real staff member performed it (the audit trail is permanently poisoned with the literal string `'staff-user'`).
- **Evidence**: direct read of `reconcile-payment.ts` (83 lines) and `reconciliation-client.tsx` (180 lines).
- **Owning module**: Finance (both files).
- **Proposed fix**: add `const session = await auth(); if (!session?.user?.organisationId) throw new Error('Unauthorized');` and derive `organisationId`/`staffId` from the session rather than from caller-supplied arguments. Update the call site to stop passing a hardcoded `staffId`.
- **Regression test**: new test asserting `reconcilePayment` throws when called with no session, and that it uses `session.user.organisationId`/`session.user.id` rather than caller-supplied values even when those differ.

### L2 — Billing-config mutations have no independent role or centre check at the server-action layer

- **Problem**: every function in `src/features/billing/actions.ts` (`createBillingConfig`, `updateBillingConfig`, `addChildToConfig`, `removeChildFromConfig`, `pauseBillingConfig`, `resumeBillingConfig`, `cancelBillingConfig`, `generateInvoiceFromConfig`) checks organisation membership only, via `getOrgId()`. None checks role or centre membership.
- **Impact**: `BillingSettingsCard` (Finance-owned) is rendered **unconditionally** in `StudentProfile.tsx` (Students, frozen) whenever a student's profile is viewable, for `ORG_OWNER, MANAGER, FRONT_DESK`. Live verification (Stage C) confirmed the Students module's own page-level centre check (`students/[id]/page.tsx`, `notFound()` when `!accessibleCentreIds.includes(student.centreId)`) already blocks a non-owner from viewing a foreign-centre student's profile at all — so the cross-centre case is **not** reachable through the rendered UI today, correcting an earlier overstatement in this document's first draft. What remains true and confirmed is that `billing/actions.ts`'s mutations carry **no independent server-side centre check of their own**: as Next.js Server Actions, each is directly POST-able regardless of which page currently renders a trigger for it, so a crafted request from an authenticated non-owner — bypassing the Students page's gate rather than going through it — can currently create, edit, pause, resume, or cancel **any** family's billing arrangement org-wide, including centres that user has no assignment to and no UI path to reach. This is the same class of gap already flagged in L2a/L2b and the Authorization Matrix's caveat: an independently-callable server action is not authorized by a page-level redirect elsewhere in the app, contrary to the centre-isolation policy every other Finance mutation (that has a non-owner path at all) already implements.
- **Evidence**: `grep -rln "BillingSettingsCard" src` → `src/features/students/components/StudentProfile.tsx`; confirmed via direct read that no `role`/`isOwner` gating surrounds the render; confirmed via `requireAuth({ roles: ['ORG_OWNER','MANAGER','FRONT_DESK'] })` in `students/[id]/page.tsx` that these roles can reach that page.
- **Owning module**: Finance (`billing/actions.ts`, `BillingSettingsCard.tsx` are both Finance-owned; the fix does not require touching the frozen `StudentProfile.tsx`, since the authorization gap is fully closeable server-side).
- **Proposed fix**: apply the same evidenced sibling-function pattern from `finance/actions.ts` (`recordPayment` et al.) to every mutation in `billing/actions.ts`: ORG_OWNER bypasses the check; non-owner roles must have the target `centreId` (existing config's `centreId` for update/pause/resume/cancel/add-child/remove-child; the supplied `centreId` for create) within `getUserAccessibleCentreIds(session.user.id)`. This extends already-established policy rather than inventing new policy, and does not lock out MANAGER/FRONT_DESK users who are legitimately assigned to the centre in question — it only closes the cross-centre gap.
- **Regression test**: new tests asserting each mutation throws for a non-owner whose accessible centres don't include the target, and succeeds for a non-owner whose accessible centres do.

### L2a — Invoice-creation functions trust caller-supplied `parentId`/`childIds`/`centreId` without verifying org ownership

- **Problem**: `createInvoice`, `createLegacyFamilyAndInvoice`, `createAdHocInvoice` (`finance/actions.ts`) check that the *caller* belongs to an organisation, but never verify that the supplied `parentId`/`childIds`/`centreId` actually belong to that organisation before using them. `createInvoice` in particular does `db.select().from(children).where(inArray(children.id, data.childIds))` with no organisation filter at all.
- **Impact**: a direct call with a `parentId`/`childIds` belonging to a different organisation would create an invoice under the caller's own org that references another org's parent/child records (their name/email would then appear on an invoice, PDF, and audit event belonging to a different tenant) — a data-integrity and cross-tenant information-disclosure risk, not merely a permissions gap. A mismatched `centreId` (never validated against the org's own centre list) would similarly let an invoice be created under a centre belonging to a different org.
- **Evidence**: direct read of all three functions (lines 130–314) — no `eq(children.organisationId, ...)`, `eq(parents.organisationId, ...)`, or `eq(centres.organisationId, ...)` filter present on any of the caller-supplied IDs.
- **Owning module**: Finance.
- **Proposed fix**: add organisation-ownership verification for every caller-supplied `parentId` (where an existing parent is referenced), `childIds`, and `centreId` before use, and add the same ORG_OWNER-or-centre-check pattern as L2 (since these are the only three functions in `finance/actions.ts` that create new invoices and currently have no role restriction at all, unlike every other mutation in the file).
- **Regression test**: new tests asserting each function rejects a `centreId`/`parentId`/`childIds` that doesn't belong to the caller's organisation.

### L2b — `getInvoiceDetails` has no role or centre check

- **Problem**: `getInvoiceDetails` (`finance/actions.ts`) is correctly org-scoped but has no role or centre check, unlike its sibling read/write functions.
- **Impact**: a direct call by a non-owner could read full invoice + payment history (including parent contact details) for a centre they don't have access to, within the same organisation. Currently only reachable via the ORG_OWNER-gated invoice-detail page, so this is a defense-in-depth fix rather than a live-exploitable gap today — but per the ticket's explicit instruction not to rely on page-level gating as authorization for an independently-callable server action, it is treated as confirmed.
- **Evidence**: direct read, lines 316–351.
- **Owning module**: Finance.
- **Proposed fix**: apply the same non-owner centre-check pattern used in `recordPayment`.
- **Regression test**: new test asserting a non-owner without access to the invoice's centre gets `Unauthorized`.

### L3 — Escaped template-literal bug (`\${...}` instead of `${...}`) across multiple Finance-owned files

- **Problem**: a systematic typo — `\${...}` instead of `${...}` — renders these as broken literal text instead of real string interpolation. Confirmed by direct `Read` (not just grep) in every listed file.
- **Locations and severity**:
  - `reconciliation-client.tsx:73` — **functionally broken**: a conditional `className` string, so the intended conditional styling never applies (cosmetic-only blast radius, but a genuine bug, not a style choice).
  - `reconciliation-client.tsx:147` — cosmetic (a `placeholder` string literally reads `Max: \${invoice?.remainingBalance.toFixed(2)}`).
  - `reconcile-payment.ts:36,76` — cosmetic (log messages only).
  - `gocardless.ts:56,59,70,82,83,113,114,118,167,169` — **functionally broken in the real-API branch**: the fetch URL (`` `\${API_BASE}\${path}` ``) and Authorization header (`` `Bearer \${GOCARDLESS_ACCESS_TOKEN}` ``) would send literal, non-interpolated strings to GoCardless, guaranteeing every real API call fails; the stub branch's "random" IDs (`` `CU\${Math.random()...}` ``) return the same fixed literal string every time instead of a random one, breaking uniqueness guarantees the moment this code becomes reachable. Currently zero live blast radius since this service is unreachable from production code (see F), but the fix is trivial, narrowly scoped to this file, and prevents the bug from surfacing the moment `InstalmentService`/`GoCardlessService` are wired up in a future milestone.
  - `credit.ts:51,104,111,162,176` — **functionally broken in a way that would very likely throw at runtime**: line 111's `sql\`\${parentCredits.reason} LIKE \${idempotencyReason + '%'}\`` breaks Drizzle's own tagged-template interpolation, not just a JS string — this is not merely wrong output but a probable runtime SQL-building error the moment `CreditService.applyCreditToInvoice`'s idempotency check executes. Also unreachable from production code today (see C), same "fix before it's wired up" rationale.
  - `instalments.ts:43` — cosmetic (log message only).
- **Owning module**: Finance (all files).
- **Proposed fix**: mechanical, line-scoped removal of the stray backslash in each location. No behavioural redesign.
- **Regression test**: for the two functionally-broken-but-currently-unreachable files (`gocardless.ts`, `credit.ts`), the existing test suites (`credit.test.ts`, `instalments.test.ts`) mock the DB/HTTP layer and do not exercise real string content, which is exactly why these bugs currently pass all existing tests — Stage B will add narrow assertions on the actual interpolated string/query content so the bug can't silently regress once these services are wired up. For `reconciliation-client.tsx`'s broken className, a visual check is more appropriate than a unit test per the ticket's own guidance (purely visual defect).

### L4 — Stripe invoice webhook has no idempotency guard on payment insert

- **Problem**: `/api/webhooks/stripe-invoice/route.ts` inserts a `payments` row on every `checkout.session.completed` event with no check for whether a payment for that Stripe session/reference has already been recorded, unlike `reconcilePayment`'s explicit `transactionReference` uniqueness check.
- **Impact**: a Stripe webhook retry (a normal, documented possibility in Stripe's delivery model, not a hypothetical) would insert a duplicate payment row, inflating the invoice's derived paid total.
- **Evidence**: direct read of the route (83 lines).
- **Owning module**: Finance.
- **Proposed fix**: add a narrow idempotency check (e.g. on the Stripe session/payment-intent ID stored as `transactionReference`) before inserting, mirroring `reconcilePayment`'s existing pattern. This is additive and does not touch provider integration architecture.
- **Regression test**: new test asserting a second webhook delivery for the same session ID does not create a second payment row.

**No other confirmed defects were found.** In particular: no money-handling defect (D), no parent/child/booking relationship defect (E), no receipt/invoice document defect beyond the authorization looseness noted in J/M, and no export defect (K).

---

## M. Ambiguous behaviour / policy questions (not blocking, none material enough to stop)

- **M1 — Should `/dashboard/finance/receipt` (cash receipt generator) be role-restricted?** Currently reachable by any authenticated org member. It doesn't mutate financial records, but it does expose org-wide children/parent data for receipt printing. Judged non-material (not money/deletion/voiding/refunding/provider-behaviour, and the same underlying data is already visible to MANAGER/FRONT_DESK via the Parents module) — left as-is, noted for a future decision rather than fixed in Stage B, since restricting it would be a policy invention with no sibling-function precedent to justify a specific choice of allowed roles.
- **M2 — `FinanceDashboardClient.tsx`'s `InvoiceTable`/`OverdueInvoiceTable`/`ParentBalanceTable`/`InvoiceAgingSummary` exports.** Only `InvoiceTable` is used in production (via Parents module and `FilterableInvoiceHistorySection`); `OverdueInvoiceTable`, `ParentBalanceTable`, `InvoiceAgingSummary` have zero call sites anywhere in `src/app`. This is dead code, not a defect — per the ticket's explicit "no dead-code deletion" instruction, these are left in place and simply not styled/modernised as part of Stage B (there is no live surface to modernise).
- **M3 — Invoice lifecycle's implicit `draft`→`sent` transition** (documented in C) only happens as a side effect of `recordPayment`'s status-derivation branch, not as an explicit "mark as sent" action. This is existing, working behaviour — not changed in Stage B.
- **M4 — Two parallel payment-recording paths** (`recordPayment` and `reconcilePayment`) exist with no evidence of which one is the "primary" one going forward, or whether `reconciliation-client.tsx`'s legacy-styled UI is meant to be consolidated with the main invoice-detail payment flow. Stage B modernises `reconciliation-client.tsx`'s visual styling (frozen design system) and fixes its authorization defect (L1), but does not merge or redesign the two payment-recording flows — that would be an architecture decision beyond narrow defect-fixing.

- **M5 — `/dashboard/finance/reconciliation` (page-level) has no role gate, confirmed live in Stage C.** Live-logging in as MANAGER, FRONT_DESK, and TUTOR each successfully loaded `/dashboard/finance/reconciliation` (200, no redirect) and could see the org's pending-invoice list (parent name, invoice number, amount) for whichever centre resolves as their active centre — the same shape of exposure as M1, on the same "view-only, no mutation risk since L1 now protects the write" reasoning. Left as-is for the same reason as M1: not money/deletion/voiding/refunding/provider-behaviour, no sibling-function precedent for which specific roles should be allowed, and restricting it would be a policy invention rather than an evidenced fix.

- **M6 — `resolveActiveCentreId`'s cookie-vs-sidebar default can disagree on a fresh session, observed live on `/dashboard/finance`.** On a browser session with no `selected_centre_id` cookie yet set (e.g. a first visit after login), `/dashboard/finance` resolves its own data-query centre independently of the sidebar's "ACTIVE CENTRE" indicator — both are driven by the same underlying value in steady state, but on a cookie-less first load the page-level default (`accessibleCentreIds[0]`, from `centres.findMany`'s natural ordering) and the sidebar's own centre-context default do not reliably resolve to the same centre. Live-observed effect: an ORG_OWNER's very first `/dashboard/finance` visit after login showed "0 invoices" / "£0.00" despite the sidebar reading "ACTIVE CENTRE: Main Campus" and real invoices existing at Main Campus — passing an explicit `?centre=<id>` (which also happens whenever the on-page centre dropdown is used, writing the cookie) immediately showed the correct figures, and every subsequent load in that session was then consistent. This is not a Milestone 3G regression: `resolveActiveCentreId` (`src/lib/centre-filter.ts`) is a shared, frozen primitive used identically by Centres/Bookings/Attendance/Finance, the Finance page's own query logic is correct once given a centre id, and no data is ever shown for the wrong org or leaked across a centre boundary — the failure mode is a confusing empty state, not an authorization or data-integrity defect. Fixing the default-resolution order is a cross-module primitive change outside Finance's ownership and this milestone's narrow-fix mandate; flagged here for a future decision rather than fixed in Stage B/C.

None of M1–M6 rise to the ticket's "material policy ambiguity" bar (money/deletion/voiding/refunding/financial-info-access/provider-behaviour where the resolution would materially change permissions or displayed liability) — Stage A therefore proceeds directly to Stage B without a stop.

---

## N. Cross-module dependencies

- **Parents module → Finance**: `ParentProfileClient.tsx` imports and renders Finance's `InvoiceTable`. No frozen-module file needs to change — the mutation buttons it conditionally renders (`isOwner &&`) are correctly backed by real server-side ORG_OWNER checks in `deleteInvoice`/`voidInvoice`.
- **Students module → Finance**: `StudentProfile.tsx` imports and renders Finance's `BillingSettingsCard` with no role gate. As established in L2, the fix is entirely containable within Finance (`billing/actions.ts`) and does not require editing the frozen `StudentProfile.tsx` — the security gap is fully closed server-side even though the UI will still render the (now correctly-erroring) controls to non-owner viewers who lack centre access. This is flagged as residual UX debt (a future milestone could pass `isOwner`/role down from `StudentProfile.tsx` to hide controls the user can't use), not fixed here, since it would require touching a frozen file for a UX polish, not a defect fix.
- **Centres module ← Finance-sounding name**: `FinancePricingForm.tsx` posts to `/api/centres/[id]` (Centres-owned, frozen) — despite living in `src/features/settings/components/`, this is Org Settings/Centres territory, correctly out of scope, not touched.
- **Bookings module**: no direct dependency found — Finance does not read booking records at all (see E).

---

## O. Out-of-scope debt (explicitly not touched)

- `CreditService`/`InstalmentService` being unreachable from production code (a real feature gap, but adding UI/wiring for refunds or instalments would be a new feature, explicitly out of scope per the ticket).
- `OverdueInvoiceTable`/`ParentBalanceTable`/`InvoiceAgingSummary` dead code (not deleted, per ticket instruction).
- `reconciliation-client.tsx`'s architecture as a second, parallel payment-recording surface (M4) — visual modernisation and its L1 authorization defect are fixed; the surface itself is not merged or redesigned.
- `StudentProfile.tsx` not passing `isOwner`/role down to `BillingSettingsCard` for UI-level control hiding (residual UX rough edge after the server-side fix in L2 — frozen module, not touched).
- Sequential/legally-numbered invoice numbering (`INV-${nanoid(6)}` is random, not sequential) — pre-existing, not something this milestone was asked to fix, no evidence it's a confirmed defect (no legal/regulatory requirement found referenced anywhere in the repo).
- Known incoming baseline: one unrelated Communications test failing due to a `next/server`-via-`next-auth` module-resolution problem (carried over from Milestone 3F's own audit) — will be verified as pre-existing at `b80ce4b`, not treated as a 3G regression.

---

## P. Proposed Stage-B implementation scope

1. **L1** — add real session-derived auth to `reconcilePayment`; stop passing a hardcoded `staffId` from `reconciliation-client.tsx`.
2. **L2** — add ORG_OWNER-or-centre-check authorization to every mutation in `billing/actions.ts`.
3. **L2a** — add organisation-ownership verification for caller-supplied `parentId`/`childIds`/`centreId` in `createInvoice`/`createLegacyFamilyAndInvoice`/`createAdHocInvoice`, plus the same ORG_OWNER-or-centre-check pattern.
4. **L2b** — add the non-owner centre-check pattern to `getInvoiceDetails`.
5. **L3** — fix every escaped-template-literal occurrence listed above (mechanical, line-scoped).
6. **L4** — add an idempotency guard to the Stripe invoice webhook's payment insert.
7. **Regression tests** for every fix above (new test files: `finance/actions.test.ts`, `billing/actions.test.ts` additions; extend `gocardless.test.ts`/add one if none exists, extend `credit.test.ts`/`instalments.test.ts` with string-content assertions; extend or add a webhook idempotency test).
8. **Visual modernisation** of Finance-owned surfaces still on legacy styling onto the frozen InvoiceFlow design system: `src/app/dashboard/finance/page.tsx` (KPI cards/header already partially modernised via `FinanceDataGridClient`, header actions need a pass), `finance/invoices/page.tsx` + `FilterableInvoiceHistorySection.tsx`, `finance/invoices/[id]/page.tsx` + `InvoiceDetailsClient.tsx` (already close to the target system — verify tokens, light/dark), `reconciliation-client.tsx` (confirmed still on pre-InvoiceFlow legacy styling, needs the largest visual pass), `finance/receipt/page.tsx` + `ReceiptGeneratorClient.tsx` (not yet visually audited in detail — Stage C will inspect).
9. No schema changes are required for any of the above.
10. No frozen-module files require editing.

Stage A is complete. Proceeding to Stage B.
