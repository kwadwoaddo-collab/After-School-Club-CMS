# SprintScale CMS — Documentation Style Guide & Authoring Standards

**Document Version:** 1.0.0  
**Effective Date:** 2026-08-27  
**Scope:** Authoritative writing and presentation standards for SprintScale CMS documentation (Milestones D1–D8).

---

## 1. Audience & Tone

SprintScale CMS documentation is written for **operational childcare professionals, club administrators, tutors, and parents**.

### Writing Guidelines
1. **Assume Operational Childcare Knowledge, Not Technical Knowledge:** Users understand after-school club operations, Ofsted ratios, safeguarding procedures, and parent billing. They do not know Next.js, PostgreSQL, UUIDs, REST APIs, HTTP codes, or database schema internals.
2. **Translate Code Mechanisms into Practical Operations:** 
   - *Avoid:* "The database executes an atomic transaction updating `children.school_year` with a where clause."
   - *Use:* "The system advances all enrolled students to their next school year in a single step (for example, Year 1 becomes Year 2)."
3. **Clarity and Precision:** Write in direct, active voice ("Click **Save Student**" rather than "The Save Student button should be clicked").
4. **Zero Assumed Technical Literacy:** Explain why specific steps are required without relying on developer shorthand.

---

## 2. Canonical Product Terminology

To maintain consistency across all guides, the following terms are canonical. Alternate synonyms must not be used casually.

| Canonical Term | Deprecated / Disallowed Synonyms | Definition & Usage |
|---|---|---|
| **Organisation** | Business, Company, Tenant, Org Account | The top-level legal and commercial entity that operates one or more club centres. |
| **Centre** | Branch, Location, Site, Venue, School Site | A physical club location operated by an Organisation where sessions take place. |
| **Owner** | Org Owner, Super Admin, Master Admin | The primary account holder with full operational, staff, and financial authority. |
| **Manager** | Centre Manager, Site Supervisor, Branch Admin | Staff responsible for supervising daily operations at assigned centre(s). |
| **Front Desk** | Receptionist, Gatekeeper, Clerk | Front-of-house staff managing arrivals, departures, student lookup, and registration review. |
| **Tutor** | Club Leader, Class Teacher, Instructor | Classroom staff responsible for session delivery, student roll call, and kiosk check-ins. |
| **Parent** | Guardian, Customer, Client, Carer | The parent, legal guardian, or billing contact responsible for an enrolled child. |
| **Child / Student** | Pupil, Kid, Minor, Enrollee | A registered child attending club sessions. Use "Child" in family/medical contexts and "Student" in classroom/academic contexts. |
| **Registration** | Application, Enrolment Form, Intake Form | A submitted public registration form containing child and family details awaiting approval. |
| **Booking** | Appointment, Reservation, Slot | A scheduled session booking for a specific child at a specific centre and time. |
| **Attendance / Roll Call** | Register, Headcount, Check-in Log | The live record of student arrival, departure, absence, or tardiness during a session. |
| **Kiosk** | Tablet Mode, Fast Check-in, Touch Screen | The streamlined, full-screen touchscreen interface for rapid student check-in/out. |
| **Invoice** | Bill, Statement, Charge | An official financial invoice issued to a parent for club sessions or monthly billing. |
| **Payment** | Remittance, Fee, Receipt | A recorded financial transaction (Stripe card payment, bank transfer, or childcare voucher). |
| **Session Ledger** | Credit Ledger, Attendance Ledger | The session balance tracking tool used to reconcile absences, extra sessions, and forgiveness credits. |
| **Forgiveness Credit** | Absence Credit, Fee Waiver | An authorized administrative credit granted in the Session Ledger for an excused missed session. |
| **Agreed-Fee Family Billing** | Flat Billing, Subscription | The monthly recurring fee agreed with a family covering all siblings enrolled at a centre. |
| **Parent Portal** | Customer Portal, Parent Area, Web App | The dedicated, passwordless web interface accessed by parents via secure email magic links. |
| **Recovery Bin** | Trash, Archive, Deleted Items | The 30-day staging area where soft-deleted parent and student records can be safely restored. |
| **Permanent GDPR Purge** | Hard Delete, Destroy, Erase | The irreversible owner-only action that permanently deletes a parent's personal record. |

---

## 3. Role Naming & User-Facing Identity

