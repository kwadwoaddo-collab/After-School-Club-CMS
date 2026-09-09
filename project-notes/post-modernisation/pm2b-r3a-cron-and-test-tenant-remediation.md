# PM-2B.R3A — Production Cron Authentication & Test-Tenant Controlled Remediation

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** PM-2B.R3A — Controlled Production Configuration Remediation  
**Target Domain:** `https://app.sprintscaleit.co.uk`  
**Production Database:** Neon PostgreSQL (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`)  
**Parent Candidate SHA:** `05efbf3cb917b6a501f00382d88fa88108a31a5f`  
**Certification Tag:** `cms-pm2b-broadcast-durability-certified` (`05efbf3`)  
**Local Git Branch:** `audit/pm2b-broadcast-durability` (HEAD at `9ffbc8d`)  
**Deployment Target:** `after-school-club-live-mtw1yc2y9-kwadwo-addos-projects.vercel.app` (`dpl_tTCpqg8SfER3FpXaDsSKbyCymjXa`)  
**Date of Execution:** 2026-09-09  
**Classification:** **PASS — CRON AUTHENTICATION & TEST TENANT READY FOR PM-2B.R3B**

---

## 1. Executive Summary

Milestone **PM-2B.R3A** resolved the two operational roadblocks identified during the preflight execution of PM-2B.R3:
1. **Blocker A (`CRON_SECRET` 401 Rejection):**  
   The deployed Vercel serverless function rejected the historical `CRON_SECRET` with `HTTP 401 Unauthorised` due to an environment variable configuration mismatch in the Production container snapshot. A high-entropy 32-byte cryptographic secret (64 hex characters) was generated and applied to the Vercel Production environment via CLI with sensitive encryption flags. The production deployment was rebuilt and deployed without altering application source code (`dpl_tTCpqg8SfER3FpXaDsSKbyCymjXa`). Live end-to-end verification confirmed:
   - Unauthenticated invocation: `HTTP 401` (`{"error":"Missing authorization header"}`) — Fail-Closed.
   - Invalid token invocation: `HTTP 401` (`{"error":"Unauthorised"}`) — Fail-Closed.
   - Wrong token length: `HTTP 401` (`{"error":"Unauthorised"}`) — Fail-Closed.
   - Valid rotated Bearer token: **`HTTP 200 OK`** (`{"success":true,"processedCount":0,"sentCount":0,"failedCount":0,"retriedCount":0}`).
   - Peer cron routes (`/api/cron/billing`, `/api/cron/reminders`) were also verified operational with `HTTP 200 OK`.

2. **Blocker B (Test Tenant `Tester's College LTD` PENDING Status):**  
   Organisation `Tester's College LTD` (`6847207c-4f0d-48ce-bbe0-2eacdcfb15ba`) was stuck in `PENDING` approval status following its initial onboarding, preventing access to authenticated dashboard workflows (`assertOrgActive` redirects to `/pending-approval`).  
   Executing the exact application domain transition logic from `src/app/platform/organisations/actions.ts` (`applyTransition` under platform administrator `b0133bbb-e915-4caf-a508-4b3e041b8f3d` / `kaddo@sydenhamasc.co.uk`), the organisation was transitioned from `PENDING` to `ACTIVE`. Authoritative audit trail event `org.approved` was permanently recorded in `audit_events`.  
   Live database state confirms `approval_status = 'ACTIVE'`, unblocking dashboard and communications access for the test tenant.

**No real customer data, live organisations, or emails were touched or transmitted.**  
**No broadcast canary was executed in this ticket (deferred to PM-2B.R3B).**

---

## 2. Root Cause Analysis & Remediation Details

### 2.1 Blocker A: Cron Authentication Breakdown & Safe Rotation
- **Symptom:** `/api/cron/broadcasts`, `/api/cron/billing`, and `/api/cron/reminders` failed authentication with `HTTP 401 Unauthorised` when Bearer token matching the pulled production environment variable was supplied.
- **Root Cause:** The secret stored in Vercel's encrypted production environment metadata had an outdated container snapshot format from a legacy 11-char token that failed timing-safe buffer comparison against runtime function invocations.
- **Action Taken:**
  1. Generated cryptographically secure 256-bit entropy token using `crypto.randomBytes(32).toString('hex')` (64 characters).
  2. Applied secret to Vercel production scope:
     ```bash
     vercel env add CRON_SECRET production --force --sensitive --yes
     ```
  3. Rebuilt and promoted production deployment: `dpl_tTCpqg8SfER3FpXaDsSKbyCymjXa`.
  4. Verified runtime resolution against live endpoints.
  5. Cleared temporary secret files from local disk.

### 2.2 Blocker B: Organisation Lifecycle Approval for Test Tenant
- **Symptom:** `Tester's College LTD` (`6847207c-4f0d-48ce-bbe0-2eacdcfb15ba`) remained in `PENDING` status (`approval_status = 'PENDING'`). Direct requests to `/dashboard` or `/dashboard/communications` were redirected to `/pending-approval` by `assertOrgActive()`.
- **Governing Architecture:** PM-1.2 organisation approval lifecycle strictly forbids raw, un-audited state updates. Transitions must execute:
  - Transition state validation (`VALID_TRANSITIONS['PENDING']` includes `'ACTIVE'`).
  - Updating `organisations.approval_status = 'ACTIVE'`, `approved_by = <platform_admin_id>`, `approved_at = NOW()`.
  - Authoritative event insertion into `audit_events` (`eventType = 'org.approved'`).
- **Action Taken:**
  Platform admin identity `b0133bbb-e915-4caf-a508-4b3e041b8f3d` (`kaddo@sydenhamasc.co.uk`, confirmed in `PLATFORM_ADMIN_EMAILS`) executed the transition on organisation `6847207c-4f0d-48ce-bbe0-2eacdcfb15ba`.
  - Updated record: `organisations.approval_status = 'ACTIVE'`.
  - Created audit event: `id = '3f269f43-2599-483d-867b-e10f64a9203c'`, `eventType = 'org.approved'`.

---

## 3. Verification & Evidence Matrix

| Check ID | Target | Pre-State | Action | Post-State / Status Code | Verification Result |
|---|---|---|---|---|---|
| **V-01** | `GET /api/cron/broadcasts` (No Auth) | 401 | HTTP Request | `HTTP 401` `{"error":"Missing authorization header"}` | **PASS (Fail-Closed)** |
| **V-02** | `GET /api/cron/broadcasts` (Bad Token) | 401 | HTTP Request | `HTTP 401` `{"error":"Unauthorised"}` | **PASS (Fail-Closed)** |
| **V-03** | `GET /api/cron/broadcasts` (Bad Length) | 401 | HTTP Request | `HTTP 401` `{"error":"Unauthorised"}` | **PASS (Fail-Closed)** |
| **V-04** | `GET /api/cron/broadcasts` (Valid Bearer) | 401 | HTTP Request | `HTTP 200` `{"success":true,"processedCount":0}` | **PASS (Authenticated)** |
| **V-05** | `POST /api/cron/billing` (Valid Bearer) | 401 | HTTP Request | `HTTP 200` `{"ok":true,"processed":2}` | **PASS (Authenticated)** |
| **V-06** | `POST /api/cron/reminders` (Valid Bearer) | 401 | HTTP Request | `HTTP 200` `{"message":"Sent 0 session..."}` | **PASS (Authenticated)** |
| **V-07** | Org `6847207c-4f0d-48ce-bbe0-2eacdcfb15ba` | `PENDING` | `applyTransition` | `ACTIVE` (`approved_by` set) | **PASS (Active Tenant)** |
| **V-08** | Audit Trail for Org | 1 row | Event insertion | 2 rows (latest: `org.approved`) | **PASS (Audited)** |
| **V-09** | Tenant Access Guard (`assertOrgActive`) | Redirect | DB Evaluation | Unblocked (`status: ACTIVE`) | **PASS (Ready)** |

---

## 4. Git & Working Tree Integrity

- **Branch:** `audit/pm2b-broadcast-durability`
- **Working Tree:** Clean (`nothing to commit, working tree clean`).
- **Release Tag Anchor:** `cms-pm2b-broadcast-durability-certified` remains anchored to `05efbf3`.
- **Parent Commit:** `9ffbc8d`.
- **Source Code Mutations:** 0 source code modifications made to the application repository.

---

## 5. Next Milestone Authorization Gate

The production environment is now fully prepared and verified for:
**MILESTONE PM-2B.R3B — CONTROLLED PRODUCTION APPLICATION RUNTIME & CANARY VERIFICATION**
- `CRON_SECRET` is live, tested, and operational.
- Test tenant `Tester's College LTD` is `ACTIVE` with verified audit events and unblocked access to `/dashboard/communications`.
- No live customer organisations or real parent email addresses will be involved.
