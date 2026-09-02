# SprintScale CMS — Troubleshooting Handbook
## Milestone D2: Family Accounts, Registrations, Student Records & Bookings

**Target Audience:** Front Desk Staff, Centre Managers, Organisation Owners  
**Scope:** Practical resolution steps for operational errors across the family-to-booking lifecycle.

---

## Master Troubleshooting Index

1. [Parent cannot be found in search](#1-parent-cannot-be-found-in-search)
2. [Child/Student cannot be found on dashboard](#2-childstudent-cannot-be-found-on-dashboard)
3. [Child appears under the wrong family context](#3-child-appears-under-the-wrong-family-context)
4. [Inbound registration appears incomplete](#4-inbound-registration-appears-incomplete)
5. [Registration cannot be approved (403 Forbidden / Centre Mismatch)](#5-registration-cannot-be-approved-403-forbidden)
6. [Duplicate parent or student records exist](#6-duplicate-parent-or-student-records-exist)
7. [Desired booking slot is unavailable or grayed out](#7-desired-booking-slot-is-unavailable-or-grayed-out)
8. [Duplicate time-slot booking conflict error](#8-duplicate-time-slot-booking-conflict-error)
9. [Staff member cannot see or select a club centre](#9-staff-member-cannot-see-or-select-a-club-centre)
10. [Parent cannot access bookings in Parent Portal](#10-parent-cannot-access-bookings-in-parent-portal)
11. [Google Calendar appointment sync is missing](#11-google-calendar-appointment-sync-is-missing)
12. [Archived parent or child needs urgent recovery](#12-archived-parent-or-child-needs-urgent-recovery)
13. [Permanent purge warning & accidental deletion concerns](#13-permanent-purge-warning--accidental-deletion-concerns)
14. [Parent did not receive broadcast email (Consent Filter)](#14-parent-did-not-receive-broadcast-email-consent-filter)
15. [Child is booked but missing from today's roll call](#15-child-is-booked-but-missing-from-todays-roll-call)

---

## Detailed Troubleshooting Scenarios

### 1. Parent Cannot Be Found in Search
- **What You May See:** Typing a parent's name in `Sidebar → Parents` returns "No parents found."
- **Most Likely Causes:**
  - The parent was soft-deleted within the last 30 days.
  - The name is misspelled or was registered under a different email.
  - The parent registered under a different Centre and staff member is in centre-filtered view.
- **What to Check:** Check `Sidebar → Parents → Recovery Bin` (`/dashboard/parents/bin`). Clear centre filters if you are an Owner.
- **How to Resolve:** If found in the Recovery Bin, click **Restore**. If misspelled, search by phone number.
- **What NOT to Do:** Do NOT immediately create a second duplicate parent record before verifying the Recovery Bin.

---

### 2. Child/Student Cannot Be Found on Dashboard
- **What You May See:** Child does not appear in `Sidebar → Students`.
- **Most Likely Causes:** The registration is still sitting in the **Awaiting Confirmation** queue and has not yet been approved.
- **What to Check:** Open `Sidebar → Registrations` and filter by status `Awaiting Confirmation`.
- **How to Resolve:** Open the registration dossier and click **Confirm & Sign Up**. The child will instantly populate the student directory.

---

### 3. Child Appears Under the Wrong Family Context
- **What You May See:** Sibling children appear under separate parent records instead of a unified family card.
- **Most Likely Causes:** Parents registered each child using different email addresses (e.g. mum's email for child 1, dad's email for child 2).
- **How to Resolve:**
  1. Decide on the primary family email address.
  2. Open the second child's profile in `Sidebar → Students → [Child]`.
  3. Click **Edit Profile**, locate the **Parent Link**, and re-link the child to the primary parent.
  4. Archive the redundant secondary parent profile.

---

### 4. Inbound Registration Appears Incomplete
- **What You May See:** An application has missing emergency contacts or incomplete medical notes.
- **How to Resolve:**
  1. Call the parent using the phone number submitted in the application.
  2. Verify the missing medical conditions or emergency contacts over the phone.
  3. Approve the registration, then immediately open `Sidebar → Students → [Child]` and input the verified details.

---

### 5. Registration Cannot Be Approved (403 Forbidden)
- **What You May See:** Clicking "Confirm & Sign Up" displays an "Unauthorised" or "Forbidden" error banner.
- **Most Likely Causes:** The staff member is logged in as a Manager or Front Desk assigned to Centre A, but the registration was submitted for Centre B.
- **How to Resolve:** Switch to Centre B in the top navigation bar (if permitted), or ask the Centre Manager for Centre B or the Organisation Owner to approve the registration.

---

### 6. Duplicate Parent or Student Records Exist
- **What You May See:** Two identical parent cards appear in the directory.
- **How to Resolve:**
  1. Open both parent profiles in separate tabs.
  2. Identify which profile has the active billing configuration and bookings.
  3. Ensure all children are linked to that primary profile.
  4. Archive the secondary parent profile to move it to the Recovery Bin.

---

### 7. Desired Booking Slot Is Unavailable or Grayed Out
- **What You May See:** A session date or time cannot be selected in the booking wizard.
- **Most Likely Causes:**
  - Session capacity is full (maximum child-to-staff ratio reached).
  - Centre is closed on that day (configured in `Sidebar → Availability`).
- **How to Resolve:** Check `Sidebar → Availability` to verify operating hours. If capacity allows, managers can increase the slot capacity limit.

---

### 8. Duplicate Time-Slot Booking Conflict Error
- **What You May See:** System displays error: *"A booking already exists for this child at this time."*
- **Most Likely Causes:** The database uniqueness constraint (`unique_time_slot`) prevented duplicate booking submission.
- **How to Resolve:** Open `Sidebar → Bookings`, locate the existing booking, and verify whether it needs rescheduling rather than creating a second entry.

---

### 9. Staff Member Cannot See or Select a Club Centre
- **What You May See:** Top-bar centre selector is empty or missing expected venues.
- **Most Likely Causes:** Staff member has not been assigned to the centre in the staff directory.
- **How to Resolve (Owner Action):** Go to `Sidebar → Team → [Staff Member]`, check the boxes for their assigned centres, and click **Save Assignments**.

---

### 10. Parent Cannot Access Bookings in Parent Portal
- **What You May See:** Parent receives magic link but sees zero bookings or children upon logging in.
- **Most Likely Causes:** The parent logged in with an email address that differs from the one stored on the child's profile in SprintScale.
- **How to Resolve:** Search the student directory in staff dashboard, check the stored parent email address, and correct any typos.

---

### 11. Google Calendar Appointment Sync Is Missing
- **What You May See:** A booking was created in SprintScale, but the appointment did not appear on Google Calendar.
- **Most Likely Causes:** Google Calendar integration is unconfigured in organisation settings, or Google OAuth token expired.
- **How to Resolve:** The booking is still 100% valid in SprintScale. The Organisation Owner can re-authenticate Google Calendar in `Sidebar → Settings → Integrations`.

---

### 12. Archived Parent or Child Needs Urgent Recovery
- **What You May See:** A child was archived by mistake and needs to be checked in today.
- **How to Resolve:**
  1. Go immediately to: `Sidebar → Parents → Recovery Bin` (`/dashboard/parents/bin`).
  2. Locate the parent.
  3. Click **Restore**.
  4. The parent and all attached children instantly return to the active attendance registers.

---

### 13. Permanent Purge Warning & Accidental Deletion Concerns
- **What You May See:** Front desk or managers worried about accidentally erasing records.
- **Guidance:** Front Desk and Managers **cannot** permanently delete records. Only the Organisation Owner has the "Permanent Purge" button in the Recovery Bin. Soft deletion can always be undone within 30 days.

---

### 14. Parent Did Not Receive Broadcast Email (Consent Filter)
- **What You May See:** Parent complains they missed a club closure announcement.
- **Most Likely Causes:** The parent's **Communications Consent** flag is set to `False`. The system automatically filtered them out to comply with UK GDPR.
- **How to Resolve:** Open parent profile, obtain verbal or written consent from the parent, toggle **Communications Consent** to `On`, and save.

---

### 15. Child Is Booked but Missing from Today's Roll Call
- **What You May See:** Child has a booking confirmation, but tutor cannot find them on `/dashboard/attendance`.
- **Most Likely Causes:** The booking was scheduled for a different Centre or the booking status is `cancelled` / `rescheduled`.
- **How to Resolve:** Open `Sidebar → Bookings`, search the child's name, verify the booked Centre and Date. If the child is physically present, create a **Walk-In Booking** and check them in.
