# BUG-R1.F — Registration Token Replay-Identity Remediation

**Date**: 2026-09-08  
**Milestone**: BUG-R1.F — Registration Token Replay-Identity Remediation  
**Status**: REMEDIATED & READY FOR CERTIFICATION  
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

### Lock Derivation
Inside the registration transaction, locks are derived deterministically:
1. If `prefillParentId` exists:
   `reg_submit_parent_${org.id}_${prefillParentId}`
2. For each target child ID (sorted deterministically to eliminate deadlocks):
   `reg_submit_child_${org.id}_${childId}`
3. For organic non-token submissions without parent ID:
   `reg_submit_${org.id}_${primarySubmittedParent.email.trim().toLowerCase()}`

---

## 4. Remediation Implementation

File: `src/app/api/register/route.ts`

1. **Full Claim Extraction & Validation**:
   - `prefillToken` payload now extracts `prefillParentId`, `prefillCentreId`, and `prefillChildIds`.
   - Any malformed or expired token returns **HTTP 400 Bad Request**.
   - `prefillParentId` is verified to exist, belong to `org.id`, and not be soft-deleted (`isNull(parents.deletedAt)`).
   - Every child in `prefillChildIds` is verified to exist, belong to `org.id`, belong to `prefillParentId`, and not be soft-deleted (`isNull(children.deletedAt)`).
2. **Child Injection Protection**:
   - If `prefillToken` is provided with signed `prefillChildIds`, submitted children cannot exceed the token count, and submitted `childId` values must belong to `prefillChildIds`.
   - Prevents attackers from injecting unrelated children into a signed invitation.
3. **Centre Scope Enforced**:
   - If `prefillCentreId` is signed in the token, the request cannot specify a conflicting `centreId`.
4. **Authoritative Duplicate Checks in Transaction**:
   - **Check A (Child Record Identity)**:
     Queries `registrationChildren` joined with `registrations` where `registrations.organisationId = org.id`, `registrations.status IN ('awaiting_confirmation', 'signed_up')`, and `registrationChildren.childId IN (sortedUniqueChildIds)`.
     Matches existing active registrations regardless of what email, phone, or parent name is submitted.
   - **Check B (Parent Record + Child Names)**:
     If `prefillParentId` exists, verifies no active registration for this parent already contains a child with matching first/last name.
   - **Check C (Organic Fallback)**:
     Retains email + child name matching for non-token organic public submissions.

---

## 5. Product Semantics Preserved

1. **Legitimate Sibling Registrations**:
   - When parent $P$ has already registered child $X$, and later receives an invitation for child $Y$:
   - Child $Y$ has distinct `childId` $Y$.
   - Check A evaluates `registrationChildren.childId = Y`, finding zero active registrations.
   - Child $Y$'s registration succeeds with **HTTP 201 Created**.
2. **Multi-Child Invitations**:
   - Token contains $[X, Y, Z]$. First submission creates 1 registration linking all 3 children.
   - Any replay with $[X, Y, Z]$ matches active records for $X, Y, Z$ and is rejected with **HTTP 409 Conflict**.
   - Changing parent email does not bypass rejection.
3. **Student Activation Lifecycle**:
   - Registration submission creates record in status `awaiting_confirmation`.
   - Child records remain `isRegistered = false` and `registeredAt = null`.
   - Only subsequent staff approval (`signed_up`) activates students.
4. **Soft-Deleted Record Isolation**:
   - `isNull(parents.deletedAt)` and `isNull(children.deletedAt)` ensure deleted records cannot be registered or revived.

---

## 6. Concurrency Proof

A behavioral concurrency test (`src/app/api/register/bug-r1f-replay.test.ts`) executes parallel submissions via `Promise.all`:
- **Concurrent Identical Payloads**:
  Two parallel requests with identical tokens and payloads produce:
  - Exactly **one** HTTP 201 success.
  - Exactly **one** HTTP 409 duplicate rejection.
  - Exactly **one** registration record in DB.
