# SprintScale CMS — D6 Visual Training Production Manifest
## Master Production Queue for Annotated Screenshots & Click-by-Click Video Screencasts

---

## 1. Production Queue Overview & Strategy

Milestone D6 will produce the complete visual training asset library for SprintScale CMS based on the evidence-backed functional manuals established in Milestones D0 through D5.R.

All visual captures are grounded strictly in the post-D5.R software baseline and must be recorded exclusively against an isolated synthetic training environment (e.g. `Oakridge Learning Club`) to ensure zero exposure of real student, parent, staff, or financial PII.

---

## 2. Visual Asset Production Totals

| Asset Type | Raw Specifications | Deduplicated Unique Assets | Essential (P0/P1) Priority | Occasional / Advanced (P2/P3) Priority |
|---|---|---|---|---|
| **Annotated UI Screenshots** | 90 | **78 Unique Screenshots** | **46 Essential** | 32 Supplementary |
| **Micro-Video Screencasts** | 57 | **52 Unique Videos** | **32 Essential** | 20 Supplementary |
| **Total D6 Visual Assets** | 147 | **130 Unique Assets** | **78 Essential** | 52 Supplementary |

---

## 3. Priority Level Classification

- **P0 — Essential Safety & Core Daily Operations:** Immediate onboarding workflows (Daily Register, Tablet Kiosk, First Aid Logging, Restricted Safeguarding, Staff Roles, Recovery Bin).
- **P1 — Core Commercial & Family Workflows:** Regular intake and finance management (Registrations, Bookings, Agreed-Fee Billing, Invoices, Payment Recording, Broadcasts).
- **P2 — Occasional Administrative Workflows:** Center configuration, session credit adjustments, voucher reconciliation, staff invitations.
- **P3 — Advanced / Edge-Case Maintenance:** GDPR data export, invoice voiding, permanent record purging.

---

## 4. Master Screenshot Production Queue

### Module D2: Parents, Students, Registrations & Bookings
| Asset ID | Title | Priority | Route | Audience | Prerequisite State |
|---|---|---|---|---|---|
| `D2-SS-01` | Parent Directory Overview | P1 | `/dashboard/parents` | Manager / Owner | Multi-parent roster |
| `D2-SS-02` | Parent Profile Card & Emergency Contacts | P1 | `/dashboard/parents/[id]` | All Staff | Selected parent |
| `D2-SS-03` | Authorised Collectors Management | P0 | `/dashboard/parents/[id]` | Front Desk / Tutor | Parent with 2+ collectors |
| `D2-SS-04` | Student Roster & Medical Badges | P0 | `/dashboard/students` | All Staff | Students with allergy flags |
| `D2-SS-05` | Student Profile & Emergency Card | P0 | `/dashboard/students/[id]` | All Staff | Selected student with dietary flags |
| `D2-SS-06` | Public Multi-Child Registration Form | P1 | `/register/[slug]` | Parent (Public) | Clean public portal form |
| `D2-SS-07` | Registration Signature Pad & Consent | P0 | `/register/[slug]` | Parent (Public) | Drawn digital signature |
| `D2-SS-08` | Back-Office Registration Intake Triage | P1 | `/dashboard/registrations` | Manager / Owner | Awaiting confirmation list |
| `D2-SS-09` | Registration Approval & Child Matching | P1 | `/dashboard/registrations/[id]` | Manager / Owner | Unmatched child resolution |
| `D2-SS-10` | Booking Calendar & Capacity Matrix | P1 | `/dashboard/bookings` | Manager / Front Desk | Weekly session view |
| `D2-SS-11` | Ad-Hoc Single Session Booking Modal | P1 | `/dashboard/bookings/new` | Front Desk / Manager | Active club session |
| `D2-SS-12` | Recurring Term Booking Plan Creation | P1 | `/dashboard/bookings/new` | Manager / Owner | Multi-week term plan |
| `D2-SS-13` | Parent Portal Family Dashboard | P1 | `/portal` | Parent | Authenticated parent portal |
| `D2-SS-14` | Parent Portal Booking Flow | P1 | `/portal/book` | Parent | Parent booking interface |

