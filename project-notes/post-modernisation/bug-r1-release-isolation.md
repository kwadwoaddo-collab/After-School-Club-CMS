# Post-Modernisation Technical Note: Certified Release Isolation (UX-F1 + BUG-R1)

**Date:** 2026-09-08  
**Milestone:** BUG-R1.R — Certified Release Isolation & Reconciliation  
**Status:** ISOLATED & LOCALLY VERIFIED (READY FOR CONTROLLED RELEASE)  
**Release Branch:** `release/uxf1-bugr1-certified`  
**Base Commit:** `efac5ff` (`origin/main`)  
**Release HEAD Commit:** `d52879f` (11 commits ahead of `origin/main`)  
**Parent Source Branch:** `main` at `b4135e5` (17 commits ahead of `origin/main`)  

---

## 1. Executive Summary & Release Motivation

The After-School-Club CMS repository local `main` branch contained a mixed ancestry:
- **PM-2A.R / PM-2B:** Operational debt and broadcast delivery durability (`1f84286`, `efdcf42`, `921df11`, `2d77004`, `a07189f`, `52128bf`). PM-2B remains **uncertified** pending external verification.
- **UX-F1:** Global form control readability remediation (`dcdfd91`), certified across all 14 form surfaces.
- **BUG-R1 / BUG-R1.C / BUG-R1.D / BUG-R1.E:** Critical booking/assessment to registration conversion remediation (`cd9477b` through `b4135e5`), certified across single-child, three-child, transactional replay safety, duplicate detection, and visual audit gates (R1–R13).

To avoid prematurely pushing uncertified PM-2B changes to production, milestone **BUG-R1.R** executed a clean release isolation, extracting **only** the certified UX-F1 and BUG-R1 commits directly onto a fresh release branch rooted at `origin/main` (`efac5ff`).

---

## 2. Commit Ancestry & Classification

The 17 commits ahead of `origin/main` on local `main` were classified as follows:

| Commit SHA | Commit Subject | Category | Status | Release Action |
| :--- | :--- | :--- | :--- | :--- |
| `1f84286` | `docs(ops): reconcile post-onboarding operational debt` | PM-2A.R | Uncertified | **EXCLUDED** |
| `efdcf42` | `feat(comms): add durable broadcast delivery ledger` | PM-2B | Uncertified | **EXCLUDED** |
| `921df11` | `feat(comms): add idempotent broadcast processor` | PM-2B | Uncertified | **EXCLUDED** |
| `2d77004` | `test(comms): verify durable broadcast delivery` | PM-2B | Uncertified | **EXCLUDED** |
| `a07189f` | `docs(pm2b): document broadcast durability remediation` | PM-2B | Uncertified | **EXCLUDED** |
| `52128bf` | `fix(pm2b): reconcile broadcast durability certification findings` | PM-2B | Uncertified | **EXCLUDED** |
| `dcdfd91` | `fix(ui): ensure readable form control text across all contexts (UX-F1)` | UX-F1 | **Certified** | **CHERRY-PICKED** (`12259ef`) |
| `cd9477b` | `fix(registration): remediate booking to registration conversion workflow (BUG-R1)` | BUG-R1 | **Certified** | **CHERRY-PICKED** (`a5f263d`) |
| `3457a23` | `test(registration): add dedicated BUG-R1 conversion regression tests` | BUG-R1 | **Certified** | **CHERRY-PICKED** (`1f20fa8`) |
| `d16e3ff` | `docs(registration): document BUG-R1 conversion workflow remediation` | BUG-R1 | **Certified** | **CHERRY-PICKED** (`84c1fb0`) |
| `f468c02` | `test(registration): strengthen BUG-R1 runtime certification coverage` | BUG-R1.C | **Certified** | **CHERRY-PICKED** (`b1f354e`) |
| `6fcc555` | `docs(bug-r1): reconcile certification evidence` | BUG-R1.C | **Certified** | **CHERRY-PICKED** (`e766f28`) |
| `0f0dfe9` | `fix(registration): prevent duplicate registration replay` | BUG-R1.D | **Certified** | **CHERRY-PICKED** (`1032b74`) |
| `c8c9f9c` | `test(registration): prove BUG-R1 replay safety` | BUG-R1.D | **Certified** | **CHERRY-PICKED** (`e0eed2b`) |
| `171728d` | `docs(bug-r1): document replay certification result` | BUG-R1.D | **Certified** | **CHERRY-PICKED** (`9301d49`) |
| `e1756f3` | `test(registration): add BUG-R1.E duplicate and cross-tenant behavioral tests` | BUG-R1.E | **Certified** | **CHERRY-PICKED** (`6c6d1a2`) |
| `b4135e5` | `docs(bug-r1): record BUG-R1.E final reconciliation and R13 evidence` | BUG-R1.E | **Certified** | **CHERRY-PICKED** (`d52879f`) |

