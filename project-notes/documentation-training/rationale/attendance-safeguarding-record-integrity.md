# SprintScale CMS — Operational Rationale
## Foundations of Attendance, Records & Incident Integrity

---

## 1. Why Arrival & Departure Timestamps Matter

Accurate recording of arrival and departure times supports operational visibility and custodial accountability.
- In building emergencies or headcount reconciliations, real-time check-in timestamps establish who was marked present on site.
- For operational reviews or late-collection fee enforcement, system timestamps provide objective records of session times.

---

## 2. Why Attendance Is NOT Just a Booking Status

A booking represents an advance scheduling intention. Attendance is a real-time record of physical arrival.
- Treating bookings as automatic attendance would obscure whether a child actually attended.
- Separating booking from attendance ensures that missed sessions, walk-ins, and late departures are accurately recorded.

---

## 3. Why Selecting the Correct Centre Is Critical

In a multi-branch organisation, staff must confirm their active centre before taking roll call. Logging attendance under the wrong venue creates inaccurate site rosters and corrupts venue capacity metrics.

---

## 4. Why Structured Absence Recording Matters

Recording specific absence reasons (`Illness`, `Holiday`, `Family`, `Other`) supports:
- **Operational Clarity:** Understanding attendance patterns and health-related absences across club cohorts.
- **Session Credit Ledger Accuracy:** Ensuring that only authorized absences receive administrative forgiveness credits.

---

## 5. Why Walk-In Arrivals Require an Explicit Workflow

When an unbooked child arrives on site, staff must not simply admit them without a record. The **+ Walk-In** workflow creates an explicit booking and attendance link, verifying medical disclosures, emergency contacts, and venue capacity limits inside an atomic database transaction.

---

## 6. Why Bulk Attendance Actions Require Explicit Confirmation

Marking whole groups as checked in or checked out simultaneously saves time during group arrivals. However, bulk actions carry the risk of marking an absent child present. Requiring confirmation ensures staff visually verify every individual in the room.

---

## 7. Why Attendance Corrections Must Remain Auditable

When an attendance record is modified (e.g. updating a late timestamp), SprintScale records `attendanceMarkedBy` and `updatedAt`. This permanent audit trail maintains record transparency and accountability.

---

## 8. Why Session Forgiveness Balances Ledgers Without Corrupting Invoices

Modifying an issued invoice to credit a missed session creates accounting discrepancies.
- SprintScale solves this via the **Session Credit Ledger**.
- Managers grant **Forgiveness Credits** against the student's attendance balance, leaving issued invoices immutable while balancing the family's session entitlement.

---

## 9. Why Medical & Severe Allergy Alerts Are Prominently Rendered

Severe food allergies and medical conditions require immediate awareness. High-contrast **Red Alert Badges** on attendance cards ensure tutors and front-desk staff instantly see health alerts without needing to navigate away from the live register.

---

## 10. Why Ordinary Student Notes Are NOT Safeguarding Files

Ordinary student notes are visible to on-duty classroom tutors and operational staff to support learning and behavioural recognition.
- Entering sensitive child protection disclosures into a general note would compromise confidentiality and expose sensitive welfare information to general staff.
- Ordinary notes must be confined strictly to educational and daily operational updates.

---

## 11. Why Safeguarding Records Have Elevated Role Restrictions

Safeguarding concerns are restricted in software to **Managers and Owners**.
- Front Desk and Tutors cannot view or create safeguarding records in the application.
- **Note on Designation:** In SprintScale, access to this area is governed by CMS role permissions (`MANAGER` and `ORG_OWNER`). However, formal appointment of Designated Safeguarding Leads (DSLs) and referral decisions are determined by your organisation's internal policy.

---

## 12. Why Factual Language Matters in Incident Logs

When logging accident reports or sensitive welfare concerns, staff should record objective facts, observable physical marks, and verbatim statements. Clear, factual language ensures records remain objective and useful for review.

---

## 13. Why Parent Visibility Differs by Record Type

- **Standard First Aid Reports:** Shared transparently with parents at pickup time as part of normal daily communication.
- **Safeguarding Records:** Maintained as confidential internal records, protected from general display in the Parent Portal.

---

## 14. Why Safeguarding Records Must Never Be Copied into Broadcasts

Bulk email announcements and newsletters query parent contact lists. Keeping safeguarding files in an isolated database entity guarantees that confidential child welfare data can never be accidentally merged into marketing or general parent broadcasts.

---

## 15. Why Soft Deletion Preserves the Historical Audit Trail

When a student or parent record is archived, historical attendance records, accident logs, and welfare notes remain preserved in the database. Soft deletion ensures organizations maintain complete historical records while removing departed families from active daily registers.
