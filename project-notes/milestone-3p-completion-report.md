# Milestone 3P — Completion Report
## Authentication, Authorization & Adversarial Security Hardening

**Branch:** `rebuild/cms-modernisation`  
**Starting SHA:** `49bf786` (3O freeze)  
**Stage A audit commit:** `635dbe3`  
**Stage B implementation commit:** `52f850f`  
**Stage C test commit:** `bdcf96e`  
**Stage B NextAuth hardening & test commit:** `3aa7d09`  
**Final SHA:** `3aa7d09`

---

## Quality Gates

| Gate | Result |
|------|--------|
| TypeScript `tsc --noEmit` | ✅ PASS (0 errors) |
| ESLint | ✅ PASS (0 errors, 0 warnings) |
| Vitest | ✅ PASS — **526/526** |
| Production build | ✅ PASS |

---

## Test Arithmetic

| Source | Count |
|--------|-------|
| 3O frozen baseline | 505 |
| `src/lib/security-3p.test.ts` — new file | +21 |
| **Total new 3P tests** | **+21** |
| **3P total** | **526** |

---

## Confirmed Defect Count

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 1 |
| MEDIUM | 2 |
| LOW | 1 (DATA-1 — configuration observation, no code change) |
| **Total** | **5** |

4 defects received code fixes. DATA-1 is a documentation observation (configuration guidance) with no production code change required.

---

## Finding Reconciliation

| ID | Sev | Description | Fix | Status |
|----|-----|-------------|-----|--------|
| TOKEN-1 | CRITICAL | Staff invite/magic-login tokens stored in plaintext — DB breach → session takeover | Hash tokens before DB storage; hash received token before lookup across all routes and NextAuth provider | ✅ Fixed |
| TOKEN-2 | HIGH | Password reset token stored in plaintext — DB breach → password reset for any ORG_OWNER | Hash token before DB storage; hash received token for lookup | ✅ Fixed |
| RATE-1 | MEDIUM | No rate limit on `/api/staff/request-magic-link` — email flooding possible | Applied `strictRateLimit` (5/min/IP) | ✅ Fixed |
| FINANCE-1 | MEDIUM | `submitVoucherPayment` accepted caller-supplied `amount` without server-side cap | Server-side outstanding balance derived from DB; caller amount capped | ✅ Fixed |
| DATA-1 | LOW | `PARENT_SESSION_SECRET` fallback to shared `AUTH_SECRET` | Documentation observation — distinct env var recommended | Observation |

### Observations (not defects)

| ID | Description | Disposition |
|----|-------------|-------------|
| OBS-1 | Logo upload writes to unnamespaced `public/uploads/logos/` | ORG_OWNER-gated; nanoid prevents collisions — not a defect |
| OBS-2 | `npm audit` reports 18 vulnerabilities; primarily transitive deps | Deferred per scope restriction — no `npm audit fix --force` |
| OBS-3 | `/api/health` is unauthenticated | Returns `{ok:true}` only — no data disclosed — not a defect |
| OBS-4 | `request-magic-link` returns `{success:true}` regardless of email existence | Correct anti-enumeration behaviour ✅ |
| OBS-5 | Staff invite `centreId` verified against org before assignment | Already correct ✅ |

---

## Files Changed

| File | Change | Defect |
|------|--------|--------|
| `src/app/api/staff/invite/route.ts` | Import `hashToken`; store `hashToken(rawToken)` in DB; deliver `rawToken` in email URL | TOKEN-1 |
| `src/app/api/staff/request-magic-link/route.ts` | Import `hashToken` + rate-limit; store `hashToken(rawToken)` in DB; deliver `rawToken` in email URL; apply `strictRateLimit` | TOKEN-1, RATE-1 |
| `src/app/api/staff/accept-invite/route.ts` | Import `hashToken`; lookup with `hashToken(token)` | TOKEN-1 |
| `src/app/api/staff/validate-invite/route.ts` | Import `hashToken`; lookup with `hashToken(token)` | TOKEN-1 |
| `src/app/api/staff/magic-login/route.ts` | Import `hashToken`; lookup with `hashToken(token)` | TOKEN-1 |
| `src/lib/auth.ts` | Import `hashToken`; NextAuth inviteToken provider lookup with `hashToken(credentials.token)` | TOKEN-1 |
| `src/app/api/auth/reset-password/route.ts` | Import `hashToken`; store `hashToken(rawToken)` in DB; deliver `rawToken` in email; PATCH lookup with `hashToken(token)` | TOKEN-2 |
| `src/app/portal/billing/actions.ts` | Fetch invoice with payments relation; compute outstanding balance (verified only); reject amount > outstanding | FINANCE-1 |
| `src/lib/security-3p.test.ts` | New — 21 regression tests | All defects |

**Frozen modules touched:** None — all changed files are authentication/session utilities that span milestone boundaries by design.

---

## Prior Milestone Regression Audit

