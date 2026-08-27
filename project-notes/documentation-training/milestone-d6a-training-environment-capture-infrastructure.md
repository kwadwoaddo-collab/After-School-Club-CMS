# SprintScale CMS — Milestone D6A Report
## Synthetic Training Environment, Hard Safety Guards & Capture Infrastructure

**Milestone:** D6A Environment Reconciliation
**Baseline SHA:** `cb4ba78`
**Branch:** `rebuild/cms-modernisation`
**Date:** 2026-08-27
**Status:** **PASS — GUARDED SYNTHETIC CAPTURE ENVIRONMENT LIVE — READY FOR D6B**

---

## 1. Executive Verdict

**PASS — GUARDED SYNTHETIC CAPTURE ENVIRONMENT LIVE — READY FOR D6B**

Milestone D6A environment reconciliation has established and empirically proven the guarded, completely isolated synthetic capture environment for SprintScale CMS.

The executable production guard (`src/lib/training-guard.ts`) prevents accidental execution against the known production database host (`ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`) and enforces explicit `ALLOW_TRAINING_SEED=true` authorization. The full synthetic `Oakridge Learning Club` dataset has been instantiated and verified via read-only SQL queries on the isolated test/staging database branch (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`), with 0 mutations to production.

---

## 2. Environment Identity & Host Isolation Proof

| Environment Parameter | Production Environment | Isolated Training Environment | Proven Isolation |
|---|---|---|---|
| **Base App URL** | `https://app.sprintscaleit.co.uk` | `http://localhost:3000` (Local Dev) | **Production URL strictly prohibited.** |
| **Database Host** | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` | `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` | **PROVEN DISTINCT HOSTS** |
| **Database Path** | `/neondb` (Production Primary) | `/neondb` (Training/Staging Branch) | Isolated PostgreSQL branch |
| **Data Scope** | Sydenham Production Roster | `Oakridge Learning Club Ltd` (100% Synthetic) | Zero real student, parent, or staff PII |
| **Production Health** | `GET /api/health` | **HTTP 200 `{"ok":true}`** | Unaffected & 100% healthy |
| **Production Mutations** | 0 INSERTs, 0 UPDATEs, 0 DELETEs | Real mutations isolated to training DB | **ZERO PRODUCTION MUTATIONS** |

---

## 3. Executable Production Guard & Tooling Verification

- **Guard Module:** [`src/lib/training-guard.ts`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/src/lib/training-guard.ts)
  - Unit tests: [`src/lib/training-guard.test.ts`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/src/lib/training-guard.test.ts) (6 passing tests).
  - Hard failure on production hostname: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`.
  - Hard failure on missing `ALLOW_TRAINING_SEED=true`.
- **Seed Script:** `npm run training:seed` (`src/scripts/seed-training-data.ts`) — Verified reproducible instantiation.
- **Reset Script:** `npm run training:reset` (`src/scripts/reset-training-data.ts`) — Verified clean cascade reset.

---

## 4. Live Synthetic Dataset Verification (Read-Only Audit)

| Entity Category | Synthetic Target | Live DB Count | Verification Evidence |
|---|---|---|---|
| **Organisations** | `Oakridge Learning Club Ltd` (`slug: oakridge-learning`) | 1 | Org ID `a8fe0607-1ac7-428b-b815-33c09f712ee1` verified. |
| **Centres / Venues** | `Oakridge Central`, `Oakridge Riverside` | 2 | Primary & secondary venues created. |
| **Staff Accounts** | Eleanor Vance, Marcus Sterling, Chloe Bennett, Liam Harper | 4 | All 4 RBAC roles represented with password `Password123!`. |
| **Parents** | Sarah Jenkins, David Patel, Rachel Taylor, James Walker | 4 | 3 active families + 1 staged in Recovery Bin (`deletedAt`). |
| **Children / Pupils** | Oliver, Emma, Aria, Noah, Lucas | 5 | Peanut allergy, asthma, SEN, and reception badges verified. |
| **Authorised Collectors** | Sarah Jenkins, Rose Jenkins (PIN: 4821) | 2 | Emergency contact & collector PIN fixtures verified. |
| **Bookings & Consent** | Jenkins (Consented), Patel (Withdrawn), Walker (Consented) | 3 | Latest booking consent values verified. |
| **Billing Configs** | Agreed monthly fee for Jenkins (£280) and Patel (£140) | 2 | Sibling discount mapping verified. |
| **Invoices** | `INV-2026-001` (Paid), `INV-2026-002` (Partially Paid), `INV-2026-003` (Sent) | 3 | Paid, partial, and sent status fixtures verified. |
| **Payments** | Bank Transfer verified (£280), Cash verified (£70), TFC pending (£70) | 3 | Verified and pending voucher states verified. |
| **Session Credit** | Aria Patel (1 session forgiven) | 1 | Absence forgiveness note verified. |
| **Incidents** | Oliver (First aid knee scrape), Aria (Generic safeguarding log) | 2 | Body-map coords & generic policy placeholder verified. |
| **Registrations** | James Walker / Lucas Walker (`awaiting_confirmation`) | 1 | Digital signature data URL fixture verified. |
| **Student Notes** | Oliver Jenkins (`progress` note by Liam Harper) | 1 | Progress note timeline entry verified. |

---

## 5. Login & Role Capture Readiness

| Role | Synthetic Account Email | Default Password | Centre Scoping | Capture Status |
|---|---|---|---|---|
| **Organisation Owner** | `eleanor.vance@example.test` | `Password123!` | All Centres (`central`, `riverside`) | **READY FOR CAPTURE** |
| **Centre Manager** | `marcus.sterling@example.test` | `Password123!` | `Oakridge Central` & `Oakridge Riverside` | **READY FOR CAPTURE** |
| **Front Desk Staff** | `chloe.bennett@example.test` | `Password123!` | `Oakridge Central` | **READY FOR CAPTURE** |
| **Tutor / Leader** | `liam.harper@example.test` | `Password123!` | `Oakridge Central` | **READY FOR CAPTURE** |
| **Parent Portal** | `sarah.jenkins@example.test` | Magic Token `magic-token-sarah-jenkins-oakridge` | Family Jenkins | **READY FOR CAPTURE** |

---

## 6. Quality Gates & Application Health

| Quality Gate | Command | Result | Verdict |
|---|---|---|---|
| **TypeScript** | `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` | Clean (0 errors) | **PASS** |
| **ESLint** | `npm run lint` | Clean (0 errors, 0 warnings) | **PASS** |
| **Vitest** | `npm test -- --run` | **616 passed across 66 test files (+6 tests, +1 file)** | **PASS (100%)** |
| **Next.js Build** | `npx next build` | **93 routes compiled successfully** | **PASS** |
| **Production Health** | `GET https://app.sprintscaleit.co.uk/api/health` | **HTTP 200 `{"ok":true}`** | **PASS** |
| **Production DB Mutations** | Zero mutations | **0 INSERTs, 0 UPDATEs, 0 DELETEs** | **SAFE** |

---

## 7. Final Recommendation

**PASS — GUARDED SYNTHETIC CAPTURE ENVIRONMENT LIVE — READY FOR D6B**
