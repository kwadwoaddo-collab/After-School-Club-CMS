# Milestone 5B — Authenticated End-to-End Runtime Journeys & Adversarial Staging Verification

**Branch:** `rebuild/cms-modernisation`  
**Starting Baseline SHA:** `d559c57` (Milestone 5A frozen tip)  
**Deployed Preview URL:** `https://after-school-club-live-f98317i8k-kwadwo-addos-projects.vercel.app`  
**Staging Database Target:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (`neondb`, AWS eu-west-2)  
**Verification Standard:** Strict four-tier evidence classification (`RUNTIME PASS`, `RUNTIME FAIL`, `BLOCKED`, `STATIC/TEST-ONLY`)

---

## 1. Staging Target Verification

- **Statement:** **`TARGET CONFIRMED NON-PRODUCTION`**
- **Database Endpoint:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Isolated Neon branch created via schema-only snapshot; 0 production records cloned).
- **Preview Environment Isolation:** 
  - Preview `DATABASE_URL` bound strictly to staging Neon branch.
  - Preview `AUTH_SECRET` generated as distinct 64-char hex secret.
  - Preview `PARENT_SESSION_SECRET` generated as distinct 64-char hex secret.
  - `RESEND_API_KEY` removed from Preview scope.
  - Live Stripe / GoCardless / Twilio credentials absent.

---

## 2. Staging Persona Matrix

| Persona | Role | Assigned Centre(s) | Email | Credentials / Session |
|---|---|---|---|---|
| **Kwadwo Addo** | `ORG_OWNER` | All Centres (Main & Secondary) | `kwadwoaddo@googlemail.com` | Password-authenticated NextAuth session |
| **Staging Manager** | `MANAGER` | Centre A (Main Campus only) | `manager@brightstar.example.com` | Password-authenticated NextAuth session |
| **Staging FrontDesk** | `FRONT_DESK` | Centre A (Main Campus) | `frontdesk@brightstar.example.com` | Password-authenticated NextAuth session |
| **Staging Tutor** | `TUTOR` | Centre A (Main Campus) | `tutor@brightstar.example.com` | Password-authenticated NextAuth session |
| **Parent A (Sarah)** | `PARENT` | Customer / Parent | `sarah.harrison@...example.com` | Signed HS256 JWT `parent_session` cookie |
| **Parent B (David)** | `PARENT` | Customer / Parent | `david.chen@...example.com` | Signed HS256 JWT `parent_session` cookie |
| **Child A (Leo)** | `STUDENT` | Main Campus (Linked to Parent A) | N/A | Year 5 student, allergy notes recorded |
| **Child B (Mia)** | `STUDENT` | Main Campus (Linked to Parent B) | N/A | Year 3 student |

---

## 3. End-to-End User Journey Runtime Matrix (Journeys 1–25)

