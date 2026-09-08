# BUG-R1.F / BUG-R1.F.R — Registration Token Replay-Identity Remediation & PostgreSQL Certification

**Date**: 2026-09-08
**Milestone**: BUG-R1.F / BUG-R1.F.R — Real Runtime & PostgreSQL Replay Certification
**Status**: REMEDIATED, CERTIFIED ON POSTGRESQL & READY FOR INDEPENDENT VERIFICATION
**Severity**: HIGH — Data Integrity
**Target Repository**: `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`
**Base Commit**: `c1640522aea73c6a98d4bae3c1d47033a11fa129` (`origin/main`)
**Working Branch**: `fix/bug-r1f-registration-replay`

---

## 1. Production Discovery

Production verification identified a data-integrity defect in the booking/assessment → registration conversion workflow.

While the certified release candidate (`6b12eaa`) was deployed and successfully verified against basic flows, controlled synthetic canary testing on production revealed:
1. **Submission A**:
   - Token $T$ signed for parent $P$ and child $X$ (`Penelope Canary`).
   - Submitted parent email = `null`.
   - Result: **HTTP 201 Created** (Registration A: `06e0e5cc-d067-4f60-bc85-2761c93303cf`).
2. **Submission B**:
   - The **SAME** valid prefill JWT token $T$ and the **SAME** child $X$.
   - Submitted parent email changed to synthetic email (`canary.synthetic.replay@example.test`).
   - Defect: **HTTP 201 Created** (Registration B: `395580c9-9fc9-411a-94e5-aaabbf551dde`).
   - A second active registration was created for the same child in the same organisation.
3. **Submission C**:
   - The same token $T$, same child $X$, and same email (`canary.synthetic.replay@example.test`).
   - Result: **HTTP 409 Conflict** (`"A registration for this child already exists"`).

This proved that duplicate/replay protection was mistakenly anchored to mutable parent email rather than stable, server-authoritative identities.

---

## 2. Root Cause Analysis

Forensic inspection of `src/app/api/register/route.ts` revealed three compounding defects:
1. **Token Payload Unpacking Gap**:
   In `POST /api/register`, `jwtVerify(prefillToken, secret)` extracted `parentId` but completely ignored `childIds` and `centreId`. As a result, the server was blind to the signed child scope.
2. **Transactional Advisory Lock Misplacement**:
   The advisory lock key was derived solely from the submitted parent email:
   ```ts
   const lockKey = `reg_submit_${org.id}_${primarySubmittedParent.email.trim().toLowerCase()}`;
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
   ```
   - If `primarySubmittedParent.email` was `null` or empty (Submission A), **no lock was acquired at all**.
   - If the email changed (Submission B), a completely different advisory lock was computed, meaning concurrent submissions across different emails did not serialize against each other.
3. **Email-Dependent Duplicate Query**:
   The duplicate query looked up past registrations solely by joining `registration_parents` on `submittedEmail`:
   ```ts
   .where(ilike(registrationParents.submittedEmail, primarySubmittedParent.email.trim()))
   ```
   If the parent entered no email in Submission A, or entered a different email in Submission B, the lookup matched zero records, completely bypassing duplicate detection.

---

## 3. Trust-Boundary & Replay Identity Architecture

### Old Replay Identity (Defective)
- **Lock Identifier**: `primarySubmittedParent.email`
- **Lookup Identifier**: `registrationParents.submittedEmail = email`
- **Flaw**: Business form fields (email, phone, address, parent name) are mutable by nature and controlled by the client. Client-mutable fields must never define server replay identity.

### New Replay Identity (Server-Authoritative)
- **Stable Identity 1**: `prefillParentId` (cryptographically signed in the JWT and verified against DB tenant records).
- **Stable Identity 2**: `childIds` (cryptographically signed in the JWT and verified against DB tenant child records).
- **Stable Identity 3**: Junction records in `registration_children` (`registrationChildren.childId`).

### Lock Derivation & Deadlock Qualification
Inside the registration transaction, locks are derived deterministically:
1. If `prefillParentId` exists:
   `reg_submit_parent_${org.id}_${prefillParentId}`
2. For each target child ID (sorted lexicographically to enforce deterministic acquisition ordering):
   `reg_submit_child_${org.id}_${childId}`
