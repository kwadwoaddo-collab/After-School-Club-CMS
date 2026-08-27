# SprintScale CMS — Operational Rationale
## Statutory, Legal & Safeguarding Foundations of Attendance, Records & Incidents

---

## 1. Why Exact Arrival & Departure Timestamps Matter

Under the statutory framework for the Early Years Foundation Stage (EYFS) and Ofsted Childcare Register requirements, childcare providers must maintain a daily record of all children being cared for on the premises, including the **exact hours of attendance**.

- In the event of a fire evacuation, building emergency, or missing-child investigation, real-time check-in timestamps establish who was physically in the building.
- For legal custody disputes or late-collection fee enforcement, objective server timestamps provide undisputed legal evidence.

---

## 2. Why Attendance Is NOT Just a Booking Status

A booking represents an advance commercial agreement and scheduling intention. Attendance is a real-time physical fact.
- Treating bookings as automatic attendance would create severe safeguarding liabilities (e.g. assuming a child who was absent was safely in the club).
- Separating booking from attendance ensures that missed sessions, emergency walk-ins, and late collections are accurately recorded.

---

## 3. Why Selecting the Correct Centre Is Critical

In a multi-branch organisation, staff must always confirm their active centre before taking roll call. Logging attendance under the wrong venue creates false fire rosters and corrupts venue capacity ratios.

---

## 4. Why Structured Absence Recording Matters

Recording specific absence reasons (`Illness`, `Holiday`, `Family`, `Other`) supports:
- **Public Health & Infection Control:** Tracking outbreaks of infectious illnesses (e.g. norovirus, chickenpox) across club cohorts.
- **Session Credit Ledger Accuracy:** Ensuring that only authorized absences receive administrative forgiveness credits.

---

## 5. Why Walk-In Arrivals Require an Explicit Workflow

When an unbooked child arrives on site, staff must not simply admit them verbally. The **+ Walk-In** workflow creates an explicit booking and attendance link, verifying medical disclosures, emergency contacts, and venue capacity limits inside an atomic database transaction.

---

## 6. Why Bulk Attendance Actions Require Explicit Confirmation

Marking whole groups as checked in or checked out simultaneously saves time during bus drop-offs. However, bulk actions risk accidentally checking in an absent child. Requiring explicit confirmation ensures staff visually verify every individual in the room.

---

## 7. Why Attendance Corrections Must Remain Auditable

When an attendance record is modified (e.g. correcting a late timestamp), SprintScale updates `attendanceMarkedBy` and `updatedAt`. This permanent audit trail prevents staff from covertly altering historical registers during regulatory audits.

---

## 8. Why Session Forgiveness Balances Ledgers Without Corrupting Invoices

In standard accounting, modifying an issued tax invoice to credit a missed session creates financial discrepancies and breaks double-entry reconciliation.
- SprintScale solves this via the **Session Credit Ledger**.
- Managers grant **Forgiveness Credits** against the student's attendance balance, leaving issued VAT invoices immutable while balancing the family's session entitlement.

---

## 9. Why Medical & Severe Allergy Alerts Are Prominently Rendered

Severe food allergies (such as peanut or tree nut anaphylaxis) require immediate recognition. High-contrast **Red Alert Badges** on attendance cards ensure tutors and front-desk staff instantly see life-saving medical alerts without needing to navigate away from the live register.

---

## 10. Why Ordinary Student Notes Are NOT Safeguarding Files

Ordinary student notes are visible to all classroom tutors and operational staff to support learning and behavioural recognition.
- If a sensitive child protection disclosure were written into a general note, it would compromise confidentiality, violate statutory data protection laws, and potentially endanger the child.
- Ordinary notes must be confined strictly to educational and daily operational updates.

---

## 11. Why Safeguarding Records Have Elevated Role Restrictions

Safeguarding concerns are restricted exclusively to **Designated Safeguarding Leads (Managers and Owners)**.
- Front Desk and Tutors cannot query, view, or edit safeguarding records.
- This legal quarantine protects the child's right to privacy and ensures that statutory referrals to local authorities (MASH/LADO) are handled solely by trained safeguarding officers.

---

## 12. Why Factual, Objective Language Is Mandatory in Incident Logs

When logging accident reports or safeguarding disclosures, staff must record objective facts, verbatim quotes, and observable physical marks. Speculation, personal opinions, or emotional assumptions can invalidate formal police or social care investigations.

---

## 13. Why Parent Visibility Differs by Record Type

- **Standard First Aid Reports:** Shared transparently with parents at pickup time to inform them of minor bumps or medication.
- **Safeguarding Disclosures:** Kept strictly confidential between the DSL and child protection agencies, and are **not** visible in the standard Parent Portal.

---

## 14. Why Safeguarding Records Must Never Be Copied into Broadcasts

Bulk email announcements and newsletters query parent contact lists. Keeping safeguarding files in an isolated database entity guarantees that confidential child protection data can never be accidentally merged into marketing or broad parent broadcasts.

---

## 15. Why Soft Deletion Preserves the Historical Audit Trail

When a student or parent record is archived, their historical attendance records, accident reports, and safeguarding disclosures remain intact in the database. Soft deletion ensures clubs satisfy UK statutory requirements to retain child accident and protection records until the child reaches adulthood.