---

## 3. Dependency Graph & Isolation Analysis

Forensic analysis verified that the certified changes are completely decoupled from PM-2B:
- **No Shared Schema/Migrations:** PM-2B introduced table `broadcast_deliveries` and migration `0026_broadcast_delivery_durability.sql`. UX-F1 and BUG-R1 require **0** database schema modifications or migrations.
- **No Shared Routes/Workers:** PM-2B added route `/api/cron/broadcasts` and worker `delivery.ts`. UX-F1 and BUG-R1 do not import or invoke these files.
- **CommunicationsClient Overlap:** UX-F1 touched 3 input styling classes (`text-foreground`) in `src/app/dashboard/communications/CommunicationsClient.tsx`. Cherry-picking onto `origin/main` auto-merged cleanly without any conflict or dependency on PM-2B delivery ledger UI.

---

## 4. Verification of PM-2B Exclusion

The following PM-2B artifacts are completely **ABSENT** from `release/uxf1-bugr1-certified`:
- `drizzle/0026_broadcast_delivery_durability.sql` (Excluded)
- `src/app/api/cron/broadcasts/route.ts` (Excluded)
- `src/features/communications/delivery.ts` (Excluded)
- `src/features/communications/delivery.test.ts` (Excluded)
- `src/lib/security-pm2b.test.ts` (Excluded)
- `scripts/verify-pm2b-durability.ts` & `scripts/capture-pm2b-evidence.ts` (Excluded)
- `project-notes/post-modernisation/pm2b-broadcast-delivery-durability.md` (Excluded)
- `vercel.json` cron additions for broadcasts (Excluded)

---

## 5. Automated Quality Gates on Isolated Release Branch

Running full automated gates on `release/uxf1-bugr1-certified`:

1. **TypeScript Typecheck:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
   # Exit code 0, 0 errors
   ```
2. **ESLint:**
   ```bash
   npm run lint
   # Exit code 0, 0 errors, 0 warnings
   ```
3. **Dedicated BUG-R1 Test Suite:**
   ```bash
   npx vitest run src/app/api/register/bug-r1-conversion.test.ts
   # 33 passed (33/33 tests)
   ```
4. **Full Test Suite:**
   ```bash
   npm test
   # 78 test files passed (78/78), 860 tests passed (860/860)
   # Note: 2 PM-2B test files (42 tests) correctly absent
   ```
5. **Production Build:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   # Exit code 0, 156 routes compiled successfully
   # (Exactly matches certified scope minus uncertified /api/cron/broadcasts)
   ```
6. **Git Diff Check:**
   ```bash
   git diff --check
   # Clean
   ```

---

## 6. Release Governance & Safety Summary

- **Push Authorization:** NO push to remote (`origin/main`, `release/*`, or `rebuild/*`).
- **Deployment:** NO deployments to Vercel or any hosting environment.
- **Database Safety:** Exactly 0 migrations applied, 0 production writes.
- **Original Branch Preservation:** Local branch `main` remains intact at commit `b4135e5`, preserving all uncertified PM-2B commits for future certification.