### Module D3: Attendance, Kiosk, Session Ledger & Safeguarding
| Asset ID | Title | Priority | Route | Audience | Prerequisite State |
|---|---|---|---|---|---|
| `D3-SS-01` | Daily Attendance Register (Morning/Afternoon) | P0 | `/dashboard/attendance` | All Staff | Live session with checked-in children |
| `D3-SS-02` | Tablet Kiosk Arrival & Departure Screen | P0 | `/dashboard/kiosk` | Front Desk / Tutor | Live kiosk PIN/sign-in view |
| `D3-SS-03` | Unplanned Walk-In Registration Modal | P0 | `/dashboard/kiosk` | Front Desk | Walk-in quick modal |
| `D3-SS-04` | Attendance Status Override (Late/Absent) | P1 | `/dashboard/attendance` | Front Desk / Manager | Session status dropdown |
| `D3-SS-05` | Historical Roll Call Export & Audit View | P2 | `/dashboard/attendance` | Manager / Owner | Filtered date range register |
| `D3-SS-06` | Session Credit Ledger Dashboard | P1 | `/dashboard/attendance/ledger` | Manager / Owner | Extra sessions & forgiven balance |
| `D3-SS-07` | Admin Session Forgiveness Modal | P1 | `/dashboard/attendance/ledger` | Manager / Owner | Forgiveness note dialog |
| `D3-SS-08` | General Student Note & Behaviour Log | P1 | `/dashboard/students/[id]` | Tutor / Staff | Non-confidential student note |
| `D3-SS-09` | First Aid & Minor Accident Logging Modal | P0 | `/dashboard/incidents` | All Staff | Injury body-map coordinates |
| `D3-SS-10` | Restricted Safeguarding Incident Form | P0 | `/dashboard/incidents` | Owner / Manager (DSL) | Restricted safeguarding entry |
| `D3-SS-11` | Safeguarding Access Denied Gate | P0 | `/dashboard/incidents` | Front Desk / Tutor | 403 Forbidden boundary screen |

### Module D4: Finance, Agreed-Fee Billing & Invoices
| Asset ID | Title | Priority | Route | Audience | Prerequisite State |
|---|---|---|---|---|---|
| `D4-SS-01` | Executive Finance Dashboard | P1 | `/dashboard/finance` | Owner Only | Global revenue & overdue totals |
| `D4-SS-02` | Agreed Monthly Fee Family Billing Config | P1 | `/dashboard/centres/[id]/billing` | Owner / Manager | Family billing anchor & sibling list |
| `D4-SS-03` | Monthly Invoice Generation Run Modal | P1 | `/dashboard/centres/[id]/billing` | Owner / Manager | Preview billing run calculation |
| `D4-SS-04` | Invoice Directory & Status Filters | P1 | `/dashboard/finance/invoices` | Staff | Draft, Sent, Paid, Void invoices |
| `D4-SS-05` | Detailed Invoice View & Verified Payments | P1 | `/dashboard/finance/invoices/[id]` | Staff | Breakdown with offline payments |
| `D4-SS-06` | Offline Cash/Bank Transfer Payment Modal | P1 | `/dashboard/finance/invoices/[id]` | Staff | Record offline payment dialog |
| `D4-SS-07` | Tax-Free Childcare & Voucher Triage | P1 | `/dashboard/finance/reconciliation` | Staff | Pending voucher reconciliation row |
| `D4-SS-08` | Owner Invoice Voiding Confirmation | P2 | `/dashboard/finance/invoices/[id]` | Owner Only | Void reason prompt |
| `D4-SS-09` | Standard Payment PDF Receipt | P1 | `/dashboard/finance/receipt` | Staff / Parent | Rendered clean PDF receipt |
| `D4-SS-10` | Parent Portal Invoices & Payment Portal | P1 | `/portal/billing` | Parent | Parent invoice history list |

