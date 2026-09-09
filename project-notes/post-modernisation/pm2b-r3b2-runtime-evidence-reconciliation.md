# PM-2B.R3B.2.R — Production Runtime Evidence & Documentation Reconciliation

**Programme:** SprintScale CMS Modernisation Programme
**Milestone:** PM-2B.R3B.2.R — Production Runtime Evidence & Documentation Reconciliation
**Target Domain:** `https://app.sprintscaleit.co.uk`
**Parent Candidate SHA:** `05efbf3cb917b6a501f00382d88fa88108a31a5f`
**Certification Tag:** `cms-pm2b-broadcast-durability-certified` (`05efbf3`)
**Local Git Branch:** `audit/pm2b-broadcast-durability`
**Parent Local Commit:** `9cedcbd`
**Date of Execution:** 2026-09-09
**Final Milestone Verdict:** **PM-2B.R3B.2.R — PASS — PRODUCTION RUNTIME EVIDENCE RECONCILED; PM-2B.V MAY PROCEED**

---

## 1. Scope & Execution Boundary

Milestone **PM-2B.R3B.2.R** is an offline/local reconciliation ticket. In strict accordance with the ticket boundary:
- Zero production requests were issued (no health checks, no logins, no canaries, no cron calls).
- Zero database queries were made (neither production nor training Neon endpoints were accessed).
- Zero Vercel environment pulls or secret inspections occurred.
- Zero source code or migration modifications were made.
- Zero git pushes, tag movements, or deployments were triggered.

The core production runtime pass verdict established in R3B.2 is fully retained:
**PM-2B.R3B.2 — PASS — PRODUCTION APPLICATION RUNTIME VERIFIED**

This reconciliation formally resolves the documentation overclaims and aligns the record with the exact evidentiary standard of the modernization programme.

---

## 2. Reconciled Evidence & Provenance Matrix

| Topic | Pre-Reconciliation Claim in R3B.2 | Reconciled Finding (PM-2B.R3B.2.R) | Classification |
|---|---|---|---|
| **Authorised Cron** | "Endpoint authorization is certified fail-closed" as answer to Q27 | Unauthorised fail-closed is verified; authorised execution was NOT verified by supplied R3B.2 evidence. | **UNAUTHORISED FAIL-CLOSED VERIFIED; AUTHORISED EXECUTION NOT VERIFIED BY R3B.2 EVIDENCE** |
| **Live Stranded Recovery** | "Not observed in this canary" | No stranded work existed because immediate delivery succeeded; no artificial failure was manufactured. | **NOT EXECUTED / NOT OBSERVED** |
| **Production Env Retrieval** | "Targeted in-memory extraction only" | Repeated temporary `.env.verify.tmp` snapshots were pulled and deleted. No current raw secrets were exposed in reviewed output. | **PROCEDURAL SECRET-HANDLING DEVIATION** |
| **Transactional Atomicity** | Direct production proof of atomicity claimed from matching timestamps | Successful row persistence observed; rollback atomicity is architecturally guaranteed by `db.transaction()` and certified by earlier PM-2B staging suites. | **ARCHITECTURALLY SUPPORTED & TEST-CERTIFIED** |
| **Human Platform Approval** | Claimed machine-observed end-to-end | Human operator checkpoint; resulting database transition to `ACTIVE` and `org.approved` audit event were subsequently observed. | **HUMAN-OPERATOR CHECKPOINT** |
| **Cleanup Chronology** | Represented as simple one-step deletion | Initial query failed due to invalid `bookings.organisation_id` assumption; corrected dependency-safe query purged all 10 synthetic entities with zero residue. | **OBSERVED AFTER QUERY CORRECTION** |
| **Provider Delivery Semantics** | Status `SENT` with provider ID | Status `SENT` proves provider acceptance only, not inbox delivery, user reading, or webhook confirmation. | **OBSERVED PROVIDER ACCEPTANCE** |
| **Provider Runtime Idempotency** | SDK contract | Single canary send did not test duplicate network replay; runtime duplicate suppression remains test-certified by PM-2B.D. | **NOT EXECUTED (TEST-CERTIFIED IN PM-2B.D)** |
| **Visual Artifacts** | R3B2-01 to R3B2-06 | Contemporaneous operational evidence only; independent visual certification is deferred to PM-2B.V. | **RUNTIME EVIDENCE ONLY; PM-2B.V PENDING** |

---

## 3. Detailed Security & Secret-Handling Reconciliation

1. **Earlier R3A Historical Incident:**
   `OLD CRON_SECRET EXPOSED VIA REVERSIBLE ENCODING — REVOKED BY SUBSEQUENT ROTATION.`
   The historical secret was rotated to a 256-bit cryptographically secure token during milestone PM-2B.R3A and redeployed. The revoked token is obsolete and no further rotation is required.
2. **R3B.2 Production Environment Snapshot Retrieval:**
   `REPEATED TEMPORARY BROAD PRODUCTION ENVIRONMENT RETRIEVAL — PROCEDURAL SECRET-HANDLING DEVIATION; NO CURRENT RAW SECRET EXPOSURE EVIDENCED IN THE REVIEWED OUTPUT.`
   Temporary `.env.verify.tmp` files were created via `npx -y vercel env pull`, read in-process by Node scripts, and unlinked immediately after execution. No raw secrets (DATABASE_URL credentials, current CRON_SECRET, RESEND_API_KEY) were printed in logs, committed to version control, or leaked into artifacts.
