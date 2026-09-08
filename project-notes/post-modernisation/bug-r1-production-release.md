# BUG-R1.P Certified Production Release Record

**Release Date**: 2026-09-08  
**Milestone**: BUG-R1.P — Controlled Certified Production Release  
**Certified Release Base**: `efac5ff80d3621e0d2393e53683d38ceebe9a804` (`origin/main` baseline)  
**Certified Release HEAD**: `6b12eaa368ec2cd128de1a8f52e450b1a3c1a878`  
**Certified Release Tag**: `cms-bug-r1-uxf1-certified`  
**Vercel Production Deployment ID**: `dpl_53zSSotcient9VXcSpNziQnKQzWC`  
**Production URL**: `https://app.sprintscaleit.co.uk` / `https://after-school-club-live.vercel.app`  

---

## 1. Scope & Isolation

This production release encapsulates exclusively the certified **UX-F1** (Form Readability Remediation) and **BUG-R1** (Booking/Assessment → Registration Conversion Remediation) changesets.

### Included Certified Commits (12 commits total ahead of `efac5ff`):
1. `8d75dc7` — `fix(ui): ensure readable form control text across all contexts (UX-F1)`
2. `f49195b` — `test(ui): add UX-F1 form readability regression tests`
3. `66aa736` — `docs(ux): document UX-F1 global form readability remediation`
4. `ff9c9cf` — `fix(registration): resolve booking conversion and multi-child prefill failure (BUG-R1)`
5. `ff6854b` — `test(registration): add regression coverage for booking conversion and prefill (BUG-R1)`
6. `f6ba63d` — `docs(registration): document BUG-R1 conversion root cause, fix, and evidence`
7. `8f8b371` — `test(registration): add runtime regression coverage for conversion edge cases (BUG-R1.C)`
8. `aa3711c` — `docs(registration): document BUG-R1.C reconciliation findings, architecture, and visual evidence`
9. `b592182` — `fix(registration): enforce transactional advisory lock and duplicate child guard on token submission (BUG-R1.D)`
10. `1850106` — `test(registration): add token replay prevention regression tests (BUG-R1.D)`
11. `ea66a3d` — `docs(registration): reconcile token replay semantics, student activation lifecycle, and test coverage (BUG-R1.E)`
12. `6b12eaa` — `docs(release): record certified UX-F1 + BUG-R1 isolated release candidate branch (BUG-R1.R)`

### Uncertified Work Strictly Excluded:
- **PM-2B** broadcast durability migration `0026_broadcast_delivery_durability.sql`
- `/api/cron/broadcasts` delivery runner and durability tests
- PM-2B documentation and associated changes on local `main` (`b4135e5`)
- Zero PM-2B content exists in this release or on `origin/main`.

---

## 2. Pre-Release QA Verification

Prior to pushing to production, the full quality gate was executed locally on `release/uxf1-bugr1-certified`:
- **TypeScript (`tsc --noEmit`)**: 0 errors
- **ESLint (`npm run lint`)**: 0 errors, 0 warnings
- **BUG-R1 Suite (`vitest run src/app/api/register/bug-r1-conversion.test.ts`)**: 33 passed (100%)
- **Full Test Suite (`npm test`)**: 78 test files, 860 passed (100%)
- **Next.js Production Build (`npm run build`)**: 156 routes compiled successfully
- **Working Tree**: Clean

---

## 3. Remote Update & Deployment Observation

1. **Remote Release Branch Push**: Pushed `release/uxf1-bugr1-certified` to `origin/release/uxf1-bugr1-certified` (`6b12eaa`).
2. **Fast-Forward Push to `origin/main`**: Updated `origin/main` from `efac5ff` to `6b12eaa` via direct fast-forward push (`git push origin 6b12eaa:main`).
3. **Vercel Production Deployment**:
   - Deployment ID: `dpl_53zSSotcient9VXcSpNziQnKQzWC`
   - State: `● Ready`
   - Aliases:
     - `https://app.sprintscaleit.co.uk`
     - `https://after-school-club-live.vercel.app`
     - `https://after-school-club-live-git-main-kwadwo-addos-projects.vercel.app`

---

## 4. Production Verification Results

### 4.1 Public Route Smoke (Section 13)
All checked public endpoints returned HTTP 200:
- `GET /`: HTTP 200
- `GET /login`: HTTP 200
- `GET /signup`: HTTP 200
- `GET /terms`: HTTP 200
- `GET /privacy`: HTTP 200
- `GET /api/health`: HTTP 200 (`{"ok":true}`)

### 4.2 UX-F1 Production CSS & Form Readability (Section 14)
- Verified stylesheet `2nerukw8w7f9l.css` contains the live `:-webkit-autofill` rules with `-webkit-text-fill-color: hsl(var(--foreground))`.
- Verified stylesheet contains `--on-surface-variant` semantic token definitions across all scopes.
- Public signup page inputs render with `text-foreground` rather than unreadable `text-white` on light surfaces.

### 4.3 Controlled Synthetic Canary & Replay Verification (Sections 15–18)
Conducted in dedicated test organization context (`Tester's College LTD` / `Centre 1`):
1. **Synthetic Record Creation**:
   - Created synthetic parent (`CanaryParent SyntheticTest`) with phone-preferred contact and null email (to prevent unneeded external emails).
   - Created synthetic child (`Penelope Canary`, Reception) with allergies (`Peanuts`), dietary requirement (`Vegetarian`), medical condition (`Mild Asthma`), and `is_registered: false`.
2. **Token Generation & Prefill GET**:
   - Generated HS256 JWT prefill token signed with production secret (`AUTH_SECRET`).
   - Queried live production prefill endpoint: `GET https://app.sprintscaleit.co.uk/api/register/prefill?token=...`
   - Status: **HTTP 200**
   - Verified prefill response accurately unpacked:
     - Child name: `Penelope Canary`
     - Allergies: `['Peanuts']`
     - Medical conditions: `'Mild Asthma'`
3. **Canary Form Submission**:
   - Executed live `POST https://app.sprintscaleit.co.uk/api/register` with valid prefill token and signature.
   - Status: **HTTP 201 Created** (`registrationId: 06e0e5cc-d067-4f60-bc85-2761c93303cf`)
   - Verified DB state:
     - `registrations.status`: `'awaiting_confirmation'`
     - `children.is_registered`: `false` (remains unactivated until explicit staff approval)
4. **Sequential Replay Verification**:
   - Executed submission with synthetic test email `canary.synthetic.replay@example.test`.
   - Status: **HTTP 201 Created** (`registrationId: 395580c9-9fc9-411a-94e5-aaabbf551dde`).
   - Re-submitted the exact same token and payload immediately:
   - Status: **HTTP 409 Conflict** (`duplicate: true`, `"A registration for this child already exists. Please contact the centre if you need to make changes."`).
   - Verified in database: Exactly **1** registration record exists for `canary.synthetic.replay@example.test`. Duplicate creation was completely blocked by the PostgreSQL transactional advisory lock guard.
5. **Synthetic Canary Cleanup (Section 19)**:
   - Deleted all synthetic registration parent/child junction rows, registration rows, synthetic child, and synthetic parent.
   - Verified post-cleanup count: **0** residual test parent records.

---

## 5. Release Certification Tag

- **Tag**: `cms-bug-r1-uxf1-certified`
- **Tagged Object**: `6b12eaa368ec2cd128de1a8f52e450b1a3c1a878`
- **Pushed to Remote**: Verified on `origin/cms-bug-r1-uxf1-certified`
