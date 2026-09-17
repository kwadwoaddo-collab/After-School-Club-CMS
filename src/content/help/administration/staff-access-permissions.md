# SprintScale CMS — Functional Manual: Staff Directory & Access Permissions
## Staff Management, Invitations, Role Assignment, Centre Memberships & Access Removal

---

## 1. What Staff Management Is

![Figure — Staff Directory showing user names, email addresses, and role badges](/training/assets/screenshots/annotated/SS-D6-S040.png)
*Figure 14.1 — Staff Directory Roster*

The **Staff Module** (`/dashboard/staff` and `/dashboard/staff/invite`) allows Organisation Owners and Centre Managers to build their team, assign operational roles, control venue access, and safely manage staff credentials.

Key Capabilities:
- **Staff Directory:** Central roster of active team members, their roles, email addresses, and assigned centres.
- **Secure Email Invitations:** Inviting new staff with single-use cryptographic invitation tokens sent via Resend.
- **Role Assignment:** Assigning or updating staff privileges across system roles (`Manager`, `Front Desk`, `Tutor`).
- **Centre Memberships:** Scoping staff members to authorised venues.
- **Safe Staff Deactivation & Removal:** Revoking centre access or organisation membership immediately without destroying historical attendance, audit, or incident attribution.

---

## 2. Server-Side Role & Permission Matrix

SprintScale enforces strict server-side authorization across all modules:

| System Capability | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) |
|---|---|---|---|---|
| **Finance Dashboard (`/dashboard/finance`)** | ✅ All Centres | ✅ Assigned Centres | ❌ Blocked | ❌ Blocked |
| **Centre Invoices & Offline Payments** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ Blocked |
| **Void Invoice (`voidInvoice`)** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Delete Invoice (`deleteInvoice`, Zero Payments)** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Staff Directory (`/dashboard/staff`)** | ✅ View / Manage All | ✅ View / Manage Assigned | ❌ Blocked | ❌ Blocked |
| **Invite Staff (`/dashboard/staff/invite`)** | ✅ All Roles & Centres | ✅ Assigned Centres (Mgr/FD/Tutor) | ❌ Blocked | ❌ Blocked |
| **Change Staff Roles** | ✅ All Roles | ✅ Up to Manager (Non-Owner) | ❌ Blocked | ❌ Blocked |
| **Remove Staff Access** | ✅ Full Org Detach | ✅ Remove from Managed Centres | ❌ Blocked | ❌ Blocked |
| **Create New Centre (`/dashboard/centres/add`)** | ✅ Full Access | ✅ Full Access | ❌ Blocked | ❌ Blocked |
| **Edit Centre General Settings** | ✅ All Centres | ✅ Assigned Centres | ❌ Blocked | ❌ Blocked |
| **Edit Centre Bank & Billing Details** | ✅ All Centres | ✅ Assigned Centres | ❌ Blocked | ❌ Blocked |
| **Student Directory & Medical Profiles** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ✅ Assigned (View) |
| **Public Registrations & Intake Triage** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ❌ Blocked |
| **Daily Attendance & Tablet Kiosk** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ✅ Assigned (Live) |
| **Session Credit Ledger (`/ledger`)** | ✅ All Centres | ✅ Assigned Centres | ❌ Blocked | ❌ Blocked |
| **Standard Incident & First Aid Logging** | ✅ All Centres | ✅ Assigned Centres | ✅ Assigned Centres | ✅ Assigned Centres |
| **Restricted Safeguarding Records (DSL)** | ✅ Full Access | ✅ Assigned Centres | ❌ Blocked | ❌ Blocked |
| **Parent Broadcasts (`/communications`)** | ✅ All Centres | ✅ Assigned Centres | ❌ Blocked | ❌ Blocked |
| **Operational Reports & CSV Exports** | ✅ Full Access | ✅ Assigned Centres | ❌ Blocked | ❌ Blocked |
| **Full GDPR Organisation Export (JSON)** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ Blocked |
| **Recovery Bin View & Family Restore** | ✅ Full Access | ✅ Full Access | ✅ Full Access | ❌ Blocked |
| **Permanent GDPR Purge (`hardDeleteParent`)** | ✅ **Owner Only** | ❌ Blocked | ❌ Blocked | ❌ Blocked |

> [!NOTE]
> **Manager Scope Invariant:** Centre Managers exercise supervisory authority over staff strictly within their authorised centres. Managers can invite new staff, update roles up to Manager, and assign or remove centre access for their managed centres. Only Organisation Owners can assign or modify the `ORG_OWNER` role, configure centres across the whole organisation, or permanently detach a user from the organisation container.

---

## 3. Step-by-Step Procedures

### Procedure 1: Inviting a New Staff Member

![Figure — Staff Invitation Modal with role selector (Manager, Front Desk, Tutor)](/training/assets/screenshots/annotated/SS-D6-S041.png)
*Figure 14.2 — Staff Invitation Modal*

📹 **Video Walkthrough:** [Watch: Inviting a New Staff Member via Email](/training/assets/videos/SS-D6-V022.mp4)

![Figure — Staff Invitation Acceptance Page with password and profile setup](/training/assets/screenshots/annotated/SS-D6-S052.png)
*Figure 14.3 — Staff Invite Acceptance Screen*

