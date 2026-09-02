# SprintScale CMS — Post-Modernisation Enhancement PM-1B
## Content Safety Model, Asset Ingestion & Help Manifest Foundation (Reconciled PM-1B.R1)

**Enhancement Track:** PM-1 — In-App Help & Training Centre  
**Milestone:** PM-1B & PM-1B.R1 — Content Safety Model, Asset Ingestion, Help Manifest Foundation & Role-Model Forensic Reconciliation
**Certified Modernisation Baseline:** Release `cms-modernisation-v1.1.0` (`de8b4e2`) / Closure Commit `b67d5c3`  
**Date:** 2026-09-02  
**Status:** **PASS — PM-1B FOUNDATION FORENSICALLY RECONCILED — READY FOR PM-1C**

---

## 1. Executive Summary

Milestone **PM-1B** (and reconciliation **PM-1B.R1**) successfully establishes the safe content, static asset delivery, and type-safe manifest foundation for the forthcoming In-App Help & Training Centre (`/dashboard/help`).

In accordance with the architectural blueprint formulated in PM-1A and the forensic reconciliation in PM-1B.R1:
1. **Asset Ingestion & Checksums:** All 130 certified visual assets (78 screenshots and 52 micro-videos) have been ingested into the application's public asset directory (`public/training/assets/`) with 100% byte-identical SHA-256 cryptographic parity.
2. **Curated User Guides:** Exactly 34 user-facing training guides were allowlisted, scanned for secrets and PII, normalized for public asset URLs, and placed into a controlled application content directory (`src/content/help/`).
3. **Role Model vs Audience Persona Distinction (PM-1B.R1):** The role model strictly enforces that `CMS_STAFF_ROLES` (`'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR'`) matches the canonical database enum `userRoleEnum`. `PARENT` is classified strictly as a training audience persona (`HelpAudience`), **never** an authenticated CMS staff RBAC role. Staff recommendations (`recommendedStaffRoles`) only accept valid staff roles.
4. **Security Accessor & Boundary:** A strongly typed manifest (`src/lib/help/help-manifest.ts`) and secure server accessor (`src/lib/help/get-help-content.ts`) enforce a strict **default-deny** boundary preventing directory traversal or runtime exposure of internal repository files.
5. **Quality Gates:** 100% Passing (TypeScript, ESLint, 649 Vitest unit tests across 68 test files, Next.js production build compiling 93 static/dynamic routes).

---

## 2. Baseline & Immutability Verification

| Dimension | Measured State | Compliance Verdict |
|---|---|---|
| **Local `main` HEAD** | Reconciled PM-1B commit | PM-1B foundation commit |
| **Local `HEAD^`** | `1fa9ed5` | PM-1A discovery commit |
| **`origin/main`** | `b67d5c3` | Base programme closure commit |
| **`origin/rebuild/cms-modernisation`** | `b67d5c3` | Parity maintained |
| **Release Tag Target** | `cms-modernisation-v1.1.0` -> `de8b4e2` | **IMMUTABLE / UNCHANGED** |
| **Working Tree** | Clean | 0 uncommitted changes |
| **Historical D6 Source Assets** | 130 / 130 SHA-256 verified | Preserved byte-identical |

---

## 3. Allowlist Reconciliation & Security Scan

### 3.1 34 Allowlisted User Guides & Exposure Arithmetic
Audit of the 86 Markdown files in `project-notes/documentation-training/` establishes an exact, mutually exclusive top-level exposure decision:
- **Allowlisted In-App User Guides:** **34 files**
- **Excluded Internal / Evidence / Production Files:** **52 files**
- **Total Documentation Files:** **34 + 52 = 86 files (100% accounted for)**

The 34 allowlisted user guides are grouped across 7 clean categories:
1. **Getting Started & Role Guides (9):** `owner-first-30-minutes.md`, `manager-first-30-minutes.md`, `tutor-first-day.md`, `parent-getting-started.md`, `owner-guide.md`, `manager-guide.md`, `front-desk-guide.md`, `tutor-guide.md`, `parent-portal-guide.md`.
2. **Core Operations (7):** `attendance-roll-call.md`, `bookings-scheduling.md`, `children-students.md`, `student-records-notes.md`, `parents-family-records.md`, `registrations-intake.md`, `communications-notifications.md`.
3. **Safeguarding & Incidents (1):** `incidents-safeguarding.md`.
4. **Finance, Billing & Payments (4):** `finance-overview.md`, `invoices-billing.md`, `payments-reconciliation.md`, `agreed-fee-billing.md`.
5. **Administration & Setup (4):** `centres-multi-centre.md`, `staff-access-permissions.md`, `academic-year-data-maintenance.md`, `administration-settings.md`.
6. **Troubleshooting Handbooks (4):** `family-booking-troubleshooting.md`, `attendance-safeguarding-troubleshooting.md`, `finance-troubleshooting.md`, `administration-troubleshooting.md`.
7. **Master User Manual (5):** `01-system-foundations.md`, `02-family-to-booking-journey.md`, `03-attendance-to-safeguarding-journey.md`, `04-finance-billing-payments-journey.md`, `05-administration-and-operations.md`.

### 3.2 Content Security & PII Scan
- **Active Secrets Discovered:** **0** (No passwords, database URLs, API tokens, or session secrets).
- **PII Scan:** **PASS** (All family and child records use synthetic Oakridge Primary data).
- **Excluded Documents:** **52 files** (Internal operational rationales, milestone reports, freeze manifests, video scripts, bounding box logs) strictly excluded from application exposure.

---

## 4. Role Model vs Audience Persona Architecture (PM-1B.R1)

