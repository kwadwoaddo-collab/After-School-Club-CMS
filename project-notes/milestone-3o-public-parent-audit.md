# Milestone 3O — Public & Parent Portal Stage A Audit

**Branch:** rebuild/cms-modernisation  
**Audit SHA:** 23c2007 (starting point)  
**Date:** 2026-08-24

---

## 1. STARTING STATE

- Branch: `rebuild/cms-modernisation` checked
- HEAD: `23c2007` confirmed
- Working tree: clean confirmed

---

## 2. ROUTE MAP

### 2.1 Public Routes

| Route | Purpose | Auth | Org Resolution |
|---|---|---|---|
| `/book/[orgSlug]` | Multi-centre org landing | None | orgSlug → DB slug |
| `/book/[orgSlug]/[centreSlug]` | Single-centre booking | None | orgSlug + centreSlug |
| `/centre-portal/[subdomain]` | Subdomain landing | None | subdomain → centre → org |
| `/centre-portal/[subdomain]/book` | Subdomain booking | None | subdomain → centre → org |
| `/centre-portal/[subdomain]/register` | Subdomain registration redirect | None | Redirects to /register/... |
| `/register/[...slug]` | Public registration wizard | None | orgSlug → `/api/organisations/[slug]/registration-info` |

### 2.2 Parent Portal Routes

| Route | Purpose | Auth |
|---|---|---|
| `/portal` | Parent dashboard | JWT cookie |
| `/portal/login` | Magic link request | None |
| `/portal/verify` | Magic link redemption | Token |
| `/portal/book` | Portal booking/reschedule | JWT cookie |
| `/portal/billing` | Invoices + payment | JWT cookie |
| `/portal/children/[id]` | Child details | JWT cookie |

### 2.3 Public APIs

| Route | Auth | Rate limit |
|---|---|---|
| `POST /api/bookings` | None | apiRateLimit (60/min) |
| `GET /api/availability` | None | None |
| `POST /api/register` | None | apiRateLimit (60/min) |
| `GET /api/register/prefill` | JWT signature | None |
| `GET /api/organisations/[slug]/registration-info` | None | None |
| `POST /api/portal/login` | None | strictRateLimit (5/min) |
| `GET /portal/verify` | Token | None |
| `POST /api/portal/checkout` | JWT cookie | None |

---

## 3. ORGANISATION ISOLATION ASSESSMENT

### Booking flow
- PASS: orgSlug resolved from URL; centre matched from org's centres filtered by `organisationId = org.id`
- PASS: `POST /api/bookings` re-validates centreId server-side
- PASS: `BookingService.createBooking()` resolves org from centre
- PASS: `resolveOrCreateParent` scoped to `currentOrgId` derived from centre
- PASS: `resolveOrCreateChild` validates parent belongs to org

### Registration flow
- PASS: org resolved from `orgSlug` in body (Zod-validated)
- PASS: `centreId` cross-checked against `org.id` (3L D3 fix confirmed)
- PASS: `prefillParentId` verified against resolved org (3L D4 fix confirmed)

### Centre-portal flow
- PASS: subdomain → centre → org resolved server-side before rendering
- PASS: `/centre-portal/[subdomain]/register` hard-redirects — no data created directly

### Prefill API
- FINDING S-1: Token verified, `parentId` extracted. Parent fetched by `parentId` alone with NO verification that parent belongs to the centre's organisation. See Section 19.

---

## 4. PARENT AUTHENTICATION LIFECYCLE

### Login (`POST /api/portal/login`)
- PASS: Rate-limited (5/min per IP)
- PASS: Email enumeration protection (generic success response)
- PASS: Token = `crypto.randomBytes(32).toString('hex')` (256 bits)
- PASS: Token stored hashed (SHA-256)
- PASS: Token expiry: 15 minutes
- PASS: `debugLink` only exposed in development

### Verification (`GET /portal/verify`)
- PASS: Token hashed before DB comparison
- FINDING AUTH-1: Raw token fallback — `eq(parents.magicLinkToken, token)` allows unhashed token match. See Section 19.
- PASS: Token invalidated after use
- PASS: Session cookie: `httpOnly`, `secure` (production), `sameSite: lax`, `maxAge: 30 days`

### Session cookie (`parent_session`)
- PASS: Signed JWT (HS256)
- PASS: JWT expiry: 30 days
- PASS: `httpOnly: true`, `secure: true` in production
- FINDING AUTH-2: UUID fallback in `verifyParentToken()` — raw UUID cookie accepted without JWT verification. See Section 19.

