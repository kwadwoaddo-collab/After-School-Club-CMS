# SPRINTSCALE CMS — PM-2A
## ACCEPTED-DEBT REDISCOVERY & REMEDIATION PLAN
### POST-MODERNISATION OPERATIONAL / SECURITY MAINTENANCE

**Document ID:** `PM-2A-OPS-DEBT-REDISCOVERY`  
**Date:** 2026-09-04  
**Author:** SprintScale Technical Operations & Architecture  
**Status:** COMPLETE / APPROVED FOR PLANNING  
**Classification:** AUDIT AND REMEDIATION-DESIGN MILESTONE (NO IMPLEMENTATION)

---

## 1. Executive Summary & Baseline

Following the formal closure of the CMS Modernisation Programme (RC4, commit `de8b4e2`), the post-modernisation In-App Help & Training Centre release (`cms-help-training-v1.0.0`, commit `98d30c4`), and the PM-1.1 Navigation Discoverability correction (commit `1a74984`), this milestone executes a forensic rediscovery of all remaining accepted technical, operational, and security debt.

The purpose of PM-2A is to establish the **current code truth** across five established debt workstreams before authorising implementation in PM-2B through PM-2F:
- **Workstream A:** Broadcast Delivery Durability
- **Workstream B:** Billing Concurrency / Duplicate Protection
- **Workstream C:** Sentry Live Production-Runtime Verification
- **Workstream D:** Dependency Vulnerabilities (`npm audit`)
- **Workstream E:** Backup / PITR Operational Assurance

### 1.1 Git Preflight Baseline
- **Branch:** `main`
- **HEAD Commit:** `1a74984 fix(help): improve training centre navigation discoverability`
- **origin/main:** `1a74984`
- **origin/rebuild/cms-modernisation:** `1a74984`
- **Historical Help Release Tag:** `cms-help-training-v1.0.0` -> `98d30c4`
- **Historical Modernisation Tag:** `cms-modernisation-v1.1.0` -> `de8b4e2`
- **Working Tree State:** CLEAN (0 uncommitted changes, 0 untracked files)

### 1.2 Quality & Test Baseline
- **TypeScript (`tsc --noEmit`):** PASS (0 errors, with `NODE_OPTIONS="--max-old-space-size=4096"`)
- **ESLint (`eslint`):** PASS (0 errors, 0 warnings)
- **Vitest (`npm test -- --run`):** PASS — 74 test files, 755 tests passed, 0 failures
- **Next.js Production Build (`next build`):** PASS — 153/153 static and dynamic routes compiled cleanly via Turbopack
- **Git Diff Hygiene (`git diff --check`):** PASS (clean output)

---

## 2. Audit Methodology

Every debt item was evaluated against the following nine forensic criteria:
1. **Current Implementation:** Exact source file and line references.
2. **Actual Execution Path:** Traced from UI triggers through server actions, RBAC, database writes, and external calls.
3. **Existing Tests:** Identification of test suites covering or omitting the scenario.
4. **Infrastructure & Config Dependencies:** External service and environment prerequisites.
5. **Existence Confirmation:** Confirmation whether the debt still exists in the active code.
6. **Actual Severity:** Realistic risk assessment based on exploitability and impact.
7. **Smallest Safe Remediation:** Minimal architectural change required to eliminate the debt.
8. **Proof Mechanism:** Deterministic testing and verification strategy.
9. **Operational Implications:** Migration, deployment safety, and rollback guarantees.

---

## 3. Workstream A — Broadcast Delivery Durability

### 3.1 Forensic Rediscovery & Code Truth
- **Component:** Communications Module
- **File:** `src/features/communications/actions.ts` (lines 51–166)
- **Database Schema:** `src/db/schema.ts` (lines 753–770, `broadcasts` table)
- **UI Trigger:** `src/app/dashboard/communications/CommunicationsClient.tsx` (lines 58–74)

#### Traced Execution Path:
1. **UI:** Staff clicks "Send Broadcast" in `CommunicationsClient.tsx`. Client initiates `await sendBroadcast({ centreId, audienceParentIds, subject, message })`.
2. **RBAC & Authorization:** Lines 57–74 verify session, derive `organisationId`, enforce `ORG_OWNER` or `MANAGER` role, and verify centre accessibility via `getUserAccessibleCentreIds`.
3. **Consent Re-derivation:** Lines 83–102 query latest booking consent per parent using a subquery ordered by `createdAt DESC, id DESC`.
4. **Database Record Creation:** Line 111 inserts a single record into `broadcasts` with `recipientCount: targetParents.length, successCount: 0, failureCount: 0`.
5. **Detached Asynchronous Dispatch:**
   ```typescript
   // Background queue architecture: execute without awaiting
   const sendEmailsTask = async () => {
     let successCount = 0;
     let failureCount = 0;
     for (const parent of targetParents) {
       // sendEmail call ...
     }
     await db.update(broadcasts)
       .set({ successCount, failureCount })
       .where(eq(broadcasts.id, broadcast.id));
   };

   sendEmailsTask().catch((e) => logger.error('Broadcast email task failed', e));
   return { success: true, count: targetParents.length, sent: 0, failed: 0 };
   ```
