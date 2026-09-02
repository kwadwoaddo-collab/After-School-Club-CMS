# SprintScale CMS — Master User Manual
## Part 2: The Complete End-to-End Family-to-Booking Journey

---

## 1. Overview of the Family Journey

This guide maps the complete operational and data lifecycle of a family within SprintScale CMS — from the moment a parent first discovers your club to their child attending classroom sessions and settling monthly club fees.

```
┌─────────────────────────────────────────────────────────────┐
│                 STAGE 1: ENQUIRY & INTAKE                   │
│  Parent completes Public Registration Form (`/register`)    │
│  Captures medical, consents, emergency contacts & signature  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 STAGE 2: REVIEW & TRIAGE                    │
│  Centre Manager / Front Desk reviews dossier in Queue       │
│  Performs CRM duplicate check and verifies medical disclosures│
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 STAGE 3: ENROLMENT APPROVAL                 │
│  Staff clicks "Confirm & Sign Up" (`signed_up`)              │
│  Automated welcome email sent; parent & child activated     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 STAGE 4: SESSION BOOKING                    │
│  Parent or staff books session dates via Portal or Wizard   │
│  Capacity verified; Google Calendar event synchronized      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 STAGE 5: CLASSROOM ATTENDANCE               │
│  Child appears on Daily Roll Call and Tablet Kiosk          │
│  Tutor checks in student with custodial timestamp (See D3)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 STAGE 6: FAMILY BILLING & PAYMENTS          │
│  Owner configures Agreed-Fee Monthly Family Billing         │
│  Invoices generated; settled via Stripe or TFC (See D4)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Stage 1: Public Intake & Data Capture

![Figure — Public Multi-Child Registration Form with sibling tabs and emergency contact entry](/training/assets/screenshots/annotated/SS-D6-S007.png)
*Figure MM-2.1 — Multi-Child Registration Intake Form*

📹 **Video Walkthrough:** [Watch: Registering a Multi-Child Family via Public Portal](/training/assets/videos/SS-D6-V001.mp4)

The journey begins when a prospective parent opens your club's public registration URL (`https://app.sprintscaleit.co.uk/register/[your-org]`).

### Data Captured at Intake:
- **Parent Contact:** Primary parent's name, email, phone number, relationship, and residential address.
- **Child Demographics & Medical:** First and last names, date of birth, school year, severe allergies (e.g. *Peanuts*, *EpiPen*), medical conditions, dietary requirements, and GP doctor surgery contacts.
- **Statutory Consents:** Explicit checkboxes for Photography Consent, Sun Cream Application Consent, and Emergency First Aid Treatment.
- **Authorised Collectors:** Pre-approved pickup contacts and collection passwords.
- **Legal Agreement:** Terms agreement and a legally binding **Digital Signature**.

---

## 3. Stage 2: Verification & Triage

Once submitted, the application enters the **Registrations Queue** (`/dashboard/registrations`) with status `awaiting_confirmation`.

1. **Staff Review:** The Centre Manager or Front Desk staff member opens the applicant dossier.
2. **CRM Matching Engine:** The system checks whether the parent's email already exists in the database:
   - If an existing parent is matched, their contact details are refreshed.
   - If new, a new parent profile is created.
3. **Medical Scrutiny:** Staff verify medical disclosures, dietary needs, and emergency numbers to ensure the centre has adequate provisions in place.

---

## 4. Stage 3: Approval & Record Activation

![Figure — Registration Approval Interface showing sibling matching and confirm action](/training/assets/screenshots/annotated/SS-D6-S010.png)
*Figure MM-2.2 — Registration Approval & Sibling Matching*

📹 **Video Walkthrough:** [Watch: Reviewing & Approving a Public Registration](/training/assets/videos/SS-D6-V002.mp4)

When staff click **Confirm & Sign Up**:
1. The registration status transitions to `signed_up`.
2. The child record is provisioned in the active **Student Directory** (`/dashboard/students`) and locked to the assigned centre.
3. An automated **Welcome Email** is dispatched to the parent, containing a one-click magic link to access their **Parent Portal** (`/portal`).

---

## 5. Stage 4: Scheduling & Booking Sessions

![Figure — Weekly Booking Matrix displaying capacity utilization across session slots](/training/assets/screenshots/annotated/SS-D6-S011.png)
*Figure MM-2.3 — Weekly Booking Matrix & Capacity*

📹 **Video Walkthrough:** [Watch: Creating a Session Booking for a Family](/training/assets/videos/SS-D6-V040.mp4)

With active profiles in place, session scheduling can occur through any of three pathways:
- **Parent Portal Booking (`/portal/book`):** The parent logs in, selects their child, chooses session dates, and receives instant confirmation.
- **Public Booking Wizard (`/book/[org-slug]`):** External bookings for upcoming holiday camps or trial sessions.
- **Staff Back-Office Booking (`/dashboard/bookings/new`):** Front-desk staff or managers schedule recurring or walk-in sessions.

Upon booking confirmation:
- Slot capacity is locked inside an atomic database transaction.
- An appointment is created on the club's Google Calendar.
- The parent receives an email confirmation with booking reference codes.
- Organisation Owners receive an in-app dashboard notification.

---

## 6. Stage 5: Classroom Roll Call & Arrival (Detailed in Milestone D3)

On the date of the booked session:
1. The child automatically appears on the **Attendance Register** (`/dashboard/attendance`) and **Touchscreen Kiosk** (`/dashboard/kiosk`).
2. High-contrast **Medical & Allergy Badges** alert tutors to any severe health considerations.
3. As the child enters the room, the tutor or front desk taps **Check In**, recording a legally mandated custodial timestamp.
4. At departure time, staff verify the collecting adult against the student's **Authorised Collectors** list and record the departure timestamp.

---

## 7. Stage 6: Family Billing & Reconciliation (Detailed in Milestone D4)

1. **Agreed Monthly Fee:** The Organisation Owner navigates to the student's profile and sets a recurring monthly fee covering all siblings in the household.
2. **Monthly Invoice Run:** The billing engine issues automated `INV-XXXXXX` invoices on the monthly cycle anchor date.
3. **Parent Settlement:** The parent logs into `/portal/billing` to pay instantly via Stripe card/Apple Pay or submits their Tax-Free Childcare voucher reference code.
4. **Reconciliation:** The Owner matches bank remittances in the reconciliation hub and issues an official PDF receipt.
