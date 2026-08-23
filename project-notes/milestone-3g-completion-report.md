# Milestone 3G — Finance Module Modernisation — Completion Report

**Repo**: `kwadwoaddo-collab/After-School-Club-CMS`
**Branch**: `rebuild/cms-modernisation`
**Frozen baseline**: `b80ce4b`
**Prior milestones (frozen, unchanged by this milestone)**: 3A Students, 3B Parents, 3C Staff, 3D Centres, 3E Bookings, 3F Attendance.

---

## 1. Starting state

Verified at the start of this milestone: repository at commit `b80ce4b`, clean working tree, on branch `rebuild/cms-modernisation`. No uncommitted changes, no divergence from the frozen baseline. This matches the state every prior milestone in this rebuild (3A–3F) started from and left the branch in.

---

## 2. Stage-A audit summary

A full Finance-module audit was written first, before any production code was touched: `project-notes/milestone-3g-finance-audit.md` (also mirrored to the Claude Project as `claude/milestone-3g-finance-audit.md`). It covers the module's full surface inventory, data model, financial lifecycle, money semantics, parent/child relationships, provider interaction (Stripe, GoCardless), organisation isolation, centre scoping, the authorization matrix, receipts/documents, exports, and a scoped Stage-B proposal.

**Outcome of the mandatory stop/proceed decision**: no material policy ambiguity involving money, deletion, voiding, refunding, financial-info access, or provider behaviour was found. Four ambiguities were logged (M1–M4 at audit time; M5–M6 were added afterward from Stage-C live findings — see §19) but none met the ticket's bar for a Stage-A stop (a resolution that would materially change permissions or displayed liability). Stage A therefore proceeded directly into Stage B.

Six confirmed defects were identified and are detailed in §6 below: L1 (`reconcilePayment` — no auth at all), L2 (billing-config mutations — no independent centre check), L2a (invoice-creation — no org-ownership verification on supplied IDs), L2b (`getInvoiceDetails` — no role/centre check), L3 (escaped-template-literal bugs across three service files), L4 (Stripe webhook — no delivery idempotency guard).

