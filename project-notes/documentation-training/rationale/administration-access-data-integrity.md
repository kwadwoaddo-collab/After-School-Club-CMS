# SprintScale CMS — Operational Rationale
## Foundations of Multi-Centre Administration, Access Controls & Data Integrity

---

## 1. Why Organisations and Centres Are Strictly Separated

An after-school club operator may run five club premises across five schools, but operates as one single corporate or legal entity.
- The **Organisation** represents the legal entity holding commercial liability, master billing terms, and staff employment contracts.
- The **Centre** represents the physical premises (hall, venue, school site) where daily sessions, registers, and Ofsted inspections occur.
- Separating these layers allows Owners to maintain centralised financial visibility while isolating daily registers and staff rosters to specific venues.

---

## 2. Why Least-Privilege Role Assignment Is Enforced

Granting every employee full administrative power creates serious data privacy, financial, and safeguarding risks.
- **Least-Privilege RBAC** limits staff to only the software capabilities necessary for their specific job function.
- A Tutor needs roll call and assessment tools; they have no operational need to view parent invoice histories or void commercial debts.

---

## 3. Why Centre Membership Scoping Is Enforced for Non-Owners

In multi-site clubs, a Manager or Tutor stationed at Site A should not accidentally view or edit daily registers at Site B.
- Centre scoping (`centreMemberships`) ensures that non-owner staff only see data for their assigned locations, preventing operational cross-talk and protecting children's local data privacy.

---

## 4. Why Tutors Are Blocked from Financial and Administrative Tools

Tutors deliver on-the-ground activities and classroom learning.
- Allowing activity staff to view parent bank details, edit billing agreements, or change organisation configurations creates operational distraction and audit non-compliance.
- Restricting Tutors to live registers, student notes, and scorecards keeps classroom delivery focused and secure.

---

## 5. Why Safeguarding Records Require Elevated Permissions

Child protection concerns, family distress notes, and external agency referrals contain highly sensitive personal information.
- Standard classroom staff and front-desk personnel must log first aid and general behavior notes, but detailed safeguarding referral files are restricted to `MANAGER` and `ORG_OWNER` roles to prevent unauthorized disclosure.

---

## 6. Why Staff Deactivation Must Preserve Historical Attribution

When an employee leaves the organisation:
- Detaching their account revokes login access immediately.
- However, their name and user ID must remain attached to historical attendance records, daily roll call check-ins, first aid logs, and payment entries. Erasing past staff attribution would invalidate statutory Ofsted inspection trails and financial audits.

---

## 7. Why Communications Consent Is Re-Derived Server-Side

Relying solely on client-side checkboxes in a web browser can lead to non-consented marketing emails if network requests are manipulated.
- SprintScale re-queries `COALESCE(bool_or(bookings.communicationsConsent), false)` inside the server action, ensuring that no broadcast email is ever dispatched to an unconsented parent.

---

## 8. Why Transactional Notices Do Not Require Marketing Consent

Essential operational communications — such as invoice receipts, passwordless login magic links, emergency closure alerts, and injury reports — are required for service fulfillment and child safety.
- Treating essential operational notices as marketing broadcasts would prevent parents from receiving critical safety and billing information if they opted out of newsletters.

---

## 9. Why Soft-Deletion and the 30-Day Recovery Bin Are Essential

Accidental deletion of a family profile can result in the loss of medical alerts, emergency contacts, and attendance history.
- The **Recovery Bin** acts as a safety buffer: soft-deleted records remain recoverable for 30 days before permanent purging.

---

## 10. Why Permanent Purge Is Strictly Caution-Flagged

Permanent purge removes relational database rows across parents, pupils, and linked records.
- Because database foreign keys cascade and permanently erase historical data, the application requires explicit confirmation and displays prominent warning alerts.

---

## 11. Why Academic-Year Rollover Preserves Historical Records

Advancing a pupil from Year 2 to Year 3 updates their current active grade.
- It does not alter past attendance registers from Year 2, past invoices issued during Year 2, or historical progress scorecards. Historical educational and commercial records remain permanently anchored to their original timestamps.

---

## 12. Why External Providers Fail Closed When Unconfigured

If an optional provider (such as Twilio SMS or Stripe Checkout) is not configured in environment variables:
- The system fails closed with a clear, graceful error rather than attempting broken network calls or corrupting application state.

---

## 13. Why Developer CLI Scripts Are Segregated from User Interfaces

Administrative tasks (such as soft-deleting a family or updating centre bank details) are built into the web UI with permission checks and audit trails.
- Low-level database reset scripts (`reset-db.ts`, direct SQL migrations) operate without application guards and are strictly reserved for developer workflows in local environments.
