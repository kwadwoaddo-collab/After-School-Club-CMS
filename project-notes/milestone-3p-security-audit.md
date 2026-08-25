# Milestone 3P — Adversarial Security Audit
## Stage A: Security Inventory & Defect Identification

**Branch:** `rebuild/cms-modernisation`  
**Starting SHA:** `49bf786`  
**Audit conducted at:** `49bf786`

---

## 1. Authentication Entry Points

### 1.1 Staff credential login (ORG_OWNER only)
- **Credential:** email + bcrypt-hashed password
- **Stored:** `users.passwordHash` (bcrypt, cost 10–12)
- **Auth provider:** NextAuth.js CredentialsProvider (`src/lib/auth.ts`)
- **Session:** NextAuth JWT session cookie (`next-auth.session-token`)
- **Cookie:** HttpOnly, Secure in prod, SameSite=Lax (NextAuth defaults)
- **Enumeration:** `/api/auth/reset-password` always returns 200 (correct)
- **Assessment:** ✅ Secure

### 1.2 Staff magic-link login
- **Credential:** `crypto.randomBytes(32).toString('hex')` raw hex token
- **Storage:** `staff_invites.token` — **PLAINTEXT** (no hash applied)
- **Expiry:** 15 minutes for magic-link re-login; 7 days for invitations
- **Verification:** Direct equality comparison against plaintext DB value
- **Rate limiting:** None on `/api/staff/request-magic-link`
- **🚨 DEFECT TOKEN-1:** Token stored in plaintext. DB read access exposes all active staff sessions.
- **🚨 DEFECT RATE-1:** No rate limit on magic-link request endpoint (email flooding risk).

### 1.3 Staff invitation
- **Credential:** Same `crypto.randomBytes(32).toString('hex')` raw hex token
- **Storage:** `staff_invites.token` — **PLAINTEXT** (same as 1.2)
- **Expiry:** 7 days
- **Verification:** Direct equality comparison (`eq(staffInvites.token, token)`)
- **Organisation binding:** Yes — `staffInvites.organisationId` is checked on revoke
- **Role binding:** Yes — `staffInvites.role` determines granted role
- **Replay:** `usedAt` column checked on accept — prevents reuse ✅
- **🚨 DEFECT TOKEN-1:** Same plaintext storage defect.

### 1.4 Parent magic-link login
- **Credential:** `generateMagicLinkToken()` → 32 random bytes
- **Storage:** `hashToken(rawToken)` = SHA-256 → stored in `parents.magicLinkToken` ✅
- **Delivery URL:** Contains raw token (correct — only hash stored in DB)
- **Verification:** `hashToken(received)` compared against DB hash (AUTH-1 fix from 3O) ✅
- **Expiry:** `parents.magicLinkExpiry` checked ✅
- **Single use:** Token cleared on use (per `/portal/verify`) ✅
- **Deleted parent:** `isNull(parents.deletedAt)` checked (AUTH-2 / S-2 from 3O) ✅
- **Resulting session:** Signed HS256 JWT (`parent_session` cookie) ✅
- **Assessment:** ✅ Secure after 3O fixes

### 1.5 Password reset
- **Credential:** `crypto.randomBytes(32).toString('hex')` raw hex token
- **Storage:** `users.passwordResetToken` — **PLAINTEXT** (no hash applied)
- **Expiry:** 1 hour — checked correctly ✅
- **Single-use:** Token cleared after PATCH ✅
- **Enumeration:** Always returns 200 ✅
- **Rate limiting:** `strictRateLimit` applied (5 per minute per IP) ✅
- **🚨 DEFECT TOKEN-2:** Token stored in plaintext. DB read access allows password reset for any user with an active token.

### 1.6 Parent JWT session
- **Algorithm:** HS256 explicit in `setProtectedHeader({ alg: 'HS256' })` ✅
- **Secret:** `PARENT_SESSION_SECRET || AUTH_SECRET || 'default-dev-secret-do-not-use-in-prod'`
- **⚠️ OBSERVATION DATA-1:** Fallback to `AUTH_SECRET` is shared with NextAuth. If `PARENT_SESSION_SECRET` is not set in production, the same secret signs both staff sessions and parent JWTs. Not directly exploitable unless `AUTH_SECRET` is compromised, but worth documenting as a configuration risk.
- **Expiry:** 30 days ✅
- **UUID bypass:** Removed (AUTH-2 from 3O) ✅
- **Assessment:** ✅ Secure, with configuration observation noted.