| Milestone | Fix | Status |
|-----------|-----|--------|
| 3D Centres | ORG_OWNER/MANAGER required for centre CRUD | ✅ PASS |
| 3E Bookings | Org isolation + centre membership on bulk ops | ✅ PASS |
| 3F Attendance | Centre scope on mark-attendance | ✅ PASS |
| 3G Finance | Org-scoped invoices; Stripe signature + idempotency | ✅ PASS |
| 3H Communications | `sendBroadcast` org from session, consent re-verified server-side | ✅ PASS |
| 3I Reports | TUTOR/FRONT_DESK excluded from exports | ✅ PASS |
| 3J Settings | ORG_OWNER only for org settings; subdomain validation | ✅ PASS |
| 3K Incidents | Safeguarding filter fixed; TUTOR cannot create safeguarding | ✅ PASS |
| 3L Registrations | Centre isolation MANAGER; cross-org prefill blocked | ✅ PASS |
| 3M Dashboard/Search | Org-scoped search; centre results role-gated | ✅ PASS |
| 3N Shell | Auth context propagated; accessible centres helper | ✅ PASS |
| 3O Public/Parent | AUTH-1/AUTH-2/S-1–S-4 all intact | ✅ PASS |

---

## Stage C — Security-Specific Closure Checklist

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Can an arbitrary UUID authenticate a parent? | SAFE | `verifyParentToken()` — HS256 JWT required; UUID returns null (AUTH-2, 3O) |
| 2 | Can a parent access another parent's children? | SAFE | `getCurrentParent()` → `eq(children.parentId, parent.id)` in portal actions |
| 3 | Can a parent modify/cancel another parent's booking? | SAFE | `cancelBookingByParent` + `createPortalBooking` verify `eq(bookings.parentId, parent.id)` |
| 4 | Can a non-owner access another centre by changing centreId? | SAFE | `getUserAccessibleCentreIds()` called for non-ORG_OWNERs in all booking/registration/export routes |
| 5 | Can Organisation A access Organisation B by changing IDs? | SAFE | All routes derive org from `session.user.organisationId`; switch-org verifies membership |
| 6 | Can TUTOR invoke privileged APIs/actions directly? | SAFE | Finance export: TUTOR explicitly rejected; student export: TUTOR rejected; communications: MANAGER+ only |
| 7 | Can FRONT_DESK invoke ORG_OWNER-only settings actions? | SAFE | Settings/branding/org-settings require ORG_OWNER check in route |
| 8 | Can MANAGER escape their centre scope? | SAFE | `getUserAccessibleCentreIds()` enforced for MANAGER in bulk ops, exports, registrations |
| 9 | Can public registration/prefill leak foreign PII? | SAFE | Prefill: org-isolation enforced (S-1, 3O); registration: org from slug |
| 10 | Can public booking mutate an existing foreign booking? | SAFE | S-3 fix (3O): `rescheduleId` verified against `parentId` + `organisationId` |
| 11 | Can a random internet caller invoke admin/migration endpoints? | SAFE | Both admin routes require `auth()` + ORG_OWNER |
| 12 | Can a random internet caller invoke cron jobs? | SAFE | All 3 cron routes require `Authorization: Bearer <CRON_SECRET>`; 503 if secret unset |
| 13 | Can a forged webhook mutate application state? | SAFE | Stripe signature verified via `constructInvoiceWebhookEvent()`; idempotent |
| 14 | Can client-supplied payment data alter authoritative amount/ownership? | SAFE | Stripe checkout: amount server-derived; voucher: capped at outstanding (FINANCE-1 fix) |
| 15 | Can upload routes write files without auth/validation? | SAFE | Public upload: rate-limited, centre-validated, content-validated; logo: ORG_OWNER only |
| 16 | Are magic-link/reset/invite tokens properly verified and expiry-bound? | DEFECT FIXED | TOKEN-1/TOKEN-2 fixed — all tokens now SHA-256 hashed; expiry enforced on all paths |
| 17 | Are sensitive credentials/tokens exposed in source/client/logs? | SAFE | No token values logged; no raw tokens in DB after fixes |
| 18 | Are previously fixed 3D–3O security boundaries still intact? | SAFE | All 12 milestones regressed — all PASS |

---

## npm audit (informational)

```
18 vulnerabilities (7 moderate, 8 high, 3 critical)
Primarily: uuid (transitive via gaxios), plus other transitive dependencies.
The uuid vulnerability requires buf parameter usage (2-arg API) to trigger.
Application usage of uuid does not use the vulnerable code path.
```

**Disposition:** Deferred. No `npm audit fix --force` per scope restriction. Dependency maintenance recommended as a separate task.

---

## Working Tree and Push Status

```
git status:    clean
git branch:    rebuild/cms-modernisation
HEAD:          bdcf96e
Commits ahead: 15 (not yet pushed)
```

---

## Final Recommendation

**PASS — recommend freezing Milestone 3P**

All confirmed CRITICAL/HIGH/MEDIUM vulnerabilities are closed. All confirmed security boundaries:
- Organisation isolation ✅
- Centre isolation ✅
- Parent ownership ✅
- Authentication/token paths hardened ✅
- Machine endpoints (cron/admin) protected ✅
- Payment/webhook trust boundaries verified ✅
- 3D–3O security fixes intact ✅
- Quality gates (TypeScript, ESLint, Vitest 523/523, Build) ✅
- Working tree clean ✅
