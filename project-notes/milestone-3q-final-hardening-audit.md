# Milestone 3Q — Final Hardening, Production Readiness & Phase-3 Audit
## Stage A: Repository-Wide Integrated System Audit

**Branch:** `rebuild/cms-modernisation`  
**Starting SHA:** `666df96` (3P frozen tip)  
**Audit Conducted at:** `666df96`

---

## 1. Application Surface Inventory

The entire application was audited across all routing tiers and operational modules:

### 1.1 Authenticated Staff Pages (`/dashboard/**`)
- Overview / Dashboard (`/dashboard`)
- Students & Attendance (`/dashboard/students`, `/dashboard/students/[id]`, `/dashboard/students/add`, `/dashboard/students/import`, `/dashboard/attendance`, `/dashboard/attendance/ledger`, `/dashboard/kiosk`)
- Parents (`/dashboard/parents`, `/dashboard/parents/[id]`, `/dashboard/parents/bin`)
- Staff Management (`/dashboard/staff`, `/dashboard/staff/[userId]`, `/dashboard/staff/invite`)
- Centres (`/dashboard/centres`, `/dashboard/centres/[id]/settings`, `/dashboard/centres/[id]/billing`, `/dashboard/centres/add`)
- Bookings & Availability (`/dashboard/bookings`, `/dashboard/bookings/[bookingId]`, `/dashboard/bookings/new`, `/dashboard/availability`, `/dashboard/availability/[centreId]`)
- Finance & Billing (`/dashboard/finance`, `/dashboard/finance/invoices`, `/dashboard/finance/invoices/[id]`, `/dashboard/finance/receipt`, `/dashboard/finance/reconciliation`)
- Communications (`/dashboard/communications`)
- Reports (`/dashboard/reports`)
- Incidents & Safeguarding (`/dashboard/incidents`)
- Registrations (`/dashboard/registrations`, `/dashboard/registrations/[id]`)
- Settings & Share (`/dashboard/settings`, `/dashboard/settings/finance`, `/dashboard/settings/registration`, `/dashboard/settings/wonde`, `/dashboard/share`)

### 1.2 Parent Portal (`/portal/**`)
- Portal Home / Booking Management (`/portal`)
- Booking Flow (`/portal/book`)
- Billing & Invoices (`/portal/billing`)
- Children Profile & Medical Notes (`/portal/children/[id]`)
- Portal Login & Verification (`/portal/login`, `/portal/verify`)