### Soft-deleted parent
- FINDING S-2: `getCurrentParent()` fetches without `isNull(parents.deletedAt)`. See Section 19.

---

## 5. PARENT IDOR ASSESSMENT

### All portal server actions
- PASS: `cancelBookingByParent` — `bookings.parentId = parent.id` checked
- PASS: `submitVoucherPayment` — `invoices.parentId = parent.id` checked
- PASS: `addMedicalNote` — `children.parentId = parent.id` checked
- PASS: `POST /api/portal/checkout` — `invoices.parentId = parent.id` + status filter
- PASS: `createPortalBooking` — child + centre verified against parent
- PASS: `reschedulePortalBooking` — old booking, child, centre all ownership-checked
- PASS: Notifications — all scoped to `parent.id`

IDOR conclusion: All identified IDOR controls are correct except for S-2 (soft-deleted parent bypass) and S-1 (prefill cross-org scope).

---

## 6. PUBLIC BOOKING SECURITY

### Reschedule in public booking
- FINDING S-3: `POST /api/bookings` accepts `rescheduleId` and cancels that booking without ownership verification. Any caller with a booking UUID can cancel it via a public booking request. See Section 19.

### Rate limiting on availability
- OBS-1 (OBSERVATION): `GET /api/availability` has no rate limiting. Data is non-sensitive (opening hours) but the computational cost is unbounded. Classified as observation.

---

## 7. MILESTONE 3L REGRESSION CHECK

All 3L defects confirmed still fixed at 23c2007:

| Defect | Status |
|---|---|
| D1 — orgSlug-derived org resolution | PASS |
| D2 — centreId cross-org validation | PASS |
| D3 — centre isolation in POST | PASS |
| D4 — prefillParentId cross-org replay | PASS |

---

## 8. PREFILL TOKEN SECURITY

### Token verification
- PASS: JWT verified (signature + expiry) using `AUTH_SECRET`
- PASS: Malformed/expired token returns 400

### Cross-org isolation gap (S-1)
Parent fetched by `eq(parents.id, parentId)` only — no verification the parent belongs to the centre's org. Children fetched by `and(eq(children.parentId, parentId), eq(children.centreId, centreId))`.

Scenario: A valid prefill token (parentId=A, centreId=A from Org-A) replayed against the prefill API returns Org-A parent/child PII to any consumer.

Note: The register POST cross-org check (3L D4) discards the prefillParentId if parent is in wrong org, so the data cannot be wrongly filed — but the PII is still returned by the prefill API itself.

---

## 9. BILLING / CHECKOUT

- PASS: Amount derived server-side; no client-supplied amount to Stripe
- PASS: `invoiceId` verified against `parent.id` AND status filter
- PASS: `remaining <= 0` check prevents zero-charge sessions
- PASS: VoucherPaymentForm — `invoiceId` re-verified in server action
- OBS-2: No server-side idempotency guard on `POST /api/portal/checkout`. Mitigated by StripePayButton client-side disable. Classified as observation.

---

## 10. RATE LIMITING REVIEW

| Endpoint | Limiter | Assessment |
|---|---|---|
| `POST /api/portal/login` | strictRateLimit (5/60s) | PASS |
| `POST /api/bookings` | apiRateLimit (60/60s) | PASS |
| `POST /api/register` | apiRateLimit (60/60s) | PASS |
| `GET /api/availability` | None | OBS-1 |
| `GET /api/register/prefill` | None | Acceptable (token-gated) |
| `POST /api/portal/checkout` | None | Acceptable (auth-gated) |

Note: All rate limiters silently permit when Upstash Redis not configured (dev only). OBS-3.

---

## 11. SOFT DELETE / INACTIVE DATA

### Parents
- FINDING S-2: `getCurrentParent()` does not filter `isNull(parents.deletedAt)`.

### Children
- FINDING S-4: `getCurrentParent()` loads `with: { children: true }` without filtering `isNull(children.deletedAt)`. Soft-deleted children visible in portal.

### Centres
- No `deletedAt` column — not applicable.

---

## 12. VISUAL AUDIT

### `/centre-portal/[subdomain]` and `/centre-portal/[subdomain]/book`
- Intentionally dark glassmorphic theme (`bg-[#05070A]`, `bg-white/5`, `border-white/10`). Deliberate premium design. NOT a defect.

