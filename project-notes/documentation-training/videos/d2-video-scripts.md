# SprintScale CMS — Micro-Video Training Scripts
## Milestone D2: Parents, Children/Students, Registrations & Bookings

**Scope:** Authoritative recording scripts for Milestone D6 video production.  
**Video Target Duration:** 30 seconds – 2 minutes per focused task.  
**Standard Production Rules:** British English narration, clean synthetic demo fixtures, zero live PII, 1440×900 desktop recording viewport, synchronized captions (SRT/VTT).

---

## Master Video Script Index

| Video ID | Title | Primary Audience | Importance | Target Duration |
|---|---|---|---|---|
| **D2-V01** | Finding and Opening a Parent Record | Front Desk / Manager / Owner | STANDARD | 45 Seconds |
| **D2-V02** | Adding a New Parent Manually | Front Desk / Manager / Owner | **ESSENTIAL** | 60 Seconds |
| **D2-V03** | Updating Parent Contact & Consent Details | Front Desk / Manager / Owner | STANDARD | 45 Seconds |
| **D2-V04** | Adding a New Child and Linking to Parent | Front Desk / Manager / Owner | **ESSENTIAL** | 75 Seconds |
| **D2-V05** | Managing Medical Alerts & Severe Allergies | Front Desk / Manager / Tutor | **ESSENTIAL** | 60 Seconds |
| **D2-V06** | Reviewing an Inbound Registration Dossier | Front Desk / Manager / Owner | **ESSENTIAL** | 75 Seconds |
| **D2-V07** | Approving a Registration & Centre Assignment | Front Desk / Manager / Owner | **ESSENTIAL** | 60 Seconds |
| **D2-V08** | Declining or Rejecting a Registration | Manager / Owner | STANDARD | 45 Seconds |
| **D2-V09** | Creating a Staff Booking in Back-Office | Front Desk / Manager / Owner | **ESSENTIAL** | 60 Seconds |
| **D2-V10** | Creating a Rapid Walk-In Booking | Front Desk / Manager | **ESSENTIAL** | 45 Seconds |
| **D2-V11** | Rescheduling or Cancelling an Appointment | Front Desk / Manager / Owner | STANDARD | 60 Seconds |
| **D2-V12** | Parent Self-Service: Booking via Portal | Registered Parents | **ESSENTIAL** | 60 Seconds |
| **D2-V13** | Public Booking Wizard Walkthrough | Prospective Parents | STANDARD | 60 Seconds |
| **D2-V14** | Restoring an Archived Record from Recovery Bin | Manager / Owner | STANDARD | 45 Seconds |

---

## Detailed Script Specifications

### D2-V01: Finding and Opening a Parent Record
- **Audience:** Front Desk, Managers, Owners
- **Importance:** STANDARD | **Duration:** 45s
- **Starting Screen:** `/dashboard/parents`
- **Synthetic Data:** Parent "Alex Example", Child "Jamie Example"
- **Timeline & Click Sequence:**
  - `00:00 - 00:08`: Title Card. "In this video, learn how to quickly find and open any parent account."
  - `00:08 - 00:20`: Navigate to `Sidebar → Parents`. Point cursor to the search bar.
  - `00:20 - 00:35`: Type `Alex` into search. Show live table filtering. Click on Alex Example's row.
  - `00:35 - 00:45`: Final screen shows the full Parent Profile 360° with linked sibling cards. "You can now view contact info, emergency details, and invoices."

---

### D2-V02: Adding a New Parent Manually
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/parents`
- **Synthetic Data:** "Morgan Example", `morgan@example.test`, `+44 7700 900123`
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. Click `+ Add Parent` button in top right.
  - `00:10 - 00:35`: Enter First Name `Morgan`, Last Name `Example`, Email, and Phone. Select Relationship `Mother`.
  - `00:35 - 00:48`: Toggle Preferred Contact Method to `Email`. Click `Save Parent`.
  - `00:48 - 01:00`: Confirmation toast appears: "Parent created successfully." Point out newly created profile ready for child linking.

---

### D2-V03: Updating Parent Contact & Consent Details
- **Audience:** Front Desk, Managers, Owners
- **Importance:** STANDARD | **Duration:** 45s
- **Starting Screen:** `/dashboard/parents/[id]`
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. Click `Edit Details` on parent card.
  - `00:10 - 00:28`: Update mobile number. Scroll to GDPR Communications section and toggle Marketing Consent switch.
  - `00:28 - 00:45`: Click `Save Changes`. Highlight green confirmation toast and updated audit note.

---

### D2-V04: Adding a New Child and Linking to Parent
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 75s
- **Starting Screen:** `/dashboard/students/add`
- **Synthetic Data:** Student "Jamie Example", DOB `2018-05-14`, Year 2
- **Timeline & Click Sequence:**
  - `00:00 - 00:12`: Navigate to `Sidebar → Students → + Add Student`.
  - `00:12 - 00:30`: Enter First Name `Jamie`, Last Name `Example`, DOB `14/05/2018`, Year Group `Year 2`. Select Centre `Oakridge Primary Club`.
  - `00:30 - 00:45`: In Parent search, select `Alex Example`.
  - `00:45 - 01:05`: Toggle Photo Consent and First Aid Consent. Enter Authorised Collector `Grandmother Sarah` with password `Dolphin22`.
  - `01:05 - 01:15`: Click `Save Student`. Student profile opens with active enrolment badge.

---

### D2-V05: Managing Medical Alerts & Severe Allergies
- **Audience:** Front Desk, Managers, Tutors
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/students/[id]`
- **Synthetic Data:** Student "Taylor Example", Condition: Asthma, Allergy: Peanuts
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Open student profile. Click `Edit Medical Notes`.
  - `00:10 - 00:30`: In Allergies field, add `Peanuts (EpiPen in classroom)`. In Medical Conditions, type `Asthma — Inhaler before PE`. Enter GP details.
  - `00:30 - 00:45`: Click `Save Medical Details`.
  - `00:45 - 01:00`: Switch screen to `/dashboard/attendance`. Highlight the high-contrast **Red Alert Badge** instantly rendered next to Taylor's name on today's roll call.

