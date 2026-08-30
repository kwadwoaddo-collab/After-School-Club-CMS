# SprintScale CMS — Milestone D6D Batch 4 Production Log
## Essential Videos `SS-D6-V031` → `SS-D6-V032` (Final Essential Batch)

---

## 1. Batch 4 Production Inventory Summary

| Video ID | Final Canonical Title | Module | Persona (Role) | Target Route | Duration | File Size | Video QA Status | Technical Standard |
|---|---|---|---|---|---|---|---|---|
| `SS-D6-V031` | Parent Magic Link Sign-In & Portal Tour | Parent Portal / Auth | Sarah Jenkins (Parent) | `/portal/login` | 13.52s | 679 KB | **CERTIFIED** | **PASS** (1440×900, 25fps, Progressive) |
| `SS-D6-V032` | Exporting Complete Organisation GDPR Data | Settings / Privacy | Eleanor Vance (Owner) | `/dashboard/settings` | 10.84s | 872 KB | **CERTIFIED** | **PASS** (1440×900, 25fps, Progressive) |

---

## 2. Representative Frame Semantic Timestamps Table

All representative review frames are extracted at semantic timestamps tailored to the specific instructional sequence inside each video:

| Video ID | Title | Total Duration | Phase 1 (Start) | Phase 2 (Key Action) | Phase 3 (End State) |
|---|---|---|---|---|---|
| `SS-D6-V031` | Parent Magic Link Sign-In & Portal Tour | 13.52s | `02.50s` | `06.50s` | `11.50s` |
| `SS-D6-V032` | Exporting Complete Organisation GDPR Data | 10.84s | `02.50s` | `06.00s` | `10.00s` |

---

## 3. Detailed Instructional & Technical Profiles

### `SS-D6-V031`: Parent Magic Link Sign-In & Portal Tour
- **Asset ID:** `SS-D6-V031`
- **Registry Title:** `Parent Magic Link Sign-In & Portal Tour`
- **Final Canonical Title:** `Parent Magic Link Sign-In & Portal Tour`
- **Title Changed:** `NO`
- **Module:** Parent Portal / Authentication
- **Persona:** Sarah Jenkins (Parent: `sarah.jenkins@example.test`)
- **Application Role:** Parent (`PARENT`)
- **Organisational Designation:** Enrolled Parent (`Oakridge Learning Club Ltd`)
- **Route:** `/portal/login` ➔ `/portal/verify?token=...` ➔ `/portal`
- **Teaching Objective:** Demonstrates passwordless parent authentication via magic link, entering the registered email address, opening the one-time verification link, landing on the Parent Portal dashboard, and reviewing children (`Oliver` & `Emma Jenkins`) and active bookings.
- **Actual Workflow:** User opens `/portal/login`, inputs `sarah.jenkins@example.test`, clicks *Send Magic Link*, receives the verified token card with link, clicks the verification link to authenticate into Next.js parent session, lands on the settled `/portal` dashboard, and scrolls to tour children and bookings.
- **START State:** Settled `/portal/login` page with Parent Portal card and email input field.
- **ACTION:** Submitting email, viewing the link confirmation card, and clicking the verification link.
- **END State:** Settled Parent Portal dashboard (`Sarah's Portal`) displaying Overdue Balance, Book a Session CTA, My Children cards (`Oliver Jenkins` Year 3, `Emma Jenkins` Reception), and navigation headers.
- **Duration:** 13.52s
- **Resolution:** 1440×900
- **FPS:** 25 fps
- **Codec:** VP8 (libvpx), progressive, yuv420p
- **Audio:** None (Silent)
- **File Size:** 695,732 bytes
- **START Timestamp:** `02.50s`
- **ACTION Timestamp:** `06.50s`
- **END Timestamp:** `11.50s`
- **Fixture:** Parent `Sarah Jenkins` (`sarah.jenkins@example.test`) with children Oliver & Emma Jenkins.
- **Training Mutations:** 1 UPDATE (`parents.magic_link_token`, `parents.magic_link_expires_at`).
- **Permission QA:** Verified passwordless parent authentication and session establishment via cryptographic token.
- **Privacy QA:** 100% synthetic training fixtures; 0 real PII.
- **Technical QA:** 1440×900 @ 25fps, 0 decode errors, 0 audio tracks.
- **Playback QA:** PASS (smooth transitions, clean form entry, verified portal landing).
- **Storyboard QA:** PASS (3 distinct instructional phases verified in contact sheet).
- **Discrepancy Classification:** None.
- **Final Status:** **CERTIFIED**

