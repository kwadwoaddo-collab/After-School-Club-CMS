# SPRINTSCALE CMS — PM-1H
## PRODUCTION VERIFICATION, RELEASE INTEGRATION & HELP CENTRE FREEZE

**Date:** 3 September 2026  
**Status:** COMPLETED — CERTIFIED FOR PRODUCTION  
**Milestone Type:** Post-Modernisation Final Release Verification, Integration, Deployment & Freeze  
**Help Release Code SHA:** `98d30c4`  
**Help Release Tag:** `cms-help-training-v1.0.0` (Target: `98d30c4`)  
**Historical Programme Closure SHA:** `b67d5c3` (Preserved intact)  
**Historical Release Tag:** `cms-modernisation-v1.1.0` -> `de8b4e2` (Preserved intact)  

---

## 1. Baseline Verification

Before initiating PM-1H release operations, the baseline repository state was strictly verified:
- **Active Branch:** `main`
- **Starting Local HEAD:** `98d30c4` (`fix(help): complete final training centre QA`)
- **Remote `origin/main`:** `b67d5c3` (Historical Programme Closure)
- **Remote `origin/rebuild/cms-modernisation`:** `b67d5c3` (Historical Programme Closure)
- **Release Tag `cms-modernisation-v1.1.0`:** Points immutably to `de8b4e2`
- **Preflight Working Tree:** Clean (0 untracked files, 0 unstaged modifications)

---

## 2. Exact Committed-Tree Verification

All verification activities and quality gates were executed against the exact committed tree at `98d30c4`:
- `git status --porcelain`: Empty (clean)
- `git diff HEAD`: Empty (clean)
- `git diff --check`: PASS (no trailing whitespace or conflict markers)

---

## 3. Complete PM-1 Git Delta Forensic Audit

Forensic audit of the full post-modernisation enhancement delta (`b67d5c3..98d30c4`):
- **Total Commits:** 10
  1. `98d30c4` fix(help): complete final training centre QA
  2. `fe2c866` fix(help): reconcile learning path recommendations
  3. `008e72a` feat(help): add role learning paths and search
  4. `fd83b35` fix(help): polish mobile video category rail
  5. `d46ce3e` fix(help): reconcile video category navigation
  6. `2433af4` feat(help): add training video library
  7. `ce02490` feat(help): add training guide reader
  8. `c5ba2fb` feat(help): add in-app training hub
  9. `20a4e30` feat(help): establish safe training content foundation
  10. `1fa9ed5` docs(help): complete PM-1A training centre discovery
- **Total Changed Files:** 202
- **File Classification:**
  - **A. Help Application Source:** 16 files (HelpHub, HelpSearchBar, guide reader, video player, video library, learning paths, Header/Sidebar links, globals.css)
  - **B. Help Automated Tests:** 6 test files (`help-manifest.test.ts`, `help-hub.test.tsx`, `guide-reader.test.tsx`, `video-library.test.tsx`, `learning-paths-search.test.tsx`, `pm1g-final-qa.test.tsx`)
  - **C. Help Content & Manifests:** 41 files (34 markdown manuals in `src/content/help/`, 7 manifest and accessor modules in `src/lib/help/`)
  - **D. Public Training Assets:** 130 files (78 annotated screenshots + 52 MP4 videos in `public/training/assets/`)
  - **E. Tooling & Ingestion:** 2 files (`scripts/help-ingest-assets.ts`, `scripts/help-ingest-content.ts`)
  - **F. Post-Modernisation Documentation:** 7 files (`pm1a` through `pm1g` notes in `project-notes/post-modernisation/`)
  - **G. Dependency / Package Files:** 0 modified (no new packages or version bumps)
  - **H. Database / Schema / Migrations:** 0 modified (no Prisma migrations or schema changes)
  - **I. Historical D6 Source Modifications:** 0 modified (`docs/D6-reference/` untouched)
  - **J. Unrelated Application Source:** 0 modified
  - **K. Unexpected Files:** 0 files

---

## 4. Security Boundary & Default-Deny Architecture

The server-side content accessor (`src/lib/help/get-help-content.ts`) strictly enforces a **default-deny** architecture:
- Content resolution uses an explicit, hardcoded in-memory manifest allowlist (`HELP_GUIDES`).
- Slugs not present in the allowlist fail closed immediately and return `null`.
- Path resolution is sandboxed strictly inside `src/content/help/`: any path traversing outside `CONTENT_BASE_DIR` is logged as a security violation and rejected.
- Files placed arbitrarily inside `project-notes/` or elsewhere on the filesystem **cannot self-expose** or be accessed via URL manipulation.
- Automated tests in `src/lib/help/help-manifest.test.ts` verify path traversal resistance and allowlist confinement.

---

## 5. Content Exposure & Secret Audit

