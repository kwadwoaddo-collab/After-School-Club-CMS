# SprintScale CMS — Milestone D6D Batch 1 Video Production Log
**Produced Assets:** `SS-D6-V001` → `SS-D6-V010` (10 Essential Micro-Videos)
**Date:** 2026-08-29
**Reconciliation Version:** D6D.R1 Semantic Visual Reconciliation
**Environment:** Isolated Synthetic Training (`Oakridge Learning Club Ltd`)
**Resolution:** 1440 × 900 px (16:10 Desktop Viewport)  
**Frame Rate:** 25 fps  
**Audio:** Silent Instructional Video (0 Audio Streams)  
**Security Guardrails:** `assertSafeTrainingEnvironment()` Verified | Production Mutations = 0 | Real PII = 0  

---

## 1. Batch Asset Summary

| Video ID | Title | Module | Persona / Role | Starting Route | Duration | File Size | Video QA | Technical QA | Discrepancy Classification |
|---|---|---|---|---|---|---|---|---|---|
| `SS-D6-V001` | Registering a Multi-Child Family via Public Portal | Intake | Parent (Public) | `/register/oakridge-learning` | 7.04s | 282 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | None |
| `SS-D6-V002` | Reviewing & Approving a Public Registration | Intake | Eleanor Vance (Owner) | `/dashboard/registrations` | 11.32s | 827 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | None |
| `SS-D6-V003` | Creating an Ad-Hoc Single Session Booking | Bookings | Eleanor Vance (Owner) | `/dashboard/bookings/new` | 8.00s | 501 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | Class A (Resolved via R1 Rerecord) |
| `SS-D6-V004` | Setting up a Recurring Term Booking Plan | Bookings | Eleanor Vance (Owner) | `/dashboard/bookings/new` | 6.52s | 505 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | Class A (Resolved via R1 Rerecord) |
| `SS-D6-V005` | Booking a Session via Parent Portal | Portal | Sarah Jenkins (Parent) | `/portal/book` | 8.72s | 298 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | Class A (Resolved via R1 Rerecord) |
| `SS-D6-V006` | Marking Morning and Afternoon Class Register | Classroom | Eleanor Vance (Owner) | `/dashboard/attendance` | 6.60s | 589 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | None |
| `SS-D6-V007` | Operating the Tablet Kiosk Sign-In & Pick-Up | Classroom | Eleanor Vance (Owner) | `/dashboard/kiosk` | 5.32s | 362 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | None (Verified) |
| `SS-D6-V008` | Fast Walk-In Registration on Tablet Kiosk | Classroom | Eleanor Vance (Owner) | `/dashboard/attendance` | 7.72s | 539 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | Class E (Spec / Route Location Note) |
| `SS-D6-V009` | Overriding Attendance Status (Late / Excused) | Classroom | Eleanor Vance (Owner) | `/dashboard/attendance` | 9.60s | 486 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | Class A (Resolved via R1 Rerecord) |
| `SS-D6-V010` | Forgiving an Absence on Session Credit Ledger | Ledger | Eleanor Vance (Owner) | `/dashboard/attendance/ledger` | 7.28s | 462 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) | Class A (Resolved via R1 Rerecord) |

---

## 2. Detailed Technical Profiles & D6D.R1 Reconciliations

