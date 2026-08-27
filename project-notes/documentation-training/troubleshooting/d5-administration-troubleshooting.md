# SprintScale CMS — Troubleshooting Handbook
## Milestone D5: Administration, Multi-Centre Settings, Staff & Access, Communications & Maintenance

**Target Audience:** Organisation Owners, Centre Managers, Front Desk Administrators  
**Scope:** Practical resolution steps for operational errors during staff onboarding, role changes, venue scoping, parent broadcasts, and data recovery.

---

## Master Troubleshooting Index

1. [Staff invitation email did not arrive](#1-staff-invitation-email-did-not-arrive)
2. [Staff invitation token expired](#2-staff-invitation-token-expired)
3. [Invite error: "This person is already a member of your organisation"](#3-user-already-exists-in-organisation)
4. [Staff member cannot see a centre in their centre switcher](#4-staff-member-cannot-see-a-centre)
5. [Staff member assigned to wrong centre](#5-staff-member-assigned-to-wrong-centre)
6. [Wrong role assigned to staff member](#6-wrong-role-assigned-to-staff-member)
7. [Tutor reports they cannot access finance or invoices](#7-tutor-cannot-access-finance)
8. [Front Desk cannot access safeguarding files or void invoices](#8-front-desk-safeguarding-void-restriction)
9. [Manager cannot see records for another club venue](#9-manager-cannot-see-other-venue)
10. [Parent excluded from email broadcast](#10-parent-excluded-from-email-broadcast)
11. [SMS broadcast failed / not delivered](#11-sms-broadcast-failed)
12. [Header notification bell unread counter not updating](#12-notification-bell-counter)
13. [Pupil school year group appears wrong on register](#13-pupil-school-year-group-wrong)
14. [Manager searching for manual "Rollover Academic Year" button](#14-manual-rollover-button-missing)
15. [Soft-deleted family cannot be found in active pupil search](#15-soft-deleted-family-in-active-search)
16. [Restored family missing from certain rosters](#16-restored-family-roster-refresh)
17. [Permanent purge button not accessible](#17-permanent-purge-button-access)
18. [Audit trail not displaying minor note changes](#18-audit-trail-event-types)
19. [Wonde integration settings unconfigured error](#19-wonde-integration-settings-error)
20. [Owner attempting to find "Delete Centre" button](#20-delete-centre-button-missing)

---

## Detailed Troubleshooting Scenarios

### 1. Staff Invitation Email Did Not Arrive
- **Symptom:** Invited employee states they have not received the invitation email.
- **Likely Cause:**
  - Email delivered to Spam/Junk folder.
  - Typo in email address during invitation.
- **Safe Resolution:**
  1. Ask employee to check Spam/Junk folders for an email from SprintScale.
  2. Open `/dashboard/staff` and verify the exact email address.
  3. If typo occurred, re-invite with the corrected email address.

---

### 2. Staff Invitation Token Expired
- **Symptom:** Staff clicks invite link and receives error: *"Invitation token has expired or is invalid."*
- **Likely Cause:** Staff invitation tokens expire automatically after **7 days** for security.
- **Safe Resolution:**
  1. Log in as Organisation Owner.
  2. Navigate to `/dashboard/staff/invite` and dispatch a fresh invitation.

---

### 3. User Already Exists in Organisation
- **Symptom:** Owner attempts to invite staff and receives error: *"This person is already a member of your organisation."*
- **Likely Cause:** The email address is already linked to an active user account in this organisation.
- **Safe Resolution:**
  1. Open `/dashboard/staff` and search for the user's name or email.
  2. Click on their profile to update their role or assign new centres.

---

### 4. Staff Member Cannot See a Centre
- **Symptom:** Manager or Tutor logs in but cannot select a specific club location.
- **Likely Cause:** The user has not been assigned to that venue in `centreMemberships`.
- **Safe Resolution:**
  1. Owner opens `/dashboard/staff/[userId]`.
  2. In the Centre Memberships checklist, check the missing venue and click **Save Centre Assignments**.

---

### 7. Tutor Cannot Access Finance
- **Symptom:** Tutor asks why they cannot see the Finance tab or invoice records.
- **Likely Cause:** Expected system behavior. By architectural design, the `TUTOR` role is strictly restricted to live registers, student notes, and scorecards.
- **Safe Resolution:** Explain least-privilege role boundaries. If the staff member requires financial access, an Owner must upgrade their role to `FRONT_DESK`, `MANAGER`, or `ORG_OWNER`.

---

### 8. Front Desk Safeguarding / Void Restriction
- **Symptom:** Front Desk staff reports missing Void button or missing safeguarding file access.
- **Likely Cause:** Expected system behavior. Voiding invoices is Owner-only; restricted safeguarding records are restricted to Managers and Owners.
- **Safe Resolution:** Front Desk staff should escalate void requests or safeguarding concerns to their Centre Manager or Organisation Owner.

---

### 10. Parent Excluded from Email Broadcast
- **Symptom:** A parent did not receive a general announcement broadcast sent to their centre.
- **Likely Cause:** The parent opted out of communications during registration (`communicationsConsent === false`).
- **Safe Resolution:**
  1. Explain that SprintScale enforces server-side consent filtering for general broadcasts.
  2. The parent can update their communications preferences in the Parent Portal or during their next booking.

---

### 11. SMS Broadcast Failed
- **Symptom:** SMS broadcast fails to send or shows unconfigured error.
- **Likely Cause:** Twilio SMS integration is currently in deferred status in production.
- **Safe Resolution:** Use the email broadcast channel (powered by Resend) for all parent announcements.

---

### 13. Pupil School Year Group Wrong
- **Symptom:** Pupil is listed in Year 3 but should be in Year 4.
- **Likely Cause:** Student joined mid-year or had their school year recorded incorrectly during intake.
- **Safe Resolution:**
  1. Open the student's profile at `/dashboard/students/[id]`.
  2. Click **Edit Student**, select the corrected School Year, and click **Save Changes**.

---

### 14. Manual Rollover Button Missing
- **Symptom:** Centre Manager is searching for a "Rollover School Years" button in the dashboard.
- **Likely Cause:** Academic-year roll-forward is fully automated via an annual background cron job running on **September 1st** (`/api/cron/school-year-roll`). There is no manual rollover button in the user dashboard.
- **Safe Resolution:** Advise the Manager that year groups advance automatically every September 1st. Individual adjustments can be made directly on student profiles.

---

### 15. Soft-Deleted Family in Active Search
- **Symptom:** Staff deleted a family, but cannot find them in the search bar.
- **Likely Cause:** Soft-deleted families are hidden from active rosters and moved to the **Recovery Bin**.
- **Safe Resolution:** Navigate to `Sidebar → Parents → Recovery Bin` (`/dashboard/parents/bin`) to view, restore, or permanently delete the family.

---

### 19. Wonde Integration Settings Error
- **Symptom:** Staff asks how to connect Wonde to their school MIS.
- **Likely Cause:** The business operates SprintScale as a standalone CMS platform. Wonde school MIS synchronization is not required and is deferred in production.
- **Safe Resolution:** Inform staff that student records and registrations are managed directly within SprintScale; no external school MIS sync is needed.

---

### 20. Delete Centre Button Missing
- **Symptom:** Owner is searching for a button to delete a closed centre venue.
- **Likely Cause:** Self-service centre deletion is omitted by design to protect historical attendance, safeguarding, and invoice audit trails from being orphaned.
- **Safe Resolution:** Remove all active staff assignments from the venue and ensure no upcoming bookings exist. Historical records will remain safely preserved for compliance.