A recursive deterministic scan of all 41 Help content files in `src/content/help/` confirmed:
- Zero database connection strings or database credentials.
- Zero API keys, private tokens, or secret credentials.
- Zero local machine filesystem paths or internal infrastructure secrets.
- Zero test user passwords or active session tokens.
- Zero real student, parent, or staff personal identifiable information (PII).
- Mentions of `RESEND_API_KEY` and `STRIPE_SECRET_KEY` in administrator guidance manuals were audited and verified to be purely conceptual references to environment variable names, containing zero secret values.

---

## 6. Product-Truth Verification

All 21 product-truth invariants required by SprintScale operational governance were audited across all written manuals, video titles, and learning path descriptions:
1. CMS role does NOT equal formal DSL appointment.
2. CMS role does NOT equal DPO appointment.
3. Safeguarding confidential-record access is governed strictly by the application permission model.
4. No claims of UK statutory, Ofsted, or regulatory compliance exist.
5. CMS does not model or execute local-authority safeguarding referrals.
6. Parent Portal is NOT a CMS staff RBAC role.
7. Parent Portal learning path is designated strictly as "Staff Reference for Parent Support".
8. Only verified payments reduce invoice balances; no automatic unverified balance reduction.
9. Back-office overpayment does not constitute a full family monetary credit-ledger feature.
10. No payment edit, delete, or reversal workflows are claimed.
11. Invoice voiding remains an Owner-only workflow.
12. Billing-run duplicate protection concurrency limitations are accurately noted.
13. Broadcast "Delivered" semantics represent internal dispatch accounting, not external provider receipt confirmation.
14. Broadcast email dispatch uses detached in-process async behavior.
15. Sentry is classified truthfully as "Configured and SDK delivery verified".
16. V032 organisation export is a partial core-entity JSON export, not a complete GDPR/SAR export.
17. V040 represents creation of a single booking, distinct from recurring term plan setup.
18. Recurring term booking functionality remains clearly distinguished from single session booking.
19. Latest-booking communications consent semantics are accurately described.
20. Stripe and GoCardless production integrations remain deferred.
21. Live Wonde MIS synchronisation remains deferred.

---

## 7. Authentication & Access Verification

Access controls follow the authenticated staff boundary:
- **Authenticated CMS Staff:** Can discover, browse, search, read, and watch all modules.
- **Role Recommendations:**
  - `ORG_OWNER` receives "Organisation Owner" primary path recommendation.
  - `MANAGER` receives "Centre Manager" primary path recommendation.
  - `FRONT_DESK` receives "Front Desk" primary path recommendation.
  - `TUTOR` receives "Tutor / Club Leader" primary path recommendation.
- **Cross-Functional Browsing:** Non-primary paths display the intended operational audience (e.g. "Audience: Centre Managers & Site Supervisors") rather than a false personal recommendation.
- **Unauthenticated Visitors:** Requests to `/dashboard/help` and all subroutes are intercepted by middleware and redirected to `/login` (verified in local automated tests and live on production via HTTP 307).
- **Parent Portal Isolation:** Staff Help Centre is not exposed to unauthenticated public visitors or parent portal sessions.
- **Unknown Slugs:** Unknown guide, video, or learning path slugs safely return `null` and trigger standard Next.js 404 UI without application crashes.

---

## 8. Training vs Production Environment Separation

Environment safety was independently verified:
- **Active Database Host:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Approved UK AWS Neon Training Host)
- **Active Database Name:** `neondb`
- **Production Host Checked:** `ep-super-dawn-abuicpc2`
- **Production Host Contacted:** **NO**
- **Safety Flags:** `ALLOW_TRAINING_SEED=true`, `TRAINING_ENVIRONMENT=oakridge` verified.

---

## 9. Database Non-Mutation & Safety

- **PM-1 Database Migrations:** 0
- **Database Schema Mutations:** 0
- **Production DB Writes Required:** 0
- **Production Fixture Writes Required:** 0
- **Production Seed Commands Required:** 0
The Help & Training Centre operates as a completely stateless, file-backed content system requiring zero database records or schema alterations.

---

## 10. External Side-Effect Safety

During PM-1H release verification:
- Real emails sent: 0
- Real SMS sent: 0
- Stripe transactions: 0
- GoCardless transactions: 0
- Wonde API calls: 0
- Google Calendar mutations: 0
- External webhook events: 0
- Parent notification broadcasts: 0

---

## 11. Certified D6 Asset Integrity Verification

Execution of `scripts/help-ingest-assets.ts`:
- **Source Screenshots:** 78
- **Source Videos:** 52
- **Total Source Assets:** 130
- **Public Deployed Copies:** 130 verified
- **Checksum Matches:** 130 / 130 (100%)
- **Checksum Failures:** 0

---

## 12. Full Quality Gate Results