📹 **Video Walkthrough:** [Watch: Accepting a Staff Email Invitation](/training/assets/videos/SS-D6-V023.mp4)
**Who Can Do This:** Organisation Owner (`ORG_OWNER`), Centre Manager (`MANAGER`) (for assigned centres)

**Steps:**
1. Navigate to: `Sidebar → Staff` (`/dashboard/staff`).
2. Click **+ Invite Staff Member** (or go to `/dashboard/staff/invite`).
3. Enter the staff member's **Email Address**, **First Name**, and **Last Name**.
4. Select their **Role:** `MANAGER`, `FRONT_DESK`, or `TUTOR`. (Note: Only Organisation Owners can configure owner-level privileges).
5. Select their initial **Assigned Centre**. Managers must select a centre within their authorised management scope; Owners can assign any centre.
6. Click **Send Invitation**.

**What Happens in the System:**
- A raw 32-byte cryptographic token is generated.
- The SHA-256 hash of the token is stored in the `staffInvites` table with a 7-day expiration timestamp.
- An email invitation containing the secure link (`/accept-invite?token=...`) is dispatched via Resend.
- The user account is provisioned and linked to the organisation and selected centre.

---

### Procedure 2: Assigning Centres to an Existing Staff Member

![Figure — Staff Centre Membership checkboxes assigning user access to specific venues](/training/assets/screenshots/annotated/SS-D6-S042.png)
*Figure 14.4 — Staff Centre Membership Selection Form*

📹 **Video Walkthrough:** [Watch: Scoping Staff Access Across Specific Centres](/training/assets/videos/SS-D6-V024.mp4)

![Figure — Zero-Centre Assigned Staff notice informing user to contact Organisation Owner](/training/assets/screenshots/annotated/SS-D6-S074.png)
*Figure 14.5 — Zero-Centre Assigned Staff Empty State*

📹 **Video Walkthrough:** [Watch: Handling Zero-Centre Staff Assignment](/training/assets/videos/SS-D6-V051.mp4)
**Who Can Do This:** Organisation Owner (`ORG_OWNER`), Centre Manager (`MANAGER`) (for assigned centres)

**Steps:**
1. Navigate to: `Sidebar → Staff` (`/dashboard/staff`).
2. Click on the staff member's name to open their profile (`/dashboard/staff/[userId]`).
3. In the **Centre Memberships** section, check the boxes next to venues the staff member should access.
4. Click **Save Centre Assignments**.

**Expected Result:**
The system updates `centreMemberships`. When a Centre Manager saves assignments, memberships are added or removed only within that Manager's authorised centres; any assignments the employee holds in other venues remain untouched. The next time the staff member logs in or refreshes, their centre selector reflects the updated venue assignments.

---

### Procedure 3: Changing a Staff Member's Role

![Figure — Self-Demotion Guard Dialog preventing owner from removing own administrative privileges](/training/assets/screenshots/annotated/SS-D6-S058.png)
*Figure 14.6 — Self-Demotion Guard Modal*

📹 **Video Walkthrough:** [Watch: Updating Staff Role & Privileges](/training/assets/videos/SS-D6-V025.mp4)
**Who Can Do This:** Organisation Owner (`ORG_OWNER`), Centre Manager (`MANAGER`) (for non-owner staff in their centres)

**Steps:**
1. Open the staff member's profile at `/dashboard/staff/[userId]`.
2. Locate the **Role & Permissions** card.
3. Select the new role from the dropdown (`MANAGER`, `FRONT_DESK`, or `TUTOR`).
4. Click **Update Role**.

> [!IMPORTANT]
> **Owner Role Boundaries:**
> Centre Managers cannot modify an Organisation Owner's role, nor can they promote any user to `ORG_OWNER`. Upgrading to or demoting an Organisation Owner can only be executed by an Organisation Owner. Users cannot change their own role.

---

### Procedure 4: Removing / Deactivating a Staff Member

![Figure — Staff Deactivation Warning Dialog explaining session revocation and record preservation](/training/assets/screenshots/annotated/SS-D6-S043.png)
*Figure 14.7 — Staff Deactivation Modal*

📹 **Video Walkthrough:** [Watch: Safely Deactivating a Staff Member](/training/assets/videos/SS-D6-V026.mp4)
**Who Can Do This:** Organisation Owner (`ORG_OWNER`) (Full Org Removal), Centre Manager (`MANAGER`) (Managed Centre Removal)

**Steps:**
1. Open the staff member's profile at `/dashboard/staff/[userId]`.
2. Click **Remove Staff Member** (red button).
3. In the confirmation modal, review the warning and click **Confirm Removal**.

**What Happens in the System:**
- **When executed by an Organisation Owner:** The system verifies the target is not an `ORG_OWNER`. All centre memberships are deleted, and the user's `organisationId` is cleared (`null`), immediately revoking all dashboard access across the organisation.
- **When executed by a Centre Manager:** The staff member's memberships for the centres authorised to that Manager are removed. If the staff member holds memberships at other centres, those remain active. Managers cannot remove an `ORG_OWNER` or remove themselves.

---

## 4. Preservation of Historical Attribution

SprintScale strictly enforces data preservation upon staff departure:

> [!IMPORTANT]
> **Historical Record Integrity:**
> Removing a staff member **never deletes** historical attendance marks, daily roll call sign-ins, first aid logs, safeguarding entries, or financial payment records created by that person. The user's historical ID remains recorded in `auditEvents` and relational tables to satisfy statutory and Ofsted audit requirements.