### `/book/[orgSlug]` — FINDING V-1
- Uses `glass-card` utility and legacy shadcn tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-secondary`).

### `/book/[orgSlug]/[centreSlug]` — FINDING V-2
- Error/not-found states use legacy tokens: `bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`.

### `/register/[...slug]` — FINDING V-3
- Legacy tokens throughout the 1044-line form (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`). Shared constants `inputCls`, `labelCls`, `sectionTitle` all use legacy tokens.

### Portal pages — FINDING V-4
- `/portal/page.tsx`, `/portal/billing/page.tsx`, `/portal/children/[id]/page.tsx` use mixed tokens: CMS (`bg-surface`, `text-on-surface`) alongside legacy (`text-foreground`, `text-muted-foreground`, `bg-secondary`, `text-primary`, `bg-destructive`).

### `/portal/error.tsx` — FINDING V-5
- Hardcoded dark hex colors: `#111216`, `#17191e`, `#e5e2e1`, `#424754`, `#8c909f`. Not using token system.

---

## 13. ACCESSIBILITY AUDIT

### AddMedicalNoteForm — FINDING A11Y-1
- `<textarea>` uses placeholder only — no `<label>` element associated.

### Portal login — FINDING A11Y-2
- Email `<input>` uses placeholder only — no `<label>` element associated.

---

## 14. EMAIL / NOTIFICATIONS

- PASS: BookingService catches notification errors (fire-and-forget)
- PASS: Registration confirmation awaited (not fire-and-forget)
- PASS: Magic link login checks email send success; returns 500 on failure

---

## 15. DUPLICATE SUBMISSION / IDEMPOTENCY

- PASS: `holdSlot()` prevents race condition double-booking
- PASS: `createPortalBooking` checks for duplicate within transaction
- PASS: Registration duplicate detection (email + child name)
- OBS-2: Stripe checkout session dedup (observation-level)

---

## 19. CONFIRMED DEFECTS

### S-1 — Cross-org data leak in prefill API
- **Category:** Security | **Severity:** HIGH
- **File:** `src/app/api/register/prefill/route.ts`
- **Behaviour:** Parent and children fetched using only `parentId` from JWT — no verification parent belongs to the centre's organisation.
- **Impact:** Org A parent/child PII returned to callers in Org B context.
- **Fix:** After JWT verify, fetch centre by `centreId`, get `centre.organisationId`. Verify `parent.organisationId === centre.organisationId`. Return 403 if mismatch.
- **Tests needed:** Cross-org prefill token → 403

### AUTH-1 — Raw token fallback in magic link verification
- **Category:** Authentication | **Severity:** MEDIUM
- **File:** `src/app/portal/verify/route.ts`
- **Behaviour:** `or(eq(parents.magicLinkToken, hashedToken), eq(parents.magicLinkToken, token))` — raw unhashed token accepted as fallback.
- **Impact:** If DB contains raw token (legacy), attacker with raw token bypasses hash protection.
- **Fix:** Remove raw token fallback. Only compare hashed token.
- **Tests needed:** Raw unhashed token must NOT authenticate.

### AUTH-2 — UUID cookie accepted without JWT signature
- **Category:** Authentication | **Severity:** HIGH
- **File:** `src/lib/parent-auth.ts`
- **Behaviour:** `verifyParentToken()` falls back to accepting any UUID-shaped cookie value as parentId if JWT verification fails.
- **Impact:** Any UUID cookie without signature treated as valid session. Legacy sessions never expire.
- **Fix:** Remove UUID fallback entirely. All sessions must be JWT-signed.
- **Tests needed:** UUID cookie must NOT authenticate.

### S-2 — Soft-deleted parent retains portal access
- **Category:** Security | **Severity:** HIGH
- **File:** `src/lib/parent-auth.ts`
- **Behaviour:** `getCurrentParent()` queries `eq(parents.id, parentId)` without `isNull(parents.deletedAt)`.
- **Impact:** Staff GDPR deletions do not revoke portal access.
- **Fix:** Add `isNull(parents.deletedAt)` to the `getCurrentParent()` query.
- **Tests needed:** Soft-deleted parent → `getCurrentParent()` returns null.

### S-3 — Unauthenticated booking cancellation via rescheduleId
- **Category:** Security | **Severity:** HIGH
- **File:** `src/lib/services/booking.ts`
- **Behaviour:** `POST /api/bookings` cancels `rescheduleId` booking without verifying ownership. Any caller with a booking UUID can cancel it.
- **Impact:** Denial of service — any booking cancelled by UUID via public endpoint.
- **Fix:** Before cancelling old booking, verify `oldBooking.parentId === resolvedParent.id` AND `oldBooking.centreId` is in same org as new `centreId`. If mismatch, ignore rescheduleId (or error).
- **Tests needed:** Public booking with foreign `rescheduleId` must NOT cancel that booking.