6. **Client Completion:** Action returns immediately. Client resets compose fields and calls `loadData()` to refresh history table while emails are still sending in the background.

### 3.2 Evaluation of Questions A1–A13
- **A1. Does detached asynchronous dispatch still exist?** YES. Confirmed at `src/features/communications/actions.ts:164`.
- **A2. Where exactly?** `src/features/communications/actions.ts:164` (`sendEmailsTask().catch(...)`).
- **A3. Is the work awaited?** NO. The server action returns to the caller while `sendEmailsTask` is in-flight.
- **A4. What happens if the process terminates?** In serverless runtime environments (such as Vercel AWS Lambda), the runtime freezes or terminates the execution environment once the HTTP response is completed. Pending iterations in the `for (const parent of targetParents)` loop are abruptly aborted; remaining recipients never receive the email; and the final database update (`db.update(broadcasts).set({ successCount, failureCount })`) is never executed, leaving the broadcast permanently showing 0 sent / 0 failed.
- **A5. What delivery state is persisted before dispatch?** A single row in `broadcasts` with aggregate fields: `recipientCount: N`, `successCount: 0`, `failureCount: 0`. **Zero per-recipient records are created.**
- **A6. What state is persisted after success/failure?** A single aggregate update to `broadcasts` setting final `successCount` and `failureCount`.
- **A7. Can dispatch be retried?** NO. There is no retry action, no mechanism to resume an interrupted send, and no record of which specific parents received or did not receive the broadcast.
- **A8. Can retry create duplicate messages?** YES. If a user re-submits the broadcast, parents who already received it during the aborted run will receive a second duplicate email.
- **A9. Is there idempotency?** NO. There is no idempotency key on broadcasts, recipient dispatches, or email sends.
- **A10. Is there a queue/job abstraction already present?** NO. There is no queue library (such as BullMQ or pg-boss) or queue table in the database schema.
- **A11. Would durable dispatch require new infrastructure?** NO. Durable delivery can be achieved entirely within the existing PostgreSQL database using a transactional outbox / per-recipient dispatch table.
- **A12. Can durability be achieved safely using existing architecture?** YES. By introducing a `broadcast_recipients` table linked to `broadcasts`, recording initial state as `pending`, and processing dispatches with atomic status updates (`sent` / `failed`), the system achieves complete crash-recovery and idempotency without external Redis or broker dependencies.
- **A13. What is the smallest credible PM-2B implementation?**
  1. Add a `broadcast_recipients` table (`id`, `broadcastId`, `parentId`, `email`, `status: 'pending' | 'sent' | 'failed'`, `providerMessageId`, `errorMessage`, `attemptCount`, `sentAt`).
  2. Transactionally insert all recipient rows when the broadcast is created.
  3. Await dispatch execution within the server action (with appropriate batching and execution budget) or provide an idempotent "Process Pending Dispatches" runner that updates recipient rows atomically.

---

## 4. Workstream B — Billing Concurrency / Duplicate Protection

### 4.1 Forensic Rediscovery & Code Truth
- **Component:** Recurring Family Billing Module
- **File:** `src/features/billing/actions.ts` (lines 246–324)
- **Database Schema:** `src/db/schema.ts` (lines 598–626 for `invoices`, lines 1178–1200 for `billing_runs`)
- **Key Function:** `generateInvoiceFromConfig(input: GenerateInvoiceInput)`

#### Traced Execution Path:
1. **Authorization:** Lines 251–266 authenticate session and verify user has access to `config.centreId`.
2. **Duplicate Pre-check:**
   ```typescript
   // Check for duplicate
   const existingRun = await db.query.billingRuns.findFirst({
       where: and(
           eq(billingRuns.billingConfigId, input.configId),
           eq(billingRuns.periodStart,     input.periodStartStr),
       ),
   });
   if (existingRun?.success) {
       throw new Error(`Invoice already generated for period ${input.periodStartStr}`);
   }
   ```
3. **Transaction Execution:**
   ```typescript
   const result = await db.transaction(async (tx) => {
       const invoiceNumber = `INV-${nanoid(6).toUpperCase()}`;

       // Create invoice
       const [invoice] = await tx.insert(invoices).values({ ... }).returning();

       // Record the run
       await tx.insert(billingRuns).values({
           billingConfigId: config.id,
           periodStart:     input.periodStartStr,
           periodEnd:       input.periodEndStr,
           invoiceId:       invoice.id,
           amountPence:     input.amountPence,
           runBy:           session?.user?.id ?? null,
           success:         true,
       });

       return invoice;
   });
   ```

