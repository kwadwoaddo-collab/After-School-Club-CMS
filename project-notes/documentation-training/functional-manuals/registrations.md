# SprintScale CMS — Functional Manual: Registrations
## Inbound Public Intake, Application Triage, Verification & Enrolment

---

## 1. What a Registration Represents

A **Registration** is an official intake application submitted by a family requesting enrolment in your club organisation.

It captures:
- Parent and emergency contact details.
- Multiple children with birthdays, school years, medical conditions, and severe allergies.
- Statutory parental consents (Photography, Sun Cream, Emergency First Aid).
- Authorised collectors and emergency pickup contacts.
- Intended start dates and requested session types.
- A legally binding **Digital Signature** and terms agreement.

---

## 2. Conceptual Relationship: Registration vs. Parent vs. Child

```
┌─────────────────────────────────────────────────────────────┐
│                 PUBLIC REGISTRATION SUBMISSION              │
│  Captures raw applicant data + digital signature + consent   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                TRIAGE & CRM MATCHING ENGINE                 │
│  • Matches or creates PARENT in organisation database       │
│  • Matches or creates CHILDREN linked to that parent        │
│  • Saves authorised collectors & medical disclosures        │
│  • Sets status to `awaiting_confirmation`                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
    [APPROVED: `signed_up`]         [REJECTED: `not_interested`]
  Parent and children become       Registration archived; parent
  fully active for bookings &       notified; records quarantined
  attendance; welcome email sent    from active roll calls.
```

---

## 3. Who Can Use It (Role Permissions)

| User Role | View Queue (`/dashboard/registrations`) | View Application Detail (`/dashboard/registrations/[id]`) | Approve (`signed_up`) | Reject (`not_interested`) | Bulk Email Applicants |
|---|---|---|---|---|---|
| **Owner** (`ORG_OWNER`) | ✅ Full (All Centres) | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **Manager** (`MANAGER`) | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped |
| **Front Desk** (`FRONT_DESK`)| ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ❌ No Access |
| **Tutor** (`TUTOR`) | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access |
| **Parent** (Consumer Auth) | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access |

---

## 4. The Registration Lifecycle & Statuses

SprintScale enforces three canonical statuses in the registration lifecycle:

| Status Enum Value | UI Badge Display | Meaning & Operational State |
|---|---|---|
| `awaiting_confirmation` | 🟡 **Awaiting Confirmation** | Application submitted; pending review by Centre Manager or Front Desk. |
| `signed_up` | 🟢 **Confirmed / Signed Up** | Application approved; family is fully active for session bookings and attendance registers. |
| `not_interested` | 🔴 **Not Interested / Rejected**| Application rejected, declined, or cancelled by applicant. Quarantined from active registers. |

---

## 5. The Public Registration Journey (Parent-Facing)

Families register online via your unique organisation URL:  
👉 `https://app.sprintscaleit.co.uk/register/[organisation-slug]`

### What the Parent Experiences:
1. **Club Branding & Welcome:** The registration page displays your club logo, brand colors, and centre selector.
2. **Parent / Guardian Details:** Enters full name, email, phone number, relationship, and residential address.
3. **Children Details:** Can add one or more children, specifying:
   - Name, Date of Birth, School Year group.
   - Medical conditions, severe allergies, dietary requirements, and GP doctor details.
   - Consents: Photo Consent, Sun Cream Consent, First Aid Treatment.
4. **Emergency Contacts & Authorised Collectors:** Enters alternative emergency contacts and authorised pickup adults.
5. **Funding & Special Needs:** Notes Tax-Free Childcare / voucher intent and SEN support requirements.
6. **Terms & Digital Signature:** Reviews club terms and signs directly on the touchscreen/mouse canvas.
7. **Immediate Email Confirmation:** Parent receives an automated email confirming receipt of the application.
8. **In-App Notification:** Organisation Owners and Centre Managers receive an immediate notification in `/dashboard/notifications`.

---

## 6. Reviewing & Triaging Inbound Applications

**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Registrations` (`/dashboard/registrations`).
2. Filter the table by **Status: Awaiting Confirmation** and select your **Centre**.
3. Click on an application row to open the complete **Registration Dossier** (`/dashboard/registrations/[id]`).
4. **Review the Dossier:**
   - Verify parent contact info and address.
   - Review children's year groups and requested session start dates.
   - **Crucial Check:** Inspect medical conditions, allergy alerts, and emergency contact numbers.
   - Inspect the captured **Digital Signature** timestamp and terms agreement.

---

## 7. Approving a Registration (Step-by-Step)

**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. In the Registration Dossier (`/dashboard/registrations/[id]`), locate the **Status Action Bar**.
2. Click **Confirm & Sign Up** (or select status `signed_up`).
3. If the registration was not pre-assigned to a specific centre, select the target **Centre Assignment** in the modal.
4. Click **Confirm Approval**.

### What Approval Actually Creates or Changes (Under the Hood):
- The `registrations.status` updates to `'signed_up'`.
- The linked `parents` record is confirmed active with verified contact info.
- The linked `children` records are marked active and assigned to the selected centre.
- An automated **Enrolment Welcome Email** (`sendRegistrationStatusUpdate`) is dispatched to the parent's inbox with portal login instructions.
- The child immediately appears in the searchable student directory and is eligible for booking slots and roll-call registers.

---

## 8. Rejecting or Declining a Registration

**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. In the Registration Dossier, click **Mark Not Interested** (or select status `not_interested`).
2. Confirm the action in the popup.
3. The registration status updates to `not_interested`.
4. A notification email is dispatched to the parent informing them of the status change.
5. The applicant is filtered out of active operational queues.

---

## 9. Duplicate Prevention & CRM Matching

To prevent duplicate database records when existing parents register additional children:

1. **Email Matching:** When a registration is submitted, the system checks whether the primary parent's email already exists in your organisation (`parents.email = submitted.email`).
   - If a match is found: The existing parent record is updated with any refreshed phone/address info rather than creating a duplicate parent.
2. **Child Matching:** The system inspects existing children linked to that parent.
   - If child first and last names match: The existing child profile is updated.
   - If child name is new: A new child profile is created and linked to the existing parent.
3. **409 Conflict Guard:** If an identical child name with the same parent email already has a pending registration in the organisation, the public form safely rejects duplicate resubmission and prompts the parent to contact the centre.

---

## 10. Registration Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| **Registration cannot be approved (403 Forbidden)** | Staff member is assigned to Centre A, but registration belongs to Centre B. | Manager/Owner must switch to the appropriate centre, or Owner must approve. |
| **Parent claims they submitted form but it's missing** | Parent did not complete the digital signature or agree to terms. | Contact parent; verify if they received the automated submission confirmation email. |
| **Child was assigned to the wrong centre on approval** | Wrong centre was selected during approval modal. | Open `Sidebar → Students → [Child Name]`, click **Edit Profile**, and update the assigned Centre. |
