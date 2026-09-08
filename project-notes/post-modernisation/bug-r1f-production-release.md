# BUG-R1.F.P — Controlled Production Release & Replay Verification Record

**Date**: 2026-09-08
**Milestone**: BUG-R1.F.P — Controlled Production Release & Replay Verification
**Release Status**: DEPLOYED & VERIFIED IN PRODUCTION
**Target Repository**: `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS`
**Release Baseline Commit**: `c1640522aea73c6a98d4bae3c1d47033a11fa129` (`origin/main` before release)
**Certified Application Release SHA**: `38008ec7ef0179e0d58aea45567dd575a0aa7c75`
**Release Tag**: `cms-bug-r1f-replay-fix-certified`
**Production Host**: `https://app.sprintscaleit.co.uk`

---

## 1. Release Architecture & Scope

This release delivers the independently certified BUG-R1.F replay-identity remediation:
- **Stable Replay Identity**: Replay protection is anchored to server-authoritative identities (`prefillParentId`, `prefillChildIds`, `registration_children.child_id`).
- **PostgreSQL Concurrency Guard**: Transactional advisory locks serialize concurrent submissions across the same parent and child records.
- **Trust-Boundary Hardening**: Child-ID injection prevention, duplicate child payload detection, and strict tenant/centre boundaries.
- **Zero Schema Migrations**: Operates completely on the existing schema without database migrations or schema lock contention.
- **PM-2B Isolation**: 100% excluded from PM-2B broadcast durability, cron routes, and schema files.

---

## 2. Remote Deployment Observation

1. **Remediation Branch Push**:
   - Branch: `fix/bug-r1f-registration-replay` pushed to `origin/fix/bug-r1f-registration-replay` (`38008ec`).
2. **Fast-Forward Push to Main**:
   - `origin/main` advanced cleanly from `c164052` to `38008ec` (8 commits ahead, 0 conflicts, no force-push).
3. **Vercel Production Deployment**:
   - Deployment ID: `dpl_7AxLbdProhsygYAGwhrpyvndDqRE`
   - State: `● Ready`
   - URL: `https://after-school-club-live-jb1lb61bn-kwadwo-addos-projects.vercel.app`
   - Production Aliases:
     - `https://app.sprintscaleit.co.uk`
     - `https://after-school-club-live.vercel.app`
     - `https://after-school-club-live-git-main-kwadwo-addos-projects.vercel.app`
   - Note: Production deployment became Ready after `origin/main` advanced to `38008ec`; exact deployment Git SHA was not independently exposed in the CLI inspect summary.

---

## 3. Public & Authenticated Smoke Verification

- `GET /`: HTTP 200
- `GET /login`: HTTP 200
- `GET /signup`: HTTP 200
- `GET /terms`: HTTP 200
- `GET /privacy`: HTTP 200
- `GET /api/health`: HTTP 200 (`{"ok":true}`)
- Protected routes (`/dashboard`, `/dashboard/students`, `/dashboard/bookings`, `/dashboard/registrations`) return HTTP 307 redirecting unauthenticated traffic to `/login` (fail-closed, 0 unhandled 500s).

---

## 4. Controlled Synthetic Canary & Replay Verification

Conducted in dedicated test organization context (`Tester's College LTD` / `Centre 1`):
1. **Synthetic Record Creation**:
   - Synthetic parent created: `CanaryParent SyntheticTest` (`id: 601ba837-423f-4a3a-8b79-ef7e9c96d28a`) with `email: null`, `phone: '07000000000'`, preferred contact `'phone'`.
   - Synthetic child created: `Penelope Canary` (`id: f52ec09f-068c-4631-a65b-8904dbcea16a`, Reception) with `is_registered: false`.
2. **Token Generation & Prefill GET**:
   - Generated HS256 JWT prefill token signed with production secret.
   - Tested live `GET /api/register/prefill`: Status **HTTP 200**.
   - Tested tampered token against `GET /api/register/prefill`: Status **HTTP 400 Bad Request** (fail-closed, 0 PII returned).
3. **Submission A (Original State, email: null)**:
   - Live `POST https://app.sprintscaleit.co.uk/api/register` with valid prefill token.
   - Status: **HTTP 201 Created** (`registrationId: 663a0899...`).
   - Authoritative DB check: Exactly 1 registration record in status `awaiting_confirmation`.
   - Student activation check: `children.is_registered` remains `false`.
4. **Submission B (Exact Replay Bypass Attempt with Changed Email)**:
   - Re-submitted the **SAME** token, **SAME** parent, **SAME** child, but changed parent email to `canary.replay.canary_mtt67615@example.test`.
   - Response: **HTTP 409 Conflict** (`{ duplicate: true, error: 'A registration for this child already exists. Please contact the centre if you need to make changes.' }`).
   - **Crucial Acceptance Gate Passed**: Replay is strictly blocked across mutable parent email changes.
5. **Database Invariant Proof**:
   - Authoritative DB registrations for Child X: **Exactly 1**.
   - Authoritative `registration_children` junction rows for Child X: **Exactly 1**.
   - Zero duplicate registrations created.
6. **Token Reopen Semantics**:
   - The reusable signed prefill token remained readable within its validity period, while duplicate active registration creation for the same validated child identity was blocked.
7. **Child Activation**:
   - Activation transition not re-executed in production due to external-side-effect safety; behavior already certified in Oakridge PostgreSQL.
8. **Synthetic Fixture Cleanup**:
   - Ordered deletion: `registration_children` -> `registration_parents` -> `registrations` -> `children` -> `parents`.
   - Verified post-cleanup count: **0** synthetic parents, **0** synthetic children, **0** synthetic registrations remaining in production database.

---

## 5. Post-Deployment Integrity & PM-2B Absence

- `GET /api/cron/broadcasts`: Status **HTTP 404 Not Found**.
- Production database contains 0 uncertified PM-2B migration tables (`broadcast_deliveries` not referenced by runtime).
- Sentry classification: Sentry configured + SDK delivery verified.

---

## 6. Certification Tag

- **Tag**: `cms-bug-r1f-replay-fix-certified`
- **Tagged Commit**: `38008ec7ef0179e0d58aea45567dd575a0aa7c75`
