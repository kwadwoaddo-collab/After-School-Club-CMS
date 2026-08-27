# SprintScale CMS — Troubleshooting Handbook
## Milestone D3: Attendance, Roll Call, Kiosk, Session Ledger, Incidents & Safeguarding

**Target Audience:** Tutors, Front Desk Staff, Centre Managers, Organisation Owners  
**Scope:** Practical resolution steps for operational errors during live club sessions, registers, first aid, and safeguarding workflows.

---

## Master Troubleshooting Index

1. [Attendance page shows zero children](#1-attendance-page-shows-zero-children)
2. [Staff cannot select or access a club centre](#2-staff-cannot-select-or-access-a-club-centre)
3. [Zero-centre staff alert banner appears](#3-zero-centre-staff-alert-banner-appears)
4. [Child cannot be checked in (Button unresponsive)](#4-child-cannot-be-checked-in)
5. [Child already appears checked in upon arrival](#5-child-already-appears-checked-in)
6. [Child cannot be checked out at departure time](#6-child-cannot-be-checked-out)
7. [Wrong attendance state recorded (e.g. marked absent by mistake)](#7-wrong-attendance-state-recorded)
8. [Late arrival timestamp / minutes appear incorrect](#8-late-arrival-timestamp-appears-incorrect)
9. [Bulk attendance selection does not update all rows](#9-bulk-attendance-selection-issue)
10. [Staff PIN rejected on Kiosk screen](#10-staff-pin-rejected-on-kiosk)
11. [Walk-in booking cannot be created](#11-walk-in-booking-cannot-be-created)
12. [Attendance timestamp correction needed](#12-attendance-timestamp-correction-needed)
13. [Session forgiveness does not change student ledger balance](#13-session-forgiveness-ledger-discrepancy)
14. [Medical or severe allergy badge missing on attendance card](#14-medicalallergy-badge-missing-on-card)
15. [Confidential disclosure entered in ordinary notes by mistake](#15-confidential-disclosure-entered-in-notes)
16. [User cannot see or access the Safeguarding incident category](#16-user-cannot-access-safeguarding-category)
17. [Standard incident vs Safeguarding classification confusion](#17-incident-vs-safeguarding-confusion)
18. [First aid record entered under wrong child or category](#18-incident-entered-under-wrong-category)
19. [Sensitive information typed into general progress scorecards](#19-sensitive-information-in-scorecards)
20. [Tablet Kiosk interface clipped or misaligned on mobile](#20-tablet-kiosk-layout-clipped)
21. [Parent asks for a copy of a confidential safeguarding file](#21-parent-requests-safeguarding-file)
22. [Incident record cannot be edited due to permission lock](#22-incident-cannot-be-edited-due-to-permissions)

---

## Detailed Troubleshooting Scenarios

### 1. Attendance Page Shows Zero Children
- **What You May See:** The roll call roster is completely blank for today's session.
- **Most Likely Causes:**
  - Active centre filter in top navigation is set to the wrong venue.
  - No bookings were scheduled for today's date.
- **How to Resolve:**
  1. Check the top-bar **Centre Selector** and switch to your physical venue.
  2. Verify that today's date is selected in the date picker.
  3. If unbooked children are physically present, create immediate **+ Walk-In** bookings.

---

### 2. Staff Cannot Select or Access a Club Centre
- **What You May See:** Top-bar centre dropdown is disabled or shows "Access Denied".
- **Most Likely Causes:** Staff member has not been assigned to the centre in the staff directory.
- **How to Resolve (Owner Action):** Organisation Owner navigates to `Sidebar → Team → [Staff Member]`, checks the appropriate centre boxes, and clicks **Save Assignments**.

---

### 3. Zero-Centre Staff Alert Banner Appears
- **What You May See:** Screen displays banner: *"No accessible centres assigned to your account."*
- **Explanation:** This is a safety feature preventing unassigned staff from seeing or modifying records.
- **How to Resolve:** Contact your Organisation Owner or Centre Manager to grant centre permissions.

---

### 4. Child Cannot Be Checked In
- **What You May See:** Clicking "Check In" fails to update the card.
- **Most Likely Causes:** Browser connection timeout or session expired.
- **How to Resolve:** Refresh the page (or reconnect Wi-Fi) and tap **Check In** again. The timestamp will reflect the current time.

---

### 5. Child Already Appears Checked In
- **What You May See:** Child's card already shows green "Present" before they walk in.
- **Most Likely Causes:** Another staff member (or Front Desk on Kiosk) already checked the child in.
- **How to Resolve:** Confirm with front-desk staff. If checked in by mistake, mark the child **Absent** or correct the timelog.

---

### 6. Child Cannot Be Checked Out
- **What You May See:** "Check Out" button is grayed out.
- **Most Likely Causes:** Child was never checked in (status is still "Expected" or "Absent").
- **How to Resolve:** Tap **Check In** first to establish arrival custody, then tap **Check Out**.

---

### 7. Wrong Attendance State Recorded
- **What You May See:** Child was marked "Absent", but actually arrived late.
- **How to Resolve:** Tap **Check In** on the child's card. The system will override the absent state, record the check-in timestamp, and derive the late minutes.

---

### 8. Late Arrival Timestamp Appears Incorrect
- **What You May See:** Card shows *45m late*, but parent claims they were only 10m late.
- **Explanation:** The system calculates late minutes strictly based on the session's configured start time (e.g. 15:30) and the moment the staff member clicked "Check In" (16:15).
- **How to Resolve:** If staff delayed clicking the button, add an attendance note: *"Child arrived at 15:40; check-in logged late by staff at 16:15."*

---

### 10. Staff PIN Rejected on Kiosk
- **What You May See:** Tablet Kiosk displays "Invalid PIN" when attempting administrative overrides.
- **How to Resolve:** Ensure you are entering your 4-digit staff PIN configured in your user profile. If forgotten, reset your PIN via your user profile in `/dashboard/settings`.

---

### 13. Session Forgiveness Does Not Change Student Ledger Balance
- **What You May See:** Manager granted a forgiveness credit, but the child's net balance remains negative.
- **Most Likely Causes:** The credit was applied to a different Academic Year (e.g. 2025/2026 instead of 2026/2027), or the student had multiple absences requiring more than 1 credit.
- **How to Resolve:** Verify the Academic Year dropdown in `Sidebar → Attendance → Session Ledger` and check the student's total recorded absences.

---

### 14. Medical or Severe Allergy Badge Missing on Card
- **What You May See:** A child known to have a peanut allergy has no red badge on the register.
- **Most Likely Causes:** The allergy was entered as plain text in general notes rather than in the structured **Allergies** field on the student profile.
- **How to Resolve:** Open `Sidebar → Students → [Child]`, click **Edit Profile**, add `Peanuts` into the dedicated **Allergies** field, and save. The red badge will instantly appear on roll call.

---

### 15. Confidential Disclosure Entered in Ordinary Notes by Mistake
- **What You May See:** A tutor entered a child abuse disclosure into the general student notes timeline.
- **IMMEDIATE COMPLIANCE ACTION:**
  1. **Immediately notify the Centre Manager / Designated Safeguarding Lead in person.**
  2. The DSL will copy the factual details and author the formal confidential report in `Sidebar → Incidents` under the `Safeguarding` type.
  3. Archive or delete the general note from the student profile to restore confidentiality.

---

### 16. User Cannot Access the Safeguarding Category
- **What You May See:** `Safeguarding` is missing from the incident type dropdown in `/dashboard/incidents`.
- **Explanation:** This is by design. Only **Managers and Owners** have access to confidential child protection files. Front Desk staff and Tutors are intentionally restricted.
- **How to Resolve:** Escalate the report verbally in private to your Centre Manager (DSL).

---

### 20. Tablet Kiosk Interface Clipped or Misaligned on Mobile
- **What You May See:** Kiosk buttons appear off-screen on a mobile device.
- **How to Resolve:** Verify device viewport. SprintScale Kiosk is engineered with a responsive CSS grid that automatically collapses into a single-column layout on 375px+ screens. Ensure browser zoom is set to 100%.

---

### 21. Parent Requests a Copy of a Safeguarding File
- **What You May See:** A parent asks staff to see an incident report regarding a safeguarding referral.
- **LEGAL DIRECTIVE:**
  - **NEVER release safeguarding records to parents.**
  - Safeguarding files are legally privileged child protection documents shared exclusively with statutory authorities (Police, Social Care, LADO).
  - Refer the parent directly to the Organisation Owner.

---

### 22. Incident Record Cannot Be Edited Due to Permission Lock
- **What You May See:** Incident record is read-only.
- **Explanation:** To protect the legal audit trail required by Ofsted, incident logs cannot be silently rewritten after submission.
- **How to Resolve:** If additional facts emerge, log a supplementary incident report referencing the original record ID.
