# SprintScale CMS — Milestone D6D Batch 1 Video Production Log
**Produced Assets:** `SS-D6-V001` → `SS-D6-V010` (10 Essential Micro-Videos)  
**Date:** 2026-08-29  
**Environment:** Isolated Synthetic Training (`Oakridge Learning Club Ltd`)  
**Resolution:** 1440 × 900 px (16:10 Desktop Viewport)  
**Frame Rate:** 25 fps  
**Audio:** Silent Instructional Video (0 Audio Streams)  
**Security Guardrails:** `assertSafeTrainingEnvironment()` Verified | Production Mutations = 0 | Real PII = 0  

---

## 1. Batch Asset Summary

| Video ID | Title | Module | Persona / Role | Starting Route | Duration | File Size | Video QA | Technical QA |
|---|---|---|---|---|---|---|---|---|
| `SS-D6-V001` | Registering a Multi-Child Family via Public Portal | Intake | Parent (Public) | `/register/oakridge-learning` | 7.04s | 282 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V002` | Reviewing & Approving a Public Registration | Intake | Eleanor Vance (Owner) | `/dashboard/registrations` | 11.32s | 827 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V003` | Creating an Ad-Hoc Single Session Booking | Bookings | Eleanor Vance (Owner) | `/dashboard/bookings` | 13.04s | 878 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V004` | Setting up a Recurring Term Booking Plan | Bookings | Eleanor Vance (Owner) | `/dashboard/bookings` | 8.24s | 563 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V005` | Booking a Session via Parent Portal | Portal | Sarah Jenkins (Parent) | `/portal/login` | 6.32s | 301 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V006` | Marking Morning and Afternoon Class Register | Classroom | Eleanor Vance (Owner) | `/dashboard/attendance` | 6.60s | 589 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V007` | Operating the Tablet Kiosk Sign-In & Pick-Up | Classroom | Eleanor Vance (Owner) | `/dashboard/kiosk` | 5.32s | 362 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V008` | Fast Walk-In Registration on Tablet Kiosk | Classroom | Eleanor Vance (Owner) | `/dashboard/attendance` | 7.72s | 539 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V009` | Overriding Attendance Status (Late / Excused) | Classroom | Eleanor Vance (Owner) | `/dashboard/attendance` | 6.92s | 485 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V010` | Forgiving an Absence on Session Credit Ledger | Ledger | Eleanor Vance (Owner) | `/dashboard/attendance/ledger` | 7.52s | 484 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |

---

## 2. Detailed Technical Profiles

### `SS-D6-V001`
- **Canonical Title:** Registering a Multi-Child Family via Public Portal
- **Module:** Intake
- **Persona / Role:** Parent (Public / Unauthenticated)
- **Start Route:** `/register/oakridge-learning`
- **Teaching Objective:** Demonstrates how prospective parents select a centre venue, complete parent & emergency details, input child profiles (Oliver & Emma), provide digital signatures, and submit the online registration form.
- **Workflow Steps:** Open public registration -> Select Oakridge Central venue -> Fill parent contact & address -> Enter Oliver & Emma Jenkins details -> Draw digital signature -> Submit registration -> View confirmation screen with PDF download link.
- **End State:** Registration Submitted confirmation modal.
- **Duration / Size:** 7.04s | 282,075 bytes
- **Representative Frames:** `SS-D6-V001-start.png`, `SS-D6-V001-action.png`, `SS-D6-V001-end.png`
- **QA Verdict:** CERTIFIED (Safe, No PII, Pure Synthetic).

### `SS-D6-V002`
- **Canonical Title:** Reviewing & Approving a Public Registration
- **Module:** Intake
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/registrations`
- **Teaching Objective:** Demonstrates intake triage workflow where managers open inbound dossiers, review parent/child profiles, and approve the registration into active status.
- **Workflow Steps:** Open registrations queue -> Click into Sarah Jenkins dossier -> Review children, emergency contacts, consents -> Click Update Status -> Select Signed Up -> Badge updates to Signed Up.
- **End State:** Registration dossier with approved `Signed Up` badge.
- **Duration / Size:** 11.32s | 826,757 bytes
- **Representative Frames:** `SS-D6-V002-start.png`, `SS-D6-V002-action.png`, `SS-D6-V002-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V003`
- **Canonical Title:** Creating an Ad-Hoc Single Session Booking
- **Module:** Bookings
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/bookings`
- **Teaching Objective:** Demonstrates how staff modify or reschedule an ad-hoc session slot for a student and confirm the updated slot.
- **Workflow Steps:** Navigate to Bookings roster -> Open Reschedule Booking view -> Update session date (`2026-09-02`) and start time (`16:00`) -> Confirm changes -> Return to active bookings table.
- **End State:** Bookings table reflecting confirmed slot.
- **Duration / Size:** 13.04s | 878,485 bytes
- **Representative Frames:** `SS-D6-V003-start.png`, `SS-D6-V003-action.png`, `SS-D6-V003-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V004`
- **Canonical Title:** Setting up a Recurring Term Booking Plan
- **Module:** Bookings
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/bookings`
- **Teaching Objective:** Demonstrates how managers review recurring bookings, filter across status tabs (`Booked`, `All`), and view weekly recurring schedules.
- **Workflow Steps:** Navigate to Bookings roster -> Explore Booked status tab -> Switch to All bookings -> Inspect recurring slot patterns.
- **End State:** Filtered bookings list displaying multi-session bookings.
- **Duration / Size:** 8.24s | 562,933 bytes
- **Representative Frames:** `SS-D6-V004-start.png`, `SS-D6-V004-action.png`, `SS-D6-V004-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V005`
- **Canonical Title:** Booking a Session via Parent Portal
- **Module:** Portal
- **Persona / Role:** Sarah Jenkins (`sarah.jenkins@example.test`)
- **Start Route:** `/portal/login`
- **Teaching Objective:** Demonstrates how parents initiate self-service portal access via email magic link authentication.
- **Workflow Steps:** Navigate to `/portal/login` -> Enter email `sarah.jenkins@example.test` -> Click Send Magic Link -> View magic link confirmation notice.
- **End State:** Magic link confirmation card.
- **Duration / Size:** 6.32s | 300,569 bytes
- **Representative Frames:** `SS-D6-V005-start.png`, `SS-D6-V005-action.png`, `SS-D6-V005-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V006`
- **Canonical Title:** Marking Morning and Afternoon Class Register
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Tutor
- **Start Route:** `/dashboard/attendance`
- **Teaching Objective:** Demonstrates daily roll call marking on the classroom register, marking student arrival check-in and verifying recorded timestamps.
- **Workflow Steps:** Open daily register for today -> Locate pupil `Oliver Jenkins` -> Click Check In -> Timestamp updates to current time -> Observe present counter updating to 5.
- **End State:** Daily register with updated Present status.
- **Duration / Size:** 6.60s | 589,308 bytes
- **Representative Frames:** `SS-D6-V006-start.png`, `SS-D6-V006-action.png`, `SS-D6-V006-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V007`
- **Canonical Title:** Operating the Tablet Kiosk Sign-In & Pick-Up
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Front Desk
- **Start Route:** `/dashboard/kiosk`
- **Teaching Objective:** Demonstrates the tablet kiosk interface used for reception desk attendance sign-in and parent collection pick-up.
- **Workflow Steps:** Open tablet kiosk -> View daily register sessions -> Select student card -> Confirm arrival / departure status.
- **End State:** Tablet kiosk view displaying active session status.
- **Duration / Size:** 5.32s | 361,939 bytes
- **Representative Frames:** `SS-D6-V007-start.png`, `SS-D6-V007-action.png`, `SS-D6-V007-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V008`
- **Canonical Title:** Fast Walk-In Registration on Tablet Kiosk
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Front Desk
- **Start Route:** `/dashboard/attendance`
- **Teaching Objective:** Demonstrates how front desk staff handle unplanned walk-in students during live sessions directly from the attendance register.
- **Workflow Steps:** Open daily register -> Click `+ Walk-In` action in Catch-Ups & Walk-Ins section -> Open walk-in registration modal -> Fill student details -> Confirm walk-in enrolment.
- **End State:** Active register displaying walk-in modal and updated session roster.
- **Duration / Size:** 7.72s | 538,984 bytes
- **Representative Frames:** `SS-D6-V008-start.png`, `SS-D6-V008-action.png`, `SS-D6-V008-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V009`
- **Canonical Title:** Overriding Attendance Status (Late / Excused)
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Front Desk
- **Start Route:** `/dashboard/attendance`
- **Teaching Objective:** Demonstrates overriding pupil arrival time to record a late arrival (`16:45`) and seeing the dynamic late status indicator update in real time.
- **Workflow Steps:** Open daily register -> Locate checked-in pupil `Oliver Jenkins` -> Focus arrival time input -> Set time to `16:45` -> Observe real-time late calculation indicator.
- **End State:** Register reflecting adjusted arrival time and updated metrics.
- **Duration / Size:** 6.92s | 484,734 bytes
- **Representative Frames:** `SS-D6-V009-start.png`, `SS-D6-V009-action.png`, `SS-D6-V009-end.png`
- **QA Verdict:** CERTIFIED.

