# SprintScale CMS — Operational Rationale
## Statutory, Legal & Security Foundations of Family, Registration & Booking Controls

---

## 1. Why Parent and Child Records Are Kept Separate

In adult-centric software, a user account typically represents a single person. In childcare management, operational reality is fundamentally different:
- **Contractual & Financial Authority:** Parents/guardians sign legal terms, provide medical consent, and pay invoices.
- **Physical Custodial Care:** Children attend classroom sessions, require first aid, and are marked on roll calls.
- **Multi-Sibling Dynamics:** A single parent often enrols multiple siblings who attend on different days, in different school years, and with different medical needs.

By maintaining separate `parents` and `children` entities linked by a relational model, SprintScale enables:
- One family billing account covering multiple children.
- Consolidated invoice runs and single-payment receipts.
- Sibling awareness on roll-call registers.

---

## 2. Why a Child Must Always Link to Verified Responsible Adults

Under UK Childcare and Ofsted statutory frameworks, childcare providers cannot take custody of a minor without verified legal guardians and emergency contacts. The system enforces:
- A mandatory parent association on every student profile.
- Authorised collectors with contact numbers and collection passwords.
- Real-time phone lookup on front-desk and manager dashboards.

---

## 3. Why Medical & Allergy Badges Are Universally Visible to On-Duty Staff

Food allergies (such as severe peanut, dairy, or egg allergies) and medical conditions (such as asthma or diabetes) present life-threatening risks during club sessions.

SprintScale ensures that:
- Whenever an allergy or medical condition is recorded, the system automatically renders prominent high-contrast **Red Medical Alert Badges** across all attendance registers and kiosk screens.
- Any staff member taking roll call or operating the door can immediately identify a child's emergency health needs without digging into administrative records.

---

## 4. Why Safeguarding Files Are Isolated from Ordinary Classroom Notes

> [!SAFEGUARDING]
> Child protection concerns, abuse disclosures, and neglect reports are governed by strict confidentiality laws (Working Together to Safeguard Children).

- **Everyday Operational Notes:** Homework flags, positive behaviour, and activity progress are accessible to all tutors to support daily classroom delivery.
- **Safeguarding Records:** Confidential child protection disclosures are locked in the `incidents` module and restricted exclusively to **Managers and Owners** acting as Designated Safeguarding Leads (DSLs). Standard front-desk staff and tutors are physically prevented from reading or authoring safeguarding files.

---

## 5. Why Registration Approval Is Controlled (Triage Queue)

Allowing public registrations to immediately populate active registers without review creates severe operational and safety risks:
- Unverified medical needs or severe allergies might go unnoticed by club supervisors.
- Incomplete emergency contacts or missing collection passwords could leave staff unable to contact parents.
- Accidental duplicate applications could inflate club rosters.

The **Registrations Triage Queue** ensures a designated manager verifies every child's details, checks capacity, and confirms centre assignment before the child is eligible to attend.

---

## 6. Why CRM Duplicate Prevention Engine Is Enforced

When parents re-register or enrol a second child, they often re-enter their own name and contact details. Without intelligent matching:
- Duplicate parent accounts would proliferate.
- Invoices would be split across separate accounts.
- Parent Portal logins would become fragmented.

SprintScale's CRM matching engine resolves parents by verified email address and matches children by full name and date of birth, preserving unified family profiles while updating phone numbers and addresses safely.

---

## 7. Why Organisations and Centres Are Strictly Isolated

- **Organisation Isolation:** Multi-tenancy isolation guarantees that records, student details, and financial balances from one club business are physically invisible to any other business on the platform.
- **Centre Isolation:** Multi-branch staff members are scoped strictly to their assigned club centres. A tutor working at Centre A cannot access children or registers at Centre B, protecting family privacy.

---

## 8. Why Booking Slot Capacity and Concurrency Controls Exist

Childcare regulations mandate strict staff-to-child supervision ratios (e.g. 1:8 for early years, 1:15 for older children). Exceeding venue capacity is a compliance breach and a safety hazard.

- SprintScale calculates real-time available capacity based on centre operating hours and existing confirmed bookings.
- Slot bookings run within database transactions, preventing race conditions where two parents simultaneously attempt to book the final available space.

---

## 9. Why Duplicate Time-Slot Protection Exists

The database enforces a composite uniqueness constraint (`unique_time_slot` on `centreId`, `modality`, `startAt`, `parentId`). This prevents accidental double-booking errors caused by browser refresh, double-clicking confirmation buttons, or conflicting booking entries.

---

## 10. Why Booking Is NOT the Same Thing as Attendance

- **A Booking is an Intent:** A scheduled reservation for a future session date.
- **Attendance is Custodial Fact:** The real-time legal record that a child walked into the building, was cared for by named staff, and was collected by an authorised adult at an exact time.

A child may have a confirmed booking but be marked **Absent** (with an absence reason). Conversely, an unbooked child may arrive unexpectedly and be logged via a **Walk-In Booking** and live check-in.

---

## 11. Why Records Are Soft-Deleted Before Permanent Purge

Accidental deletion of a student record during active term time could destroy critical attendance audit trails, medical histories, and safeguarding records.

SprintScale's 30-day **Recovery Bin** ensures:
- Archived records can be restored with a single click.
- Active rosters are kept clean without risking irreversible data loss.

---

## 12. Why Permanent GDPR Purge Is Restricted to Organisation Owners

UK GDPR gives parents the "Right to Erasure" under specific conditions. However, permanent database erasure destroys historical audit logs and cannot be undone.

To prevent accidental data destruction by junior staff, **only the Organisation Owner (`ORG_OWNER`)** possesses the cryptographic authority to execute a permanent purge from the Recovery Bin.

---

## 13. Why Communications Consent Is Legally Gated

Under UK Privacy and Electronic Communications Regulations (PECR) and UK GDPR, marketing communications and general announcements require explicit opt-in consent.

SprintScale automatically queries `parents.communicationsConsent` before compiling recipient lists for bulk email broadcasts. Parents who have opted out are excluded server-side, protecting club owners from regulatory fines.

---

## 14. Why Parent Portal Access Is Passwordless & Family-Scoped

- **Passwordless Security:** Eliminates weak passwords, credential stuffing attacks, and password sharing between estranged family members.
- **Family Scoping:** The parent session token (`parent_session`) is signed with a high-entropy secret (HS256) and verified on every request. Parents can only access student profiles and invoices where `children.parentId = session.parentId`.

---

## 15. Why External Integrations Must Not Become Single Points of Failure

SprintScale integrates with Stripe, Resend, and Google Calendar. However, if an external API experiences a third-party outage or network timeout:
- The core CMS database transaction completes successfully.
- The parent and child records are saved safely.
- The integration failure is caught, logged in Sentry, and handled via background retry queues without crashing the staff dashboard or blocking child check-ins.