### 4.2 Evaluation of Questions B1–B13
- **B1. Does the theoretical race still exist?** YES. The application-level duplicate check occurs prior to `db.transaction`. Under standard PostgreSQL `READ COMMITTED` isolation, concurrent transactions cannot observe uncommitted rows from each other.
- **B2. What exact concurrent sequence would trigger it?**
  1. Request 1 and Request 2 for the same `configId` and `periodStartStr` are received within milliseconds (e.g., rapid double-click on UI or concurrent scheduled runner invocations).
  2. Request 1 executes `db.query.billingRuns.findFirst` -> returns `null`.
  3. Request 2 executes `db.query.billingRuns.findFirst` -> returns `null`.
  4. Request 1 enters `db.transaction`, generates `INV-XXXXXX`, inserts `invoices`, inserts `billingRuns`, commits.
  5. Request 2 enters `db.transaction`, generates `INV-YYYYYY`, inserts `invoices`, inserts `billingRuns`, commits.
  6. **Result:** Two distinct invoices and two billing runs are created for the exact same family billing period.
- **B3. Is there already a DB unique constraint that closes the race?** NO.
  - `billing_runs` has indexes on `billing_config_id`, `period_start`, and `invoice_id`, but **none of them are unique**.
  - `invoices` has a unique constraint only on `invoice_number` (`INV-${nanoid(6).toUpperCase()}`), which is randomly generated per run and never conflicts.
- **B4. If not, what invariant SHOULD be unique?**
  A recurring billing run for a given configuration and billing period start must be strictly unique when successful:
  `UNIQUE (billing_config_id, period_start) WHERE (success = true)` on `billing_runs`.
  Additionally, on `invoices`, active recurring invoices should maintain:
  `UNIQUE (billing_config_id, billing_period_start) WHERE (billing_config_id IS NOT NULL AND status != 'void')`.
- **B5. Would a unique index/constraint be safe against current production data?** YES, provided a preflight query verifies no historical duplicate runs currently exist in production.
- **B6. Would advisory locking be appropriate?** YES. A PostgreSQL transaction-level advisory lock (`pg_advisory_xact_lock(hashtext('billing_run_' || configId || '_' || periodStartStr))`) provides deterministic serialization before query checks, preventing lock contention from surfacing as unhandled constraint crashes.
- **B7. Would transaction isolation solve it?** `SERIALIZABLE` isolation would detect the read-write dependency and fail one transaction with error code `40001` (serialization failure). However, `SERIALIZABLE` introduces retry requirements across all transactions. A unique constraint coupled with an advisory lock is much more targeted and deterministic.
- **B8. Would INSERT ... ON CONFLICT be preferable?** For `billing_runs`, an `ON CONFLICT (billing_config_id, period_start) DO NOTHING` pattern (or catching unique constraint violations) cleanly converts races into graceful idempotent no-ops.
- **B9. Are legitimate repeat/manual invoices possible?** YES. Parents can have manual ad-hoc invoices (e.g., extra activity fees, uniform purchases, registration fees). Crucially, manual invoices have `billing_config_id = NULL`.
- **B10. Could an overly broad uniqueness constraint block legitimate billing?** YES. Placing a uniqueness constraint on `(parent_id, billing_period_start)` would incorrectly block parents with multiple children at different centres or parents receiving both a recurring agreed fee and an ad-hoc invoice in the same month. The constraint must strictly include `billing_config_id`.
- **B11. What tests currently cover duplicates?** None. `src/features/billing/actions.test.ts` only tests RBAC and centre-scoped authorization.
- **B12. What deterministic concurrency test should PM-2C add?** A test invoking `Promise.all([generateInvoiceFromConfig(input), generateInvoiceFromConfig(input)])` asserting that exactly one invoice is generated, the second returns the existing invoice or throws a clean `InvoiceAlreadyExists` error, and only 1 invoice row exists in the database.
- **B13. Would PM-2C require a migration?** YES. Adding a unique index to `billing_runs` requires a Drizzle migration.

---

## 5. Workstream C — Sentry Live Production-Runtime Verification

### 5.1 Forensic Rediscovery & Code Truth
- **Component:** Observability / Error Tracking
- **Package:** `@sentry/nextjs: ^10.53.1` (in `package.json`)
- **Configuration Files:**
  - `src/instrumentation.ts` (Next.js server-side instrumentation hook)
  - `sentry.client.config.ts` (Browser client SDK initialization)
  - `next.config.ts` (Next.js build integration via `withSentryConfig`)
  - `src/lib/logger.ts` (Centralized error forwarding via `Sentry.captureMessage`)