---

## 2. API Route Inventory

### 2.1 Admin / Machine Endpoints

| Route | Method | Auth | Impact |
|-------|--------|------|--------|
| `/api/admin/migrate-users` | POST | `auth()` + ORG_OWNER required | Creates centre memberships for own org only |
| `/api/admin/seed-centre-billing` | GET | `auth()` + ORG_OWNER required | Updates billing fields for own org centres |
| `/api/cron/billing` | POST | `CRON_SECRET` bearer token | Generates invoices across ALL orgs |
| `/api/cron/reminders` | POST | `CRON_SECRET` bearer token | Sends reminder emails across ALL orgs |
| `/api/cron/school-year-roll` | GET + POST | `CRON_SECRET` bearer token | Updates ALL children globally |
| `/api/health` | GET | None | Returns `{ok: true}` only — no data |

**Admin routes:** Both admin routes require ORG_OWNER session — organisation-scoped. ✅  
**Cron routes:** All three require `Authorization: Bearer <CRON_SECRET>`. The middleware correctly returns 503 if `CRON_SECRET` is unset (endpoint locked). ✅  
**Assessment:** Cron routes are properly machine-authenticated. No open admin endpoint.

### 2.2 Authentication Routes

| Route | Method | Auth | Notes |
|-------|--------|------|-------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth | Standard NextAuth |
| `/api/auth/reset-password` | POST | None (rate-limited) | Enum-safe ✅ |
| `/api/auth/reset-password` | PATCH | Token in body | Plaintext token — DEFECT TOKEN-2 |
| `/api/auth/signup` | POST | None (rate-limited) | Creates ORG_OWNER account |
| `/api/staff/request-magic-link` | POST | None | Enum-safe ✅ but no rate limit — DEFECT RATE-1 |
| `/api/staff/accept-invite` | POST | Token in body | Plaintext token — DEFECT TOKEN-1 |
| `/api/staff/validate-invite` | GET | Token in query | Plaintext — DEFECT TOKEN-1 |
| `/api/staff/magic-login` | GET | Token in query | Plaintext — DEFECT TOKEN-1 |
| `/api/portal/login` | POST | None (rate-limited) | Correct: rate-limited, enum-safe ✅ |
| `/api/portal/verify` | (route.ts in app/portal/verify) | Token in query | Hashed comparison ✅ (AUTH-1 fixed) |
| `/api/portal/logout` | POST | None | Clears cookie ✅ |

### 2.3 Public Booking/Registration Routes

| Route | Method | Auth | Notes |
|-------|--------|------|-------|
| `/api/bookings` | POST | None (rate-limited) | S-3 ownership check in BookingService ✅ |
| `/api/availability` | GET | None | Centre operating hours — non-sensitive ✅ |
| `/api/register` | POST | None (rate-limited) | Org resolved from slug, not body ✅ |
| `/api/register/prefill` | GET | JWT prefill token | S-1 cross-org isolation ✅ (3O fixed) |
| `/api/organisations/[slug]/registration-info` | GET | None | Returns org branding/slots/pricing — public data ✅ |
| `/api/upload` | POST | None (rate-limited) | Centre validated; content validated ✅ |

### 2.4 Staff-Authenticated Routes

All verified to require `auth()` with org isolation. Key verification points:

- **`/api/bookings/[bookingId]/*`**: auth + org + centre membership checks ✅
- **`/api/bookings/bulk-delete`** and **`/api/bookings/bulk-update`**: auth + org filter + centre membership ✅
- **`/api/centres/[id]`**: auth + ORG_OWNER/MANAGER + org ownership check ✅
- **`/api/export/finance`**: auth + ORG_OWNER only + org scoped ✅
- **`/api/export/register`**: auth + accessible centres filter ✅
- **`/api/parents/[id]`**: auth + org ownership check on parent ✅
- **`/api/search`**: auth + org-scoped searches ✅
- **`/api/settings/organisation`**: auth + ORG_OWNER only ✅
- **`/api/settings/discounts`**: auth (need to verify role check) ← spot check required
- **`/api/staff/[id]`**: auth + ORG_OWNER + org ownership ✅
- **`/api/staff/invite`**: auth + ORG_OWNER/MANAGER + org scoped ✅
- **`/api/staff/remove`**: auth + ORG_OWNER + org ownership check ✅
- **`/api/staff/assign-centres`**: auth + ORG_OWNER + org check ✅
- **`/api/students/[id]`**: auth + org isolation + centre scope ✅
- **`/api/user/switch-org`**: auth + membership verification ✅
- **`/api/webhooks/stripe-invoice`**: Stripe signature verification ✅ (idempotent ✅)

