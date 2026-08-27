# SprintScale CMS — Annotated Screenshot Plan
## Milestone D3: Attendance, Roll Call, Kiosk, Session Ledger, Student Notes & Safeguarding

**Scope:** Authoritative visual asset specifications for Milestone D6 screenshot production.  
**Production Rules:** Clean 1440×900 desktop viewport (or standard tablet for Kiosk), synthetic demo accounts only, zero real child/parent PII, high-contrast rounded rectangular highlight boxes, numbered circular badges (`①`, `②`, `③`).

---

## Master Screenshot Specifications Index

| Screenshot ID | Manual & Section | Target Route / Page | Target Role | Key Visible UI Elements & Highlights |
|---|---|---|---|---|
| **D3-S01** | `attendance.md` §1 | `/dashboard/attendance` | Tutors / Front Desk | Attendance header, date picker, centre selector, total headcount KPIs. |
| **D3-S02** | `attendance.md` §5 | Attendance Centre Menu | All Staff | Centre switcher dropdown, active venue selection checkmark. |
| **D3-S03** | `attendance.md` §4 | Roll Call Roster | Tutors / Front Desk | Roster table/cards, student names, school years, medical flags. |
| **D3-S04** | `attendance.md` §5 | Attendance Card (Present) | Tutors / Front Desk | Green "Present" badge, `checkInAt` timestamp (`15:32`). |
| **D3-S05** | `attendance.md` §4 | Attendance Card (Late) | Tutors / Front Desk | Yellow "Late" badge, derived late minutes badge (`+17m`). |
| **D3-S06** | `attendance.md` §5 | Mark Absent Modal | Tutors / Front Desk | Absence reason dropdown (`Illness`, `Holiday`, `Family`, `Other`), note field. |
| **D3-S07** | `attendance.md` §5 | Attendance Card (Departed)| Tutors / Front Desk | Gray "Checked Out" badge, `checkOutAt` timestamp (`18:01`). |
| **D3-S08** | `attendance.md` §5 | Walk-In Creation Modal | Front Desk / Manager | Rapid walk-in form, parent search, child checkbox, create button. |
| **D3-S09** | `attendance.md` §5 | Bulk Action Controls | Front Desk / Manager | Multi-select checkboxes, "Mark Selected Present" action bar. |
| **D3-S10** | `attendance.md` §5 | `/dashboard/kiosk` | Tutors / Front Desk | Tablet touchscreen card grid, large touch buttons, high contrast. |
| **D3-S11** | `attendance.md` §5 | Kiosk Touch Interaction | Tutors / Front Desk | Active tap on "Check In", instantaneous transition to green checkmark. |
| **D3-S12** | `attendance.md` §5 | Kiosk at 375px Mobile | Tutors / Front Desk | Verified responsive layout: cleanly stacked single-column touch cards. |
| **D3-S13** | `attendance.md` §7 | Zero-Centre Alert | Unassigned Staff | Friendly alert banner: "No accessible centres assigned to your account." |
| **D3-S14** | `attendance.md` §6 | `/dashboard/attendance/ledger`| Manager / Owner | Session Credit Ledger table, scheduled absences, extra sessions, net balance. |
| **D3-S15** | `attendance.md` §6 | Forgive Sessions Modal | Manager / Owner | Student name, sessions amount input, mandatory audit note field. |
| **D3-S16** | `student-records-notes.md` §4| Student Notes Tab | Tutors / Managers | Chronological internal notes timeline, staff author tags, category badges. |
| **D3-S17** | `student-records-notes.md` §5| Medical Alerts on Card | Tutors / All Staff | High-contrast Red Allergy Badge (Peanuts/EpiPen) on roll call card. |
| **D3-S18** | `incidents-safeguarding.md` §4| `/dashboard/incidents` | Front Desk / Manager | Standard Incident Modal: Accident type, treatment notes, signature canvas. |
| **D3-S19** | `incidents-safeguarding.md` §4| Safeguarding Modal (Manager/Owner)| Manager / Owner | Restricted Safeguarding Form, generic observation text, action notes. |
| **D3-S20** | `incidents-safeguarding.md` §3| Incidents History Table | Manager / Owner | Filtered table showing Accident, Medication, and Safeguarding badges. |

---

## Detailed Visual Specifications

### D3-S04: Student Attendance Card (Checked In / Present)
- **Filename:** `tutor-attendance-04-card-present.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/attendance`
- **Role:** Tutor / Front Desk
- **Required Synthetic Data:** Student "Jamie Example", Year 2, Start Time `15:30`, Checked in at `15:28`.
- **Annotations:**
  - Box ① around the **Green Present Badge** and timestamp `15:28`.
  - Box ② around the **Check Out** action button.
  - Box ③ around the **Homework & Behaviour Flag** icons.

---

### D3-S10: Tablet Kiosk Grid Overview
- **Filename:** `tutor-kiosk-10-tablet-grid.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/kiosk` (Tablet Viewport: 1024×768)
- **Role:** Tutor / Front Desk
- **Required Synthetic Data:** 6 student cards with large touch targets.
- **Annotations:**
  - Box ① around the large touch-friendly **Check In** button.
  - Box ② around the **Medical Allergy Indicator** on the student card.
  - Box ③ around the top **Centre Title & Clock**.

---

### D3-S14: Session Credit Ledger Table
- **Filename:** `manager-attendance-14-session-ledger.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/attendance/ledger`
- **Role:** Manager / Owner
- **Required Synthetic Data:** Morgan Example, Scheduled Absences: `2`, Extras: `0`, Forgiven: `0`, Net Balance: `-2` (Red).
- **Annotations:**
  - Box ① around the **Net Balance Column** highlighting negative balance in red.
  - Box ② around the **Forgive Sessions** action button.
  - Box ③ around the **Academic Year Selector**.

---

### D3-S18: Standard Incident Form (Accident / First Aid)
- **Filename:** `frontdesk-incidents-18-accident-form.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/incidents`
- **Role:** Front Desk / Manager
- **Required Synthetic Data:** Child "Alex Example", Type: `Accident`, Description: "Tripped on cone; scraped knee", Treatment: "Saline wipe & plaster".
- **Annotations:**
  - Box ① around the **Incident Type Dropdown** showing `Accident`.
  - Box ② around the **Treatment Provided** text area.
  - Box ③ around the **Staff Digital Signature** canvas.

---

### D3-S19: Restricted Safeguarding Form (Manager / Owner View)
- **Filename:** `manager-incidents-19-safeguarding-form.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/incidents`
- **Role:** Manager / Owner
- **Required Synthetic Data:** Child "Demo Child", Type: `Safeguarding`, Description: "Observation recorded per organisation safeguarding policy.", Action: "Informed appointed DSL".
- **Annotations:**
  - Box ① around the **Incident Type Dropdown** showing `Safeguarding`.
  - Box ② around the **Description & Action Taken** text areas.
  - Box ③ around the **Staff Digital Signature** canvas.