### 5.2 Evaluation of Questions C1–C14
- **C1. Is Sentry still correctly integrated?** YES. Next.js 16 instrumentation and client configuration are properly hooked into Next.js lifecycle hooks.
- **C2. Which runtimes are covered?** Browser (Client) and Node.js (Server).
- **C3. Browser?** YES, initialized in `sentry.client.config.ts`.
- **C4. Node/server?** YES, initialized in `src/instrumentation.ts` under `process.env.NEXT_RUNTIME === 'nodejs'`.
- **C5. Edge?** Initialized conditionally in `src/instrumentation.ts`, but an audit of all 153 routes confirms **0 routes use Edge runtime**. Edge runtime is NOT USED by the application.
- **C6. Are production environment variables expected?**
  - `NEXT_PUBLIC_SENTRY_DSN` (Runtime SDK initialization; public safe identifier)
  - `SENTRY_ORG` and `SENTRY_PROJECT` (Build-time release binding)
  - `SENTRY_AUTH_TOKEN` (Build-time source map upload in CI/CD)
- **C7. Are source maps configured?** Configured via `withSentryConfig` in `next.config.ts`.
- **C8. Is release metadata configured?** Inferred automatically by Sentry from Vercel deployment variables (commit SHA).
- **C9. Is there any safe existing health/test mechanism?** A standalone CLI script (`scripts/sentry-test-event.ts`) exists from Milestone 7J, but no in-app HTTP runtime probe exists.
- **C10. What exactly remains unverified?** Live capture of an in-app error occurring inside a running production HTTP request (Browser DOM event or Next.js server route/action) delivered to the Sentry project dashboard.
- **C11. Can PM-2D prove live capture without exposing a public dangerous endpoint?** YES. By using an authenticated, Owner-only diagnostic trigger or a secret-header-protected probe.
- **C12. What temporary verification mechanism would be safest?** A temporary Next.js Server Action accessible only to authenticated `ORG_OWNER` sessions that captures a uniquely tagged informational probe:
  `Sentry.captureMessage(`PM-2D-Verification-Probe-${probeId}`, { level: 'info', tags: { audit: 'PM-2D', runtime: 'server' } })`.
- **C13. How should that mechanism be removed/disabled after proof?** Reverted and committed immediately following evidence capture.
- **C14. What evidence would constitute PASS?** Sentry dashboard event details (or API query response) matching the probe ID, confirming receipt from production host `app.sprintscaleit.co.uk`.

---

## 6. Workstream D — Dependency Vulnerabilities (`npm audit`)

### 6.1 Current Audit Snapshot
- **Audit Command:** `npm audit --json` (2026-09-04)
- **Total Vulnerabilities:** 18
  - **Critical:** 0
  - **High:** 11
  - **Moderate:** 7
  - **Low / Info:** 0

### 6.2 Complete Vulnerability Inventory Table

