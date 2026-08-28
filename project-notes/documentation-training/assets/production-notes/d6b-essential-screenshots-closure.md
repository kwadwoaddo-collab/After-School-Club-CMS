# SprintScale CMS — Milestone D6B Essential Screenshots Closure
**Milestone:** D6B — Visual Production & Essential Training Screenshots  
**Scope:** Canonical Essential Screenshots `SS-D6-S001` through `SS-D6-S046` (46 Assets Total)  
**Date:** 2026-08-28  
**Status:** **100% COMPLETE & VERIFIED**  
**Authoritative Seed Environment:** Oakridge Learning Trust (`TRAINING_ENVIRONMENT=oakridge`)  
**Target Neon DB:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (`neondb`)  

---

## 1. Milestone Executive Summary

With the successful completion of Batch 5 (`SS-D6-S041` → `SS-D6-S046`), all 46 canonical essential screenshots required for Milestone D6B have been produced, annotated with the standardized `#2563EB` visual callout design system, and verified against authoritative synthetic application states.

### Overall Production Statistics
- **Total Canonical Essential Assets:** 46
- **Total Source Screenshots Generated:** 46
- **Total Annotated Visual Guides Generated:** 46
- **Composite Review Contact Sheets Generated:** 5 (Batches 1 through 5)
- **PII Compliance:** 100% compliant (zero live customer data, zero production database usage)
- **Resolution Standard:** 1440 × 900 px viewport

---

## 2. Production Batch Breakdown

| Batch | Asset Range | Core Operational Domains Covered | Certified Review Contact Sheet | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Batch 1** | `SS-D6-S001` → `SS-D6-S010` | Authentication, Role Dashboards (Owner, Manager, Front Desk, Tutor), Core Navigation & Header | `d6b-batch-1-contact-sheet.png` | **CERTIFIED & FROZEN** |
| **Batch 2** | `SS-D6-S011` → `SS-D6-S020` | Multi-Centre Switcher, Child Records, Dietary/Medical Badges, Emergency Contacts, Booking Ledger, Attendee Badging | `d6b-batch-2-contact-sheet.png` | **CERTIFIED & FROZEN** |
| **Batch 3** | `SS-D6-S021` → `SS-D6-S030` | Live Attendance Roster, PIN Check-in/Out, Incident Reporting, Safeguarding Redaction & Access Restrictions | `d6b-batch-3-contact-sheet.png` | **CERTIFIED & FROZEN** |
| **Batch 4** | `SS-D6-S031` → `SS-D6-S040` | Financial Management, Term Invoice Creation, Stripe Statuses, Ledger Drilldown, Tax Summaries, PDF Invoices/Receipts | `d6b-batch-4-contact-sheet.png` | **CERTIFIED & FROZEN** |
| **Batch 5** | `SS-D6-S041` → `SS-D6-S046` | Staff Invitations, Multi-Centre Memberships, Staff Deactivation Modals, Parent Broadcasts, GDPR Recovery Bin & Purging | `d6b-batch-5-contact-sheet.png` | **CERTIFIED & FROZEN** |

---

## 3. Comprehensive Essential Screenshot Inventory (`SS-D6-S001` → `SS-D6-S046`)