### Module D5: Administration, Multi-Centre Settings & Maintenance
| Asset ID | Title | Priority | Route | Audience | Prerequisite State |
|---|---|---|---|---|---|
| `D5-SS-01` | Organisation Profile & Settings | P2 | `/dashboard/settings` | Owner Only | Org contact & slug details |
| `D5-SS-02` | GDPR Subject Access JSON Export | P3 | `/dashboard/settings` | Owner Only | Export button & JSON download |
| `D5-SS-03` | Multi-Centre Venue Directory | P1 | `/dashboard/centres` | Owner / Manager | Multiple centre cards |
| `D5-SS-04` | Centre Venue General Settings | P1 | `/dashboard/centres/[id]/settings` | Owner / Manager | Operating times & capacity |
| `D5-SS-05` | Centre Bank Details (Owner-Only Card) | P0 | `/dashboard/centres/[id]/settings` | Owner Only | Sort code & account number form |
| `D5-SS-06` | Staff Directory & Roles Overview | P0 | `/dashboard/staff` | Owner / Manager | Staff list with role badges |
| `D5-SS-07` | Staff Invitation Modal & Role Selection | P0 | `/dashboard/staff/invite` | Owner Only | 7-day invite email dialog |
| `D5-SS-08` | Staff Centre Assignment Scoping | P0 | `/dashboard/staff/[userId]` | Owner Only | Multi-centre checkbox selection |
| `D5-SS-09` | Staff Deactivation Modal | P0 | `/dashboard/staff/[userId]` | Owner Only | Safe removal warning dialog |
| `D5-SS-10` | Parent Broadcast Composition & Recipient Count | P1 | `/dashboard/communications` | Owner / Manager | Filtered consented audience |
| `D5-SS-11` | Header Notification Bell & Alerts Dropdown | P1 | `/dashboard` | Staff | Active alerts badge |
| `D5-SS-12` | Recovery Bin Directory & 30-Day Expiry | P0 | `/dashboard/parents/bin` | Owner / Manager / FrontDesk | Soft-deleted families table |
| `D5-SS-13` | Family Record Restoration Modal | P0 | `/dashboard/parents/bin` | Staff | Confirm restore dialog |
| `D5-SS-14` | Owner Permanent GDPR Purge Warning Dialog | P0 | `/dashboard/parents/bin` | Owner Only | Irreversible delete confirmation |

---

## 5. Master Micro-Video Screencast Production Queue