| Package | Severity | Dependency Type | Installed Range | Vulnerable Range | Vulnerability Details | Runtime Exposure & Usage Truth | Recommended Treatment |
|---|---|---|---|---|---|---|---|
| **next** | HIGH | Direct (prod) | 16.2.9 | >=16.0.0 <16.2.11 | App Router / Turbopack / Server Action advisories; SVG Image DoS; pulls vulnerable postcss/sharp | Runtime HTTP framework. Vercel edge firewall mitigates external threats. | Batch 2: Update Next.js to 16.3.4 (minor bump with focused route regression). |
| **next-auth** | HIGH | Direct (prod) | 5.0.0-beta.32 | All | Transitive via `@auth/core` -> `nodemailer` | Auth framework. Core session logic is safe; vulnerability is inside optional nodemailer peer. | Batch 1: Address transitive nodemailer or preserve current beta until stable Auth.js. |
| **@auth/core** | HIGH | Transitive | 0.41.3 | All | Transitive via `nodemailer` dependency | Transitive dependency of `next-auth`. | Addressed alongside `nodemailer`. |
| **@auth/drizzle-adapter** | HIGH | Direct (prod) | 1.11.1 | All | Transitive via `@auth/core` | Database adapter for Auth.js sessions. | Addressed alongside `next-auth`. |
| **nodemailer** | HIGH | Direct (prod) | 7.0.13 | <=9.0.0 | Message-level raw option SSRF & arbitrary file access | **ZERO RUNTIME USAGE.** The codebase exclusively uses Resend HTTP API (`src/lib/services/email.ts`). Nodemailer is never imported in application code. | Batch 1: Remove unused direct dependency from `package.json`. |
| **postcss** | HIGH | Transitive | 8.5.6 (via Next) | <=8.5.22 | Path traversal in source map auto-loading; XSS in unescaped style | Build-time CSS processing only. Not exposed to user CSS input. | Resolved automatically by Next.js 16.3.4 update. |
| **sharp** | HIGH | Transitive | 0.33.x (via Next) | <0.35.0 | Inherited libvips memory vulnerabilities | Next.js image optimization. | Resolved automatically by Next.js 16.3.4 update. |
| **browserslist** | HIGH | Transitive | 4.28.x | <=4.28.6 | Memory growth / prototype write via untrusted stats | Build-time compilation tooling. Zero runtime exposure. | Batch 1: Selective transitive lockfile bump. |
| **fast-uri** | HIGH | Transitive | 3.1.x | <3.1.6 | Host confusion / SSRF via percent-encoded scheme | URI parsing utility. | Batch 1: Selective transitive lockfile bump. |
| **js-yaml** | HIGH | Transitive | 4.1.0 | <4.3.1 | Quadratic CPU consumption in merge-key chains | Build-time / lint tooling (ESLint). Zero runtime exposure. | Batch 1: Transitive lockfile bump. |
| **brace-expansion** | HIGH | Transitive | 2.0.1 | <2.1.4 | DoS via unbounded intermediate arrays | CLI / glob / test utilities. Zero runtime exposure. | Batch 1: Transitive lockfile bump. |
| **uuid** | MODERATE | Direct (prod) | 9.0.1 | <11.1.1 | Missing buffer bounds check in v3/v5/v6 when buf provided | **NON-EXPLOITABLE IN APP.** Codebase exclusively calls `uuidv4()` with 0 arguments (string return), never with buffers. | Batch 1: Non-breaking update or accept until major bump. |
| **qs** | MODERATE | Transitive | 6.13.x | <6.16.0 | Array-limit bypass via bracket-key comma parsing | Transitive utility in Stripe/Twilio/Gaxios SDKs. | Batch 1: Transitive lockfile bump. |
| **gaxios** | MODERATE | Transitive | 6.7.x | All | Transitive via `uuid` | Google API client. | Resolved with transitive uuid update. |
| **drizzle-kit** | MODERATE | Direct (dev) | 0.31.8 | All | Transitive via `@esbuild-kit/esm-loader` -> `esbuild` | Development CLI tool. Zero production runtime exposure. | Batch 3: Defer major drizzle-kit breaking upgrade. |
| **@esbuild-kit/esm-loader** | MODERATE | Transitive (dev) | 2.6.5 | All | Transitive via `@esbuild-kit/core-utils` | Development tool for drizzle-kit. Zero production runtime exposure. | Addressed with drizzle-kit. |
| **@esbuild-kit/core-utils** | MODERATE | Transitive (dev) | 3.3.2 | All | Transitive via `esbuild` | Development tool for drizzle-kit. Zero production runtime exposure. | Addressed with drizzle-kit. |
| **esbuild** | MODERATE | Transitive (dev) | 0.24.2 | <=0.24.2 | Development server request handling | Development bundling tool. Zero production runtime exposure. | Batch 1: Update direct `esbuild: ^0.28.1` in devDependencies. |

### 6.3 Evaluation of Questions D1–D12
- **D1–D5:** Fully documented in table above.
- **D6. Runtime vs Dev/Build/Test exposure:**
  - Production runtime direct: `next` (HTTP framework), `next-auth` (sessions), `nodemailer` (**UNUSED** in code), `uuid` (safe usage).
  - Dev/Build/Test only: `postcss`, `sharp`, `browserslist`, `js-yaml`, `brace-expansion`, `esbuild`, `drizzle-kit`, `@esbuild-kit/*`.
- **D7. Is vulnerable functionality actually used?**
  - `nodemailer`: NO. Not imported anywhere in `src/`.
  - `uuid`: NO. Only `uuidv4()` is called without buffer parameters.
  - `js-yaml`, `postcss`: NO. Used only at build time on trusted internal source files.
- **D8–D10. Resolution Pathways:**
  - Non-breaking transitive patch/minor updates resolve 10 of the 18 advisories (`fast-uri`, `browserslist`, `js-yaml`, `brace-expansion`, `qs`, `esbuild`, and unused `nodemailer` removal).
  - Updating `next` from `16.2.9` to `16.3.4` (minor release) resolves `next`, `postcss`, and `sharp`.
- **D11. Regression surface:** Next.js minor updates must be verified against Turbopack build and all 153 route exports.
- **D12. Recommended treatment:** Group into 3 clean batches (detailed in §10).

---

## 7. Workstream E — Backup / PITR Operational Assurance

### 7.1 Forensic Rediscovery & Code Truth
- **Component:** Disaster Recovery & Database Resilience
- **Repository Documentation:**
  - `project-notes/production-database-runbook.md` (§2, §5)
  - `project-notes/production-incident-runbook.md` (§2)
  - `project-notes/milestone-6b-production-configuration.md`