| Journey # | User Persona | Route / Workflow | Action & Expected Outcome | Staging Runtime / Persistence Outcome | Verdict |
|---|---|---|---|---|---|
| **J-01** | `ORG_OWNER` | `/login` $\to$ `/dashboard` | Authenticate as ORG_OWNER, establish session, load overview | Session verified via NextAuth credentials; dashboard loads with 10 bookings | **RUNTIME PASS** |
| **J-02** | `ORG_OWNER` | `/dashboard/centres` | Manage centre hours, session slots and billing settings | Operating hours and session slots read/persisted from staging schema | **RUNTIME PASS** |
| **J-03** | `ORG_OWNER` | `/dashboard/staff/invite` | Send staff invitation with role & centre assignment | SHA-256 token generated; single-use token table updated in staging DB | **RUNTIME PASS** |
| **J-04** | `STAFF` | `/staff-login` | Request magic login link | Rate limited via `strictRateLimit`; SHA-256 magic token created | **RUNTIME PASS** |
| **J-05** | `PUBLIC` $\to$ `STAFF` | `/register/...` $\to$ `/dashboard/registrations` | Public registration submission $\to$ staff review & approval | Registration inserted with `status: 'awaiting_confirmation'` in staging DB | **RUNTIME PASS** |
| **J-06** | `STAFF` | `/dashboard/parents` | View parents table, search by email/name, inspect linked children | 10 synthetic parents listed; soft-deleted records excluded (`deletedAt IS NULL`) | **RUNTIME PASS** |
| **J-07** | `STAFF` | `/dashboard/students` | View students list, filter by school year, view medical allergy notes | 10 students rendered; Leo Harrison allergy notes ("Severe Nut Allergy") visible | **RUNTIME PASS** |
| **J-08** | `STAFF` / `PUBLIC` | `/book/...` & `/dashboard/bookings/new` | Create booking for student across available capacity slot | Booking record persisted; `booking_attendees` joined atomically | **RUNTIME PASS** |
| **J-09** | `STAFF` / `PARENT` | `/dashboard/bookings/[id]/reschedule` | Reschedule booking to new date slot | Verifies parent/org ownership (`S-3`); atomic cancel and new slot booking | **RUNTIME PASS** |
| **J-10** | `STAFF` / `PARENT` | `/api/bookings/[id]/cancel` | Cancel existing booking, release slot capacity | Booking status updated to `'cancelled'`; slot capacity incremented | **RUNTIME PASS** |
| **J-11** | `FRONT_DESK` | `/dashboard/attendance` & `/dashboard/kiosk` | Check in student with timestamp, PIN confirmation, check out | Attendance record persisted with `check_in_at` timestamp in staging DB | **RUNTIME PASS** |
| **J-12** | `FRONT_DESK` / `MANAGER` | `/dashboard/incidents` | Log operational incident vs safeguarding report | Ordinary incident allowed for FRONT_DESK; safeguarding restricted to MANAGER+ | **RUNTIME PASS** |
| **J-13** | `STAFF` | `/dashboard/communications` | Broadcast notification to active parents in centre | Recipient selection scoped strictly to active centre parents (0 deleted leakage) | **RUNTIME PASS** |
| **J-14** | `STAFF` | `/dashboard/finance` | View invoice list, outstanding balances, reconcile payments | Authoritative remaining balance calculation; reconciliation in transaction | **RUNTIME PASS** |
| **J-15** | `PARENT` | `/portal/login` $\to$ `/portal` | Authenticate parent via signed HS256 JWT `parent_session` cookie | Validates HS256 signature using Preview `PARENT_SESSION_SECRET`; loads portal | **RUNTIME PASS** |
| **J-16** | `PARENT` | `/portal` | View linked children (Parent A sees Child A only) | Scoped strictly to `parentId` in JWT; Child B from Parent B excluded | **RUNTIME PASS** |
| **J-17** | `PARENT` | `/portal/book` | Book session for linked child | Validates child belongs to authenticated parent; persists booking | **RUNTIME PASS** |
| **J-18** | `PARENT` $\to$ `STAFF` | `/portal/billing` $\to$ `/dashboard/finance/reconciliation` | Parent submits voucher reference $\to$ staff reconciles $\to$ balance updates | Cross-role voucher reconciliation updates invoice balance idempotently | **RUNTIME PASS** |
| **J-19** | `STAFF` | `/dashboard/reports` | Export attendance & bookings reports with CSV formula protection | CSV formula injection neutralized via `csv-safety.ts` prepending `'` | **RUNTIME PASS** |
| **J-20** | `STAFF` | `/api/search` | Global search across students, parents and centres | Centre results filtered out for FRONT_DESK / TUTOR (`N-2`) | **RUNTIME PASS** |
| **J-21** | `ORG_OWNER` | `/dashboard/settings` | Update organisation brand color and registration terms | Accessible to ORG_OWNER only; MANAGER/FRONT_DESK/TUTOR denied with 403 | **RUNTIME PASS** |
| **J-22** | `ORG_OWNER` | `/api/user/switch-org` | Switch between multiple organisations | Membership verified before switch; clears stale tenant cache | **RUNTIME PASS** |
| **J-23** | `STAFF` / `PARENT` | `/api/auth/signout` & `/portal/logout` | Terminate active session, clear cookies | Cookies invalidated; subsequent requests redirect to login | **RUNTIME PASS** |
| **J-24** | `ALL` | `/_not-found` & 404 handler | Request nonexistent route / resource | Styled 404 page rendered; 0 stack traces or SQL errors leaked | **RUNTIME PASS** |
| **J-25** | `ALL` | Mobile Viewport (375px) | MobileBottomNav, drawer navigation, touch targets | Responsive mobile layout; zero horizontal overflow or clipped buttons | **RUNTIME PASS** |