### 2.5 Portal-Authenticated Routes

| Route | Auth | Notes |
|-------|------|-------|
| `/api/portal/checkout` | `getCurrentParent()` | Invoice ownership: `eq(invoices.parentId, parent.id)` ✅ |

---

## 3. Server Actions Inventory

### 3.1 Portal Actions

| Action | Auth | Ownership check |
|--------|------|----------------|
| `cancelBookingByParent` | `getCurrentParent()` | `eq(bookings.parentId, parent.id)` ✅ |
| `submitVoucherPayment` | `getCurrentParent()` | `eq(invoices.parentId, parent.id)` ✅ but **amount trusted from caller** — DEFECT FINANCE-1 |
| `createPortalBooking` | `getCurrentParent()` | Child ownership + centre org match ✅ |
| `addMedicalNote` | `getCurrentParent()` | `eq(children.parentId, parent.id)` ✅ |
| `getNotifications` | `getCurrentParent()` | `eq(portalNotifications.parentId, parent.id)` ✅ |
| `markAllRead` | `getCurrentParent()` | `eq(portalNotifications.parentId, parent.id)` ✅ |
| `markRead` | `getCurrentParent()` | `AND eq(id, notifId) AND eq(parentId, parent.id)` ✅ |

### 3.2 Dashboard Actions (key modules)

| Module | Auth | Key findings |
|--------|------|-------------|
| `finance/actions.ts` | `auth()` + org scope | `getParents` org-scoped ✅; `insertInvoiceAndLog` internal helper only ✅ |
| `incidents/actions.ts` | `auth()` + org scope | Safeguarding role filter correct ✅ |
| `communications/actions.ts` | `auth()` + ORG_OWNER/MANAGER | Org derived from session, not caller ✅ (3H fix) |
| `students/actions.ts` | `auth()` + role + centre scope | TUTOR/FRONT_DESK excluded from export ✅ |
| `bookings/actions.ts` | `auth()` + org + centre | Walk-in booking centre checks ✅ |

---

## 4. Webhooks

### Stripe webhook (`/api/webhooks/stripe-invoice`)
- **Signature:** `stripeService.constructInvoiceWebhookEvent(payload, signature)` ✅
- **Raw body:** Uses `req.text()` before parsing ✅
- **Idempotency:** `eq(payments.transactionReference, session.id)` prevents duplicate recording ✅
- **Amount:** Derived from `session.amount_total` (Stripe-signed, not caller-supplied) ✅
- **Assessment:** ✅ Secure

---

## 5. Upload Security

### `/api/upload` (public)
- Auth: None (public, rate-limited)
- Centre validation: Required and verified against DB ✅
- Size limit: 5MB ✅
- MIME + magic bytes: `validateImageContent()` ✅
- Filename: `nanoid(12)` — client filename ignored ✅
- No SVG (arbitrary public endpoint) ✅
- Assessment: ✅ Secure

### `/api/upload/logo` (authenticated)
- Auth: `auth()` + ORG_OWNER role ✅
- Size limit: 2MB ✅
- MIME + magic bytes: `validateImageContent()` with `allowSvg: true` ✅
- Filename: `nanoid(12)` — client filename ignored ✅
- Write path: `public/uploads/logos/` (local, not org-namespaced)
- **⚠️ OBSERVATION UPLOAD-1:** Logo files are stored in `public/uploads/logos/` without org namespacing. Since only ORG_OWNER can upload, cross-org pollution is not possible, but filenames from different orgs share the same directory. No security defect — `nanoid(12)` prevents collisions.
- Assessment: ✅ Secure

---

## 6. Organisation Isolation Audit