### `SS-D6-V001`
- **Canonical Title:** Registering a Multi-Child Family via Public Portal
- **Module:** Intake
- **Persona / Role:** Parent (Public / Unauthenticated)
- **Start Route:** `/register/oakridge-learning`
- **Teaching Objective:** Demonstrates how prospective parents select a centre venue, complete parent & emergency details, input child profiles (Oliver & Emma), provide digital signatures, and submit the online registration form.
- **End State:** Registration Submitted confirmation modal with signed PDF download action.
- **Duration / Size:** 7.04s | 282,075 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V002`
- **Canonical Title:** Reviewing & Approving a Public Registration
- **Module:** Intake
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/registrations`
- **Teaching Objective:** Demonstrates intake triage workflow where managers open inbound dossiers, review parent/child profiles, and approve the registration into active status.
- **End State:** Registration dossier with approved `Signed Up` badge.
- **Duration / Size:** 11.32s | 826,757 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V003` (D6D.R1 Reconciled)
- **Canonical Title:** Creating an Ad-Hoc Single Session Booking
- **Module:** Bookings
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/bookings/new?centreId=77188a34-043b-4513-94a2-5610738e05ab`
- **Discrepancy History:** In initial Batch 1, the video incorrectly demonstrated rescheduling an existing booking.
- **Reconciliation Action:** Rerecorded using the real ad-hoc single booking creation wizard.
- **Teaching Objective:** Demonstrates opening the New Session Booking form, entering parent contact details, child name (`Oliver Jenkins`), choosing session date (`2026-09-02`) and subject (`Maths`), and creating the booking.
- **Key Action:** Selecting single session date and subject tag `Maths` on the New Session Booking form.
- **End State:** "Booking Confirmed!" summary card displaying reference code `BKG-7712`, student name, and session slot.
- **Duration / Size:** 8.00s | 500,861 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V004` (D6D.R1 Reconciled)
- **Canonical Title:** Setting up a Recurring Term Booking Plan
- **Module:** Bookings
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/bookings/new?centreId=77188a34-043b-4513-94a2-5610738e05ab`
- **Discrepancy History:** In initial Batch 1, the video showed passive roster filtering rather than plan creation.
- **Reconciliation Action:** Rerecorded demonstrating multi-child / multi-slot recurring term schedule configuration.
- **Teaching Objective:** Demonstrates configuring a recurring term booking plan for multiple siblings (`Oliver` & `Emma Jenkins`) and saving the multi-week schedule.
- **Key Action:** Adding second child to the booking form, setting term start date, and saving recurring plan.
- **End State:** "Recurring Term Booking Plan Created" confirmation displaying weekly schedule (`Mon & Wed 15:30–17:00`) across 15 weeks.
- **Duration / Size:** 6.52s | 504,791 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V005` (D6D.R1 Reconciled)
- **Canonical Title:** Booking a Session via Parent Portal
- **Module:** Portal
- **Persona / Role:** Sarah Jenkins (Parent — Authenticated via `parent_session` JWT)
- **Start Route:** `/portal/book`
- **Discrepancy History:** In initial Batch 1, the video demonstrated magic link login rather than the booking task.
- **Reconciliation Action:** Pre-authenticated parent session and executed genuine 3-step self-service booking flow on `/portal/book`.
- **Teaching Objective:** Demonstrates how parents select a child (`Oliver Jenkins`), pick an available date/time slot, and confirm a self-service session booking.
- **Key Action:** Selecting child checkbox `Oliver Jenkins` -> advancing to step 2 -> selecting date & session slot.
- **End State:** Parent Portal "Booking Confirmed!" modal with calendar sync action.
- **Duration / Size:** 8.72s | 297,816 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V006`
- **Canonical Title:** Marking Morning and Afternoon Class Register
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Tutor
- **Start Route:** `/dashboard/attendance`
- **Teaching Objective:** Demonstrates daily roll call marking on the classroom register, marking student arrival check-in and verifying recorded timestamps.
- **End State:** Daily register with updated Present status and live headcount counter.
- **Duration / Size:** 6.60s | 589,308 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V007` (Verified)
- **Canonical Title:** Operating the Tablet Kiosk Sign-In & Pick-Up
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Front Desk
- **Start Route:** `/dashboard/kiosk`
- **Teaching Objective:** Demonstrates the tablet kiosk interface used for reception desk attendance sign-in and parent collection pick-up.
- **Verification Note:** Visually demonstrates kiosk register student card interaction and arrival/departure flow.
- **End State:** Tablet kiosk view displaying active session status.
- **Duration / Size:** 5.32s | 361,939 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V008` (Verified)
- **Canonical Title:** Fast Walk-In Registration on Tablet Kiosk
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Front Desk
- **Start Route:** `/dashboard/attendance`
- **Teaching Objective:** Demonstrates how front desk staff handle unplanned walk-in students during live sessions directly from the attendance register.
- **Specification Finding (Class E):** In the canonical specification title, "Tablet Kiosk" is referenced, but the actual product feature lives in the Daily Attendance Register (`/dashboard/attendance`) via the `+ Walk-In` modal.
- **End State:** Active register displaying walk-in modal and updated session roster.
- **Duration / Size:** 7.72s | 538,984 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V009` (D6D.R1 Reconciled)
- **Canonical Title:** Overriding Attendance Status (Late / Excused)
- **Module:** Classroom
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Front Desk
- **Start Route:** `/dashboard/attendance`
- **Discrepancy History:** In initial Batch 1, only the automatic late arrival calculation was shown.
- **Reconciliation Action:** Rerecorded demonstrating both late arrival calculation (`Late 45m`) and excused absence override (`🤒 Illness`).
- **Teaching Objective:** Demonstrates adjusting pupil arrival time to trigger dynamic late status and using the absence reason sheet to record an excused illness absence.
- **Key Action:** Editing arrival time on Oliver Jenkins to `16:45` and opening absence reason sheet on Noah Taylor to select `🤒 Illness`.
- **End State:** Register displaying both the `Late 45m` badge on Oliver Jenkins and the `🤒 Illness` absence status on Noah Taylor.
- **Duration / Size:** 9.60s | 485,971 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V010` (D6D.R1 Reconciled)
- **Canonical Title:** Forgiving an Absence on Session Credit Ledger
- **Module:** Ledger
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`) / Manager
- **Start Route:** `/dashboard/attendance/ledger`
- **Discrepancy History:** In initial Batch 1, the video filtered into an empty In Arrears tab without executing forgiveness.
- **Reconciliation Action:** Rerecorded on the active ledger view, opening the Forgive Sessions modal, entering justification reason, and submitting the forgiveness action.
- **Teaching Objective:** Demonstrates expanding student balance ledger, opening the Forgive Sessions dialog, specifying session amount and audit reason, and confirming forgiveness.
- **Key Action:** Expanding student row, launching Forgive Sessions modal, and filling audit reason `Absence waived with medical certificate`.
- **End State:** Session ledger displaying updated forgiven session count and confirmation toast.
- **Duration / Size:** 7.28s | 462,116 bytes
- **QA Verdict:** CERTIFIED.

---

## 3. Review Artifacts & Derivative Files

- **Master Video Directory:** `project-notes/documentation-training/assets/videos/` (`SS-D6-V001.mp4` → `SS-D6-V010.mp4`)
- **Review Storyboard Contact Sheet:** `project-notes/documentation-training/assets/review/d6d-batch-1-video-contact-sheet.png` (912 × 2270 px)
- **Representative Review Frames (30 PNGs):** `project-notes/documentation-training/assets/review/d6d-batch-1-frames/SS-D6-V001-start.png` → `SS-D6-V010-end.png`
