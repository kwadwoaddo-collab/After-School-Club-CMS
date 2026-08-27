# SprintScale CMS — Micro-Video Training Scripts
## Milestone D3: Attendance, Roll Call, Kiosk, Session Ledger, Student Notes & Safeguarding

**Scope:** Authoritative recording scripts for Milestone D6 video production.  
**Video Target Duration:** 30 seconds – 2 minutes per focused task.  
**Standard Production Rules:** British English narration, clean synthetic demo accounts only, zero real child/parent PII, 1440×900 desktop viewport (or standard tablet for Kiosk), synchronized captions (SRT/VTT).

---

## Master Video Script Index

| Video ID | Title | Primary Audience | Importance | Target Duration |
|---|---|---|---|---|
| **D3-V01** | Opening Attendance & Centre Selection | All Staff | STANDARD | 45 Seconds |
| **D3-V02** | Conducting Daily Roll Call | Tutors / Front Desk / Managers | **ESSENTIAL** | 60 Seconds |
| **D3-V03** | Checking In a Child with Timestamps | Tutors / Front Desk / Managers | **ESSENTIAL** | 45 Seconds |
| **D3-V04** | Checking Out a Child with Collector Verification | Tutors / Front Desk / Managers | **ESSENTIAL** | 45 Seconds |
| **D3-V05** | Marking an Absence & Structured Reason | Tutors / Front Desk / Managers | **ESSENTIAL** | 45 Seconds |
| **D3-V06** | Managing Late Arrivals & Derived Minutes | Tutors / Front Desk / Managers | STANDARD | 45 Seconds |
| **D3-V07** | Logging an Unscheduled Walk-In Arrival | Front Desk / Managers | **ESSENTIAL** | 60 Seconds |
| **D3-V08** | Executing Bulk Check-In/Out Actions | Front Desk / Managers | STANDARD | 45 Seconds |
| **D3-V09** | Operating Touchscreen Tablet Kiosk Mode | Tutors / Front Desk | **ESSENTIAL** | 60 Seconds |
| **D3-V10** | Correcting an Attendance Timestamp | Front Desk / Managers / Owners | STANDARD | 45 Seconds |
| **D3-V11** | Granting Forgiveness in Session Ledger | Managers / Owners | **ESSENTIAL** | 60 Seconds |
| **D3-V12** | Adding Ordinary Student Notes & Flags | Tutors / Managers | STANDARD | 45 Seconds |
| **D3-V13** | Logging a First Aid Accident Report | Front Desk / Managers / Owners | **ESSENTIAL** | 60 Seconds |
| **D3-V14** | Recording a Restricted Safeguarding Record (Manager/Owner)| Managers / Owners | **ESSENTIAL** | 75 Seconds |
| **D3-V15** | Identifying Medical & Allergy Badges on Roll Call | Tutors / All Staff | STANDARD | 45 Seconds |

---

## Detailed Script Specifications

### D3-V02: Conducting Daily Roll Call
- **Audience:** Tutors, Front Desk, Managers
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/attendance`
- **Synthetic Data:** Centre "Oakridge Primary Club", Students "Jamie Example", "Taylor Example", "Riley Example"
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "Learn how to conduct daily roll call in under one minute."
  - `00:10 - 00:25`: Open `/dashboard/attendance`. Verify centre selection. Point cursor to headcount summary bar.
  - `00:25 - 00:45`: Tap `Check In` on Jamie Example (on-time). Tap `Check In` on Taylor Example (late — highlight *7m late* badge).
  - `00:45 - 01:00`: Show live present/late headcount counter update at the top of the register.

---

### D3-V09: Operating Touchscreen Tablet Kiosk Mode
- **Audience:** Tutors, Front Desk Staff
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/kiosk` (Tablet Viewport)
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Open `/dashboard/kiosk`. Highlight large touch card layout.
  - `00:10 - 00:30`: Child arrives at door: Tap green `Check In` button on student card. Button transitions to green checkmark with `08:02 AM`.
  - `00:30 - 00:45`: Show pickup collection: Tap `Check Out` on student card.
  - `00:45 - 01:00`: Explain that all timestamps instantly sync to the back-office management dashboard.

---

### D3-V11: Granting Forgiveness in Session Ledger
- **Audience:** Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/attendance/ledger`
- **Synthetic Data:** Student "Morgan Example", Scheduled Absences: 2, Net Balance: -2
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Open `Sidebar → Attendance → Session Ledger`.
  - `00:10 - 00:25`: Locate Morgan Example with `-2` balance in red. Click `Forgive Sessions`.
  - `00:25 - 00:45`: Enter Sessions Amount: `2`. Enter Audit Note: `Approved absence per club policy`.
  - `00:45 - 01:00`: Click `Grant Forgiveness Credit`. Show net balance update immediately to `0` without altering invoices.

---

### D3-V13: Logging a First Aid Accident Report
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/incidents`
- **Synthetic Data:** Student "Alex Example", Injury: Scraped left knee, Treatment: Saline wipe + plaster
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Click `+ Log Incident` in top right.
  - `00:10 - 00:30`: Select Type `Accident`, select Child `Alex Example`. Enter date/time.
  - `00:30 - 00:48`: Enter Description and Treatment. Enter witness name and sign in signature canvas.
  - `00:48 - 01:00`: Click `Save Incident Record`. Show record saved in the health and safety log.

---

### D3-V14: Recording a Restricted Safeguarding Record (Manager/Owner)
- **Audience:** Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 75s
- **Starting Screen:** `/dashboard/incidents`
- **Synthetic Data:** Fictitious demo student "Demo Child", Minimal generic note: "Observation recorded per organisation safeguarding policy."
- **Production Note:** Do NOT use realistic or graphic safeguarding narratives. Use purely generic placeholder phrases.
- **Timeline & Click Sequence:**
  - `00:00 - 00:15`: Title Card. "Restricted Safeguarding Record Creation (Manager/Owner Access)."
  - `00:15 - 00:35`: Open `/dashboard/incidents`. Click `+ Log Incident`. Select Type `Safeguarding`.
  - `00:35 - 00:55`: Select Demo Child. Enter generic factual text: "Observation recorded per organisation safeguarding policy."
  - `00:55 - 01:15`: Sign digital signature and click `Save Incident Record`. Highlight that this record type is accessible only to Manager and Owner accounts.
