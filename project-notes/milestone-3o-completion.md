# Milestone 3O — Completion Report
## Public & Parent Portal Modernisation

**Branch:** `rebuild/cms-modernisation`  
**Stage A audit commit:** `d248b86`  
**Stage B implementation commit:** `dd2ed8e`  
**Freeze candidate:** `dd2ed8e`

---

## Quality Gates

| Gate | Result |
|------|--------|
| TypeScript `tsc --noEmit` | ✅ PASS (0 errors) |
| ESLint | ✅ PASS (0 errors, 0 warnings) |
| Vitest | ✅ PASS — **505/505** |
| Production build | ✅ PASS |

---

## Test Arithmetic

| Source | Count |
|--------|-------|
| 3N frozen baseline | 484 |
| `src/lib/parent-auth.test.ts` — net new (2 replaced + 3 added) | +2 net |
| `src/lib/security-3o.test.ts` — new file | +19 |
| **Total new 3O tests** | **+21** |
| **3O total** | **505** |

---

## Finding Reconciliation — All 13 Defects

| ID | Category | Sev | Description | File(s) Fixed | Status |
|----|----------|-----|-------------|---------------|--------|
| AUTH-2 | Auth | HIGH | UUID cookie fallback accepted without JWT signature | `parent-auth.ts` | ✅ Fixed |
| S-3 | Security | HIGH | Public booking endpoint cancelled arbitrary booking via `rescheduleId` | `booking.ts` | ✅ Fixed |
| S-2 | Security | HIGH | Soft-deleted parents not excluded from `getCurrentParent()` | `parent-auth.ts` | ✅ Fixed |
| AUTH-1 | Auth | MED | Raw unhashed magic-link token accepted in `/portal/verify` | `verify/route.ts` | ✅ Fixed |
| S-1 | Security | MED | Prefill API returned PII without org isolation | `prefill/route.ts` | ✅ Fixed |
| S-4 | Security | MED | Soft-deleted children not excluded from portal | `parent-auth.ts` | ✅ Fixed |
| A11Y-1 | A11Y | MED | Medical note textarea had no associated label | `AddMedicalNoteForm.tsx` | ✅ Fixed |
| A11Y-2 | A11Y | MED | Portal login email input had no associated label | `portal/login/page.tsx` | ✅ Fixed |
| V-1 | Visual | LOW | `/book/[orgSlug]` — glass-card + legacy tokens | `book/[orgSlug]/page.tsx` | ✅ Fixed |
| V-2 | Visual | LOW | `/book/.../[centreSlug]` — legacy tokens in error states | `book/[orgSlug]/[centreSlug]/page.tsx` | ✅ Fixed |
| V-3 | Visual | LOW | `/register/[...slug]` — shared constants + screens | `register/[...slug]/page.tsx` | ✅ Fixed |
| V-4 | Visual | LOW | `/portal/**` pages — legacy shadcn tokens | `portal/page.tsx`, `billing/page.tsx`, `children/[id]/page.tsx`, `login/page.tsx` | ✅ Fixed |
| V-5 | Visual | LOW | `/portal/error.tsx` — hardcoded hex colours | `portal/error.tsx` | ✅ Fixed |

**All 13 confirmed defects resolved. 0 new defects discovered during adversarial pass.**

---

## Adversarial API Pass Results

All `/api/portal/**`, `/api/register/**`, `/api/bookings/**` routes reachable from public/parent surfaces reviewed:

- `POST /api/bookings` — S-3 fixed; rate-limited; org-isolated; no client-trusted amount
- `POST /api/portal/checkout` — `getCurrentParent()` gated; amount derived server-side from DB; invoice ownership verified
- `GET /api/register/prefill` — S-1 fixed; JWT verified; org-isolated; soft-deleted filtered
- `POST /api/register` — `prefillToken` JWT guard + cross-org check (3L D4) intact
- `DELETE/PATCH /api/bookings/[bookingId]/*` — `auth()` required; org isolation; centre membership
- `POST /api/portal/login` — rate-limited; email existence not revealed
- `POST /api/portal/logout` — cookie cleared server-side

**No additional defects discovered.**

---

## Payments Trace