3. For organic non-token submissions without parent ID:
   `reg_submit_${org.id}_${primarySubmittedParent.email.trim().toLowerCase()}`

> **Deadlock Analysis Qualification**:
> Acquisition ordering is strictly: parent lock first (`reg_submit_parent_${org.id}_${prefillParentId}`), followed by child locks sorted lexicographically (`reg_submit_child_${org.id}_${childId}`). This provides deterministic lock ordering within the `POST /api/register` code path, preventing deadlocks between concurrent registration attempts. Note that this guarantees deadlock prevention within this specific registration transaction path; it does not protect against unrelated external database transactions that might lock child or parent rows in reverse order.

---

## 4. Remediation Implementation

File: `src/app/api/register/route.ts`

1. **Full Claim Extraction & Validation**:
   - `prefillToken` payload now extracts `prefillParentId`, `prefillCentreId`, and `prefillChildIds`.
   - Any malformed or expired token returns **HTTP 400 Bad Request**.
   - `prefillParentId` is verified to exist, belong to `org.id`, and not be soft-deleted (`isNull(parents.deletedAt)`).
   - Every child in `prefillChildIds` is verified to exist, belong to `org.id`, belong to `prefillParentId`, and not be soft-deleted (`isNull(children.deletedAt)`).
2. **Child Injection Protection & Section 13 Critic Issue Resolution**:
   - When `prefillChildIds.length > 0`:
     - Every submitted child entry must include a non-empty `childId` (`if (!c.childId || !prefillChildIds.includes(c.childId)) throw 400`).
     - Submitting a child without `childId` (missing child-ID attack) is strictly rejected with **HTTP 400 Bad Request**.
     - Submitting a child with duplicate `childId` values in the same payload is rejected with **HTTP 400 Bad Request**.
     - Submitted children cannot exceed the token count, and must all match the signed child set.
3. **Active Registration Status Semantics**:
   - Active registrations are defined as: `registrations.status IN ('awaiting_confirmation', 'signed_up', 'pending')`.
   - Including `'pending'` guarantees that draft or initial state registrations prevent duplicate submissions.
4. **Centre Scope Enforced**:
   - If `prefillCentreId` is signed in the token, the request cannot specify a conflicting `centreId`.
5. **Authoritative Duplicate Checks in Transaction**:
   - **Check A (Child Record Identity)**:
     Queries `registrationChildren` joined with `registrations` where `registrations.organisationId = org.id`, `registrations.status IN ('awaiting_confirmation', 'signed_up', 'pending')`, and `registrationChildren.childId IN (sortedUniqueChildIds)`.
     Matches existing active registrations regardless of what email, phone, or parent name is submitted.
   - **Check B (Parent Record + Child Names)**:
     If `prefillParentId` exists, verifies no active registration for this parent already contains a child with matching first/last name.
   - **Check C (Organic Fallback)**:
     Retains email + child name matching for non-token organic public submissions.

---

## 5. Registration Write Path Inventory

A full static analysis audit across the codebase for `.insert(registrations)`, `.insert(registrationChildren)`, and `.insert(registrationParents)` identified:
- **Total Runtime Public Write Paths**: Exactly **1** (`POST /api/register` in `src/app/api/register/route.ts`).
- **Administrative Endpoints**:
  - `src/app/dashboard/registrations/actions.ts`: Only executes `UPDATE` (status changes) and `DELETE` (cancellations). Does NOT insert new registrations.
  - `src/app/api/register/[id]/status/route.ts`: Only executes `UPDATE`.
- **Offline / Developer Scripts**:
  - `src/db/seed.ts`: Static CLI seed script (not exposed to runtime API traffic).

Thus, securing `POST /api/register` comprehensively covers 100% of runtime registration ingestion.

---

## 6. Real Runtime & PostgreSQL Certification (BUG-R1.F.R)