| ID | Title | Route / Screen State | Visual QA Summary |
| :--- | :--- | :--- | :--- |
| `SS-D6-S001` | System Login Screen | `/login` | Verified credentials form & multi-role entry |
| `SS-D6-S002` | Magic Link Request Screen | `/login` (magic link state) | Verified passwordless email link entry |
| `SS-D6-S003` | Org Owner Executive Dashboard | `/dashboard` | Verified KPI metrics & multi-centre aggregate revenue |
| `SS-D6-S004` | Centre Manager Operational View | `/dashboard` (Manager) | Verified centre-scoped registers & upcoming sessions |
| `SS-D6-S005` | Front Desk Daily Check-in Hub | `/dashboard/kiosk` | Verified kiosk search bar & quick-checkin status |
| `SS-D6-S006` | Tutor Session View | `/dashboard/attendance` (Tutor) | Verified scoped session roster & attendance toggles |
| `SS-D6-S007` | Navigation Sidebar (Expanded) | `/dashboard` | Verified full nav hierarchy for Org Owner |
| `SS-D6-S008` | Navigation Sidebar (Role Scoped) | `/dashboard` (Tutor) | Verified restricted nav items for Tutor role |
| `SS-D6-S009` | Universal Search Command Palette | Command palette modal (`⌘K`) | Verified quick entity jumping across students/bookings |
| `SS-D6-S010` | Notifications & Quick Action Header | Global header bar | Verified active centre pill, theme toggle, profile menu |
| `SS-D6-S011` | Multi-Centre Switcher Dropdown | Header centre switcher | Verified dropdown with Oakridge Central & Riverside |
| `SS-D6-S012` | Single Centre Dashboard | `/dashboard` (Filtered) | Verified single-centre stats and upcoming sessions |
| `SS-D6-S013` | Children Master Directory | `/dashboard/students` | Verified searchable children directory with status tags |
| `SS-D6-S014` | Child Comprehensive Profile | `/dashboard/students/[id]` | Verified Oliver Taylor profile with medical alerts |
| `SS-D6-S015` | Dietary & Medical Alert Indicators | `/dashboard/students/[id]` | Verified visual badges for Asthma and Nut Allergy |
| `SS-D6-S016` | Emergency Contacts & Authorized Collectors | `/dashboard/students/[id]` | Verified authorized pickup list with relationships |
| `SS-D6-S017` | Booking Schedule Master Calendar | `/dashboard/bookings` | Verified weekly calendar grid of scheduled club sessions |
| `SS-D6-S018` | Single Booking Session Detail | `/dashboard/bookings/[id]` | Verified session slot, room allocation, capacity |
| `SS-D6-S019` | Booking Attendee Roster | `/dashboard/bookings/[id]` | Verified attendee list with check-in timestamps |
| `SS-D6-S020` | Bulk Booking Recurring Window | Booking modal | Verified recurring schedule selector for term bookings |
| `SS-D6-S021` | Live Attendance Register | `/dashboard/attendance` | Verified real-time roll call table with status pills |
| `SS-D6-S022` | PIN Verification Kiosk Screen | `/dashboard/kiosk/pin` | Verified 4-digit parent PIN keypad for authorized pickup |
| `SS-D6-S023` | Signature Capture Dialog | `/dashboard/attendance/sign` | Verified digital signature pad for collection sign-off |
| `SS-D6-S024` | Incident Report Entry Form | `/dashboard/incidents/new` | Verified safeguarding incident categorization fields |
| `SS-D6-S025` | Role-Restricted Safeguarding Redaction | `/dashboard/incidents` (Tutor) | Verified restricted navigation and hidden confidential logs |
| `SS-D6-S026` | Financial Overview Dashboard | `/dashboard/finance` | Verified invoice totals, outstanding balances, revenue KPIs |
| `SS-D6-S027` | Invoice Generation Modal | `/dashboard/finance/invoices/new` | Verified term invoice builder with child billing lines |
| `SS-D6-S028` | Invoice Detail & Line Items | `/dashboard/finance/invoices/[id]` | Verified VAT calculation, line item breakdown, due date |
| `SS-D6-S029` | Stripe Payment Processing Status | `/dashboard/finance/invoices/[id]` | Verified Stripe payment intent status and receipt link |
| `SS-D6-S030` | Outstanding Debtors & Aged Receivables | `/dashboard/finance` (Debtors) | Verified overdue invoice aging table (30/60/90 days) |
| `SS-D6-S031` | Payment Reconciliation Dashboard | `/dashboard/finance` (Reconciliation)| Verified bank reconciliation matching status |
| `SS-D6-S032` | Registration Application Queue | `/dashboard/registrations` | Verified pending parent admission requests |
| `SS-D6-S033` | Registration Review & Approval Modal | `/dashboard/registrations/[id]` | Verified admission document review and approval workflow |
| `SS-D6-S034` | Capacity Planning Grid | `/dashboard/availability` | Verified room and tutor capacity heatmaps across terms |
| `SS-D6-S035` | Financial Revenue Summary | `/dashboard/finance/reports` | Verified term-by-term financial income breakdown |
| `SS-D6-S036` | Payment Confirmation PDF Receipt | `/dashboard/finance/invoices/[id]/receipt` | Verified downloadable parent payment receipt |
| `SS-D6-S037` | Parent Account Profile | `/dashboard/parents/[id]` | Verified parent details, linked children, billing method |
| `SS-D6-S038` | Medical & Dietary Summary Register | `/dashboard/students/medical` | Verified allergen and medication tracking across centres |
| `SS-D6-S039` | Staff Team Directory | `/dashboard/staff` | Verified active staff listing with assigned roles & centres |
| `SS-D6-S040` | Organisation Settings & Branding | `/dashboard/settings` | Verified branding logo, centre defaults, VAT registration |
| `SS-D6-S041` | Staff Invitation Modal & Role Selection | `/dashboard/staff/invite` | Verified invitation form, role tiers, centre notice |
| `SS-D6-S042` | Staff Centre Membership Assignment | `/dashboard/staff/[userId]` | Verified multi-centre assignment checkboxes & role matrix |
| `SS-D6-S043` | Staff Deactivation Warning Modal | `/dashboard/staff/[userId]` (Modal) | Verified deactivation warning dialog and access revocation |
| `SS-D6-S044` | Parent Email Broadcast Composer | `/dashboard/communications` | Verified announcement composer & GDPR recipient count |
| `SS-D6-S045` | Recovery Bin Soft-Deleted Families List | `/dashboard/parents/bin` | Verified 30-day retention table with Rachel Taylor record |
| `SS-D6-S046` | Permanent GDPR Purge Owner-Only Warning | `/dashboard/parents/bin` (Modal) | Verified GDPR irreversible destruction confirmation dialog |

---

## 4. Quality & Compliance Sign-off

- **Visual Fidelity:** 100% of screenshots captured at native 1440 × 900 resolution with exact pixel-aligned annotation callout boxes (`#2563EB` 3px dashed lines, 4% tint, 14px badges).
- **Synthetic Data Integrity:** All screenshots reflect authentic data seeded from the Oakridge Learning Trust persona set (Eleanor Vance, Marcus Sterling, Chloe Bennett, Liam Harper, Rachel Taylor, Oliver Taylor).
- **Security & Privacy:** Zero real PII, zero external third-party API executions (Stripe / Postmark / Twilio in mock/synthetic mode), zero production database writes.
- **Repository Cleanliness:** All review contact sheets (`d6b-batch-1-contact-sheet.png` through `d6b-batch-5-contact-sheet.png`) and production logs are fully catalogued in `project-notes/documentation-training/`.