### 4.1 Canonical Staff RBAC Truth
The canonical staff role definition across the database schema (`src/db/schema.ts`, `userRoleEnum`) is:
```typescript
export const CMS_STAFF_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR'] as const;
export type HelpStaffRole = (typeof CMS_STAFF_ROLES)[number];
```
There is **no** `PARENT` staff role in the CMS RBAC model.

### 4.2 Audience Persona Model
`PARENT` is modeled strictly as a target audience persona:
```typescript
export const HELP_AUDIENCES = [
  'ALL_STAFF',
  'ORG_OWNER',
  'MANAGER',
  'FRONT_DESK',
  'TUTOR',
  'PARENT',
] as const;
export type HelpAudience = (typeof HELP_AUDIENCES)[number];
```

### 4.3 Guarantees Enforced:
1. `recommendedStaffRoles` on `HelpGuideMetadata` and `HelpVideoMetadata` strictly accepts `HelpStaffRole[]`. `PARENT` cannot be placed in `recommendedStaffRoles`.
2. For parent-facing guides (`parent-portal-guide`, `parent-getting-started`), `targetAudience` includes `'PARENT'`, while `recommendedStaffRoles` contains `['FRONT_DESK', 'MANAGER']` (staff reference for parent support).
3. `getGuidesByRole('PARENT')` returns an empty array `[]` (preventing accidental role confusion). Staff queries (`getGuidesByRole('FRONT_DESK')`) return operational guides plus parent reference guides.
4. `getGuidesByAudience('PARENT')` explicitly retrieves parent-focused material.

---

## 5. Visual Asset Ingestion & Cryptographic Verification

### 5.1 Ingestion Summary
All certified D6 visual assets were copied into the application public tree without modifying or recompressing the source files:
- **Public Screenshots:** `public/training/assets/screenshots/annotated/` (78 PNG files, 9.97 MB)
- **Public Videos:** `public/training/assets/videos/` (52 MP4 files, 45.11 MB)
- **Total Public Visual Corpus:** 130 files (55.07 MB)

### 5.2 SHA-256 Checksum Audit
Using `project-notes/documentation-training/assets/registry/d6g-certified-asset-checksums.sha256`:
- **Source Assets Match:** **130 / 130 (100%)**
- **Public Copies Match:** **130 / 130 (100%)**
- **Checksum Mismatches:** **0**

### 5.3 Public Asset URL Model
- Screenshots: `/training/assets/screenshots/annotated/SS-D6-Sxxx.png`
- Videos: `/training/assets/videos/SS-D6-Vxxx.mp4`

---

## 6. Manifest Architecture & Security Boundary

```
src/lib/help/
├── types.ts              -> Type system separating HelpStaffRole from HelpAudience
├── help-manifest.ts      -> Static metadata registry (34 guides, 52 videos, staff recommendations)
├── get-help-content.ts   -> Default-deny server-side content reader with path traversal protection
└── help-manifest.test.ts -> 25 automated unit tests verifying integrity, roles, and isolation
```

---

## 7. Verification & Quality Gates

| Quality Gate | Command | Result | Details |
|---|---|---|---|
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Full type check across all new help modules |
| **ESLint** | `npm run lint` | **PASS (0 warnings/errors)** | Code style and logger compliance |
| **Unit & Integration Tests** | `npm test -- --run` | **PASS (649/649 passed)** | 68 test files; 25 help manifest & role tests |
| **Production Build** | `npm run build` | **PASS (36.4s)** | 93 static/dynamic routes compiled cleanly |
| **Asset Checksum Audit** | `scripts/help-ingest-assets.ts` | **PASS (130/130 matched)** | 0 failures, 0 modifications |

---

## 8. Exact Git Changed-File Forensics & Stack Arithmetic

### 8.1 Stack Breakdown
- **PM-1A Changes (`b67d5c3..1fa9ed5`):** **1 file**
  - `project-notes/post-modernisation/pm1a-help-training-discovery.md`
- **PM-1B Changes (`1fa9ed5..HEAD`):** **171 files**
- **Combined Post-Modernisation Stack (`b67d5c3..HEAD`):** **172 files (1 + 171 = 172)**

### 8.2 Exact Category Breakdown for PM-1B (171 Files Total)
1. **Curated Markdown Guides (`src/content/help/**`):** **34 files**
2. **Public Screenshots (`public/training/assets/screenshots/annotated/**`):** **78 files**
3. **Public Videos (`public/training/assets/videos/**`):** **52 files**
4. **Ingestion Scripts (`scripts/**`):** **2 files** (`help-ingest-assets.ts`, `help-ingest-content.ts`)
5. **Help Source / Library Files (`src/lib/help/**`):** **3 files** (`types.ts`, `help-manifest.ts`, `get-help-content.ts`)
6. **Help Unit Tests (`src/lib/help/help-manifest.test.ts`):** **1 file**
7. **PM-1B Documentation (`project-notes/post-modernisation/**`):** **1 file** (`pm1b-help-content-foundation.md`)
8. **Other Files:** **0 files**

**Total PM-1B Changed Files:** `34 + 78 + 52 + 2 + 3 + 1 + 1 = 171 files`.
*(Note on initial report typo: The original PM-1B completion report noted 178 files due to an arithmetic typo in drafting. Git forensics conclusively prove the exact count is 171 files).*

---

## 9. Next Milestone Handoff (PM-1C)

With the safe content model, static asset routing, reconciled role/audience types, and manifest infrastructure certified:
- **Milestone PM-1C** will implement the in-app Help Centre shell (`/dashboard/help`), category navigation cards, "Recommended for your role" banner, and sidebar/header entry points.