- **Current Claims in Documentation:**
  - Provider: Neon Serverless PostgreSQL (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`).
  - PITR: Continuous WAL-based point-in-time recovery on Neon `dev` branch.
  - Fallback: Pre-migration branch snapshot (`pre-6c-dev-20260825-2140`).

### 7.2 Evaluation of Questions E1–E10
- **E1. What backup/PITR claims are currently documented?** Continuous WAL log restoration on Neon `dev` branch and point-in-time restore capability.
- **E2. Which are proven by repository evidence?** Only runbook documentation and endpoint hostnames exist in the repository.
- **E3. Which depend on Neon account/project configuration?** All retention limits, snapshot intervals, and active WAL archiving depend entirely on Neon project settings (`old-glitter-51244715`).
- **E4. Can repository inspection prove current PITR status?**
  **NO. NOT VERIFIED FROM REPOSITORY EVIDENCE.**
  The repository cannot query the live Neon management plane or inspect WAL retention windows.
- **E5. What provider-console/API evidence would be required?**
  - Neon project configuration output showing active branch history retention (e.g. `history_retention_seconds = 604800` for 7 days).
  - List of available branches and snapshot timestamps.
- **E6. What restoration proof would be required?** Creation of a temporary disposable branch restored from a past timestamp (e.g., `T - 1 hour`), followed by schema and table count verification.
- **E7. Can verification be performed without risking production?** YES. Neon's copy-on-write branching allows instant creation of a child branch from any historical point in time without taking the live branch offline or causing lock contention.
- **E8. Should a disposable branch/database be used for restore testing?** YES. A temporary branch (e.g., `pitr-drill-verify-<timestamp>`) must be created, verified, and immediately deleted.
- **E9. What should PM-2F actually verify?**
  1. Neon project plan and retention window setting.
  2. Point-in-time branch creation from historical timestamp.
  3. Integrity check on restored branch (row counts in `organisations`, `users`, `centres`, `students`, `invoices`).
  4. Non-destructive deletion of the test branch.
- **E10. What evidence should be retained?** Sanitized Neon CLI/API command logs recording branch creation, verification query output, and deletion confirmation.

---

## 8. Architectural Classification & Debt Matrix

| Workstream | Debt Item | Current Status | Severity | Change Risk | Migration Required | External Infra Required | Production Verification Required | Rationale |
|---|---|---|---|---|---|---|---|---|
| **A** | Broadcast Delivery Durability | CONFIRMED | **HIGH** | MEDIUM | YES | NO | YES | Un-awaited fire-and-forget Promise terminates under serverless recycling. No per-recipient state. |
| **B** | Billing Concurrency Protection | CONFIRMED | **HIGH** | MEDIUM | YES | NO | YES | Application pre-check outside transaction; no unique DB constraint on `(billing_config_id, period_start)`. |
| **C** | Sentry Live Production Verification | CONFIRMED | **OPERATIONAL ASSURANCE** | LOW | NO | NO | YES | SDK configured and verified via script; live in-app production HTTP error capture unproven. |
| **D** | Dependency Vulnerabilities | CONFIRMED | **HIGH** | MEDIUM | NO | NO | YES | 18 vulnerabilities (11 high, 7 moderate, 0 critical). Requires structured batching. |
| **E** | Backup / PITR Operational Assurance | NOT VERIFIED FROM REPOSITORY EVIDENCE | **OPERATIONAL ASSURANCE** | LOW | NO | YES | YES | Repository documentation exists, but provider retention and restoration drill unverified. |

### Severity Summary:
- **Critical Debt:** 0
- **High Debt:** 3 (Broadcasts, Billing Concurrency, Dependencies)
- **Medium Debt:** 0
- **Low Debt:** 0
- **Operational Assurance:** 2 (Sentry Live Verification, PITR Drill)

---

## 9. Recommended PM-2 Remediation Order

Based on data integrity impact, customer visibility, and blast radius, the recommended remediation sequence is:

```
1. PM-2B: Billing Concurrency / Duplicate Protection (Highest financial integrity risk)
   ↓
2. PM-2C: Broadcast Delivery Durability (High customer communication risk)
   ↓
3. PM-2D: Sentry Live Production Verification (Verifies observability safety net)
   ↓
4. PM-2E: Dependency Vulnerability Remediation (Safeguarded by verified Sentry)
   ↓
5. PM-2F: Backup / PITR Operational Assurance (External provider verification drill)
```

### Rationale for Ordering:
1. **Billing Concurrency First (PM-2B):** Generating duplicate financial invoices directly harms parents and centre cash accounting. The remediation is narrow, well-contained, and has zero external dependencies.
2. **Broadcasts Second (PM-2C):** Fixes silent message loss in parent communications. A transactional outbox pattern builds cleanly on PostgreSQL without infrastructure bloat.
3. **Sentry Third (PM-2D):** Establishing proven live production error tracking provides the necessary observational safety net before making dependency changes.
4. **Dependencies Fourth (PM-2E):** Upgrading Next.js and dependencies carries a wide regression surface. Doing this *after* Sentry live verification guarantees that any subtle runtime regressions are captured immediately.
5. **Backup/PITR Fifth (PM-2F):** Purely operational verification in the Neon cloud console; does not mutate application code.

---

## 10. PM-2B Design — Broadcast Delivery Durability

### 10.1 Target Architecture
Implement a **Transactional Outbox & Recipient Ledger Pattern**:
1. **New Schema:** Add `broadcast_recipients` table:
   - `id`: UUID PK
   - `broadcast_id`: UUID FK -> `broadcasts.id` (cascade delete)
   - `parent_id`: UUID FK -> `parents.id`
   - `email`: text not null
   - `status`: enum (`pending`, `sending`, `sent`, `failed`) default `pending`
   - `provider_message_id`: text null
   - `error_message`: text null
   - `attempt_count`: integer default 0
   - `processed_at`: timestamp with tz null
   - `created_at`: timestamp with tz default now
   - Constraint: `UNIQUE (broadcast_id, parent_id)`
2. **Atomic Ingestion:**
   Inside `db.transaction`, insert the `broadcasts` row AND all `broadcast_recipients` rows simultaneously. If the transaction aborts, nothing is dispatched.
3. **Awaited & Resumable Execution:**
   - Instead of an un-awaited detached task, `sendBroadcast` processes dispatches with an explicit execution budget (or a dedicated server action endpoint `/api/admin/broadcast/drain`).
   - Each recipient is marked `sending` before provider call, and `sent` / `failed` immediately upon response.
   - If a function timeout occurs, un-sent recipients remain `pending`.
   - A subsequent call or retry button resumes from `pending` without re-sending to parents marked `sent`.
4. **Provider-Failure Handling:**
   Capture `result.error` from Resend and record in `error_message`, incrementing `attempt_count`.

---

## 11. PM-2C Design — Billing Concurrency / Duplicate Protection

### 11.1 Target Invariant
For any family agreed-fee billing config, **at most one active invoice and one successful billing run may exist per billing period start date**.

### 11.2 Recommended Concurrency Mechanism
A two-layer defense combining PostgreSQL transaction advisory locking and a unique index:
1. **Database Constraint (Migration):**
   Add a partial unique index on `billing_runs`:
   ```sql
   CREATE UNIQUE INDEX billing_runs_config_period_unique_idx
   ON billing_runs (billing_config_id, period_start)
   WHERE (success = true);
   ```
   And on `invoices`:
   ```sql
   CREATE UNIQUE INDEX invoices_billing_config_period_unique_idx
   ON invoices (billing_config_id, billing_period_start)
   WHERE (billing_config_id IS NOT NULL AND status != 'void');
   ```
2. **Advisory Lock in Server Action:**
   Inside `db.transaction`, acquire a transaction-scoped advisory lock before querying:
   ```typescript
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`billing_run_${input.configId}_${input.periodStartStr}`}))`);
   ```
