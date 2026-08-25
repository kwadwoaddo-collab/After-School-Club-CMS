# Milestone 6B — Production Configuration & Provider Bring-Up Report
## Resend Pre-Freeze Reconciliation

**Branch:** `rebuild/cms-modernisation`  
**Starting / Working Tip SHA:** `30d124e`  
**Approved Application Baseline SHA:** `6c205ed`  
**Vercel Project:** `after-school-club-live` (`kwadwo-addos-projects`)  
**Canonical Domain:** `https://app.sprintscaleit.co.uk`

---

## 1. Executive Verdict

**STOP — RESEND CONFIGURATION REQUIRED**

Production authentication (parent magic links, staff invitations, staff magic logins, password resets) and transactional notifications require operational email delivery. While `PARENT_SESSION_SECRET` and `CRON_SECRET` have been securely provisioned in Vercel Production, `RESEND_API_KEY` is genuinely missing from the Production environment. Milestone 6B is stopped for human Resend configuration.

---

## 2. Source Code Email Variables Audit

Inspection of `src/lib/services/email.ts`, `src/app/api/cron/reminders/route.ts`, and auth workflows confirms:

1. **`RESEND_API_KEY`:** Required for Resend client instantiation (`new Resend(process.env.RESEND_API_KEY)`).
2. **`FROM_EMAIL`:** Configured as `noreply@sprintscaleit.co.uk` (defaults to `noreply@sprintscaleit.co.uk`).
3. **`FROM_NAME`:** Configured as `SprintScale` (with per-organisation prefix: `${orgName} via SprintScale`).
4. **Workflows Dependent on Email:**
   - Staff invitations (`sendStaffInvitation`)
   - Staff magic login (`sendMagicLink`)
   - Password reset (`sendPasswordReset`)
   - Parent booking confirmations (`sendBookingConfirmation`)
   - Booking cancellation & rescheduling (`sendBookingCancellation`, `sendBookingReschedule`)
   - Invoice issuance & receipts (`sendInvoiceEmail`, `sendPaymentReceipt`)
   - Registration confirmations & approvals (`sendRegistrationReceived`, `sendRegistrationApproved`)
   - Session & invoice reminders (`/api/cron/reminders`)

---

## 3. Production Environment & Resend Status

- **`RESEND_API_KEY`:** **MISSING** in Vercel Production.
- **`FROM_EMAIL`:** **CONFIGURED** as `noreply@sprintscaleit.co.uk`.
- **Sending Domain:** `sprintscaleit.co.uk`.
- **Domain Verification Status:** **CANNOT VERIFY LOCALLY** (Requires human verification in Resend Dashboard).
- **Production Scope:** `RESEND_API_KEY` is not present in Vercel Production environment scope.
- **Resend Classification:** **BLOCKED — Human Resend configuration required**.

---

## 4. Human Action Checklist for Resend Bring-Up

To complete Resend configuration for launch without exposing credentials in chat:

1. **Resend Dashboard:**
   - Log in to your [Resend Dashboard](https://resend.com).
   - Ensure the domain `sprintscaleit.co.uk` is added and displays **Verified** (DKIM / SPF / MX / DMARC records configured in DNS).
   - Create a Production API Key with **Sending Access** (or Full Access).
2. **Vercel CLI / Dashboard (Production Scope Only):**
   - Add the key to Vercel Production using the Vercel CLI:
     ```bash
     npx -y vercel env add RESEND_API_KEY production
     ```
     *(Paste the `re_...` API key when prompted; it will be marked as a Sensitive Secret in Production).*
   - Or add via the Vercel Dashboard under **Project Settings → Environment Variables → `RESEND_API_KEY` (Environment: Production)**.
3. **Confirm Sender Address:**
   - The application is configured to send from `noreply@sprintscaleit.co.uk` (`FROM_EMAIL`). If you prefer a different address (e.g. `info@sprintscaleit.co.uk`), update `FROM_EMAIL` in Vercel Production accordingly.

---

## 5. Final Vercel Production Environment Matrix

| Variable Name | Production Status | Classification | Runtime Effect |
|---|---|---|---|
| `DATABASE_URL` | CONFIGURED | Core DB | Points to Production Neon cluster |
| `AUTH_SECRET` | CONFIGURED | Core Auth | NextAuth server session signing |
| `PARENT_SESSION_SECRET`| **CONFIGURED** | Core Auth | Dedicated HS256 JWT parent cookie signing |
| `NEXTAUTH_SECRET` | CONFIGURED | Core Auth | Backwards compatibility for NextAuth |
| `AUTH_URL` | CONFIGURED | Core Routing | Canonical production domain |
| `NEXT_PUBLIC_BASE_URL` | CONFIGURED | Core Routing | Canonical production domain |
| `CRON_SECRET` | **CONFIGURED** | Background | Bearer token authorization for cron routes |
| `BLOB_STORE_ID` | CONFIGURED | Storage | Linked Vercel Blob store |
| `BLOB_WEBHOOK_PUBLIC_KEY`| CONFIGURED | Storage | Linked Vercel Blob store |
| `FROM_EMAIL` | CONFIGURED | Comms | `noreply@sprintscaleit.co.uk` |
| `RESEND_API_KEY` | **MISSING** | Comms | **BLOCKED (Human action required)** |
| `STRIPE_*` | DEFERRED | Payments | Card checkout disabled; voucher/invoice active |
| `GOCARDLESS_*` | DEFERRED | Direct Debit | Fail-closed in production mode |
| `TWILIO_*` | DEFERRED | SMS | Disabled |
| `GOOGLE_*` / `WONDE_*` | DEFERRED | Integrations | Disabled / Coming Soon |
| `UPSTASH_REDIS_*` | DEFERRED | Rate Limiting | In-memory sliding window fallback active |

---

## 6. Production Contamination Audit (Zero Impact)

- **Production DB writes:** 0
- **Production migrations:** 0
- **Production seed executions:** 0
- **Emails sent:** 0 *(Controlled runtime email testing deferred to Milestone 6E)*
- **SMS sent:** 0
- **Live payments:** 0
- **Cron executions:** 0
- **Blob mutations:** 0

---

## 7. Recommendation

**STOP — RESEND CONFIGURATION REQUIRED**