Executed against exact committed tree `98d30c4`:
- **TypeScript Typecheck (`tsc --noEmit`):** PASS (0 errors)
- **ESLint (`eslint`):** PASS (0 errors, 0 warnings)
- **Vitest Full Test Suite:** PASS (73 test files, 744 tests, 0 failures)
- **Production Build (`next build`):** PASS (153/153 static and dynamic routes compiled)
- **Git Formatting & Conflicts (`git diff --check`):** PASS

---

## 13. Help-Specific Automated Test Results

Dedicated execution of the 6 Help Centre test suites:
- `src/lib/help/help-manifest.test.ts`: 25 passed
- `src/app/dashboard/help/__tests__/help-hub.test.tsx`: 11 passed
- `src/app/dashboard/help/__tests__/guide-reader.test.tsx`: 13 passed
- `src/app/dashboard/help/__tests__/video-library.test.tsx`: 20 passed
- `src/app/dashboard/help/__tests__/learning-paths-search.test.tsx`: 34 passed
- `src/app/dashboard/help/__tests__/pm1g-final-qa.test.tsx`: 17 passed
**Total Help-Specific Tests:** 120 passed (100% pass)

---

## 14. Production Build Output Audit

The production build generated 153 routes including all Help Centre entry points:
- `○ /dashboard/help` (Help Hub)
- `ƒ /dashboard/help/guides/[slug]` (34 dynamic guide reader routes)
- `ƒ /dashboard/help/videos` (Video Library with category filtering)
- `ƒ /dashboard/help/videos/[slug]` (52 dynamic video player routes)
- `ƒ /dashboard/help/learning-paths` (Role Learning Paths Overview)
- `ƒ /dashboard/help/learning-paths/[slug]` (5 dynamic learning path detail routes)

Audited client-side bundle output:
- Zero repository filesystem paths exposed in generated bundles.
- Zero private source tokens or internal secrets embedded.
- Zero arbitrary markdown enumeration or discovery endpoints.

---

## 15. Dependency Security Snapshot (`npm audit`)

Deterministic `npm audit --json` snapshot:
- **Critical:** 0
- **High:** 11 (inherited build-time / dev dependencies: `postcss`, `sharp`, `nodemailer`)
- **Moderate:** 7 (inherited dependencies: `qs`, `uuid`, `nodemailer`)
- **Low / Info:** 0
- **Total Vulnerabilities:** 18
- **Assessment:** Zero critical vulnerabilities. All 18 items represent inherited historical maintenance debt documented at programme closure. No new vulnerabilities were introduced by PM-1.

---

## 16. Accepted Operational Debt

The established operational debt items remain transparently tracked:
1. **Broadcast Email Dispatch:** Uses detached in-process async Promise execution rather than a persistent external queue worker.
2. **Billing-Run Duplicate Protection:** Relies on application-level query pre-checks with known theoretical concurrency limitations under rapid multi-click scenarios.
3. **Observability / Sentry:** Classified as "Configured and SDK delivery verified". Live production exception capture depends on genuine live production traffic.
4. **Dependency Maintenance Debt:** 18 inherited non-critical npm audit items (`0 critical, 11 high, 7 moderate`).

---

## 17. Release Integration Graph

Forensic verification confirmed clean linear ancestry before pushing:
- `git merge-base --is-ancestor origin/main HEAD` -> YES
- `git merge-base --is-ancestor origin/rebuild/cms-modernisation HEAD` -> YES
- Fast-forward integration confirmed possible on both release branches without merge commits or history alteration.

---

## 18. Push Evidence & Synchronization

- **Pre-Push Local SHA:** `98d30c4`
- **Pre-Push `origin/main`:** `b67d5c3`
- **Pre-Push `origin/rebuild/cms-modernisation`:** `b67d5c3`
- **Push Action:** `git push origin main` executed successfully (`b67d5c3..98d30c4  main -> main`).
- **Rebuild Synchronization:** `git checkout rebuild/cms-modernisation && git merge --ff-only main && git push origin rebuild/cms-modernisation` executed successfully (`b67d5c3..98d30c4  rebuild/cms-modernisation -> rebuild/cms-modernisation`).
- **Post-Push Remote State:** Both `origin/main` and `origin/rebuild/cms-modernisation` synchronized at `98d30c4`.

---

## 19. Deployment Evidence

Production deployment was automatically triggered via Vercel GitHub integration upon push to `origin/main`:
- **Production URL:** `https://app.sprintscaleit.co.uk`
- **Platform:** Vercel Edge / Serverless Next.js runtime
- **Deployment Status:** LIVE / READY
- **Deployment SHA:** `98d30c4`

---

## 20. Public Production Smoke Verification