- **Concurrent Changed-Email Payloads**:
  Two parallel requests using the same token/child where Payload A has `email: null` and Payload B has `email: "different@example.test"` produce:
  - Exactly **one** HTTP 201 success.
  - Exactly **one** HTTP 409 duplicate rejection.
  - Advisory locks serialize both transactions on `reg_submit_parent_${org.id}_${prefillParentId}` and `reg_submit_child_${org.id}_${childId}`, completely eliminating the race condition.

---

## 7. Automated Test Coverage (26 Scenarios)

File: `src/app/api/register/bug-r1f-replay.test.ts` (30 tests passing)

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1 | First valid submission | HTTP 201 | PASS |
| 2 | Exact sequential replay | HTTP 409 | PASS |
| 3 | Replay with changed email | HTTP 409 | PASS |
| 4 | Replay null-email → populated-email | HTTP 409 | PASS |
| 5 | Replay with changed phone | HTTP 409 | PASS |
| 6 | Replay with changed address | HTTP 409 | PASS |
| 7 | Replay with changed parent name | HTTP 409 | PASS |
| 8 | Email casing variation (`PARENT@...`) | HTTP 409 | PASS |
| 9 | Concurrent identical replay | 1x 201, 1x 409 | PASS |
| 10 | Concurrent changed-email replay | 1x 201, 1x 409 | PASS |
| 11 | Same parent + different child (sibling) | HTTP 201 | PASS |
| 12 | Multi-child first submission | HTTP 201 (all 3 linked) | PASS |
| 13 | Multi-child replay | HTTP 409 | PASS |
| 14 | Multi-child changed-email replay | HTTP 409 | PASS |
| 15 | Unrelated child injection | HTTP 400 | PASS |
| 16 | Cross-tenant child injection | HTTP 400 | PASS |
| 17 | Cross-centre mismatch | HTTP 400 | PASS |
| 18 | Malformed token | HTTP 400 | PASS |
| 19 | Expired token | HTTP 400 | PASS |
| 20 | Token with nonexistent parent | HTTP 400 | PASS |
| 21 | Token with nonexistent child | HTTP 400 | PASS |
| 22 | Soft-deleted child exclusion | HTTP 400 | PASS |
| 23 | No premature student activation | `isRegistered: false` | PASS |
| 24 | Staff `signed_up` transition activates student | `isRegistered: true` | PASS |
| 25 | Step 2 undefined allergies safety | No crash | PASS |
| 26 | Step 4 signature & terms validation | Fail-closed | PASS |

---

## 8. Quality Gate Verification

- **TypeScript (`tsc --noEmit`)**: 0 errors
- **ESLint (`npm run lint`)**: 0 errors, 0 warnings
- **BUG-R1 Suites**:
  - `src/app/api/register/bug-r1-conversion.test.ts`: 33 passed
  - `src/app/api/register/bug-r1f-replay.test.ts`: 30 passed
- **Full Test Suite (`npm test`)**: 79 test files, 890 tests passed (100%)
- **Next.js Production Build (`npm run build`)**: 156 routes compiled successfully
- **Working Tree**: Clean

---

## 9. Visual Change Determination

**NO VISUAL SOURCE CHANGE**: BUG-R1.F is strictly a backend data-integrity remediation in `src/app/api/register/route.ts`. The public form continues to render the existing certified BUG-R1/UX-F1 interface. Existing visual evidence (R1–R13) remains applicable.

---

## 10. Database Invariant Decision

No database migration was added. The existing schema (`registrations`, `registration_children`, `registration_parents`) already provides the necessary relational keys (`child_id`, `parent_id`, `organisation_id`, `status`). Enforcing the invariant at the transaction boundary with PostgreSQL advisory locks guarantees data integrity across single-child, multi-child, and sibling registrations without introducing migration risks or disrupting quarantined PM-2B changes.
