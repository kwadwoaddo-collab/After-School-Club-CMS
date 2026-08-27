# SprintScale CMS — Annotated Screenshot Plan
## Milestone D5: Administration, Multi-Centre Settings, Staff Access & Data Maintenance

**Scope:** Authoritative visual asset specifications for Milestone D6 screenshot production.  
**Production Rules:** Clean 1440×900 desktop viewport, synthetic demo accounts only, zero real staff/parent/child PII, high-contrast rounded rectangular highlight boxes, numbered circular badges (`①`, `②`, `③`).

---

## Master Screenshot Specifications Index

| Screenshot ID | Manual & Section | Target Route / Page | Target Role | Key Visible UI Elements & Highlights |
|---|---|---|---|---|
| **D5-S01** | `administration-settings.md` §1 | `/dashboard/settings` | Owner (`ORG_OWNER`) | Organisation profile card: Name, slug, address, support contact email. |
| **D5-S02** | `administration-settings.md` §3 | `/dashboard/settings` | Owner (`ORG_OWNER`) | GDPR Export card: Export JSON button and data privacy summary. |
| **D5-S03** | `centres-multi-centre.md` §1 | `/dashboard/centres` | Owner / Manager | Centres directory grid showing venue names, pupil counts, staff counts. |
| **D5-S04** | `centres-multi-centre.md` §3 | `/dashboard/centres/add` | Owner / Manager | Add Centre form: Name input, address text box, Create Centre button. |
| **D5-S05** | `centres-multi-centre.md` §3 | `/dashboard/centres/[id]/settings`| Owner / Manager | General settings: Ofsted ID, session slot times and capacities. |
| **D5-S06** | `centres-multi-centre.md` §3 | Centre Billing Settings | Owner (`ORG_OWNER`) | Bank details form: Bank name, sort code, account number, hourly fees. |
| **D5-S07** | `staff-access-permissions.md` §1| `/dashboard/staff` | Owner (`ORG_OWNER`) | Staff directory table: Names, email addresses, role badges, assigned centres. |
| **D5-S08** | `staff-access-permissions.md` §3| `/dashboard/staff/invite` | Owner (`ORG_OWNER`) | Invite Staff form: Email, name, role selector, initial centre dropdown. |
| **D5-S09** | `staff-access-permissions.md` §3| `/dashboard/staff/[userId]` | Owner (`ORG_OWNER`) | Staff profile card: Role selector dropdown and Update Role button. |
| **D5-S10** | `staff-access-permissions.md` §3| Staff Centre Memberships | Owner (`ORG_OWNER`) | Centre assignments checklist and Save Centre Assignments button. |
| **D5-S11** | `staff-access-permissions.md` §3| Remove Staff Modal | Owner (`ORG_OWNER`) | Deactivation confirmation dialog with access revocation warning. |
| **D5-S12** | `communications-notifications.md` §1| `/dashboard/communications` | Owner / Manager | Communications overview: Compose message card and Broadcast History. |
| **D5-S13** | `communications-notifications.md` §4| Compose Broadcast Form | Owner / Manager | Centre selector, subject input, message box, consented recipient counter. |
| **D5-S14** | `communications-notifications.md` §4| Broadcast History Table | Owner / Manager | Sent broadcasts list: Date, subject, recipient count, sent/failed badges. |
| **D5-S15** | `communications-notifications.md` §4| Header Notification Bell | Owner / Manager | Active notification dropdown showing recent alerts and Mark as Read. |
| **D5-S16** | `academic-year-data-maintenance.md` §5| Delete Family Dialog | Front Desk / Manager | 30-day Recovery Bin warning dialog on parent profile. |
| **D5-S17** | `academic-year-data-maintenance.md` §5| `/dashboard/parents/bin` | Front Desk / Manager | Recovery Bin table: Family name, deleted date, expires in days, Restore button. |
| **D5-S18** | `academic-year-data-maintenance.md` §5| Permanent Purge Dialog | Front Desk / Manager | Irreversible deletion modal with red Confirm Permanent Purge button. |

---

## Detailed Visual Specifications

### D5-S01: Organisation Settings Overview
- **Filename:** `owner-admin-01-organisation-settings.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/settings`
- **Role:** Owner (`ORG_OWNER`)
- **Required Synthetic Data:** Org Name "SprintScale Demo Academy", Email `admin@example.com`.
- **Annotations:**
  - Box ① around the **Organisation Details Card**.
  - Box ② around the **Support Contact Fields**.
  - Box ③ around the **Save Changes** action button.

---

### D5-S08: Invite Staff Member Form
- **Filename:** `owner-admin-08-invite-staff-form.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/staff/invite`
- **Role:** Owner (`ORG_OWNER`)
- **Required Synthetic Data:** Email `jordan.demo@example.com`, Role `Front Desk`.
- **Annotations:**
  - Box ① around the **Email Address & Name** inputs.
  - Box ② around the **Role Selection Options** (`MANAGER`, `FRONT_DESK`, `TUTOR`).
  - Box ③ around the **Assigned Centre Dropdown**.

---

### D5-S13: Compose Broadcast Form
- **Filename:** `manager-comms-13-compose-broadcast.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/communications`
- **Role:** Manager / Owner
- **Required Synthetic Data:** Centre "St. Jude's Primary", Consented Recipients "42 parents".
- **Annotations:**
  - Box ① around the **Centre Selector Dropdown**.
  - Box ② around the **Subject & Message Body** inputs.
  - Box ③ around the **Consented Recipient Summary Badge**.

---

### D5-S17: Recovery Bin Table
- **Filename:** `manager-admin-17-recovery-bin.png`
- **Route:** `https://app.sprintscaleit.co.uk/dashboard/parents/bin`
- **Role:** Manager / Front Desk
- **Required Synthetic Data:** 1 soft-deleted family "Alex Example", Deleted on "2026-08-20", Expires in "23 days".
- **Annotations:**
  - Box ① around the **Deleted Family Row**.
  - Box ② around the **Expires in 23 days** badge.
  - Box ③ around the **Restore Family** and **Permanently Delete** action buttons.