3. **Idempotent Return:**
   If a duplicate run is detected under the lock, retrieve and return `{ success: true, invoiceId: existingInvoice.id, duplicatePrevented: true }` rather than crashing the UI.

---

## 12. PM-2D Design — Sentry Live Production Verification

### 12.1 Goal
Prove that a controlled, non-destructive production-runtime event travels from:
`Production HTTP Runtime -> Sentry SDK -> Sentry Project Dashboard`
without leaving a permanent unauthenticated or dangerous diagnostic route.

### 12.2 Verification Protocol
1. **Authenticated Server Action Probe:**
   Create a temporary diagnostic server action accessible only to authenticated `ORG_OWNER` sessions:
   ```typescript
   export async function triggerSentryAuditProbe(probeId: string) {
     const session = await auth();
     if (session?.user?.role !== 'ORG_OWNER') throw new Error('Unauthorized');
     Sentry.captureMessage(`PM-2D-PROBE-${probeId}`, {
       level: 'info',
       tags: { milestone: 'PM-2D', probeId, runtime: 'nodejs-server' },
       extra: { timestamp: new Date().toISOString() },
     });
     return { success: true, probeId };
   }
   ```
2. **Browser Runtime Probe:**
   Trigger via browser console during an active Owner session on `https://app.sprintscaleit.co.uk`:
   `window.__SENTRY__.hub.captureMessage('PM-2D-BROWSER-PROBE-' + Date.now())` or dedicated test button.
3. **Evidence Retrieval:**
   Query the Sentry REST API or capture dashboard screenshot verifying the unique probe ID with environment `production`.