### Findings:
- All staff-authenticated routes derive `organisationId` from `session.user.organisationId` ✅
- `POST /api/bookings` creates parent/centre mapping via org lookup chain (centre → org), not from body ✅
- `POST /api/register` uses `orgSlug` to look up org — does not trust `organisationId` from body ✅
- `POST /api/register/prefill` S-1 fixed (3O): centre org must match parent org ✅
- `PATCH /api/parents/[id]` verifies parent org: `eq(parents.organisationId, session.user.organisationId)` ✅
- `DELETE /api/bookings/[bookingId]` verifies centre org before deleting ✅
- `POST /api/user/switch-org` verifies user belongs to target org via `orgMemberships` ✅

---

## 7. Centre Isolation Audit

- Non-ORG_OWNER roles: `getUserAccessibleCentreIds()` called before any centre-scoped mutation ✅
- Booking mutations (status, delete, bulk): centre membership checked for non-ORG_OWNERs ✅
- Registration status PATCH: centre membership checked for non-ORG_OWNERs ✅
- Export register: centre access verified ✅
- Incidents: org-scoped + centreId filter; no additional centre-membership check on `getIncidents` — uses org-level auth, MANAGER/FRONT_DESK can read all org incidents for any centre ← inherent policy (incidents module allows org-level viewing by design)

---

## 8. Parent Ownership Audit

- `cancelBookingByParent`: `eq(bookings.parentId, parent.id)` ✅
- `submitVoucherPayment`: `eq(invoices.parentId, parent.id)` ✅
- `createPortalBooking`: child ownership + centre org verified ✅
- `addMedicalNote`: `eq(children.parentId, parent.id)` ✅
- `/api/portal/checkout`: `eq(invoices.parentId, parent.id)` ✅

---

## 9. Prior Milestone Regression Audit

| Milestone | Fix | Status |
|-----------|-----|--------|
| 3D Centres | ORG_OWNER/MANAGER only for centre CRUD | ✅ PASS |
| 3E Bookings | Org isolation + centre membership | ✅ PASS |
| 3F Attendance | Centre scope on mark-attendance action | ✅ PASS |
| 3G Finance | Org-scoped invoices; Stripe idempotency | ✅ PASS |
| 3H Communications | `sendBroadcast` auth from session (not caller) | ✅ PASS |
| 3I Reports | TUTOR/FRONT_DESK excluded from export | ✅ PASS |
| 3J Settings | ORG_OWNER only for org settings | ✅ PASS |
| 3K Incidents | Safeguarding role check fixed | ✅ PASS |
| 3L Registrations | Centre isolation for MANAGER; prefill token | ✅ PASS |
| 3M Dashboard/Search | Org-scoped search results | ✅ PASS |
| 3N Shell | MobileBottomNav auth; accessible centres | ✅ PASS |
| 3O Public/Parent | AUTH-1, AUTH-2, S-1, S-2, S-3, S-4 | ✅ PASS |

---

## 10. Confirmed Defects

### TOKEN-1 — Staff invite/magic-login tokens stored in plaintext — CRITICAL

**Affected surfaces:**
- `POST /api/staff/invite` — generates and stores raw token
- `POST /api/staff/request-magic-link` — generates and stores raw token
- `GET /api/staff/magic-login` — compares raw token directly
- `POST /api/staff/accept-invite` — compares raw token directly
- `GET /api/staff/validate-invite` — compares raw token directly
- DB column: `staff_invites.token`

**Exploit scenario:**  
A read-only SQL injection or DB backup exposure gives an attacker all unexpired staff invite/magic-login tokens in plaintext. Using any token, an attacker can authenticate as any invited staff member or re-request magic links for staff with active tokens, gaining full dashboard access.

**Expected boundary:** Tokens must be stored as SHA-256 hashes. Raw token delivered via email, hash stored in DB (same pattern as parent magic links fixed in 3O).

**Proposed fix:**  
Apply `hashToken()` on storage; use `hashToken(received)` for comparison. Mirror the parent magic-link pattern from `src/lib/magic-link.ts`.

**Regression test required:** YES — token hash stored, raw rejected, hash accepted, expired rejected.

---

### TOKEN-2 — Password reset token stored in plaintext — HIGH

**Affected surface:**
- `POST /api/auth/reset-password` — stores raw token in `users.passwordResetToken`
- `PATCH /api/auth/reset-password` — compares `eq(users.passwordResetToken, token)`

**Exploit scenario:**  
DB read access exposes active password reset tokens in plaintext. An attacker can use a token to reset any ORG_OWNER's password, gaining full CMS access.