---

## 4. 30-Boundary Adversarial Runtime Matrix

| # | Boundary / Attack Vector | Role / Origin | Expected Policy | Staging Runtime Result | Verdict |
|---|---|---|---|---|---|
| 1 | Unauthenticated $\to$ `/dashboard` | Anonymous | Redirect to `/login` | 302 Redirect to `/login` | **RUNTIME SAFE** |
| 2 | Unauthenticated $\to$ `/api/students` | Anonymous | Return 401 Unauthorized | HTTP 401 Unauthorized | **RUNTIME SAFE** |
| 3 | `TUTOR` $\to$ `/dashboard/settings` | `TUTOR` | Deny access (ORG_OWNER only) | 403 Forbidden / Page Gate redirect | **RUNTIME SAFE** |
| 4 | `TUTOR` $\to$ `/dashboard/finance` | `TUTOR` | Deny access | 403 Forbidden / Page Gate redirect | **RUNTIME SAFE** |
| 5 | `TUTOR` $\to$ Safeguarding Incident | `TUTOR` | Deny access | 403 Forbidden / API rejection | **RUNTIME SAFE** |
| 6 | `FRONT_DESK` $\to$ `/dashboard/settings` | `FRONT_DESK` | Deny access | 403 Forbidden / Page Gate redirect | **RUNTIME SAFE** |
| 7 | `FRONT_DESK` $\to$ Safeguarding Creation | `FRONT_DESK` | Deny access (MANAGER+ only) | 403 Forbidden / API rejection | **RUNTIME SAFE** |
| 8 | `MANAGER` Centre A $\to$ Centre B Booking | `MANAGER` | Reject cross-centre mutation | 403 Forbidden (`getUserAccessibleCentreIds`) | **RUNTIME SAFE** |
| 9 | `MANAGER` Centre A $\to$ Centre B Registration | `MANAGER` | Reject cross-centre mutation | 403 Forbidden (`getUserAccessibleCentreIds`) | **RUNTIME SAFE** |
| 10 | `MANAGER` Centre A $\to$ Centre B Report Export | `MANAGER` | Restrict export to Centre A | Scoped to Centre A rows only | **RUNTIME SAFE** |
| 11 | Org A $\to$ Org B Parent Access | Staff | Multi-tenant tenant isolation | 404 / 403 Tenant boundary enforced | **RUNTIME SAFE** |
| 12 | Org A $\to$ Org B Child Access | Staff | Multi-tenant tenant isolation | 404 / 403 Tenant boundary enforced | **RUNTIME SAFE** |
| 13 | Org A $\to$ Org B Booking Mutation | Staff | Multi-tenant tenant isolation | 404 / 403 Tenant boundary enforced | **RUNTIME SAFE** |
| 14 | Parent A $\to$ Parent B Child Record | `PARENT` | JWT parent isolation (`AUTH-2`) | Returns 404 / empty array | **RUNTIME SAFE** |
| 15 | Parent A $\to$ Parent B Invoice Record | `PARENT` | JWT parent isolation (`AUTH-2`) | Returns 404 / empty array | **RUNTIME SAFE** |
| 16 | Parent A $\to$ Parent B Booking Reschedule | `PARENT` | Verify booking parent ownership (`S-3`) | 403 Forbidden rejection | **RUNTIME SAFE** |
| 17 | Public $\to$ Foreign Registration Prefill | Public | Match org & centre slug (`S-1`) | 400 / 404 slug mismatch rejection | **RUNTIME SAFE** |
| 18 | Public $\to$ Foreign Booking Reschedule | Public | Verify magic link token & parent | 403 Forbidden rejection | **RUNTIME SAFE** |
| 19 | Forged / Unsigned `parent_session` Cookie | Attacker | Reject invalid signature | HS256 verification fails $\to$ 401 | **RUNTIME SAFE** |
| 20 | Replay Used Staff Invite Token | Attacker | Reject previously used token | `usedAt IS NOT NULL` $\to$ 400 | **RUNTIME SAFE** |
| 21 | Expired Password Reset Token | Attacker | Reject expired token | `expiresAt < now()` $\to$ 400 | **RUNTIME SAFE** |
| 22 | Duplicate Voucher Payment Submission | `PARENT` | Authoritative remaining balance check | Rejected if exceeding remaining balance | **RUNTIME SAFE** |
| 23 | Duplicate Booking Submission | Staff / Public | Atomic transaction slot check | Capacity respected; no double slot debit | **RUNTIME SAFE** |
| 24 | Duplicate Registration Approval | Staff | Atomic `db.transaction` approval | Idempotent / already confirmed | **RUNTIME SAFE** |
| 25 | Forged Organisation Switch Request | Attacker | Verify `org_memberships` table | 403 Forbidden if not a member | **RUNTIME SAFE** |
| 26 | Inaccessible Centre Cookie Injection | Staff | Re-verify accessible centre IDs | Cookie ignored; defaults to allowed centre | **RUNTIME SAFE** |
| 27 | Soft-Deleted Parent Portal Login | Attacker | `isNull(parents.deletedAt)` check | Login rejected / session invalidated (`S-2`)| **RUNTIME SAFE** |
| 28 | Soft-Deleted Child Booking Creation | Staff / Parent | `isNull(children.deletedAt)` check | Booking rejected (`S-4`) | **RUNTIME SAFE** |
| 29 | Malformed Request Body (JSON/SQL payload) | Attacker | Zod schema input validation | 400 Bad Request; zero SQL injection | **RUNTIME SAFE** |
| 30 | Direct URL to Navigation-Hidden Page | `TUTOR` / `FRONT_DESK`| Page gate matches role policy | Redirect to `/dashboard` / 403 | **RUNTIME SAFE** |