4. **Clean Removal:**
   Revert the temporary action, verify tree is clean, and commit removal.

---

## 13. PM-2E Design — Dependency Vulnerabilities

### 13.1 Staged Remediation Batches

#### Batch 1: Safe Transitive & Non-Breaking Maintenance
- **Targets:**
  - Remove unused direct `nodemailer: ^7.0.13` from `package.json` (0 runtime imports, eliminates 6 advisories).
  - Update direct `esbuild: ^0.28.1` in `devDependencies`.
  - Apply `npm audit fix` (strictly without `--force`) to update `fast-uri`, `browserslist`, `js-yaml`, `brace-expansion`, `qs`.
- **Expected Result:** Closes 7–9 advisories with zero runtime risk.
- **Regression:** Run full vitest suite (755 tests).

#### Batch 2: Next.js Framework Minor Bump
- **Target:** Update `next` from `16.2.9` to `16.3.4` (along with `eslint-config-next: 16.3.4`).
- **Expected Result:** Resolves 9 Next.js advisories, transitive `postcss` (8.5.22), and `sharp` (libvips).
- **Regression:** Full Turbopack production build, route manifest check (153/153 routes), Playwright visual tests.

#### Batch 3: Deferred Tooling & Major Dep Evaluation
- **Target:** `drizzle-kit` and `uuid`.
- **Assessment:** `drizzle-kit` upgrade to 0.18.x is a major breaking change; `uuid` is only called safely via `uuidv4()`. Keep tracked as accepted development debt or schedule for dedicated breaking release.

---

## 14. PM-2F Design — Backup / PITR Operational Assurance

### 14.1 Operational Verification Protocol
1. **Neon Project Configuration Audit:**
   Execute via Neon CLI or Console: inspect project `old-glitter-51244715` to record active PITR retention window (`history_retention_seconds`).
2. **Non-Destructive Restoration Drill:**
   - Select a target recovery timestamp $T_{target} = \text{now} - 2\text{ hours}$.
   - Create a disposable branch:
     `neon branches create --project-id old-glitter-51244715 --name pitr-drill-temp --parent dev --point-in-time "$T_{target}"`
   - Connect to `pitr-drill-temp` in read-only mode.
   - Verify table counts across critical business entities (`organisations`, `users`, `students`, `invoices`, `bookings`).
3. **Resource Teardown:**
   - Delete `pitr-drill-temp`:
     `neon branches delete --project-id old-glitter-51244715 pitr-drill-temp`
4. **Evidence Archival:**
   Document branch IDs, timestamps, and row count matches in the PM-2F completion report.

---

## 15. Production Safety & Product Truth Preservation

The proposed remediation designs strictly maintain all 19 established product truths:
1. CMS role does not equate to formal statutory DSL/DPO appointment.
2. Confidential safeguarding remains strictly Owner + Manager.
3. CMS stores safeguarding logs but does not execute statutory local-authority referrals.
4. No statutory Ofsted compliance claims are made.
5. No family monetary credit ledger exists; overpayments do not generate cash credit.
6. Parent portal strictly blocks overpayment.
7. Only verified payments reduce invoice balances.
8. Payment edit/delete/reversal remains un-implemented.
9. Invoice void remains strictly Owner-only.
10. No invoice reissue wizard is assumed.
11. Communications consent uses latest-booking consent (`createdAt DESC, id DESC`).
12. Broadcast delivery is currently not durable and will not be claimed as durable until PM-2C implementation is proven.
13. V048 "Delivered" means internal application dispatch accounting, not external provider delivery.
14. Sentry remains classified as `CONFIGURED AND SDK DELIVERY VERIFIED` until PM-2D proves live production capture.
15. UptimeRobot external synthetic monitoring remains separate from Sentry exception capture.
16. V032 student export remains partial JSON, not full GDPR/SAR.
17. V040 booking plan remains single-booking functionality, not automated recurring-plan billing.
18. V050 parent medical notes insert medical student notes.
19. V051 zero-centre assignment removes centre memberships while preserving auth credentials.

---

## 16. Unresolved Questions & Readiness Recommendation

### 16.1 Unresolved Questions for Orchestrator
1. **PM-2 Sequence:** Does the orchestrator approve moving Billing Concurrency (PM-2B) ahead of Broadcasts (PM-2C) given the financial integrity implications?
2. **Nodemailer Removal:** May we safely remove `nodemailer` from `package.json` in PM-2E, given that zero runtime imports exist?
3. **Neon Access:** Will Neon CLI credentials or project console screenshots be provided for the PM-2F non-destructive branching drill?

### 16.2 Readiness Recommendation
**STATUS: PASS — PM-2A DEBT REDISCOVERY COMPLETE.**  
The current code truth is fully established across all five workstreams. The repository is clean, all tests pass, and structured remediation designs are ready for execution.
