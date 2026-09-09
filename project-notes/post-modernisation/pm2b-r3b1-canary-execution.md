# PM-2B.R3B.1 — Legitimate Synthetic Tenant Authentication & Production Canary Execution Report

**Programme:** SprintScale CMS Modernisation Programme  
**Milestone:** PM-2B.R3B.1 — Legitimate Synthetic Tenant Authentication & Production Application-Runtime Broadcast Canary Resume  
**Target Domain:** `https://app.sprintscaleit.co.uk`  
**Production Database:** Neon PostgreSQL (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`)  
**Parent Candidate SHA:** `05efbf3cb917b6a501f00382d88fa88108a31a5f`  
**Certification Tag:** `cms-pm2b-broadcast-durability-certified` (`05efbf3`)  
**Local Git Branch:** `audit/pm2b-broadcast-durability`  
**Date of Execution:** 2026-09-09  
**Final Milestone Verdict:** **HOLD — LEGITIMATE PLATFORM APPROVAL NOT AVAILABLE**

---

## 1. Executive Summary

Milestone **PM-2B.R3B.1** was initiated to execute a controlled production application-runtime broadcast canary on `https://app.sprintscaleit.co.uk` by resolving the authentication blocker of PM-2B.R3B through a legitimate synthetic tenant lifecycle:
1. Public registration via deployed `/signup` with operator-controlled credentials.
2. Organisation and centre creation via deployed `/onboarding`.
3. Transition from `PENDING` to `ACTIVE` strictly through the genuine platform-admin application interface (`/platform/organisations`).

Under the strict operational constraints of milestone PM-2B.R3B.1:
- Zero application code modifications, zero schema changes, zero deployments, and zero git tag movements were permitted.
- Session manufacture via `AUTH_SECRET`, session injection, direct database state mutations (`UPDATE organisations SET approval_status = 'ACTIVE'`), and password hash manipulations were strictly forbidden.
- Per Section 7 of the milestone ticket:
  > *"The new organisation must be approved through the actual deployed platform-admin application workflow. Preferred: `/platform/organisations`. Use an already legitimate platform-admin session/account. DO NOT: modify PLATFORM_ADMIN_EMAILS, manufacture platform-admin auth, UPDATE organisations via SQL, INSERT org.approved manually. If a legitimate platform-admin session/account is unavailable: STOP. Verdict: **`HOLD — LEGITIMATE PLATFORM APPROVAL NOT AVAILABLE`**."*

### Key Operational Findings:
1. **Git Baseline Integrity:** Verified clean working tree on branch `audit/pm2b-broadcast-durability`. The candidate release lineage cleanly preserves the certified tag `cms-pm2b-broadcast-durability-certified` (`05efbf3cb917b6a501f00382d88fa88108a31a5f`).
2. **Production Health:** Verified `GET https://app.sprintscaleit.co.uk/api/health` returned HTTP 200 `{"ok":true}`.
3. **Platform Admin Interface Dependency:**
   - The deployed platform approval server action (`approveOrg` in `src/app/platform/organisations/actions.ts`) enforces `requirePlatformAdmin()`.
   - `requirePlatformAdmin()` requires an authenticated session matching `PLATFORM_ADMIN_EMAILS`.
   - Production environment inspection confirmed `PLATFORM_ADMIN_EMAILS="kaddo@sydenhamasc.co.uk"`.
   - Authoritative production database inspection confirmed user `b0133bbb-e915-4caf-a508-4b3e041b8f3d` (`kaddo@sydenhamasc.co.uk`) authenticates solely via Google OAuth (`has_password: false`, provider: `google`, provider account IDs: `117511884225743932661`, `110765294012218238519`).
4. **Legitimate Platform Approval Gate Evaluation:**
   - In an automated execution environment, completing interactive Google OAuth for `kaddo@sydenhamasc.co.uk` is impossible without human interactive sign-in or session cookie injection.
   - Injecting cookies or manufacturing JWTs is strictly prohibited by PM-2B.R3B.1 safety rules.
   - SQL update to bypass approval is explicitly prohibited.
   - Per the explicit gate condition in Section 7 of the ticket, execution must immediately halt with verdict **`HOLD — LEGITIMATE PLATFORM APPROVAL NOT AVAILABLE`**.
5. **Zero Production Mutation:**
   - No synthetic tenant was created to leave orphaned `PENDING` records in the live database.
   - All live customer organisations (`Sydenham After School Club LTD`, `Norbert Agyei`, and `Tester's College LTD`) remain 100% untouched.
   - Zero broadcasts and zero deliveries were dispatched.

---

## 2. Evidence Matrix & Phase Verification

| Phase | Milestone Requirement | Observed Reality / Evidence | Classification |
|---|---|---|---|
| **Phase 1: Environment Baseline** | Clean git tree on candidate SHA, prod health check 200, DB host confirmed | Git status clean on `audit/pm2b-broadcast-durability`. `/api/health` = 200 `{"ok":true}`. Production DB host: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`. | **PASS** |
| **Phase 2: Disposable Synthetic Tenant Registration** | Complete real `/signup` and `/onboarding` without session forgery | Evaluated against Phase 3 gate. Creating the tenant before ensuring platform approval would leave an unapproved PENDING orphan. Suspended pending platform admin availability. | **SUSPENDED BY GATE** |
| **Phase 3: Legitimate Platform Approval Gate** | Approve new organisation through `/platform/organisations` via legitimate platform admin account | Platform admin is `kaddo@sydenhamasc.co.uk`, authenticated exclusively via Google OAuth (`has_password: false`). No active admin session available. Session manufacture and SQL mutation strictly prohibited. | **FAIL (MANDATORY STOP GATE)** |
| **Phase 4: Authentic Owner Login** | Log in via `/login` with credentials from Phase 2 | Dependent on Phase 2 & 3. | **BLOCKED** |
| **Phase 5: Single Synthetic Recipient & Consent** | Create 1 recipient via `POST /api/bookings` with `communicationsConsent: true` | Dependent on Phase 4. | **BLOCKED** |
| **Phase 6: Single Controlled Canary Broadcast** | Trigger broadcast via real Communications UI | Dependent on Phase 4. | **BLOCKED** |
| **Phase 7: PostgreSQL Outbox Verification** | Verify atomic header, delivery, and audit log creation | Dependent on Phase 6. | **BLOCKED** |
| **Phase 8: Post-Commit Processing / Cron Recovery** | Verify delivery dispatch and recovery sweeper fail-closed auth | Auth verified fail-closed (401 without Bearer, 401 with bad Bearer). Dispatch blocked. | **PASS (Cron security) / BLOCKED (Canary)** |
| **Phase 9: Strict Cleanup** | Purge all synthetic canary data in tenant | No canary mutations created; residual counts in all tenants remain zero canary rows. | **PASS** |
| **Phase 10: Final Independent Review** | Complete independent review answering all 40 questions | Completed by Independent Critic Agent. | **PASS** |

---

## 3. Mandatory Independent Critic Review (40 Questions)

### Baseline & Environment Identity
1. **Was git status verified clean before any canary action?**  
   *Yes. `git status --porcelain` returned empty output.*
2. **Did HEAD match the expected candidate lineage without unexpected drift?**  
   *Yes. HEAD is `41306c5` (recording R3B documentation), descending cleanly from candidate tag `cms-pm2b-broadcast-durability-certified` (`05efbf3`).*
3. **Was the production health endpoint verified before any mutation?**  
   *Yes. `curl -i -s https://app.sprintscaleit.co.uk/api/health` returned HTTP 200 `{"ok":true}`.*
4. **Is the target database host confirmed as the genuine production database?**  
   *Yes. Confirmed as `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`.*
5. **Were all live customer organisations protected from mutation?**  
   *Yes. `Sydenham After School Club LTD` (`8049f803-...`), `Norbert Agyei` (`3fd8fad0-...`), and `Tester's College LTD` (`6847207c-...`) were completely untouched.*

### Disposable Synthetic Tenant & Registration
6. **Was the disposable synthetic tenant created through the public /signup and /onboarding routes?**  
   *No. Tenant creation was suspended prior to database writes when the platform approval gate was found blocked.*
7. **Were all synthetic names and emails clearly marked with Canary / PM2B / disposable prefixes?**  
   *Yes. Planned credentials conformed to `kwadwo.addo+canary<timestamp>@sprintscaleit.co.uk`.*
8. **Was the newly created tenant initially in PENDING status in the database?**  
   *N/A — Tenant creation suspended to avoid leaving unapprovable orphan records.*
9. **Did the new owner credentials use a fresh, uncommitted password?**  
   *Yes. Generated in memory, never written to disk, version control, or logs.*
10. **Was the tenant ID recorded for scoped cleanup?**  
    *N/A — No tenant ID generated.*

### Platform Approval Gate
11. **Was the new organisation approved through the actual deployed platform-admin workflow (/platform/organisations)?**  
    *No. Platform admin approval was not accessible legitimately.*
12. **Did the platform-admin identity come from a legitimate session/account?**  
    *No legitimate platform-admin session was active or accessible.*
13. **Was PLATFORM_ADMIN_EMAILS left untouched in the environment?**  
    *Yes. Verified unchanged: `PLATFORM_ADMIN_EMAILS="kaddo@sydenhamasc.co.uk"`.*
14. **Was any platform-admin session manufactured or forged?**  
    *No. JWT forging via `AUTH_SECRET` and cookie injection were strictly rejected.*
15. **Was approval achieved without direct SQL UPDATE to organisations?**  
    *Yes. No SQL mutations were performed.*
16. **Did the approval write an authoritative org.approved audit event via the application runtime?**  
    *N/A — Approval action not invoked.*

### Test Tenant Owner Authentication
17. **Did the synthetic tenant owner authenticate through the real deployed /login route?**  
    *No. Gated by lack of platform approval.*
18. **Was authentication completed with the credentials created during /signup?**  
    *No. Gated.*
19. **Was any session token manufactured or injected using AUTH_SECRET?**  
    *No. Session manufacture was strictly avoided.*
20. **Were any database sessions created directly in PostgreSQL?**  
    *No. Zero database sessions were inserted.*
21. **Did the synthetic owner access /dashboard and /dashboard/communications through real authenticated navigation?**  
    *No. Navigation gated.*

### Fixture & Consent
22. **Was the synthetic recipient created through a real application workflow?**  
    *No canary recipient was created during this run.*
23. **Was the synthetic recipient email address owned by the test operator?**  
    *Yes, reserved operator email `kwadwo.addo+canary@sprintscaleit.co.uk` was designated.*
24. **Was communications consent derived from a real booking record rather than manually updated?**  
    *No booking record was inserted during this run.*
25. **Did the consent resolution logic resolve exactly 1 eligible recipient before sendBroadcast()?**  
    *N/A — Not executed.*

### Application Runtime & Outbox
26. **Was sendBroadcast() executed through the deployed application runtime?**  
    *No. Blocked by upstream approval gate.*
27. **Did sendBroadcast() commit the broadcast header, delivery row, and audit event atomically?**  
    *N/A — Not executed.*
28. **Did the broadcast header initially record status 'QUEUED' and recipient_count 1?**  
    *N/A — Not executed.*
29. **Did exactly 1 broadcast_deliveries row exist for the canary recipient with status 'PENDING'?**  
    *N/A — Not executed.*
30. **Did the delivery row contain the immutable subject and message snapshot?**  
    *N/A — Not executed.*
31. **Was the audit event 'broadcast.queued' written with the expected payload?**  
    *N/A — Not executed.*

### Recovery & Provider Observation
32. **Was immediate provider delivery observed, or was post-commit processing skipped?**  
    *N/A — Not executed.*
33. **If immediate dispatch executed, what were the final statuses of the broadcast and delivery?**  
    *N/A — Not executed.*
34. **Was any live delivery stranded without artificial database corruption?**  
    *No stranded deliveries occurred; no artificial mutation was attempted.*
35. **Was /api/cron/broadcasts executed with authorised credentials?**  
    *Production cron authentication was previously certified in PM-2B.R3A / R3A.R. Missing and invalid tokens fail closed with 401.*
36. **Did the cron route process remaining work and advance state?**  
    *N/A — Zero pending delivery rows existed.*
37. **Were any unrelated cron endpoints called during R3B.1?**  
    *No. Neither billing nor reminders cron endpoints were touched.*

### Tenant Isolation & Cleanup
38. **Did any canary record escape into another organisation?**  
    *No. No canary records were created.*
39. **Were Sydenham records checked and proven untouched before and after?**  
    *Yes. Verified: 0 broadcasts and 0 deliveries exist in Sydenham.*
40. **Did cleanup leave all tenants in their expected clean state?**  
    *Yes. Verified: 0 broadcasts and 0 deliveries across all organisations.*

---

## 4. Root Cause Analysis & Path to Final Certification

### The Dual Authentication Constraint
To prove PM-2B durability in production through the real deployed application runtime, two separate authentication boundaries must be crossed without artificial bypass:
1. **Tenant Owner Authentication:** Requires logging into `/login` as an `ORG_OWNER` or `MANAGER` of an `ACTIVE` organisation.
2. **Platform Admin Authentication:** Required to transition any newly created tenant from `PENDING` to `ACTIVE` via `/platform/organisations`.

### Current State of Production Accounts:
1. **Existing Active Test Tenant (`Tester's College LTD`):**
   - Organisation status: `ACTIVE`.
   - Dedicated synthetic test tenant with 0 live parents or bookings.
   - Owner user: `c74288a1-d51e-4298-8013-b43adbd3e2e4` (`kwadwoaddo+tester@gmail.com`).
   - Authentication method: `credentials` (`has_password: true`).
   - **Blocker:** Plaintext password is unrecorded.
2. **Platform Admin Account:**
   - Platform admin email: `kaddo@sydenhamasc.co.uk`.
   - User: `b0133bbb-e915-4caf-a508-4b3e041b8f3d`.
   - Authentication method: `google` OAuth only (`has_password: false`).
   - **Blocker:** Automated headless tools cannot complete interactive Google OAuth without human interaction or session token injection.

### Unambiguous Next Step for Human Operator:
To unblock the canary without violating production safety gates:
- **Option A (Simplest & Direct):** Operator provides the plaintext password for `kwadwoaddo+tester@gmail.com`. This allows immediate login to `Tester's College LTD` via `/login`, bypassing the need for new platform approval.
- **Option B (Interactive Platform Approval):** The automated agent registers a fresh synthetic tenant via `/signup` and `/onboarding`, and pauses while the human operator signs into `https://app.sprintscaleit.co.uk/platform/organisations` via Google OAuth and clicks "Approve". Once approved, the agent resumes execution as the synthetic tenant owner.
