# SprintScale CMS — Role Guide: Centre Manager
## Operational Supervision & Designated Safeguarding Lead Manual

---

## 1. Manager Role Overview

As a **Centre Manager**, you are responsible for day-to-day operational leadership at your assigned club centre(s). You oversee student intake, classroom attendance, session scheduling, staff supervision, and confidential child safeguarding.

### Key Responsibilities
- **Centre Operations & Headcount:** Monitoring daily session capacity, active roll calls, and staff-to-child ratios.
- **Student & Parent Onboarding:** Reviewing and approving inbound registrations and managing student medical/SEN records.
- **Designated Safeguarding Lead (DSL):** Authoring and reviewing confidential child protection and safeguarding incident files.
- **Session Credit Ledger Management:** Reviewing student absence balances and granting forgiveness credits for excused absences.
- **Centre Communications:** Sending targeted email announcements to parents with verified communications consent.
- **Centre Opening Schedules:** Managing weekly session operating hours and slot capacities.

---

## 2. Daily Manager Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                       MORNING SETUP                         │
│  • Sign in and select active Centre                         │
│  • Review today's expected session headcount on Dashboard   │
│  • Check medical/allergy badges for today's attendees       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    MID-SESSION TRIAGE                       │
│  • Review & approve pending registrations                   │
│  • Handle booking reschedule requests                       │
│  • Monitor active check-in kiosk on floor                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   END-OF-DAY CLOSEOUT                       │
│  • Verify 100% of children are checked out on Roll Call     │
│  • Review and sign off any logged accident/injury reports   │
│  • Record any confidential safeguarding files if necessary  │
│  • Reconcile unexplained absences in Session Ledger         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. What Managers Can and Cannot Access

### What You CAN Access (Centre-Scoped):
- **Full Student Directory:** View and edit child profiles, medical notes, emergency contacts, and authorised collectors.
- **Registration Triage:** Approve inbound public registrations or mark them not interested.
- **Bookings & Scheduling:** Book sessions, reschedule bookings, and complete assessment scorecards.
- **Attendance & Kiosk:** Take roll call, monitor arrivals/departures, and operate kiosk check-ins.
- **Incidents & Safeguarding:** Log standard injuries and author confidential safeguarding disclosures.
- **Session Credit Ledger:** Grant forgiveness credits for excused absences.
- **Centre Hours:** Configure daily opening/closing times and capacity rules.
- **Parent Broadcasts:** Send bulk email announcements to your centre's consented parents.
- **Reports:** Export attendance registers and student lists to CSV.

### What Requires OWNER Authority (Escalate to Owner):
- **Finance & Invoicing:** Creating family billing configs, issuing monthly invoices, and recording payments.
- **Staff Roles & Invites:** Inviting new staff members or modifying staff permissions.
- **Organisation Settings:** Modifying logo, brand colors, or legal terms.
- **Annual School Year Roll:** Advancing student year groups at year-end.
- **Centre Banking Setup:** Modifying centre bank account details.
- **Permanent Data Deletion:** Permanent GDPR purge of records from the Recovery Bin.

---

## 4. Step-by-Step Procedures for Managers

### Procedure 1: Reviewing and Approving a Public Registration
1. Navigate to: `Sidebar → Registrations`.
2. Click on a registration card with status **Awaiting Confirmation**.
3. Review parent details, emergency contacts, child medical disclosures, and digital signature.
4. Click **Confirm & Sign Up**.
5. Select the target Centre assignment and confirm.
6. The child and parent are instantly provisioned in the active student directory, and a confirmation email is dispatched to the parent.

---

### Procedure 2: Logging a Confidential Safeguarding Incident
> [!SAFEGUARDING]
> Safeguarding files are strictly confidential and visible only to Managers and Owners acting as Designated Safeguarding Leads.

1. Navigate to: `Sidebar → Incidents → [+ Log Incident]`.
2. Select **Incident Type:** `Safeguarding`.
3. Select the Student from the searchable dropdown.
4. Record factual, objective observations, disclosures, witness names, and external agency referrals.
5. Provide your digital signature in the signature canvas.
6. Click **Save Incident Record**.
7. The file is encrypted and saved strictly in the manager-level audit log, invisible to front-desk staff and tutors.

---

### Procedure 3: Forgiving an Absence in the Session Credit Ledger
> [!NOTE]
> The Session Credit Ledger balances missed sessions without editing issued invoices, preserving accounting integrity.

1. Navigate to: `Sidebar → Attendance → Session Ledger`.
2. Filter by your centre and academic year.
3. Locate the student (indicated with a negative balance due to recorded absences).
4. Click **Forgive Sessions**.
5. Enter the number of sessions to credit (e.g. `1`).
6. Enter a mandatory operational note (e.g. "Excused illness — medical note provided").
7. Click **Grant Forgiveness Credit**.
8. The student's net balance updates immediately.

---

### Procedure 4: Sending an Email Broadcast to Centre Parents
1. Navigate to: `Sidebar → Communications`.
2. Select your Centre.
3. Select the target audience (e.g. "All Active Centre Parents").
4. The system automatically calculates the recipient count, filtering out any parents who have not consented to marketing/announcements.
5. Enter a Subject and Message body.
6. Click **Send Broadcast**.

---

## 5. Manager Escalation Protocol

| Scenario | Immediate Manager Action | Escalation Route |
|---|---|---|
| **Critical Safeguarding Disclosure** | Ensure child's immediate physical safety; log confidential report in `/dashboard/incidents`. | Contact local authority Designated Officer (LADO) / Police, and notify Organisation Owner immediately. |
| **Parent Disputing Monthly Bill** | Review student's attendance records in Session Ledger; verify attended sessions. | If financial adjustment is required, escalate to Owner to apply a credit or update family billing config. |
| **New Staff Member Hired** | Collect DBS, First Aid, and Safeguarding certification details. | Provide details to Organisation Owner to issue formal email invitation and configure centre access. |
| **Venue Closure / Snow Day** | Log closure in Centre Hours; send urgent broadcast email to all affected parents. | Notify Organisation Owner of lost operational hours. |