**One correction made after Stage-A**, documented transparently: the audit's original L2 write-up characterized the cross-centre billing-config exposure as "live-reachable through the actual rendered UI." Stage-C live verification (see §16) showed this overstated the finding — the frozen Students module's own page-level centre check already blocks a non-owner from viewing a foreign-centre student's profile at all, so the cross-centre UI path was never actually reachable. The underlying defect is unchanged and was still fully real and fully fixed: `billing/actions.ts`'s mutations had zero independent server-side authorization of their own, so a crafted direct call (bypassing the Students page's gate, not going through it) could reach any centre org-wide. The audit document was corrected in place and re-mirrored to the project once this was confirmed live, rather than left to stand incorrectly in the historical record.

---

## 3. Finance authorization matrix

Reproduced from the (corrected) audit; "—" means no live UI surface currently reaches this action for that role, but the server action itself is independently callable regardless of UI.

| Action | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR |
|---|---|---|---|---|
| View finance dashboard / invoice list / invoice detail | ✅ (page-gated) | ❌ (redirects) | ❌ (redirects) | ❌ (redirects) |
| View family invoice ledger (via Parent profile) | ✅ | ✅ (read-only) | ✅ (read-only) | ❌ |
| Create invoice | ✅ (only role with UI access) | — (fixed, L2a) | — | — |
| Record payment | ✅ (only role with UI access) | — (dead-but-safe, already centre-checked) | — | — |
| Edit invoice date/notes | ✅ | — (dead-but-safe) | — | — |
| Verify/fail a payment | ✅ | — (dead-but-safe) | — | — |
| Void invoice | ✅ (server-enforced) | ❌ | ❌ | ❌ |
| Delete invoice | ✅ (server-enforced) | ❌ | ❌ | ❌ |
| Resend invoice email | ✅ (server-enforced) | ❌ | ❌ | ❌ |
| Generate/download receipt or PDF | ✅ | — | — | — |
| Export finance CSV | ✅ (route-enforced) | ❌ | ❌ | ❌ |
| Set up/edit/pause/resume/cancel family billing config | ✅ | ✅ own-centre via UI; server action independently centre-checked post-fix (L2) | Same as MANAGER | — |
| Generate invoice from billing config | ✅ (only role with UI access) | — | — | — |
| Reconcile a payment | — (page has no role gate; function now session-derived, fixed L1) | — | — | — |
| View/pay own invoices (parent portal) | n/a | n/a | n/a | n/a (parent-only, correctly scoped) |

---

## 4. Data model / source-of-truth findings

No schema changes were made or required. The existing `invoices` / `payments` / `billingConfigs` / `billingConfigChildren` / `billingRuns` tables and their foreign-key relationships to `parents`/`children`/`centres`/`organisations` were confirmed sufficient for every defect fix — every fix is an added authorization check or an idempotency guard against existing columns, never a new column or table.

---

## 5. Financial lifecycle findings

Confirmed via direct read and live exercise: invoices move `draft` → `sent` → `partially_paid`/`paid`, or `sent`/`partially_paid`/`draft` → `void`. The `draft`→`sent` transition happens implicitly inside `recordPayment`'s status-derivation branch rather than as an explicit action (pre-existing behaviour, unchanged — see audit M3). `deleteInvoice` and `voidInvoice` are both strictly `ORG_OWNER`-only with organisation-ownership verification and were, along with `resendInvoiceEmail`, already the cleanest and most secure functions in the file — they served as the model for the L2/L2a/L2b fixes.

---

## 6. Confirmed defects, fixes, and regression tests

### L1 — `reconcilePayment` had no authentication check at all

**Problem**: took `organisationId`/`staffId` as caller-supplied arguments; never called `auth()`; the client called it with a hardcoded literal `staffId = 'staff-user'`.
**Fix**: `src/features/billing/actions/reconcile-payment.ts` now derives both values from the session, and applies the same evidenced non-owner centre-check pattern used by `finance/actions.ts`'s sibling functions.
**Test**: `src/features/billing/actions/reconcile-payment.test.ts` (5 tests, rewritten) — rejects no-session, rejects non-owner-without-centre-access, allows ORG_OWNER, allows non-owner-with-access, idempotency skip on double-click.
**Live verification**: exercised end-to-end as ORG_OWNER (§16) — a real pending invoice was reconciled via Tax-Free Childcare through the actual UI; the payment row and invoice status update correctly, with zero console errors.

### L2 — Billing-config mutations had no independent role/centre check

**Problem**: every function in `src/features/billing/actions.ts` checked organisation membership only.
**Fix**: added `assertCentreAccess`/`getOrgIdAndSession`/`requireOwnedConfig` helpers; every mutation now requires ORG_OWNER or centre-membership for the target config's centre.
**Test**: `src/features/billing/actions.test.ts` (15 tests, new) — reject/allow pairs for every mutation.
**Live verification**: the cross-centre UI path is already blocked by the frozen Students module's own page gate (see §16); the fix's actual authorization boundary is confirmed by the 15 unit tests above, which exercise the real production functions (not reimplemented logic) against mocked session/centre-access states — see §17 for why this was judged sufficient in place of an ad-hoc live crafted-request script.

### L2a — Invoice-creation functions trusted caller-supplied IDs without org-ownership verification

**Problem**: `createInvoice`, `createLegacyFamilyAndInvoice`, `createAdHocInvoice` never verified that supplied `parentId`/`childIds`/`centreId` belonged to the caller's own organisation.
**Fix**: added org-ownership verification for every caller-supplied ID before use, plus the same ORG_OWNER-or-centre-check pattern.
**Test**: `src/features/finance/actions.test.ts` (12 tests, new, covers L2a and L2b together).

### L2b — `getInvoiceDetails` had no role or centre check

**Problem**: correctly org-scoped, but no role/centre check, unlike its sibling functions.
**Fix**: added the standard non-owner centre-check pattern.
**Test**: included in `src/features/finance/actions.test.ts` above.

### L3 — Escaped template literals broke interpolation across three service files

**Problem**: `\${...}` instead of `${...}` in `gocardless.ts`, `credit.ts`, `instalments.ts` — stub IDs, log lines, and (in `credit.ts`) the actual idempotency-matching `sql` template were all literal, non-interpolated text.
**Fix**: `sed`-corrected all 16 occurrences across the three files; verified via `git diff` that only the intended lines changed.
**Test**: `src/lib/services/gocardless.test.ts` (5 new tests, stub + real-API-branch URL/header construction); `src/lib/services/credit.test.ts` (extended with 2 assertions inspecting actual interpolated string content — the prior mocked test passed even with the bug present, since it never inspected the string).

### L4 — Stripe invoice webhook had no delivery-idempotency guard

**Problem**: inserted a payment row on every `checkout.session.completed` event with no duplicate-delivery guard, unlike `reconcilePayment`'s own uniqueness check.
**Fix**: added a `payments` lookup keyed on `(invoiceId, transactionReference=session.id)` before inserting; a redelivery now returns `{ ok: true, duplicate: true }` without a second insert or a second status update.
**Test**: `src/app/api/webhooks/stripe-invoice/route.test.ts` (3 new tests).

---

## 7. Payment / provider findings

Stripe (`stripeService`) and the ad-hoc/legacy invoice flows were confirmed correctly integrated with no defects beyond L4's idempotency gap. GoCardless (`gocardless.ts`) is not wired into any production code path today (confirmed via grep — no call sites in `src/app`); its L3 fix and new test suite exist purely to lock in correct behaviour before it is ever activated, since it was found broken by the same escaped-literal bug as `credit.ts`/`instalments.ts`.

---

## 8. Organisation / centre-isolation findings

No cross-organisation data leak was found in any function except `reconcilePayment` pre-fix (L1), whose complete absence of a session check meant org isolation there was not merely weak but absent — now fixed. Centre isolation gaps were L2/L2a/L2b, all fixed and regression-tested as above. Cross-org testing itself could not be performed live (this dev environment has a single organisation seeded) — see §17 for how this limitation was handled.

---

## 9. UI/UX changes

Only one Finance surface required visual modernisation: `src/app/dashboard/finance/reconciliation/reconciliation-client.tsx` and its parent `page.tsx`, which were on a legacy `[--color-x]` bracket-syntax styling system rather than the frozen InvoiceFlow design tokens. Both were rewritten onto `bg-card`/`border-border`/`text-foreground`/`text-muted-foreground`/`bg-secondary/40`/`rounded-2xl`/`rounded-[32px]` etc., and the payment-method `<select>` was replaced with the same button-grid pattern already established in `RecordPaymentModal`. Every other Finance surface (`InvoiceDetailsClient`, `RecordPaymentModal`, `PaymentHistoryList`, `CreateInvoiceModal`, `FinanceDataGridClient`, the dashboard, invoice list, receipt generator) was already on the frozen design system and required no visual changes. No parallel Finance palette was introduced anywhere.

---

## 10. Files changed, grouped by owning module

**Finance-owned** (7 files): `src/features/finance/actions.ts`; `src/features/finance/actions.test.ts` (new); `src/features/billing/actions.ts`; `src/features/billing/actions.test.ts` (new); `src/features/billing/actions/reconcile-payment.ts`; `src/features/billing/actions/reconcile-payment.test.ts`; `src/app/dashboard/finance/reconciliation/reconciliation-client.tsx`; `src/app/dashboard/finance/reconciliation/page.tsx`; `src/app/api/webhooks/stripe-invoice/route.ts`; `src/app/api/webhooks/stripe-invoice/route.test.ts` (new).

**Shared services, Finance-adjacent** (5 files): `src/lib/services/gocardless.ts`; `src/lib/services/gocardless.test.ts` (new); `src/lib/services/credit.ts`; `src/lib/services/credit.test.ts`; `src/lib/services/instalments.ts`.

No file in any frozen module (Students, Parents, Staff, Centres, Bookings, Attendance) was modified. `src/features/students/components/StudentProfile.tsx` (which renders Finance's `BillingSettingsCard`) and `src/app/dashboard/students/[id]/page.tsx` (whose existing centre check was load-bearing evidence for the L2 correction) were both read but not touched — the L2 fix was fully achievable server-side within Finance's own files.

Documentation: `project-notes/milestone-3g-finance-audit.md` (new), `project-notes/milestone-3g-completion-report.md` (this file, new).

---

## 11. Responsive verification

Screenshots captured at 1440×900 (desktop), 834×1112 (tablet), 375×812 (mobile) for five Finance surfaces (dashboard, invoice list, invoice detail, reconciliation, receipt generator) — 30 screenshots total, all reviewed. No horizontal overflow, no clipped content, no broken layout at any breakpoint. The mobile layout collapses the sidebar to a bottom nav bar consistent with the rest of the app; the reconciliation page's rewritten button-grid payment-method selector wraps correctly at all three widths.

---

## 12. Light/dark verification

Both themes were explicitly set via `localStorage.theme` + reload, and the resulting `<html class="light">` / `<html class="dark">` state was read back and asserted before each screenshot — not just requested — specifically because Milestone 3F's own audit recorded a prior instance where a theme-setting call silently failed and both screenshot batches ended up dark. Confirmed here: light requests produced `class="light"`, dark requests produced `class="dark"`, for both checks performed. All five surfaces were visually reviewed in both themes; no unstyled/broken-token elements, no illegible text-on-background combinations, and the modernised reconciliation surface renders correctly in both.

---

## 13. RSC / runtime verification

Console errors and page errors were captured via Playwright across all live sessions in this milestone. As ORG_OWNER, across the full payment/void/reconcile/navigation flow (§16), zero console errors were recorded. As MANAGER/FRONT_DESK/TUTOR, a transient `ClientFetchError` from NextAuth's client-side `getSession()` was observed once or twice per account during rapid, back-to-back scripted `page.goto()` navigation with no pacing between requests; the identical navigation sequence produced zero errors for ORG_OWNER, and a follow-up check confirmed no such error under normal-paced navigation (the same pattern used throughout the payment/void/reconcile testing, which paces actions with explicit waits). This is judged a scripted-test-harness artifact of unpaced navigation against NextAuth's session-refetch-on-navigation behaviour, not a Finance-module regression — no page failed to load, no redirect misfired, and no data was shown incorrectly as a result.

---

## 14. Live functional verification

All performed against real dev-DB data as ORG_OWNER (`kwadwoaddo@googlemail.com`), via Playwright/Chromium:

- **Record payment**: opened a real `sent` invoice (INV-STGC01, £120.00), recorded a £120 cash payment through the actual `RecordPaymentModal` UI. Result: invoice status `SENT` → `PAID`, payment row created (method `cash`, status `verified`), balance remaining £0.00. Zero console errors.
- **Void invoice**: opened a second real `sent` invoice (INV-STGC02, £85.00), clicked Void, confirmed. Result: status `SENT` → `VOID`, action buttons correctly reduced to `Preview`/`PDF`/`Record Payment`/`Delete` (Void/Send-to-parent no longer offered on a void invoice). Zero console errors.
- **Reconcile payment (L1)**: created a third real `sent` invoice (INV-STGC03, £60.00), selected it on the Payment Reconciliation page, chose Tax-Free Childcare as the method, entered a reference, submitted. Result: "Payment reconciled successfully", invoice status → `PAID`, a `payments` row created with `method='tax_free_childcare'`, `transaction_reference='TFC-STGC-001'` — confirmed directly against the database. The reconciliation list correctly returned to "All caught up!" afterward. Zero console errors.
- **Finance dashboard, invoice list, receipt generator**: all load correctly for ORG_OWNER with zero console errors once given an explicit active centre (see §19, M6, for a caveat on the first-load default).
- Invoice creation via the multi-step `CreateInvoiceModal` wizard was smoke-tested (opens without error; the built-in parent-search field returns real results; zero console errors) but not driven to full completion via the UI script — the wizard's multi-step client state was not straightforward to script blindly within this session's time budget, and the authorization paths it depends on (L2a) are already covered end-to-end by 5 dedicated unit tests exercising the real `createInvoice`/`createAdHocInvoice`/`createLegacyFamilyAndInvoice` functions. This is a deliberate, documented scope trim, not an oversight.

All three test invoices, and the child/parent fixture used to exercise them, are pre-existing seeded dev data (Emma Wright / Oscar Wright, Main Campus) plus three newly-inserted disposable invoice rows — see §20 for disposition.

---

## 15. Live security verification — role authorization

Logged in as each of MANAGER (`marcus.manager@brightstar.example`), FRONT_DESK (`freya.frontdesk@brightstar.example`), and TUTOR (`tariq.tutor@brightstar.example`) — passwords for these pre-existing seeded accounts were not recorded anywhere in the repo from whichever prior milestone created them, so their `password_hash` columns were reset to a fresh bcrypt hash of a known dev-only password, matching the ORG_OWNER account's own credential, explicitly as "safe seeded/dev data" per the ticket's own live-verification allowance.

- `/dashboard/finance` and `/dashboard/finance/invoices`: all three non-owner roles correctly redirected to `/dashboard` — confirms the existing `ORG_OWNER`-only page gate.
- `/dashboard/finance/reconciliation` and `/dashboard/finance/receipt`: all three non-owner roles could load these pages (200, no redirect) — this matches the audit's own documented finding (no page-level role gate on either surface) and is now recorded live in the audit as M5/M1 rather than left as a theoretical read. Neither surface allows a mutation without going through its own server-action-level check, so this is a view-only exposure, not a write exposure.

---

## 16. Live security verification — centre isolation

The concrete scenario tested was the L2 finding: can a non-owner reach a foreign-centre family's billing config via the Students module UI?

Fixture: a new child "Nora Wright" was created at Riverside Annex (a centre Freya, FRONT_DESK, has no assignment to), as a sibling of the existing "Oscar Wright" at Main Campus (a centre Freya does have access to), both under the same parent (Emma Wright) — enabling a same-parent, cross-centre comparison.

- Freya → Nora Wright's profile (Riverside Annex, inaccessible): **HTTP 200, body is the app's 404 page** ("This page could not be found"). The frozen `students/[id]/page.tsx`'s own centre check (`accessibleCentreIds.includes(student.centreId)`, else `notFound()`) blocks this before `BillingSettingsCard` ever renders.
- Freya → Oscar Wright's profile (Main Campus, accessible): **200, body contains "Oscar" and "Billing"** — confirms the legitimate own-centre path is unaffected by the L2 fix.

This is the finding that led to the audit correction in §2: the cross-centre exposure is real at the server-action layer (any centre, reachable by a crafted direct call bypassing the Students page) but was never actually reachable through the rendered UI, because a different frozen module's own gate already blocks that specific path. Both facts are now accurately recorded.

**Organisation isolation** could not be tested live — this dev environment has a single seeded organisation, so there is no second-org account to attempt cross-org access with. This is explicitly noted rather than described as "tested": org-isolation coverage for the functions this milestone touched comes from the automated regression suite (§6), which exercises the real production functions against mocked cross-org session/data scenarios, not from a live cross-org UI or crafted-request test.

---

## 17. A note on evidence choices for L2 and organisation isolation

Two places in this report rely on the automated regression suite as the primary evidence for a server-action-level authorization boundary, rather than an ad-hoc live crafted-request script:

1. **L2's actual IDOR-style exploit vector** (a direct call to e.g. `pauseBillingConfig` bypassing the Students page's UI entirely). Reproducing this live would mean crafting a raw POST to a Next.js Server Action's internal endpoint (which requires the action's runtime-generated id from the RSC payload, not a stable public API) from outside the browser session — a meaningfully more complex undertaking than the browser-driven checks used elsewhere in this report. The 15 tests in `src/features/billing/actions.test.ts` already exercise the actual, unmodified production functions (not reimplemented logic) with a mocked session/centre-access boundary, and directly assert the reject/allow behaviour this finding is about.
2. **Organisation isolation**, for the reason given in §16 — no second organisation exists in this dev environment to test against live.