---

### D2-V06: Reviewing an Inbound Registration Dossier
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 75s
- **Starting Screen:** `/dashboard/registrations`
- **Synthetic Data:** Registration `REG-8821`, Parent "Sam Example", Child "Riley Example"
- **Timeline & Click Sequence:**
  - `00:00 - 00:12`: Open Registrations Queue. Filter by `Awaiting Confirmation`.
  - `00:12 - 00:35`: Click on application `REG-8821`. Scroll through parent contacts, address, and child year groups.
  - `00:35 - 00:55`: Inspect the Medical Alert section and statutory consents.
  - `00:55 - 01:15`: Scroll to the bottom to verify the captured **Digital Signature** canvas and submission timestamp.

---

### D2-V07: Approving a Registration & Centre Assignment
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/registrations/[id]`
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: On registration dossier, click the green `Confirm & Sign Up` button.
  - `00:10 - 00:30`: Approval modal appears. Confirm assigned centre: `Oakridge Primary Club`.
  - `00:30 - 00:45`: Click `Confirm Approval`.
  - `00:45 - 01:00`: Status updates to `Signed Up`. Explain that welcome email is dispatched and student is activated in directory.

---

### D2-V08: Declining or Rejecting a Registration
- **Audience:** Managers, Owners
- **Importance:** STANDARD | **Duration:** 45s
- **Starting Screen:** `/dashboard/registrations/[id]`
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: In dossier action bar, click `Mark Not Interested`.
  - `00:10 - 00:25`: Select decline reason (e.g. `Venue at capacity` or `Parent requested cancellation`).
  - `00:25 - 00:45`: Click `Confirm`. Application status transitions to `Not Interested` and notification email is sent.

---

### D2-V09: Creating a Staff Booking in Back-Office
- **Audience:** Front Desk, Managers, Owners
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/bookings/new`
- **Timeline & Click Sequence:**
  - `00:00 - 00:12`: Navigate to `Sidebar → Bookings → + New Booking`.
  - `00:12 - 00:30`: Select Parent `Alex Example`, check Child `Jamie Example`.
  - `00:30 - 00:45`: Select Centre, Session Date `Tomorrow`, Start Time `15:30`, Duration `150 mins`, Modality `In-Person`.
  - `00:45 - 01:00`: Click `Create Booking`. Success screen shows confirmation code `BKG-7712` and calendar sync confirmation.

---

### D2-V10: Creating a Rapid Walk-In Booking
- **Audience:** Front Desk, Managers
- **Importance:** **ESSENTIAL** | **Duration:** 45s
- **Starting Screen:** `/dashboard/bookings/new`
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Front-desk reception scenario: child arrives unbooked. Click `+ New Booking`.
  - `00:10 - 00:25`: Search parent phone. Check child box. Select today's current session slot.
  - `00:25 - 00:45`: Click `Create Booking`. Switch immediately to `/dashboard/attendance` and tap `Check In`.

---

### D2-V11: Rescheduling or Cancelling an Appointment
- **Audience:** Front Desk, Managers, Owners
- **Importance:** STANDARD | **Duration:** 60s
- **Starting Screen:** `/dashboard/bookings/[bookingId]`
- **Timeline & Click Sequence:**
  - `00:00 - 00:12`: Open confirmed booking. Click `Reschedule Booking`.
  - `00:12 - 00:35`: Select new session date and available time slot from picker. Click `Confirm Reschedule`.
  - `00:35 - 00:48`: Demonstrate how old booking is archived and new booking is created.
  - `00:48 - 01:00`: Show updated Google Calendar sync and email confirmation toast.

---

### D2-V12: Parent Self-Service: Booking via Portal
- **Audience:** Parents
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/portal`
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Parent logs into portal. Tap `Book Sessions` button.
  - `00:10 - 00:30`: Check child checkboxes. Select club centre and desired date on calendar.
  - `00:30 - 00:45`: Review booking summary. Tap `Confirm Booking`.
  - `00:45 - 01:00`: Immediate confirmation card appears with booking reference and add-to-calendar shortcut.

---

### D2-V13: Public Booking Wizard Walkthrough
- **Audience:** Prospective Parents
- **Importance:** STANDARD | **Duration:** 60s
- **Starting Screen:** `/book/[orgSlug]`
- **Timeline & Click Sequence:**
  - `00:00 - 00:12`: Open public link. Select club centre and appointment type.
  - `00:12 - 00:35`: Choose date and time slot. Enter parent contact details and child name/year.
  - `00:35 - 00:48`: Agree to terms and click `Complete Booking`.
  - `00:48 - 01:00`: Confirmation screen displays confirmation code and magic link email notice.

---

### D2-V14: Restoring an Archived Record from Recovery Bin
- **Audience:** Managers, Owners
- **Importance:** STANDARD | **Duration:** 45s
- **Starting Screen:** `/dashboard/parents/bin`
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Navigate to `Sidebar → Parents → Recovery Bin`.
  - `00:10 - 00:25`: Locate archived family "Jordan Example". Show 30-day countdown timer.
  - `00:25 - 00:45`: Click `Restore`. Switch to active directory to verify family and children are fully restored.