When documenting system roles, use the plain English title. Do not expose internal code enums (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`) in user-facing manuals.

| Internal Code Role | Canonical Documentation Title | Typical Operational Responsibility |
|---|---|---|
| `ORG_OWNER` | **Owner** | Full authority over all centres, staff roles, billing configs, and org settings. |
| `MANAGER` | **Manager** | Operational management of assigned centre(s), safeguarding logs, and broadcasts. |
| `FRONT_DESK` | **Front Desk** | Daily reception, arrivals, walk-ins, registrations review, and standard injury logs. |
| `TUTOR` | **Tutor** | Classroom roll call, student notes, activity delivery, and kiosk check-in. |
| Consumer Auth | **Parent** | Passwordless portal access to view children, book sessions, and pay invoices. |

---

## 4. Click-Path & Navigation Notation

Document navigation paths consistently using bolded breadcrumb arrows. Exact UI labels must match the application interface.

### Standard Notation Format
```markdown
Sidebar → Navigation Item → Sub-Item → [Action Button]
```

### Examples
- `Sidebar → Attendance → Session Ledger → [+ Forgive Sessions]`
- `Sidebar → Finance → Billing Cycles → [Generate Invoices]`
- `Sidebar → Students → Select Student → Family Billing Tab → [Save Billing Config]`
- `Parent Portal → Billing → [Pay with Card]`

---

## 5. Procedural Instruction Structure

Every procedural guide or task breakdown must follow this consistent 8-part structure:

1. **Purpose:** A 1–2 sentence summary of what this workflow achieves.
2. **Who Can Do This:** The exact roles authorized to perform the action.
3. **Before You Begin (Prerequisites):** What information, records, or context must exist first.
4. **Step-by-Step Instructions:** Sequenced, numbered steps with bold UI elements.
5. **Expected Outcome:** Exactly what the user will see on screen upon successful completion.
6. **Why This Matters (Operational Rationale):** The operational, legal, safeguarding, or accounting reason behind this workflow.
7. **Common Mistakes & Troubleshooting:** 1–2 frequent user errors and how to avoid them.
8. **Related Tasks:** Clickable links to preceding or follow-up procedures.

---

## 6. Standard Callouts & Alerts

Use standard callout alerts to highlight essential context without inducing warning fatigue.

```markdown
> [!NOTE]
> Helpful background context, default settings, or non-critical details.

> [!TIP]
> Best practices, operational shortcuts, and efficiency recommendations.

> [!IMPORTANT]
> Essential prerequisites, mandatory fields, and required compliance steps.

> [!WARNING]
> Potential operational pitfalls, deadline requirements, or data validation constraints.

> [!SAFEGUARDING]
> Legal child protection requirements, Ofsted statutory guidelines, and DSL confidentiality rules.

> [!FINANCIAL CONTROL]
> Accounting integrity requirements, tax-free childcare reconciliation rules, and invoice auditing principles.

> [!CAUTION]
> Irreversible or destructive actions (such as permanent GDPR purges or bulk cancellations).
```

---

## 7. Screenshot Standards (For D6 Production)

All visual documentation must adhere to strict data-protection and clarity standards:

1. **Zero Real Personal Identifiable Information (PII):** Real parent names, children names, email addresses, phone numbers, addresses, and payment references must never appear in any screenshot.
2. **Synthetic Data Fixtures:** All screenshots must use standard demo accounts (for example, "Alex Example", "Oakridge Primary Club", "£250.00").
3. **Standard File Naming:** Format: `[role]-[module]-[number]-[descriptor].png`
   - Example: `owner-finance-02-billing-config.png`
   - Example: `tutor-attendance-01-roll-call.png`
4. **Cropping & Focus:**
   - Crop tightly to the relevant modal, table, or card section unless full layout context is essential.
   - Clean browser viewport (1440×900 for desktop, standard tablet viewport for kiosk).
   - Clean, neutral browser frame without personal bookmarks or browser extensions.
5. **Visual Annotations:**
   - Use high-contrast rounded rectangular highlight boxes around target buttons.
   - Numbered circular badges (`①`, `②`, `③`) matching procedural steps in the text.
   - Avoid messy freehand arrows.

---

## 8. Micro-Video Standards (For D6 Production)

Micro-video training modules must be focused, professional, and accessible:

1. **Target Duration:** 30 seconds to 2 minutes maximum per video. One discrete task per video.
2. **Standard Timeline Structure:**
   - **0–5s:** Title card and task objective.
   - **5–15s:** Starting location and prerequisites.
   - **15–90s:** Step-by-step click execution.
   - **Final 10–20s:** Result confirmation and key compliance/safeguarding takeaway.
3. **Audio & Narration:**
   - Calm, articulate, professional British English narration.
   - High-quality audio with zero background noise.
4. **Accessibility:**
   - Synchronised closed captions (SRT/VTT) required on 100% of videos.
   - Clear visual mouse-click highlight circles.
5. **Strict Data Safety:** No live production mutations, no live email dispatches, zero real parent/child data.

---

## 9. Rationale Model: "Why SprintScale Works This Way"

Merely explaining *how to click* leads to procedural mistakes. Every major operational module must include an operational rationale explaining:

1. **The Safeguarding or Legal Imperative:** (e.g. Ofsted statutory framework requiring exact check-in/out timestamps for custodial proof).
2. **The Data Integrity Principle:** (e.g. why session credits are issued in the Session Ledger rather than modifying issued invoices).
3. **The Multi-Tenant Security Boundary:** (e.g. why staff only see children registered at their assigned centre).

---

## 10. Documentation Quality Checklist

Before publishing any documentation file in Milestones D1–D8, verify:
- [ ] No technical jargon or internal database enum references in user sections.
- [ ] All navigation breadcrumbs match actual application menus exactly.
- [ ] Step-by-step instructions are numbered and clearly state the expected result.
- [ ] Appropriate callout boxes are used without consecutive nesting.
- [ ] Zero real personal data or live API tokens are present.
- [ ] All internal markdown file links are valid and relative.