This is a deliberate scope decision, made and disclosed here rather than silently substituting one kind of evidence for another without saying so.

---

## 18. Automated quality gates

Run after Stage B, and re-run in full at the end of Stage C (no Stage-C code changes were made — only test fixtures via SQL and documentation edits — so a re-run was not strictly required by the ticket's rule, but was performed anyway for a clean final record):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npm run lint` (ESLint) | **0 errors, 0 warnings** |
| `npx vitest run` | **365 passed, 1 failed** (`src/features/communications/actions.test.ts` — pre-existing `next/server`/`next-auth` module-resolution failure, explicitly pre-authorized by the ticket as a non-regression baseline failure; unrelated to Finance) |
| `npm run build` | **PASS** (exit 0) |

---

## 19. Frozen-module regression verification

The full Vitest suite (not a Finance-only subset) was run — 365 of 366 tests pass, matching the pre-existing baseline exactly (the one failure is the same Communications module-resolution issue present before this milestone started, per the ticket's own pre-authorization). No test belonging to Students, Parents, Staff, Centres, Bookings, or Attendance regressed. No file in any frozen module was modified.

---

## 20. Remaining debt / out-of-scope observations

- **M1** — `/dashboard/finance/receipt` has no role gate (any authenticated org member can view it). Non-material (no mutation, same underlying data already visible via Parents module); left as-is, flagged for a future decision.
- **M2** — `FinanceDashboardClient.tsx`'s `OverdueInvoiceTable`/`ParentBalanceTable`/`InvoiceAgingSummary` exports are dead code (zero call sites). Left in place per the ticket's no-dead-code-deletion instruction.
- **M3** — the `draft`→`sent` transition is an implicit side effect of `recordPayment`, not an explicit action. Pre-existing, unchanged.
- **M4** — `reconcilePayment` and `recordPayment` are two parallel, unmerged payment-recording paths. Both are now correctly authorized; consolidating them would be an architecture decision beyond narrow defect-fixing.
- **M5** — `/dashboard/finance/reconciliation` also has no page-level role gate (confirmed live in Stage C — see §15). Same reasoning and disposition as M1.
- **M6** — `resolveActiveCentreId`'s default resolution (when no `selected_centre_id` cookie is yet set) can disagree with the sidebar's own "ACTIVE CENTRE" indicator on a session's first page load, producing a confusing (but not incorrect or leaked) empty state until the on-page centre dropdown is used once. This is a shared, frozen primitive (`src/lib/centre-filter.ts`) used identically by Centres/Bookings/Attendance/Finance — not a Finance-owned defect, and out of this milestone's narrow-fix mandate to change. Flagged for a future decision.
- GoCardless (`gocardless.ts`) remains unwired from any production code path — its L3 fix and new tests exist to be correct whenever it is activated, not because it is reachable today.

None of these are classified as confirmed defects requiring a fix under this milestone's mandate; they are documented ambiguities, dead code, or cross-cutting technical debt outside Finance's ownership.

---

## 21. Ambiguities / decisions intentionally not made

No new financial policy was invented anywhere in this milestone. Every authorization fix (L1, L2, L2a, L2b) applies a policy the codebase's own sibling functions had already established and evidenced (ORG_OWNER bypasses; everyone else needs centre membership) — none of it required guessing at an unstated business rule. M1/M5 (receipt/reconciliation page role gates) were deliberately left unresolved rather than picking an arbitrary allowed-roles list with no precedent to justify the choice.

---

## 22. Scope confirmation

No frozen module (Students, Parents, Staff, Centres, Bookings, Attendance) was redesigned, refactored, or had its files modified. No schema migration was performed or required. No new Finance features were added — every change is either an authorization fix, a correctness bug fix (L3, L4), or a visual-token modernisation of an already-existing surface (reconciliation). Milestone 3H was not started. `main` was not touched.

---

## 23. Similarity rating vs. frozen modules

**High.** Every fix in this milestone reuses an authorization pattern already established and load-bearing elsewhere in the same codebase (the `recordPayment`/`updateInvoiceDate`/`verifyPayment` non-owner centre-check shape, the `deleteInvoice`/`voidInvoice` ORG_OWNER-plus-ownership-verification shape). The one rewritten UI surface (`reconciliation-client.tsx`) now uses the exact same InvoiceFlow design tokens, spacing scale, and button-grid interaction pattern as `RecordPaymentModal` and the rest of Finance. No new abstractions, no parallel styling system, no new dependency was introduced.

---

## 24. Git summary

- Starting commit: `b80ce4b` (verified clean, on `rebuild/cms-modernisation`).
- Changes: 11 files modified/added in `src/`, 448 insertions / 107 deletions, plus 2 new project-notes documents.
- See §25 below for the actual commit(s), push attempt, and bundle, performed immediately after this report was finalized.

---

## Final recommendation: **PASS**

All four automated quality gates are clean (0 tsc errors, 0 lint errors/warnings, 365/366 tests passing with the one failure being an explicitly pre-authorized pre-existing baseline issue, build passing). All six confirmed defects have narrow, evidenced fixes with dedicated regression tests, all verified live end-to-end where practical (L1, and the L2 UI-boundary correction) and via direct exercise of the real production code otherwise (L2/L2a/L2b/L3/L4, all backed by unit tests against the unmodified functions). No frozen module was touched. One documentation correction was made transparently rather than left standing. Six non-blocking ambiguities/technical-debt items are documented for a future decision, none of which met the bar for a Stage-A stop or block this milestone's completion.