### S-4 — Soft-deleted children visible in parent portal
- **Category:** Security/Correctness | **Severity:** MEDIUM
- **File:** `src/lib/parent-auth.ts`
- **Behaviour:** Children loaded via `with: { children: true }` without `isNull(children.deletedAt)` filter.
- **Impact:** Staff-deleted children still visible; parent can attempt re-booking.
- **Fix:** Add `where: isNull(children.deletedAt)` condition to children relation in `getCurrentParent()`.
- **Tests needed:** Soft-deleted child excluded from `getCurrentParent().children`.

### A11Y-1 — AddMedicalNoteForm textarea missing label
- **Category:** Accessibility | **Severity:** MEDIUM
- **File:** `src/features/portal/components/AddMedicalNoteForm.tsx`
- **Fix:** Add `<label htmlFor="medical-note-input">Medical note</label>` and `id="medical-note-input"` on textarea.

### A11Y-2 — Portal login email input missing label
- **Category:** Accessibility | **Severity:** MEDIUM
- **File:** `src/app/portal/login/page.tsx`
- **Fix:** Add `<label htmlFor="portal-login-email">Email address</label>` and `id="portal-login-email"` on input.

### V-1 — `/book/[orgSlug]` legacy tokens
- **Category:** Visual | **Severity:** LOW
- **File:** `src/app/book/[orgSlug]/page.tsx`
- **Fix:** Replace `glass-card` and shadcn tokens with CMS surface tokens.

### V-2 — `/book/[orgSlug]/[centreSlug]` error states legacy tokens
- **Category:** Visual | **Severity:** LOW
- **File:** `src/app/book/[orgSlug]/[centreSlug]/page.tsx`
- **Fix:** Replace with CMS tokens.

### V-3 — Registration form legacy tokens throughout
- **Category:** Visual | **Severity:** LOW
- **File:** `src/app/register/[...slug]/page.tsx`
- **Fix:** Modernise `inputCls`, `labelCls`, `sectionTitle` constants and surrounding page tokens.

### V-4 — Portal pages mixed token sets
- **Category:** Visual | **Severity:** LOW
- **Files:** `src/app/portal/page.tsx`, `src/app/portal/billing/page.tsx`, `src/app/portal/children/[id]/page.tsx`
- **Fix:** Complete migration to CMS tokens.

### V-5 — Portal error.tsx hardcoded hex colours
- **Category:** Visual | **Severity:** LOW
- **File:** `src/app/portal/error.tsx`
- **Fix:** Replace with `bg-surface`, `text-on-surface`, `text-on-surface-variant` tokens.

---

## 20. FINDING SUMMARY

| Category | Count | IDs |
|---|---|---|
| Security | 4 | S-1, S-2, S-3, S-4 |
| Authentication | 2 | AUTH-1, AUTH-2 |
| IDOR | 0 | All controls correct |
| Accessibility | 2 | A11Y-1, A11Y-2 |
| Visual | 5 | V-1, V-2, V-3, V-4, V-5 |
| **TOTAL** | **13** | |

Arithmetic: S(4) + AUTH(2) + A11Y(2) + V(5) = 13

---

## 21. OBSERVATIONS (NOT DEFECTS)

| ID | Description |
|---|---|
| OBS-1 | `GET /api/availability` — no rate limit; non-sensitive data but unbounded DB cost |
| OBS-2 | `POST /api/portal/checkout` — no server-side dedup; mitigated by client-side disable |
| OBS-3 | Rate limiting disabled without Upstash Redis (dev-safe) |

---

## 22. BLOCKING AMBIGUITIES

**None.** All 13 defects have clear, narrow remediation paths requiring no product policy decisions.

---

## 23. STAGE A CONCLUSION

**Milestone 3O — Stage A Complete**

- Audit SHA: 23c2007
- Confirmed defects: 13
- Observations: 3
- Blocking ambiguities: 0

**Stage B priority order:**
1. AUTH-2 — UUID cookie bypass (critical session security)
2. S-3 — unauthenticated booking cancellation via rescheduleId
3. S-2 — soft-deleted parent portal access
4. AUTH-1 — raw token fallback
5. S-1 — cross-org data in prefill API
6. S-4 — soft-deleted children in portal
7. A11Y-1, A11Y-2 — form label accessibility
8. V-1 through V-5 — visual modernisation
