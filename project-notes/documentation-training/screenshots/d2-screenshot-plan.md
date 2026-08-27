# SprintScale CMS — Annotated Screenshot Plan
## Milestone D2: Parents, Children/Students, Registrations & Bookings

**Scope:** Authoritative visual asset specifications for Milestone D6 screenshot production.  
**Production Rules:** Clean 1440×900 desktop viewport (or standard tablet for Kiosk), synthetic demo accounts only, zero real PII, high-contrast rounded rectangular highlight boxes, numbered circular badges (`①`, `②`, `③`).

---

## Master Screenshot Specifications Index

| Screenshot ID | Manual & Section | Target Route / Page | Target Role | Key Visible UI Elements & Highlights |
|---|---|---|---|---|
| **D2-S01** | `parents.md` §4 | `/dashboard/parents` | Front Desk / Manager | Parent search bar, table rows, linked children badges, action buttons. |
| **D2-S02** | `parents.md` §3 | `/dashboard/parents/[id]` | Front Desk / Manager | Full profile, contact cards, linked sibling cards, billing summary. |
| **D2-S03** | `parents.md` §5 | Add Parent Modal | Front Desk / Manager | Form fields: Name, email, phone, relationship, preferred contact. |
| **D2-S04** | `parents.md` §9 | `/dashboard/parents/bin` | Manager / Owner | Soft-deleted parents table, days remaining, Restore button, Purge button. |
| **D2-S05** | `children-students.md` §3 | `/dashboard/students` | Front Desk / Manager | Student cards/table, year groups, centre filters, medical alert flags. |
| **D2-S06** | `children-students.md` §4 | `/dashboard/students/[id]` | Front Desk / Manager | Pupil 360° overview, family link, emergency numbers, attendance stats. |
| **D2-S07** | `children-students.md` §7 | Student Medical Modal | Front Desk / Manager | Red alert allergy fields, medical conditions, GP phone, inhaler notes. |
| **D2-S08** | `children-students.md` §8 | Authorised Collectors Card | Front Desk / Manager | Named collectors, relationship, emergency phone, collection password. |
| **D2-S09** | `children-students.md` §6 | `/dashboard/students/import`| Manager / Owner | CSV dropzone, mapping preview table, validation checkmark badges. |
| **D2-S10** | `registrations.md` §6 | `/dashboard/registrations` | Front Desk / Manager | Queue table filtered by "Awaiting Confirmation", child names, date. |
| **D2-S11** | `registrations.md` §6 | `/dashboard/registrations/[id]`| Front Desk / Manager | Application dossier, medical disclosures, digital signature canvas. |
| **D2-S12** | `registrations.md` §7 | Approval Action Modal | Front Desk / Manager | Centre assignment dropdown, "Confirm & Sign Up" action button. |
| **D2-S13** | `bookings.md` §4 | `/dashboard/bookings` | Front Desk / Manager | Bookings list/calendar, session time slots, status badges, filters. |
| **D2-S14** | `bookings.md` §4 | `/dashboard/bookings/new` | Front Desk / Manager | Parent selector, child checkboxes, date picker, slot selector. |
| **D2-S15** | `bookings.md` §1 | `/book/[orgSlug]` | Public Parent | Public booking wizard, club logo, appointment types, date picker. |
| **D2-S16** | `bookings.md` §1 | `/portal/book` | Authenticated Parent| Parent portal booking screen, pre-populated child cards, session slots. |

---

## Detailed Visual Specifications

### D2-S01: Parent Directory List
- **Filename:** `frontdesk-parents-01-directory-list.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/parents`
- **Role:** Front Desk / Manager
- **Required Synthetic Data:** Parents "Alex Example", "Morgan Example", "Jordan Example" with 1–2 linked children each.
- **Crop Guidance:** Full dashboard container below the top navigation bar.
- **Annotations:**
  - Box ① around the **Search Parents** input field.
  - Box ② around the **Linked Children** column badges.
  - Box ③ around the **View Profile** button on the first row.

---

### D2-S02: Parent Profile 360° Detail
- **Filename:** `manager-parents-02-profile-360.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/parents/11111111-1111-1111-1111-111111111111`
- **Role:** Manager / Owner
- **Required Synthetic Data:** Alex Example, `alex@example.test`, `+44 7700 900123`, Address: 12 High Street, London. Children: "Jamie Example" (Year 2), "Taylor Example" (Reception).
- **Annotations:**
  - Box ① around the **Contact & Address** card.
  - Box ② around the **Linked Children** sibling cards.
  - Box ③ around the **Communications Consent** active badge.

---

### D2-S04: Parent Recovery Bin
- **Filename:** `owner-parents-04-recovery-bin.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/parents/bin`
- **Role:** Owner
- **Required Synthetic Data:** Archived parent "Casey Example", deleted 4 days ago (26 days remaining).
- **Annotations:**
  - Box ① around the **Days Remaining** countdown pill.
  - Box ② around the **Restore** button.
  - Box ③ around the red **Permanent Purge** button (highlighting the GDPR warning label).

---

### D2-S06: Student Profile 360° Detail
- **Filename:** `manager-students-06-profile-overview.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/students/22222222-2222-2222-2222-222222222222`
- **Role:** Manager / Front Desk
- **Required Synthetic Data:** Jamie Example, Year 2, Oakridge Primary Club, Red Allergy Badge (Peanut Allergy), Primary Parent Alex Example.
- **Annotations:**
  - Box ① around the **Red Medical Alert Banner**.
  - Box ② around the **Parent Contact** link.
  - Box ③ around the **Authorised Collectors** section.

---

### D2-S11: Registration Dossier with Digital Signature
- **Filename:** `frontdesk-registrations-11-dossier-signature.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/registrations/33333333-3333-3333-3333-333333333333`
- **Role:** Front Desk / Manager
- **Required Synthetic Data:** Application `REG-8821`, Child "Riley Example", Digital signature image displayed on canvas with timestamp.
- **Annotations:**
  - Box ① around the **Submitted Medical Disclosures** section.
  - Box ② around the **Digital Signature** canvas.
  - Box ③ around the **Confirm & Sign Up** action button.

---

### D2-S14: Create Staff Booking Form
- **Filename:** `frontdesk-bookings-14-staff-booking-form.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/bookings/new`
- **Role:** Front Desk / Manager
- **Required Synthetic Data:** Selected Parent Alex Example, checked child Jamie Example, Centre: Oakridge Primary Club, Time: `15:30 - 18:00`.
- **Annotations:**
  - Box ① around the **Parent Search & Child Checkboxes**.
  - Box ② around the **Session Date & Time Slot Picker**.
  - Box ③ around the **Create Booking** confirmation button.
