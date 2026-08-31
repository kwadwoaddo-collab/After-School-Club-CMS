# SprintScale CMS — Milestone D6E Batch 1 Production Log

## 1. Batch Overview & Provenance

- **Milestone:** D6E — Remaining Training Video Production
- **Batch:** Batch 1 (`SS-D6-V033` → `SS-D6-V042`)
- **Execution Mode:** Isolated Synthetic Environment (`Oakridge Learning Club`)
- **Starting Certified Baseline:** `917407d`
- **Application Source Changes:** `0` (Strictly Prohibited & Enforced)
- **Production Mutations (INSERT / UPDATE / DELETE):** `0`
- **External Side Effects (Real Outbound Emails / Webhooks):** `0`
- **Quality Gate Verification:**
  - Video Frame Resolution: 1440x900 viewport capture
  - Format: MP4 (H.264 / AAC / WebM)
  - Semantic Progression: 3 distinct visual phases (START • ACTION • END)
  - Storyboard Contact Sheet: `project-notes/documentation-training/assets/review/d6e-batch-1-video-contact-sheet.png`

---

## 2. Asset Manifest & Video Metadata

| Asset ID | Canonical Title | Primary Route | Role / Persona Auth | Duration | File Size | Frame Timestamps (Start / Action / End) |
|---|---|---|---|---|---|---|
| `SS-D6-V033` | Adding a New Parent Manually | `/dashboard/students/add` | Front Desk (`chloe.bennett@example.test`) | 14.12s | 1,030,314 B | `02.50s` / `06.50s` / `11.00s` |
| `SS-D6-V034` | Adding a Sibling to an Existing Family | `/dashboard/students/add` | Front Desk (`chloe.bennett@example.test`) | 11.08s | 990,440 B | `02.50s` / `06.50s` / `10.00s` |
| `SS-D6-V035` | Adding an Authorised Pick-Up Collector During Registration | `/register/oakridge-learning` | Public Parent (`sarah.jenkins@example.test`) | 12.84s | 900,982 B | `02.50s` / `06.50s` / `11.00s` |
| `SS-D6-V036` | Updating Pupil Medical & Allergy Profiles | `/dashboard/students/[id]` | Front Desk (`chloe.bennett@example.test`) | 13.52s | 980,443 B | `02.50s` / `06.00s` / `10.50s` |
| `SS-D6-V037` | Logging Student Homework & Progress Notes | `/dashboard/students/[id]` | Front Desk (`chloe.bennett@example.test`) | 15.28s | 978,704 B | `03.00s` / `07.00s` / `11.50s` |
| `SS-D6-V038` | Rescheduling an Existing Booking Slot | `/dashboard/bookings/[id]` | Org Owner (`eleanor.vance@example.test`) | 23.32s | 1,459,723 B | `04.00s` / `11.00s` / `19.50s` |
| `SS-D6-V039` | Cancelling a Booking Slot | `/dashboard/bookings` | Org Owner (`eleanor.vance@example.test`) | 15.96s | 1,290,442 B | `02.50s` / `05.50s` / `11.00s` |
| `SS-D6-V040` | Creating a Session Booking for a Family | `/dashboard/bookings` | Manager (`marcus.sterling@example.test`) | 17.28s | 1,109,362 B | `03.00s` / `07.00s` / `11.50s` |
| `SS-D6-V041` | Adjusting Attendance Arrival Timelogs | `/dashboard/attendance` | Manager (`marcus.sterling@example.test`) | 25.72s | 1,308,791 B | `03.00s` / `07.00s` / `11.50s` |
| `SS-D6-V042` | Exporting Daily Roll Call Attendance CSV | `/dashboard/attendance` | Front Desk (`chloe.bennett@example.test`) | 13.68s | 678,762 B | `03.00s` / `06.50s` / `11.00s` |

---

## 3. Synthetic Training Mutation Accounting

| Asset ID | Canonical Title | Training INSERT | Training UPDATE | Training DELETE | Affected Tables | Key Persisted Field / State |
|---|---|---|---|---|---|---|
| `SS-D6-V033` | Adding a New Parent Manually | 2 | 0 | 0 | `parents`, `children` | `parents.email = 'james.watson@example.test'`, `children.firstName = 'Emily'` |
| `SS-D6-V034` | Adding a Sibling to an Existing Family | 1 | 0 | 0 | `children` | `children.firstName = 'Leo'`, `children.parentId = <sarahJenkins.id>` |
| `SS-D6-V035` | Adding an Authorised Pick-Up Collector During Registration | 0 | 0 | 0 | None (Client Form State) | Form fields populated (`Arthur Jenkins`, `Grandfather`) |
| `SS-D6-V036` | Updating Pupil Medical & Allergy Profiles | 0 | 1 | 0 | `children` | `children.notes` updated with emergency medical/allergy profile |
| `SS-D6-V037` | Logging Student Homework & Progress Notes | 1 | 0 | 0 | `studentNotes` | `studentNotes.noteType = 'progress'`, `studentNotes.subject = 'Homework Help'` |
| `SS-D6-V038` | Rescheduling an Existing Booking Slot | 1 | 1 | 0 | `bookings`, `notifications` | `bookings.startAt = 2026-09-08T16:30:00.000Z`, `notifications` row inserted |
| `SS-D6-V039` | Cancelling a Booking Slot | 0 | 1 | 0 | `bookings` | `bookings.status = 'cancelled'`, `bookings.updatedAt` |
| `SS-D6-V040` | Creating a Session Booking for a Family | 0 | 0 | 0 | None (Client Wizard State) | Step 1 session booking wizard configured |
| `SS-D6-V041` | Adjusting Attendance Arrival Timelogs | 0 | 1 | 0 | `bookingAttendees` | `bookingAttendees.checkInAt`, `bookingAttendees.attendanceStatus = 'present'` |
| `SS-D6-V042` | Exporting Daily Roll Call Attendance CSV | 0 | 0 | 0 | None (Read-only Export) | Streamed CSV attachment (`register-YYYY-MM-DD.csv`) |
| **TOTALS** | **Batch 1 Totals** | **5** | **4** | **0** | — | — |

---

## 4. Side-Effect & Safety Arithmetic

- **Production Data Guard (`src/lib/training-guard.ts`):** `ACTIVE / FAIL-CLOSED`
- **Target Database Environment:** Synthetic sandbox (`Oakridge Learning Club`, `d682f873-1301-4159-a6ca-0c40949c671c`)
- **Production Records Affected:** `0`
- **Simulated / Synthetic Outbound Communications:** `0` real outbound messages delivered.
- **External Network Requests to Third Parties:** `0`

---

## 5. Milestone Progression Summary

- **Certified Screenshots:** 78 / 78 (`SS-D6-S001` → `SS-D6-S078`) — **100% COMPLETE & FROZEN**
- **Certified Essential Videos (D6D):** 32 / 32 (`SS-D6-V001` → `SS-D6-V032`) — **100% COMPLETE & FROZEN**
- **D6E Remaining Videos:** 10 / 20 (`SS-D6-V033` → `SS-D6-V042` Produced in Batch 1)
- **Cumulative Visual Training Assets Produced:** 120 / 130
