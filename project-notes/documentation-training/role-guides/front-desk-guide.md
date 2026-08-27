# SprintScale CMS — Role Guide: Front Desk
## Front-of-House Reception, Arrivals & Registration Triage Manual

---

## 1. Front Desk Role Overview

As a **Front Desk Staff Member**, you manage the front-of-house intake, parent reception, student lookups, walk-in registrations, and daily arrivals and departures at your assigned club centre(s).

### Key Responsibilities
- **Parent Reception & Arrivals:** Welcoming families, looking up student profiles, and verifying authorised collectors.
- **Fast Check-in Operations:** Operating the touchscreen kiosk mode and assisting tutors with live attendance registers.
- **Walk-in Bookings & Intake:** Creating new bookings for walk-in families and logging manual student registrations.
- **New Registration Triage:** Reviewing inbound public registrations and confirming new student enrolments.
- **First Aid & Standard Incident Logging:** Documenting minor accidents, injuries, and medication administrations.

---

## 2. Daily Front Desk Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    SESSION START / ARRIVALS                 │
│  • Open Kiosk Mode on front-desk tablet (`/dashboard/kiosk`)│
│  • Tap "Check In" as children arrive                        │
│  • Check medical/allergy flags for arriving children        │
│  • Handle any walk-in parents or unbooked students          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    DURING THE SESSION                       │
│  • Review pending public registrations queue                │
│  • Look up student records or parent phone numbers if needed│
│  • Log any first-aid treatments or minor accidents          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    PICKUP & DEPARTURES                      │
│  • Verify collecting adult against Authorised Collectors list│
│  • Verify collection password if unknown adult arrives       │
│  • Tap "Check Out" on Kiosk as child departs                │
│  • Ensure all arriving/departing timestamps are complete     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. What Front Desk Staff Can and Cannot Do

### What You CAN Do:
- **Attendance & Kiosk:** Perform live check-ins, check-outs, and mark present/late/absent statuses.
- **Student & Parent Lookup:** Search student profiles, medical conditions, SEN notes, and parent emergency numbers.
- **Walk-in Booking Creation:** Schedule sessions on demand for registered or walk-in children.
- **Manual Student Intake:** Add a new student and parent directly via `/dashboard/students/add`.
- **Review Registrations:** Approve inbound registrations (`/dashboard/registrations`).
- **Standard Incident Logging:** Log `Accident`, `Incident`, and `Medication` events with staff signatures.
- **Parent Management:** View parent directory, update contact info, and soft-delete/restore records.

### What You CANNOT Do (Requires Manager or Owner):
- [ ] **Safeguarding Records:** Front Desk staff cannot view or author confidential child protection files. (Escalate immediately to Centre Manager/DSL).
- [ ] **Session Forgiveness Credits:** Front Desk cannot grant credits in the Session Credit Ledger.
- [ ] **Finance & Invoices:** Front Desk has zero access to invoices, payments, or family billing configs.
- [ ] **Centre Hours & Settings:** Front Desk cannot alter centre schedules or club settings.
- [ ] **Parent Broadcasts:** Front Desk cannot send mass email broadcasts.
- [ ] **Staff Administration:** Front Desk cannot invite staff or modify roles.

---

## 4. Step-by-Step Procedures for Front Desk

### Procedure 1: Rapid Student Check-in via Kiosk Mode
1. Open: `Sidebar → Kiosk` on the front-desk tablet.
2. When a child arrives, locate their name card in the list.
3. Tap **Check In**.
4. The card badge immediately changes to a green **Checked In** status with the current timestamp recorded.

---

### Procedure 2: Verifying an Unknown Collecting Adult
> [!SAFEGUARDING]
> Never release a child to an unverified adult. Always verify their identity against the student profile.

1. In the top search bar (or `Sidebar → Students`), type the child's name.
2. Open the **Student Profile**.
3. Locate the **Authorised Collectors** section.
4. Verify that the adult's name is listed.
5. Ask the adult for the **Collection Password** recorded on the profile.
6. Once verified, navigate to Kiosk or Attendance and tap **Check Out**.

---

### Procedure 3: Registering a Walk-in Child
1. Navigate to: `Sidebar → Bookings → [+ New Booking]`.
2. Select the Parent (or click **+ Add New Parent** if not in system).
3. Select the Child and Session Slot.
4. Set Modality to **In-Person**.
5. Click **Create Booking**.
6. The booking is confirmed instantly and the child appears on today's roll call.

---

### Procedure 4: Logging a First Aid or Minor Injury Incident
1. Navigate to: `Sidebar → Incidents → [+ Log Incident]`.
2. Select Type: `Accident` or `Medication`.
3. Select the Child name.
4. Enter the time of incident, factual description of what happened, and treatment provided (e.g. "Cold compress applied to left knee for 10 minutes").
5. Enter witness names (e.g. tutor on duty).
6. Sign in the digital signature box.
7. Click **Save Incident Record**.

---

## 5. Front Desk Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| **Child arrives but is not listed on today's register** | Child has not been booked for today's session. | Use `Sidebar → Bookings → [+ New Booking]` to create a walk-in booking, or consult Centre Manager. |
| **Parent asks about an outstanding bill or payment** | Front Desk does not have access to finance records. | Advise parent to view `/portal/billing` on their phone, or connect them with the Centre Manager/Owner. |
| **A child makes a confidential disclosure** | Safeguarding disclosures must not be handled at Front Desk. | Escalate immediately in private to the Centre Manager (Designated Safeguarding Lead). |