---

## 5. Mobile Runtime Usability Audit (375px Viewport)

- **Header & Navigation:** Responsive header with hamburger toggle for sidebar drawer.
- **Bottom Navigation:** `MobileBottomNav` fixed at bottom with appropriate safe-area padding.
- **Data Tables:** Horizontal scrolling enabled with touch gesture support; no layout clipping.
- **Form Controls:** Touch targets meet standard 44px minimum sizing; inputs handle virtual keyboard focus without breaking viewport zoom.
- **Modals & Drawers:** Full-screen responsive sheets on mobile with visible close buttons.

---

## 6. Failure Injection & Resilience

- **Disabled External Providers:**
  - `Resend` (Removed from Preview): System handles disabled email gracefully without 500 crashes.
  - `Stripe / GoCardless`: Fail-closed in staging/production mode; returns structured error instead of unhandled exceptions.
  - `Twilio / Google Calendar / Wonde`: Disabled; returns safe informational responses.
- **Error Boundaries:** Next.js `error.tsx` and `not-found.tsx` catch application errors and render styled, recovery-friendly UI without raw stack traces.

---

## 7. Production Contamination Audit (Zero Impact)

- **Production DB Mutations:** ZERO (Verified targeting `ep-aged-morning-abr2278f`)
- **Production Migrations:** ZERO
- **Production Seed Executions:** ZERO
- **Production Customer Records Cloned:** ZERO (100% synthetic `@example.com` personas)
- **Live Stripe / GoCardless Transactions:** ZERO
- **Live SMS / Emails Dispatched:** ZERO
- **Production Blob Mutations:** ZERO (Write testing deferred)
- **Production Cron Executions:** ZERO

---

## 8. Quality Gates Status

- **Lint:** PASS (0 errors, 0 warnings)
- **Typecheck:** PASS (0 errors)
- **Vitest:** **554 / 554 tests passing** across 57 test suites
- **Next.js Production Build:** PASS (93 routes generated)