### 1.3 Public Surfaces
- Landing & Login (`/`, `/login`, `/staff-login`, `/signup`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/onboarding`, `/register-org`)
- Public Booking (`/book/[orgSlug]`, `/book/[orgSlug]/[centreSlug]`)
- Public Registration (`/register/[...slug]`, `/centre-portal/[subdomain]/register`, `/centre-portal/[subdomain]/book`)
- Public Careers (`/careers/[slug]`)

### 1.4 API & Backend Subsystems
- Admin routes (`/api/admin/migrate-users`, `/api/admin/seed-centre-billing`)
- Cron routes (`/api/cron/billing`, `/api/cron/reminders`, `/api/cron/school-year-roll`)
- Webhook routes (`/api/webhooks/stripe-invoice`)
- Upload routes (`/api/upload`, `/api/upload/logo`)
- Search & Notifications (`/api/search`, `/api/notifications`)
- Reports & Exports (`/api/reports/attendance`, `/api/reports/bookings`, `/api/reports/students`, `/api/export/finance`, `/api/export/register`)
- Auth & User endpoints (`/api/auth/[...nextauth]`, `/api/auth/reset-password`, `/api/auth/signup`, `/api/user/memberships`, `/api/user/switch-org`)

---

## 2. Authentication Audit

All authentication methods were traced end-to-end:

| Authentication Flow | Credential / Token Type | Storage & Verification | Status |
|---------------------|-------------------------|------------------------|--------|
| Staff Password Login | bcrypt password hash | `users.passwordHash` via NextAuth CredentialsProvider | ✅ Verified Safe |
| Staff Magic Link Login | 32-byte hex token | DB stores SHA-256 hash `staff_invites.token`; lookup via `hashToken(token)` | ✅ Verified Safe (3P TOKEN-1) |
| NextAuth `inviteToken` | 32-byte hex token | `src/lib/auth.ts` verifies via `hashToken(credentials.token)` | ✅ Verified Safe (3P TOKEN-1) |
| Staff Invite Acceptance | 32-byte hex token | Raw token in email; DB stores SHA-256 hash; single-use via `usedAt` | ✅ Verified Safe (3P TOKEN-1) |
| Password Reset | 32-byte hex token | Raw token in email; DB stores SHA-256 hash; lookup via `hashToken(token)` | ✅ Verified Safe (3P TOKEN-2) |
| Parent Magic Link | 32-byte hex token | Stored as SHA-256 hash `parents.magicLinkToken`; verified via `hashToken` | ✅ Verified Safe (3O AUTH-1) |
| Parent Session | HS256 Signed JWT | Cookie `parent_session`; `verifyParentToken()` strictly requires JWT | ✅ Verified Safe (3O AUTH-2) |
| Org Switch | Session JWT + Org ID | `POST /api/user/switch-org` verifies user membership in target org | ✅ Verified Safe |

---

## 3. Authorization Matrix

| Module | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR | PARENT | PUBLIC |
|--------|-----------|---------|------------|-------|--------|--------|
| Dashboard | All Org Centres | Assigned Centres | Assigned Centres | Denied | Denied | Denied |
| Students (Read/Write) | Full Org | Assigned Centres | Assigned Centres | Read Assigned (No Export) | Denied | Denied |
| Parents (Read/Write) | Full Org | Assigned Centres | Assigned Centres | Denied | Own Record | Denied |
| Staff & Invites | Full Org | Denied | Denied | Denied | Denied | Denied |
| Centres (CRUD) | Full Org | View / Update Assigned (No Billing) | Denied | Denied | Denied | Public Info |
| Bookings (CRUD) | Full Org | Assigned Centres | Assigned Centres | Assigned Centres | Own Bookings | Public Create |
| Finance & Invoices | Full Org | Assigned Centres | Reconcile TFC/Voucher | Denied | Own Invoices | Stripe Checkout |
| Communications (Broadcast) | Full Org | Assigned Centres | Denied | Denied | Denied | Denied |
| Reports & Exports | Full Org | Assigned Centres | Denied | Denied | Denied | Denied |
| Settings & Branding | Full Org | Denied | Denied | Denied | Denied | Public Logo |
| Incidents & Safeguarding | Full Org | Assigned Centres | Assigned Centres | Non-Safeguarding Only | Denied | Denied |
| Registrations (Review) | Full Org | Assigned Centres | Denied | Denied | Own Children | Public Submit |

**Audit finding:** All server-side actions and API routes independently assert role and centre boundaries matching the matrix above. No role leakage or unauthenticated bypass paths exist.

---

## 4. Tenancy & Isolation Audit

### 4.1 Organisation Isolation (Multi-Tenancy)
- Every staff-authenticated mutation derives `organisationId` from `session.user.organisationId` (never trusted from query params or request payload).
- Public registration endpoints resolve the tenant from the URL slug (`orgSlug`) in the database before creating records.
- Cross-tenant IDOR checks verify that foreign centre, booking, parent, or child IDs return 404 or 403.

### 4.2 Centre Isolation
- Non-owner roles (`MANAGER`, `FRONT_DESK`, `TUTOR`) are filtered by `getUserAccessibleCentreIds(session.user.id)`.
- All bulk booking updates, registration status patches, and student/attendance exports filter out centres outside the user's explicit memberships.

### 4.3 Parent Isolation
- Parent portal queries filter on `eq(table.parentId, parent.id)`.
- Reschedules verify that the original booking belongs to the same parent before cancelling (Milestone 3O S-3).
- Voucher submissions verify `invoices.parentId = parent.id` and cap payments at the authoritative outstanding balance (Milestone 3P FINANCE-1).

---

## 5. Soft-Deletion Audit

`deletedAt` filter review:
- `parents` and `children`: Excluded from active student lists, attendance kiosks, search results, billing configs, and portal views via `isNull(table.deletedAt)`.
- Soft-deleted parents are rejected immediately at portal verification (`/portal/verify`) and in `getCurrentParent()`.
- Parent bin restore actions (`/dashboard/parents/bin`) restore parents and children atomically.

---

## 6. Financial Integrity Audit

- **Invoice Creation:** Server-authoritative calculation based on centre slot fees; caller cannot alter computed invoice totals.
- **Stripe Checkout:** `amountPence` derived server-side from `invoice.amount - paidAmount`; Stripe webhook verifies cryptographic signature and enforces idempotency on `session.id`.
- **Voucher Payments:** Server-side calculation caps caller amount at `outstandingBalance`; records payment as `status: 'pending'` for staff manual bank reconciliation.
- **Payment Reconciliation:** Staff reconciliation checks idempotency reference (`transactionReference`) and updates invoice status atomically.

---

## 7. Machine, Cron, Admin & Upload Boundaries

- **Admin Routes (`/api/admin/**`):** Protected by `auth()` requiring `role === 'ORG_OWNER'`.
- **Cron Routes (`/api/cron/**`):** Protected by `Authorization: Bearer <CRON_SECRET>` with `timingSafeEqual`. Returns 503 if `CRON_SECRET` is unset.
- **Webhook Routes (`/api/webhooks/stripe-invoice`):** Cryptographically verifies Stripe signature before payload processing.
- **Upload Routes:** Public upload validates MIME type, image magic bytes, and centre existence. Logo upload requires authenticated `ORG_OWNER`.

---

## 8. Defect & Hardening Classification

### Confirmed Defects for Remediation

1. **BUILD-1 (Build Warning Cleanup — Low):**
   - **Surface:** `src/app/layout.tsx`
   - **Evidence:** `themeColor` is exported in `metadata` object, causing 20+ repetitive Next.js build warnings across static generation.
   - **Fix:** Move `themeColor` to a standard `export const viewport: Viewport` in `src/app/layout.tsx`.

2. **CONFIG-1 (Production Secret Fallback Hardening — Low):**
   - **Surface:** `src/lib/parent-auth.ts`, `src/app/api/register/route.ts`, `src/app/dashboard/registrations/actions.ts`
   - **Evidence:** Fallback string `'fallback-secret-at-least-32-chars-long'` / `'default-dev-secret-do-not-use-in-prod'` is used if `AUTH_SECRET` is missing.
   - **Fix:** In `NODE_ENV === 'production'`, throw an explicit configuration error if signing secrets are missing, preventing insecure fallback secret usage in production deployments.

---

## 9. Observations & Deferred Technical Debt

| Item | Category | Description | Disposition |
|------|----------|-------------|-------------|
| OBS-1 | Dependencies | `npm audit` reports 18 vulnerabilities in transitive dependencies (e.g. `uuid`, `esbuild`, `postcss`). | Deferred to dedicated dependency upgrade milestone per non-negotiable rule 2.4. |
| OBS-2 | Build Warning | Inferred workspace root warning due to `/Users/KWADW/package-lock.json` outside project root. | Local environment condition, does not affect production build. |
| OBS-3 | Build Warning | Deprecation warning on `middleware.ts` in favour of `proxy`. | Standard Next.js 16 deprecation warning; framework migration deferred. |
| OBS-4 | Build Warning | Turbopack NFT tracing warning on Google Calendar service account path. | Harmless runtime fallback notice. |

---

## 10. Stage-A Assessment

- **Blocking Product-Policy Ambiguities:** NONE.
- **Confirmed Defects for 3Q:** 2 (BUILD-1, CONFIG-1).
- **Stage A Verdict:** PASS — Proceeding directly to Stage B remediation.