| Video ID | Title | Audience | Priority | Target Duration | Workflow Summary |
|---|---|---|---|---|---|
| `D2-V01` | Registering a Multi-Child Family via Public Portal | Parent | P1 | 60s | Complete form submission with signature |
| `D2-V04` | Reviewing and Approving a Public Registration | Manager | P1 | 60s | Intake triage, matching existing parents/children |
| `D2-V05` | Creating an Ad-Hoc Session Booking | Front Desk | P1 | 45s | Calendar slot selection, confirming attendance |
| `D2-V07` | Booking via Parent Portal | Parent | P1 | 45s | Parent portal session selection |
| `D3-V01` | Marking Morning and Afternoon Register | Tutor | P0 | 45s | Present, absent, late status marking |
| `D3-V03` | Operating the Tablet Kiosk Sign-In | Front Desk | P0 | 45s | Kiosk arrival/departure & collector pickup |
| `D3-V04` | Fast Walk-In Registration on Kiosk | Front Desk | P0 | 45s | Instant walk-in registration on tablet |
| `D3-V08` | Forgiving an Absence on Session Ledger | Manager | P1 | 45s | Admin forgiveness and session credit update |
| `D3-V10` | Logging a First Aid Accident on Body Map | Tutor | P0 | 60s | Selecting body coordinates & injury description |
| `D3-V12` | Creating a Confidential Safeguarding Record | Owner / DSL | P0 | 60s | Restricted incident logging with restricted view |
| `D4-V01` | Setting up Agreed Monthly Family Fee | Owner / Manager | P1 | 60s | Billing anchor date & sibling coverage |
| `D4-V02` | Executing Monthly Invoicing Batch Run | Owner / Manager | P1 | 60s | Batch invoice generation & automated numbering |
| `D4-V04` | Recording Offline Cash or Bank Payment | Front Desk | P1 | 45s | Logging offline payment & status update to Paid |
| `D4-V05` | Reconciling Childcare Vouchers & TFC | Manager | P1 | 60s | Matching voucher reference & verified status |
| `D4-V07` | Voiding and Reissuing an Invoice | Owner | P2 | 60s | Owner-only voiding and creating corrected bill |
| `D4-V08` | Parent Portal Billing & Receipt Download | Parent | P1 | 45s | Viewing invoice breakdown & downloading PDF |
| `D5-V01` | Creating and Setting Up a New Centre Venue | Owner / Manager | P1 | 60s | Venue slug, operating times, session slots |
| `D5-V04` | Inviting a New Staff Member via Email | Owner | P0 | 45s | Role assignment & cryptographic invite dispatch |
| `D5-V06` | Scoping Staff Access Across Specific Centres | Owner | P0 | 45s | Multi-site checkbox assignment |
| `D5-V07` | Safely Deactivating a Staff Member | Owner | P0 | 45s | Access revocation with audit preservation |
| `D5-V09` | Broadcasting an Email to Consented Parents | Manager | P1 | 60s | Server consent filtering & Resend dispatch |
| `D5-V12` | Moving a Family to the Recovery Bin | Front Desk | P0 | 45s | Soft-deletion and student list removal |
| `D5-V13` | Restoring an Archived Family Record | Front Desk | P0 | 45s | One-click restore back to active registers |
| `D5-V14` | Irreversible Permanent GDPR Purge | Owner | P0 | 45s | Owner-only permanent deletion execution |

---

## 6. Synthetic Training Data Specification

All visual recordings must use the standardized synthetic data profile:

- **Organisation:** `Oakridge Learning Club Ltd` (`slug: oakridge-learning`)
- **Centres:**
  - `Oakridge Central` (Primary multi-session venue)
  - `Oakridge West` (Secondary after-school venue)
- **Staff Personas:**
  - `Eleanor Vance` (`ORG_OWNER` — Club Principal)
  - `Marcus Sterling` (`MANAGER` — Centre Lead & Designated Safeguarding Lead)
  - `Chloe Bennett` (`FRONT_DESK` — Club Administrator)
  - `Liam Harper` (`TUTOR` — Activity Specialist)
- **Family Persona 1 (Standard Consented):**
  - Parent: `Sarah Jenkins` (`sarah.jenkins@example.test`)
  - Children: `Oliver Jenkins` (Year 3), `Emma Jenkins` (Reception)
  - Agreed Monthly Fee: £280.00
- **Family Persona 2 (Withdrawn Consent):**
  - Parent: `David Patel` (`david.patel@example.test`)
  - Child: `Aria Patel` (Year 5)
  - Communications Consent: `false` (Withdrawn on latest booking)
- **Family Persona 3 (Recovery Bin Staging):**
  - Parent: `Rachel Taylor` (Soft-deleted 5 days ago)
  - Child: `Noah Taylor` (Year 2)

---

## 7. Visual Privacy & Capture Standards

1. **Zero Real PII:** No actual customer names, live email addresses, real phone numbers, real bank accounts, or real incident narratives may appear.
2. **Standard Viewports:**
   - Desktop Manuals: 1440 × 900 px (Browser zoom 100%)
   - Tablet Kiosk: 1024 × 768 px (iPad landscape)
   - Mobile Parent Portal: 390 × 844 px (iPhone viewport)
3. **Clean Browser Chrome:** Browser bookmarks, extension badges, developer consoles, and personal tabs must be hidden.
4. **Callout Annotations:** Use 2px solid cyan/accent bounding boxes (`#0284c7`) with rounded pill-badge numbers for click sequence callouts.