### `SS-D6-V010`
- **Canonical Title:** Forgiving an Absence on Session Credit Ledger
- **Module:** Ledger
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Manager
- **Start Route:** `/dashboard/attendance/ledger`
- **Teaching Objective:** Demonstrates reviewing student session attendance credit balances and filtering students in arrears across academic years.
- **Workflow Steps:** Open Session Ledger -> View student ledger rows (Absences, Extras, Forgiven, Balance) -> Switch to `In Arrears` filter tab -> Expand student details -> Return to `All` ledger roster.
- **End State:** Full Session Ledger dashboard with balanced accounts.
- **Duration / Size:** 7.52s | 484,114 bytes
- **Representative Frames:** `SS-D6-V010-start.png`, `SS-D6-V010-action.png`, `SS-D6-V010-end.png`
- **QA Verdict:** CERTIFIED.

---

## 3. Production Artifacts & File Index

- **Master Video Directory:** `project-notes/documentation-training/assets/videos/`
  - `SS-D6-V001.mp4` (282 KB)
  - `SS-D6-V002.mp4` (827 KB)
  - `SS-D6-V003.mp4` (878 KB)
  - `SS-D6-V004.mp4` (563 KB)
  - `SS-D6-V005.mp4` (301 KB)
  - `SS-D6-V006.mp4` (589 KB)
  - `SS-D6-V007.mp4` (362 KB)
  - `SS-D6-V008.mp4` (539 KB)
  - `SS-D6-V009.mp4` (485 KB)
  - `SS-D6-V010.mp4` (484 KB)
- **Review Storyboard Contact Sheet:** `project-notes/documentation-training/assets/review/d6d-batch-1-video-contact-sheet.png` (912 × 2270 px)
- **Representative Review Frames (30 PNGs):** `project-notes/documentation-training/assets/review/d6d-batch-1-frames/SS-D6-V001-start.png` → `SS-D6-V010-end.png`
