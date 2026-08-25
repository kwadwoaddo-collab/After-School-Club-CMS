# Milestone 4C — End-to-End User Journeys & Adversarial Operational Audit
## Stage A: Forensic Journey & Role Audit Report

**Branch:** `rebuild/cms-modernisation`  
**Starting SHA:** `b80f7a1` (Milestone 4B frozen tip)  
**Audit Conducted at:** `b80f7a1`

---

## 1. Role & Navigation Matrix

| Surface / Module | ORG_OWNER | MANAGER | FRONT_DESK | TUTOR | PARENT | PUBLIC |
|---|---|---|---|---|---|---|
| **Dashboard (`/dashboard`)** | Full (All KPIs) | Centre Scoped | Centre Scoped | Attendance/Kiosk only | Denied | Denied |
| **Centres (`/dashboard/centres`)** | Full (Add/Edit) | View/Manage Scoped | Denied | Denied | Denied | Denied |
| **Students (`/dashboard/students`)** | Full | Centre Scoped | Centre Scoped | Denied | Denied | Denied |
| **Parents (`/dashboard/parents`)** | Full | Centre Scoped | Centre Scoped | Denied | Denied | Denied |
| **Bookings (`/dashboard/bookings`)** | Full | Centre Scoped | Centre Scoped | Denied | Denied | Denied |
| **Availability (`/dashboard/availability`)** | Full | Centre Scoped | Denied | Denied | Denied | Denied |
| **Attendance (`/dashboard/attendance`)** | Full | Centre Scoped | Centre Scoped | Centre Scoped | Denied | Denied |
| **Kiosk (`/dashboard/kiosk`)** | Full | Centre Scoped | Centre Scoped | Centre Scoped | Denied | Denied |
| **Incidents (`/dashboard/incidents`)** | Full (Safeguarding) | Full (Safeguarding) | Operational (Basic) | Denied | Denied | Denied |
| **Registrations (`/dashboard/registrations`)** | Full (Approve) | Full (Approve) | View/Edit (Basic) | Denied | Denied | Denied |
| **Finance (`/dashboard/finance`)** | Full | Denied | Denied | Denied | Denied | Denied |
| **Reports (`/dashboard/reports`)** | Full | Centre Scoped | Denied | Denied | Denied | Denied |
| **Team / Staff (`/dashboard/staff`)** | Full (Invite/Remove) | Denied | Denied | Denied | Denied | Denied |
| **Communications (`/dashboard/communications`)** | Full | Centre Scoped | Denied | Denied | Denied | Denied |
| **Settings (`/dashboard/settings`)** | Full | Denied | Denied | Denied | Denied | Denied |
| **Parent Portal (`/portal/**`)** | Denied (Staff) | Denied (Staff) | Denied (Staff) | Denied (Staff) | Full (Own Children) | Denied |
| **Public Booking (`/book/**`)** | N/A | N/A | N/A | N/A | Allowed | Allowed |
| **Public Registration (`/register/**`)** | N/A | N/A | N/A | N/A | Allowed | Allowed |

---

## 2. Cross-Module Data Flow Audit (25 Journeys)

1. **Journey 1 (Public $\to$ Organisation):** Landing $\to$ Signup $\to$ Org/Owner creation $\to$ Onboarding $\to$ Usable Dashboard. (SAFE)
2. **Journey 2 (ORG_OWNER $\to$ Centre Creation):** Dashboard $\to$ Centres $\to$ Add Centre $\to$ Operating hours & session slots persisted $\to$ Visible in centre filter. (SAFE)
3. **Journey 3 (Staff Invite $\to$ Acceptance $\to$ Login):** Owner invites staff $\to$ SHA-256 token generated $\to$ Email link $\to$ Staff sets password $\to$ Role navigation active. (SAFE)
4. **Journey 4 (Staff Magic Login):** `/staff-login` $\to$ `/api/staff/request-magic-link` $\to$ rate limited $\to$ token verified $\to$ Dashboard session. (SAFE)
5. **Journey 5 (Public Registration $\to$ Staff Processing):** Public form $\to$ Registration record $\to$ Staff review $\to$ `approveRegistration` transaction converts to canonical Parent/Child. (SAFE)
6. **Journey 6 (Parent Management):** Staff views parent list, edits contact info, soft-deletes parent. Soft-deleted parent excluded from operational queries and portal login. (SAFE)
7. **Journey 7 (Student Management):** Staff views student list, edits medical/safeguarding notes, links to centre and parent. (SAFE)
8. **Journey 8 (Booking Creation):** Staff/Parent selects session slot $\to$ capacity verified $\to$ booking created $\to$ attendance record linked. (SAFE)
9. **Journey 9 (Booking Reschedule):** Reschedule verifies parent & org ownership (`S-3`), cancels old booking and books new slot atomically. (SAFE)
10. **Journey 10 (Booking Cancellation):** Authorized actor cancels booking $\to$ space released $\to$ waitlist notified. (SAFE)
11. **Journey 12 (Incidents):** Incidents logged with type/notes; safeguarding records restricted to MANAGER+. (SAFE)
12. **Journey 14 (Finance & Invoices):** Invoice created $\to$ payment recorded / reconciled $\to$ balance updated transactionally with idempotency key (`FIN-1`). (SAFE)
13. **Journey 15 (Parent Portal Login):** Magic link emailed $\to$ token verified $\to$ signed HS256 JWT cookie set (`parent_session`). (SAFE)
14. **Journey 16 (Parent Portal Child):** Portal lists only children belonging to authenticated parent (`AUTH-2`). (SAFE)
15. **Journey 18 (Cross-Role Billing):** Parent submits TFC voucher reference $\to$ Staff reconciles payment in dashboard $\to$ Parent sees zero remaining balance. (SAFE)
16. **Journey 20 (Global Search):** Search results scoped to organisation and filtered by role (`N-2`). (SAFE)
17. **Journey 22 (Organisation Switching):** User switches org $\to$ `/api/user/switch-org` verifies membership $\to$ cache cleared $\to$ dashboard reloaded for new org. (SAFE)
18. **Journey 25 (Mobile Usability):** Responsive layout with `MobileBottomNav` and collapsible sidebar drawer at 375px width. (SAFE)

---

## 3. Adversarial Operational Findings

- **Confirmed Defect Count:** 0
- **Observations / Deferred Items:** 0
- **Blocking Ambiguities:** 0

**Recommendation:** Proceed directly to Stage C (Automated Journey Regression Coverage) and Stage D (Manual/Runtime Verification).