`POST /api/portal/checkout` computes:
```
remaining = invoice.amount − SUM(verified_payments.amount)
```
- `invoiceId` validated against `eq(invoices.parentId, parent.id)` — only authenticated parent's own invoice
- `amountPence = Math.round(remaining * 100)` — server-derived, not client-supplied
- Organisation context from `invoice.organisationId` — not from request body

No Finance scope broadening required.

---

## Regression Test Coverage (security-3o.test.ts — 19 tests)

| Test name | Defect covered |
|-----------|---------------|
| returns null for a raw UUID cookie | AUTH-2 |
| returns null for a forged arbitrary UUID cookie | AUTH-2 |
| returns null for a malformed non-JWT string | AUTH-2 |
| returns null for an empty string cookie | AUTH-2 |
| returns parentId for legitimately signed JWT (mocked jose) | AUTH-2 positive |
| returns null for a tampered JWT signature | AUTH-2 |
| returns null when DB excludes parent due to soft deletion | S-2 |
| returns parent when active | S-2 positive |
| does not include soft-deleted children | S-4 |
| returns empty children when all soft-deleted | S-4 |
| does NOT cancel another parent's booking (same org) | S-3 |
| does NOT cancel cross-org booking | S-3 |
| does NOT cancel when rescheduleId not found | S-3 |
| DOES cancel legitimate owner reschedule | S-3 positive |
| returns 404 for cross-org prefill token | S-1 |
| returns 404 when centre does not exist | S-1 |
| returns 400 for invalid/expired token | S-1 |
| returns 400 with no token param | S-1 |
| returns parent PII for same-org request | S-1 positive |

AUTH-1 regression: The magic-link generation path (`/api/portal/login`) always stores `hashToken(rawToken)`. The `/portal/verify` route now exclusively uses `hashToken(rawToken)` for comparison — raw-token acceptance is removed. This is verified by the existing `magic-link.test.ts` (hash round-trips) + manual review of the simplified verify route.

---

## Stage C Verification Checklist (Manual)

**Public booking:**
- [ ] `/book/{orgSlug}` — multi-centre selector renders correctly (V-1 tokens)
- [ ] `/book/{orgSlug}/{centreSlug}` — booking form with brand color (V-2 tokens)
- [ ] Submit booking → confirmation email received → magic link → portal session established
- [ ] Forged/arbitrary `rescheduleId` → existing booking unchanged, new booking created (S-3)
- [ ] Own `rescheduleId` → original booking cancelled, new booking created (S-3 positive)

**Public registration:**
- [ ] `/register/{orgSlug}` — form loads, token constants render (V-3 tokens)
- [ ] Same-org prefill token → parent/child data populated
- [ ] Cross-org prefill token → empty form, no PII visible (S-1)

**Parent portal auth:**
- [ ] Magic link request → email delivered → `/portal/verify?token=...` → portal session
- [ ] Soft-deleted parent → magic link does not create session (AUTH-1 + S-2)
- [ ] Raw UUID as `parent_session` cookie → portal redirects to login (AUTH-2)
- [ ] Valid JWT for soft-deleted parent → redirected to login (S-2)

**Portal UX:**
- [ ] Portal home — `text-on-surface`, `text-on-surface-variant` visible (V-4)
- [ ] Medical note form — label announced by screen reader (A11Y-1)
- [ ] Login page — label programmatically associated with email input (A11Y-2)
- [ ] Soft-deleted child not in portal child list or booking selector (S-4)
- [ ] Portal error page — no hardcoded dark hex colours in light or dark mode (V-5)

**Billing/checkout:**
- [ ] `/portal/billing` — invoice list renders
- [ ] Checkout POST → Stripe session created → payment completes → invoice marked paid
- [ ] Another parent's invoiceId → 404

**Responsive/dark mode:**
- [ ] All public pages respond correctly at mobile breakpoints
- [ ] Dark mode: all surfaces use CMS tokens (no hardcoded colours visible)

---

## Freeze Recommendation

All 13 Stage A defects resolved. Quality gates pass. Adversarial pass clean. No additional defects.

**Recommended freeze candidate:** `dd2ed8e`