---

### `SS-D6-V032`: Exporting Complete Organisation GDPR Data
- **Asset ID:** `SS-D6-V032`
- **Registry Title:** `Exporting Complete Organisation GDPR Data`
- **Final Canonical Title:** `Exporting Complete Organisation GDPR Data`
- **Title Changed:** `NO`
- **Module:** Settings / Privacy & Compliance
- **Persona:** Eleanor Vance (`eleanor.vance@example.test`)
- **Application Role:** Organisation Owner (`ORG_OWNER`)
- **Organisational Designation:** Club Owner & Data Protection Officer (`Oakridge Learning Club Ltd`)
- **Route:** `/dashboard/settings?tab=danger_zone`
- **Teaching Objective:** Demonstrates how organisation owners export all stored personal records (parents, pupils, registrations, bookings) as a portable JSON file to fulfill GDPR Subject Access Requests (SAR) and data portability obligations.
- **Actual Workflow:** Eleanor Vance opens Workspace Settings, switches to the *Danger Zone* tab, navigates to *Privacy & Compliance*, clicks *Export Data*, awaits server-side collation of JSON records, and receives the green completion toast ("Export ready: GDPR data export downloaded successfully.").
- **START State:** Settled Workspace Settings page on the *Danger Zone* tab, showing *Privacy & Compliance* and the *GDPR Data Export* card.
- **ACTION:** Clicking *Export Data* button, triggering asynchronous organisation export collation.
- **END State:** Settled Danger Zone page displaying the green confirmation toast ("Export ready: GDPR data export downloaded successfully.") with the export button restored to idle state.
- **Duration:** 10.84s
- **Resolution:** 1440×900
- **FPS:** 25 fps
- **Codec:** VP8 (libvpx), progressive, yuv420p
- **Audio:** None (Silent)
- **File Size:** 893,344 bytes
- **START Timestamp:** `02.50s`
- **ACTION Timestamp:** `06.00s`
- **END Timestamp:** `10.00s`
- **Fixture:** Authenticated Organisation Owner Eleanor Vance (`Oakridge Learning Club Ltd`).
- **Training Mutations:** 0 INSERTs, 0 UPDATEs, 0 DELETEs (Read-only collation query).
- **Permission QA:** Verified server-side check `session.user.role === 'ORG_OWNER'`.
- **Privacy QA:** 100% synthetic training fixtures; 0 real PII.
- **Technical QA:** 1440×900 @ 25fps, 0 decode errors, 0 audio tracks.
- **Playback QA:** PASS (smooth tab navigation, clear action trigger, verified toast notification).
- **Storyboard QA:** PASS (3 distinct instructional phases verified in contact sheet).
- **Discrepancy Classification:** None.
- **Final Status:** **CERTIFIED**

---

## 4. D6D Complete Essential Video Programme Inventory (V001–V032)

| Batch | Range | Target Count | Produced & QA Verified | Status |
|---|---|---|---|---|
| Batch 1 | `SS-D6-V001` → `SS-D6-V010` | 10 | 10 | **CERTIFIED** |
| Batch 2 | `SS-D6-V011` → `SS-D6-V020` | 10 | 10 | **CERTIFIED** |
| Batch 3 | `SS-D6-V021` → `SS-D6-V030` | 10 | 10 | **CERTIFIED** |
| Batch 4 | `SS-D6-V031` → `SS-D6-V032` | 2 | 2 | **CERTIFIED** |
| **Total** | **`SS-D6-V001` → `SS-D6-V032`** | **32** | **32** | **D6D PRODUCTION COMPLETE (100%)** |