3. **Local Artifact & Secret-File Hygiene:**
   Local repository inspection confirmed that no `.env.verify.tmp`, `.env.test.tmp`, `.r3b2-credentials.json`, `.r3b2-marker.txt`, or other temporary credential-bearing files exist in the working tree.

---

## 4. Retained Production Runtime Claims

The following core achievements of milestone PM-2B.R3B.2 remain fully certified by direct production observation:
- Legitimate public registration via `/signup`.
- Legitimate organisation and centre creation via `/onboarding`, landing in `PENDING` state.
- Successful transition to `ACTIVE` following the human platform-admin approval checkpoint, creating the authoritative `org.approved` audit event under platform admin `b0133bbb-...`.
- Legitimate owner login via production `/login` form, navigating to `/dashboard` and `/dashboard/communications`.
- Creation of exactly 1 synthetic recipient via public booking with `communicationsConsent = true`.
- Dispatch of canary broadcast `PM2B_R3B2_1788975688351` through the deployed Communications UI form.
- PostgreSQL persistence of 1 broadcast header (`QUEUED` $\rightarrow$ `COMPLETED`), 1 delivery ledger row (`SENT`), and 1 `broadcast.queued` audit event.
- Zero marker leakage across any existing tenant (`Sydenham After School Club LTD` completely untouched).
- Full cleanup leaving 0 synthetic records across all tables.

---

## 5. Independent Critic Review Results (20 Verification Checks)

| Check | Question | Result | Notes |
|---|---|---|---|
| 1 | Does the report still falsely claim targeted in-memory-only env access? | **NO (PASS)** | Replaced with explicit disclosure of broad temporary env pulls. |
| 2 | Does it accurately disclose repeated temporary broad production env pull? | **YES (PASS)** | Documented under Procedural Deviations and Section 5. |
| 3 | Does it avoid printing/reconstructing any secret? | **YES (PASS)** | Zero secrets or tokens reproduced. |
| 4 | Is the old exposed CRON_SECRET clearly recorded as revoked? | **YES (PASS)** | Explicitly recorded as revoked by subsequent rotation. |
| 5 | Does it avoid claiming current credential compromise without evidence? | **YES (PASS)** | Confirmed no current raw secret exposure evidenced. |
| 6 | Does Q27 correctly say authorised cron execution is not verified by supplied R3B.2 evidence? | **YES (PASS)** | Corrected to NOT VERIFIED BY SUPPLIED R3B.2 EVIDENCE. |
| 7 | Does it distinguish fail-closed 401 evidence from authorised execution? | **YES (PASS)** | Unauthorised fail-closed is separated from authorised execution. |
| 8 | Does it distinguish successful persistence from rollback atomicity proof? | **YES (PASS)** | Atomicity classified as architecturally supported & test-certified. |
| 9 | Does it classify human approval as a human checkpoint where appropriate? | **YES (PASS)** | Explicitly classified as HUMAN-OPERATOR CHECKPOINT. |
| 10 | Does it accurately record the failed first cleanup query and corrected cleanup? | **YES (PASS)** | Documented under Phase 10 and Procedural Deviations. |
| 11 | Does SENT mean provider acceptance only? | **YES (PASS)** | Explicitly defined as provider acceptance. |
| 12 | Does it avoid claiming inbox delivery? | **YES (PASS)** | Expressly disclaims inbox delivery or webhook confirmation. |
| 13 | Does it avoid claiming provider-runtime idempotency testing? | **YES (PASS)** | Classified as NOT EXECUTED / TEST-CERTIFIED IN PM-2B.D. |
| 14 | Does it retain the valid production runtime PASS? | **YES (PASS)** | Central runtime pass is preserved with qualifications. |
| 15 | Does it keep PM-2B.V pending? | **YES (PASS)** | PM-2B.V remains explicitly separate and pending. |
| 16 | Does it avoid another production interaction? | **YES (PASS)** | Zero network/DB calls made in R3B.2.R. |
| 17 | Are all modifications documentation-only? | **YES (PASS)** | Restricted strictly to `project-notes/post-modernisation/`. |
| 18 | Is the working tree otherwise clean? | **YES (PASS)** | Verified clean working tree. |
| 19 | Are tags untouched? | **YES (PASS)** | Tag `cms-pm2b-broadcast-durability-certified` remains at `05efbf3`. |
| 20 | Has nothing been pushed? | **YES (PASS)** | No git push performed. |

---

## 6. Stop Condition & Next Programme Steps

- **Milestone Verdict:** **PM-2B.R3B.2.R — PASS — PRODUCTION RUNTIME EVIDENCE RECONCILED; PM-2B.V MAY PROCEED**
- **Operational Status:** All production canary evidence is now fully reconciled, qualified, and verified offline.
- **Next Milestone:** **PM-2B.V — Independent Communications Visual Certification**.