Unlike model simulations, BUG-R1.F.R was verified directly against the real Next.js API route handler (`POST /api/register`), real Drizzle ORM, and the actual Neon PostgreSQL training database (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`).

### Real Suite Results
File: `src/app/api/register/bug-r1f-postgres.integration.test.ts` (19 tests passing)

1. **Sequential Defect Reproduction**:
   - Submission A (`email: null`) creates Registration 1 (HTTP 201).
   - Submission B (same token, `email: "new@example.test"`) is **blocked with HTTP 409 Conflict**.
   - Exactly 1 registration record in PostgreSQL.
2. **True PostgreSQL Concurrent Races**:
   - **Case C1 (Concurrent Identical Replay)**: Two simultaneous requests against PostgreSQL with identical payload: exactly 1x 201, 1x 409, 1 DB row.
   - **Case C2 (Concurrent Changed-Email Race)**: Two simultaneous requests against PostgreSQL where one has `email: null` and the other has `email: "changed@example.test"`: serialized by `pg_advisory_xact_lock(...)`, resulting in exactly 1x 201, 1x 409, 1 DB row.
3. **Trust-Boundary & Attack Injections (T1–T11)**:
   - T1: Nonexistent parent rejected (HTTP 400).
   - T2: Child belonging to another parent rejected (HTTP 400).
   - T3: Cross-tenant child rejected (HTTP 400).
   - T4: Soft-deleted child rejected (HTTP 400).
   - T5: Centre mismatch rejected (HTTP 400).
   - T6: Missing child-ID attack rejected (HTTP 400).
   - T7: Mixed signed/unsigned children rejected (HTTP 400).
   - T8: Malformed JWT rejected (HTTP 400).
   - T9: Expired JWT rejected (HTTP 400).
   - T10: Nonexistent centre rejected (HTTP 400).
   - T11: Cross-tenant centre rejected (HTTP 400).
4. **Product Semantics**:
   - Sibling registrations for genuine different children succeed (2 distinct registrations in DB).
   - Multi-child 3-sibling registration succeeds (1 reg, 3 children in DB); replay blocked with 409.
   - Concurrent 3-child submissions complete without deadlock (1x 201, 1x 409).
   - Student activation lifecycle verified: `isRegistered = false` upon submission, transitions to `true` with `registeredAt: Date` upon `updateRegistrationStatus('signed_up')`.
5. **Data Cleanup**:
   - Strict `afterAll` hook deleted 100% of synthetic test entities; verified 0 orphaned rows.

---

## 7. Automated Test Taxonomy & Disambiguation

To ensure complete transparency and prevent overclaiming, tests in this repository are categorized as follows:

| Category | Description | Files | Test Count |
|---|---|---|---|
| **Category A** | Real Route Handler + Real Neon PostgreSQL Integration | `bug-r1f-postgres.integration.test.ts` | 19 tests |
| **Category C** | In-Memory Reference Engine / Fast Model Simulation | `bug-r1f-replay.test.ts` (part)<br>`bug-r1-conversion.test.ts` (part) | 36 tests |
| **Category D** | Static Source-Code / AST Analysis Tests | `bug-r1f-replay.test.ts` (part)<br>`bug-r1-conversion.test.ts` (part) | 23 tests |
| **Category E** | Unit Logic / Pure Helper Tests | `bug-r1-conversion.test.ts` (part) | 4 tests |

All 19 Category A tests execute against real PostgreSQL and enforce genuine database constraints and advisory locks.

---

## 8. Quality Gate Verification

- **TypeScript (`NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit`)**: 0 errors
- **ESLint (`npm run lint`)**: 0 errors, 0 warnings
- **Full Test Suite (`npm test`)**: 80 test files, 909 tests passed (100%)
- **Next.js Production Build (`npm run build`)**: 156 routes compiled successfully
- **Working Tree**: Clean (all changes tracked and staged)

---

## 9. Visual Change Determination

**NO VISUAL SOURCE CHANGE**: BUG-R1.F / BUG-R1.F.R is strictly a backend data-integrity remediation in `src/app/api/register/route.ts`. The public registration form interface remains identical to the certified UX-F1 / BUG-R1 design. Visual evidence R1–R13 remains 100% valid.

---

## 10. Database Invariant & Production Safety Decision

No database migration was added or executed. The existing schema (`registrations`, `registration_children`, `registration_parents`) already provides the required relational columns. Enforcing the invariant at the transaction boundary with PostgreSQL advisory locks provides robust data integrity without introducing migration risk, schema lock contention, or uncertified PM-2B broadcast files.