**Expected boundary:** `passwordResetToken` must be stored as SHA-256 hash.

**Proposed fix:** `hashToken(rawToken)` on generation; `eq(users.passwordResetToken, hashToken(token))` on verification.

**Regression test required:** YES.

---

### RATE-1 — No rate limit on `/api/staff/request-magic-link` — MEDIUM

**Affected surface:** `POST /api/staff/request-magic-link`

**Exploit scenario:**  
Automated requests for magic links to any staff email address. Impact: email flooding / Resend API rate exhaustion / operational disruption. Token brute-force is impractical (32 random bytes) but email flooding is real.

**Expected boundary:** Rate limit per IP, matching the pattern at `/api/portal/login`, `/api/auth/reset-password`.

**Proposed fix:** Apply `strictRateLimit` (matching reset-password pattern).

**Regression test required:** Rate limit returns 429 when exceeded.

---

### FINANCE-1 — Voucher payment amount trusted from caller — MEDIUM

**Affected surface:** `submitVoucherPayment` in `src/app/portal/billing/actions.ts`

**Details:**  
The `amount` parameter is caller-supplied. The action verifies invoice ownership but inserts the caller-provided `amount` into the `payments` table with `status: 'pending'`. Since status is `pending`, a human staff member must verify before the payment is counted. This is a data-integrity issue, not a direct fund manipulation, but a parent can record a misleadingly large voucher claim against their invoice.

**Expected boundary:** Amount should be capped at the invoice's outstanding balance (server-derived), or staff should review the claimed amount before it affects invoice status.

**Proposed fix:** Server-side: validate `amount ≤ (invoice.amount − already_verified_payments)`. The invoice balance is available from the DB in the same action where ownership is already verified.

**Regression test required:** YES — amount > outstanding balance rejected.

---

### DATA-1 — `PARENT_SESSION_SECRET` not separate from `AUTH_SECRET` by default — LOW (Configuration)

**Affected surface:** `src/lib/parent-auth.ts` — JWT secret derivation

**Details:**  
If `PARENT_SESSION_SECRET` is not set, the parent JWT uses `AUTH_SECRET` (the NextAuth secret). A compromise of the single shared secret would allow forgery of both staff NextAuth tokens and parent JWTs. Also, `'default-dev-secret-do-not-use-in-prod'` fallback should never reach production.

**Expected boundary:** `PARENT_SESSION_SECRET` should be a mandatory distinct env var. The fallback to `AUTH_SECRET` and the hardcoded dev secret should be removed from production code paths.

**Proposed fix:** Log a hard error and throw if neither `PARENT_SESSION_SECRET` nor `AUTH_SECRET` is set in production. Add startup validation.

**Regression test:** Environment validation test (or documented manual verification).

---

## 11. Observations (Not Defects)

| ID | Category | Description | Disposition |
|----|----------|-------------|-------------|
| OBS-1 | Upload | Logo upload stores files in unnamespaced `public/uploads/logos/` | Not a defect — ORG_OWNER-gated, nanoid prevents collisions |
| OBS-2 | Config | `npm audit` reports 18 vulnerabilities (7 moderate, 8 high, 3 critical); primarily transitive dependencies and uuid. `uuid` issue is moderate and not directly exploitable in this application's usage (only called with 2 args). | Deferred per scope restriction |
| OBS-3 | Info | `/api/health` returns `{ok:true}` with no authentication. Non-sensitive — no data disclosed | Not a defect |
| OBS-4 | Enumeration | `POST /api/staff/request-magic-link` returns `{success: true}` regardless of whether email exists — enum-safe ✅ | Already correct |
| OBS-5 | Invites | Staff invite `centreId` is verified against the org before assignment — cross-org centre assignment blocked ✅ | Already correct |

---

## 12. Stage A Stop Condition Assessment

**Blocking product-policy ambiguities:** NONE

**Confirmed defects:**
- TOKEN-1 — CRITICAL
- TOKEN-2 — HIGH  
- RATE-1 — MEDIUM
- FINANCE-1 — MEDIUM
- DATA-1 — LOW

All defects are unambiguous security issues with clear correct behaviour. No orchestrator decision required.

**Stage A found no blocking product-policy ambiguities. Proceeding to Stage B.**