Live HTTP requests to production endpoints verified:
- `GET https://app.sprintscaleit.co.uk/api/health` -> `HTTP/2 200 OK` (`{"ok":true}`)
- `GET https://app.sprintscaleit.co.uk/login` -> `HTTP/2 200 OK`
- `GET https://app.sprintscaleit.co.uk/portal/login` -> `HTTP/2 200 OK`
- `GET https://app.sprintscaleit.co.uk/dashboard` -> `HTTP/2 307 Temporary Redirect` (`location: /login`)
- `GET https://app.sprintscaleit.co.uk/dashboard/help` -> `HTTP/2 307 Temporary Redirect` (`location: /login`)
- `GET https://app.sprintscaleit.co.uk/dashboard/help/videos` -> `HTTP/2 307 Temporary Redirect` (`location: /login`)
- `GET https://app.sprintscaleit.co.uk/dashboard/help/learning-paths` -> `HTTP/2 307 Temporary Redirect` (`location: /login`)
- `GET https://app.sprintscaleit.co.uk/dashboard/help/guides/attendance-roll-call` -> `HTTP/2 307 Temporary Redirect` (`location: /login`)

Unauthenticated visitors are strictly redirected to `/login`; no protected content is leaked.

---

## 21. Authenticated Production Smoke Status

**AUTHENTICATED PRODUCTION HELP SMOKE: NOT EXECUTED — SAFE PRODUCTION AUTH NOT AVAILABLE**

In accordance with Section 20 safety directives:
- No synthetic Oakridge credentials were used against production.
- No production user accounts or passwords were created, reset, or altered.
- No transactional magic links were dispatched.
- Authenticated verification was completed exhaustively on the local server against the Oakridge training environment (Milestone PM-1G certified).

---

## 22. Production Static Asset Sampling

Direct HTTP verification of deployed training assets on production:
- **Representative Screenshot (`SS-D6-S001.png`):**
  - URL: `https://app.sprintscaleit.co.uk/training/assets/screenshots/annotated/SS-D6-S001.png`
  - Status: `HTTP/2 200 OK`
  - Content-Type: `image/png`
  - Content-Length: `144810` bytes
  - Accept-Ranges: `bytes`
- **Representative Video (`SS-D6-V001.mp4`):**
  - URL: `https://app.sprintscaleit.co.uk/training/assets/videos/SS-D6-V001.mp4`
  - Request: `Range: bytes=0-1024`
  - Status: `HTTP/2 206 Partial Content`
  - Content-Range: `bytes 0-1024/282075`
  - Content-Type: `video/mp4`
  - Accept-Ranges: `bytes`
  - HTML5 video byte-range streaming verified functional.

---

## 23. Observability & Monitoring Classification

- **Sentry:** `CONFIGURED AND SDK DELIVERY VERIFIED` (truth preserved; no live production exception artificially manufactured).
- **UptimeRobot:** `LIVE AND EXTERNALLY VERIFIED` (production health reporting 200 OK).

---

## 24. Release Tagging Decision

Repository conventions and Section 19 directives were followed:
- Historical tag `cms-modernisation-v1.1.0` remains unchanged pointing to `de8b4e2`.
- A dedicated post-modernisation annotated tag was created:
  `cms-help-training-v1.0.0`
  - Target: `98d30c4` (Help Centre application release code commit)
  - Message: `"SprintScale Help & Training Centre v1.0.0"`
  - Pushed to `origin` successfully.

---

## 25. Final Branch Synchronization

- `main` (local): `98d30c4`
- `origin/main` (remote): `98d30c4`
- `rebuild/cms-modernisation` (local): `98d30c4`
- `origin/rebuild/cms-modernisation` (remote): `98d30c4`
- All branches are 100% in sync via clean fast-forward.

---

## 26. Final Help Centre Freeze Statement

The SprintScale CMS In-App Help & Training Centre (Milestones PM-1A through PM-1H) is hereby **FROZEN AND CERTIFIED FOR PRODUCTION**.

### Certified Functional Corpus:
- **34 Training Guides** (across 7 operational domains)
- **52 Training Videos** (native HTML5 click-by-click screencasts)
- **5 Role Learning Paths** (Organisation Owner, Centre Manager, Front Desk, Tutor/Club Leader, Parent Portal Staff Reference)

### Certified Visual Corpus:
- **78 Annotated High-Density Screenshots**
- **52 MP4 Screencasts**
- **130 Total D6 Verified Assets** (100% checksum match, 0 failures)

### Technical Release Integrity:
- **Quality Gates:** 0 type errors, 0 lint warnings, 744 passed tests across 73 test suites.
- **Route Count:** 153/153 routes successfully compiled.
- **Security Posture:** Default-deny server boundary, zero exposed credentials, zero database mutations.

---

## 27. Blockers & Residual Risks

- **Blocking Defects:** 0
- **Critical Security Risks:** 0
- **Residual Risks:** None. The Help Centre operates statelessly on static markdown and media assets with zero impact on core transactional databases or third-party service quotas.
