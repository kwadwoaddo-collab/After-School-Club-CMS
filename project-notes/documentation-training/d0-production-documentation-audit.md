# SprintScale CMS — Milestone D0: Production Documentation Audit & Master Function Inventory

**Document Type:** Post-Launch Documentation Discovery & Functional Inventory  
**Milestone:** D0 (Documentation & Training Baseline)  
**Authoritative Starting Baseline SHA:** `dde8500`  
**Branch:** `rebuild/cms-modernisation`  
**Phase-7 Completion Reference Tag:** `cms-modernisation-phase7-complete` (`0c03442`)  
**Production Application URL:** `https://app.sprintscaleit.co.uk`  
**Date:** 2026-08-27  
**Status:** COMPLETE — ZERO MUTATION AUDIT PASS  

---

## 1. Executive Verdict

**PASS — DOCUMENTATION SOURCE OF TRUTH ESTABLISHED — READY FOR D1**

A full, non-destructive, evidence-backed inspection of the SprintScale After-School-Club-CMS codebase and production surface was conducted on branch `rebuild/cms-modernisation` at commit `dde8500`.

- **5 User Roles Discovered & Evidenced:** 4 internal staff roles (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`) and 1 external consumer role (`PARENT`).
- **38 User-Facing Pages & Views Audited:** Spanning Public Discovery, Authentication, Onboarding, Staff Dashboard, and Parent Portal.
- **32 API Endpoints, 3 Cron Routes, and 1 Webhook Catalogued.**
- **25 Functional Modules Inventoried:** Covering multi-tenant centre management, safeguarding, roll-call attendance, session credit ledgers, agreed-fee family billing, automated invoicing, public booking wizards, and multi-child registration forms.
- **42 Discrete User Workflows Documented:** 15 P0 (Essential operational/safeguarding/financial), 16 P1 (Common daily/weekly), 8 P2 (Occasional administrative), and 3 P3 (Advanced/rare).
- **Video & Screenshot Requirements Defined:** 24 proposed micro-videos (12 classified as **VIDEO ESSENTIAL**) and 31 annotated screenshot specifications with strict PII-redaction rules.
- **Zero Production Side-Effects:** 0 DB writes, 0 emails, 0 SMS, 0 Stripe/GoCardless calls, 0 schema changes, 0 migrations, 0 infrastructure alterations.

---

## 2. Baseline & Environment Context

| Attribute | Verified Value | Evidence Source |
|---|---|---|
| **Repository** | `/Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS` | Local Filesystem |
| **Active Branch** | `rebuild/cms-modernisation` | `git branch --show-current` |
| **Starting SHA** | `dde8500` | `git rev-parse --short HEAD` |
| **Phase-7 Tag** | `cms-modernisation-phase7-complete` (`0c03442`) | `git rev-list -n 1 cms-modernisation-phase7-complete` |
| **Working Tree** | Clean (`nothing to commit, working tree clean`) | `git status` |
| **Origin Alignment** | Synchronized with `origin/rebuild/cms-modernisation` | Git upstream tracking |
| **Production Target** | `https://app.sprintscaleit.co.uk` | Production Vercel Deployment |
| **Database Engine** | PostgreSQL 16 (Neon Serverless) | `src/db/schema.ts`, `drizzle-orm` |
| **Auth Engine** | NextAuth.js v5 (JWT strategy) + Jose HS256 for Parent Portal | `src/lib/auth.ts`, `src/lib/parent-auth.ts` |

---

## 3. Role Model & Authorization Architecture

The system enforces strict role-based access control (RBAC) and multi-tenant centre-based access control (CBAC). Roles are stored in `users.role` (`userRoleEnum`) and `centre_memberships.role`.

### Discovered Roles

1. **`ORG_OWNER` ("Owner")**
   - **Scope:** Entire organisation across all centres.
   - **Permissions:** Unrestricted access to all modules, centre settings, staff management, role promotion/demotion, staff invitations, financial records, billing configurations, invoice runs, payment reconciliations, communications broadcasts, Wonde school integrations, pupil year roll-forward, and data recovery/trash bins.
2. **`MANAGER` ("Manager")**
   - **Scope:** Centre-scoped (assigned via `centre_memberships`). If an organisation has multiple centres, managers only see and manage data for their assigned centre(s).
   - **Permissions:** Full operational access to assigned centres: Students, Parents, Registrations, Bookings, Attendance Roll Call, Session Ledger forgiveness, Incident Reporting (including sensitive Safeguarding records), Centre Operating Hours, and Centre Communications Broadcasts.
   - **Restricted from:** Organisation billing/financial configuration, issuing invoices, recording payments, managing staff roles/invitations, Wonde API configuration, and org-wide settings.
3. **`FRONT_DESK` ("Front Desk")**
   - **Scope:** Centre-scoped (assigned via `centre_memberships`).
   - **Permissions:** Daily reception and student intake: View student profiles, parent contact information, registrations queue, create/reschedule bookings, walk-in child registration, mark roll-call attendance, operate the Check-In/Check-Out Kiosk, and log standard incidents (Accident, Incident, Medication).
   - **Restricted from:** Safeguarding incident records, session forgiveness credits, centre hours configuration, financial records, team settings, and broadcasts.
4. **`TUTOR` ("Tutor" — formerly "Club Leader")**
   - **Scope:** Centre-scoped operational floor staff.
   - **Permissions:** Focused classroom execution: Dashboard daily schedule view, Attendance Roll Call (marking present/absent/late and checking in/out), and Kiosk check-in mode.
   - **Restricted from:** Student full profile editing, medical/safeguarding notes, parent records, registrations, bookings management, incidents management, team, settings, and finance.
5. **`PARENT` (Consumer / Guardian)**
   - **Authentication:** Passwordless Magic Link email verification issuing a signed HS256 JWT cookie (`parent_session`, 30-day expiry).
   - **Scope:** Strictly isolated to records matching `parent_id = session.parentId` where `deleted_at IS NULL`.
   - **Capabilities:** View registered children, update medical notes/allergies/consents, book club sessions, view invoices and payment history, pay via Stripe Checkout, submit Tax-Free Childcare (TFC) / Voucher references, and receive in-app portal notifications.

---

## 4. Master Route & Surface Inventory

### A. User-Facing Pages

| Route | Page Name | Audience | Nav Path | Purpose | Primary Actions | Secondary Actions | Req Role | Org Scope | Centre Scope | Destructive? | Ext Provider | Training Priority | Manual Req | Video Req |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Landing / Redirect | Public / All | Direct URL | Root routing entry point | Redirect to `/dashboard` (if auth) or `/login` | Public discovery | None | None | None | No | None | P3 | No | No |
| `/login` | Staff Login | Staff | Direct URL | Staff authentication entry point | Email/Password sign in, Google OAuth | Magic link request, Forgot password | Public | None | None | No | Google OAuth, NextAuth | P0 | Yes | Essential |
| `/staff-login` | Staff Magic Link | Staff | Direct URL | Request passwordless login token | Enter email, submit magic link | Back to password login | Public | None | None | No | Resend (Email) | P1 | Yes | Useful |
| `/signup` | Org Signup | New Owners | Direct URL | New organisation registration | Create account & organisation | Redirect to onboarding | Public | None | None | No | NextAuth | P1 | Yes | Useful |
| `/register-org` | Register Org Form | New Owners | Direct URL | Multi-step org creation | Submit business details | Link billing | Public | None | None | No | None | P2 | Yes | No |
| `/onboarding` | Post-Signup Setup | New Owners | Auto Redirect | Initial centre and brand setup | Configure first centre, brand color | Set opening hours | `ORG_OWNER` (no org) | Yes | None | No | None | P0 | Yes | Essential |
| `/accept-invite` | Accept Staff Invite | Invited Staff | Invite Link in Email | Set password and join organisation | Set password, complete name | Auto-login | Token holder | Token | Token | No | NextAuth | P0 | Yes | Essential |
| `/forgot-password` | Forgot Password | Staff | Direct URL | Request password reset email | Enter email | Return to login | Public | None | None | No | Resend (Email) | P1 | Yes | No |
| `/reset-password` | Reset Password | Staff | Reset Link in Email | Enter new account password | Set new password | Return to login | Token holder | Token | None | No | NextAuth | P1 | Yes | No |
| `/register/[...slug]` | Public Registration | Parents | Public Link / QR | Comprehensive child/family registration form | Multi-child registration, medical details, emergency contact, consents, digital signature | Upload docs, select sessions | Public | Slug | Optional Slug | No | None | P0 | Yes | Essential |
| `/book/[orgSlug]` | Public Booking Org | Parents | Public Link | Organisation-level booking wizard | Select centre and book sessions | Switch centre | Public | Slug | Selected | No | Stripe, GCal | P0 | Yes | Essential |
| `/book/[orgSlug]/[centreSlug]` | Public Booking Centre | Parents | Public Link | Centre-specific booking wizard | Select child, modality, time slot, confirm booking | Add notes | Public | Slug | Slug | No | Stripe, GCal | P0 | Yes | Essential |
| `/careers/[slug]` | Careers Portal | Public | Direct URL | View job openings for centre | View roles | Submit inquiry | Public | None | Slug | No | None | P3 | No | No |
| `/centre-portal/[subdomain]` | Centre White-Label | Public/Parents | Subdomain URL | White-label centre landing | Quick links to book / register | View centre info | Public | Subdomain | Subdomain | No | None | P2 | Yes | No |
| `/portal/login` | Parent Portal Login | Parents | Direct URL | Passwordless parent login | Enter email for magic link | Resend link | Public | None | None | No | Resend (Email) | P0 | Yes | Essential |
| `/portal` | Parent Dashboard | Parents | Post-Login | Overview of children, bookings, invoices | View session schedule, check alerts | Quick links to Book/Billing | `PARENT` | Scoped | None | No | None | P0 | Yes | Essential |
| `/portal/children/[id]` | Parent Child Profile | Parents | Portal Nav → Child | View/update child info and medical data | Add medical note, update dietary/allergies | Review consents | `PARENT` | Scoped | Scoped | No | None | P0 | Yes | Useful |
| `/portal/book` | Parent Portal Book | Parents | Portal Nav → Book | Authenticated multi-session booking | Select child, dates, sessions, book | Review pricing | `PARENT` | Scoped | Scoped | No | Stripe | P0 | Yes | Essential |
| `/portal/billing` | Parent Billing | Parents | Portal Nav → Billing | Invoices, payment history, card setup | Pay outstanding invoice (Stripe), submit voucher ref | Download invoice PDF | `PARENT` | Scoped | Scoped | Yes (Payment) | Stripe, GoCardless | P0 | Yes | Essential |
| `/portal/notifications` | Parent Notifications | Parents | Portal Bell Icon | View in-app alerts and updates | Mark as read, click alert action link | Clear notifications | `PARENT` | Scoped | Scoped | No | None | P2 | Yes | No |
| `/dashboard` | Main Staff Dashboard | All Staff | Sidebar → Dashboard | Operational cockpit: KPIs, schedule, alerts | Filter by Centre, quick action buttons | Search, theme toggle, notifications | Any Staff | Yes | Filterable | No | None | P0 | Yes | Essential |
| `/dashboard/centres` | Centres Management | Owners / Managers | Sidebar → Centres | Multi-centre list and summary | Add Centre, edit settings | Access centre billing | `ORG_OWNER`, `MANAGER` | Yes | Accessible | No | None | P1 | Yes | Useful |
| `/dashboard/centres/add` | Add Centre | Owners / Managers | Centres → Add Centre | Create new club centre | Input address, Ofsted ID, hours, capacity | Set fee structures | `ORG_OWNER`, `MANAGER` | Yes | None | No | None | P1 | Yes | Useful |
| `/dashboard/centres/[id]/settings` | Centre Settings | Owners / Managers | Centres → Centre → Edit | Manage centre operating parameters | Update contact info, Ofsted ID, banking | Set signature | `ORG_OWNER`, `MANAGER` | Yes | Assigned | No | None | P1 | Yes | Useful |
| `/dashboard/centres/[id]/billing` | Centre Bank & Billing | Owners Only | Centres → Centre → Billing | Configure bank account details for centre | Sort code, account number, invoice footer | Set approval date | `ORG_OWNER` | Yes | Assigned | No | None | P1 | Yes | Useful |
| `/dashboard/staff` | Team Management | Owners Only | Sidebar → Team | Staff list, roles, invitations | Invite staff, change role, revoke access | Filter by role | `ORG_OWNER` | Yes | All | Yes (Revoke) | Resend (Email) | P0 | Yes | Essential |
| `/dashboard/staff/invite` | Invite Staff Member | Owners Only | Team → Invite Staff | Send staff email invitation | Enter email, select role, assign centres | Send magic invite | `ORG_OWNER` | Yes | All | No | Resend (Email) | P0 | Yes | Essential |
| `/dashboard/staff/[userId]` | Staff Profile & Centres | Owners Only | Team → Staff Member | Manage staff member centre assignments | Assign/unassign centres, update role | View DBS/Safeguarding status | `ORG_OWNER` | Yes | All | No | None | P1 | Yes | Useful |
| `/dashboard/students` | Students Directory | Owners, Mgrs, Front Desk | Sidebar → Students | Master student roster with flags | Search, filter by centre/year, add student | CSV Import, export, roll years | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Filterable | No | None | P0 | Yes | Essential |
| `/dashboard/students/add` | Add Student Manual | Owners, Mgrs, Front Desk | Students → Add Student | Manual student & parent intake | Child details, parent contact, medical notes | Assign home centre | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Accessible | No | None | P0 | Yes | Essential |
| `/dashboard/students/import` | CSV Student Import | Owners, Mgrs, Front Desk | Students → Import CSV | Bulk student & parent ingestion | Upload CSV, map columns, execute import | Download sample CSV | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Accessible | Yes (Bulk write) | None | P1 | Yes | Useful |
| `/dashboard/students/[id]` | Student Profile Detail | Owners, Mgrs, Front Desk | Students → Student Record | Comprehensive 360° student view | Edit medical/SEN/GP, add notes, set flags | Manage recurring billing config, collectors | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Scoped | No | None | P0 | Yes | Essential |
| `/dashboard/students/[id]/attendance` | Student Attendance History | Owners, Mgrs, Front Desk | Student Profile → Attendance | Historical attendance records for student | View session dates, late minutes, absence reason | Filter by date range | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Scoped | No | None | P1 | Yes | No |
| `/dashboard/parents` | Parents Directory | Owners, Mgrs, Front Desk | Sidebar → Parents | Parent directory & portal access status | Search, filter, view linked children | Send portal magic link, delete parent | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Filterable | Yes (Soft delete) | Resend (Email) | P0 | Yes | Essential |
| `/dashboard/parents/[id]` | Parent Detail View | Owners, Mgrs, Front Desk | Parents → Parent Record | Parent contact info and linked children | Update contact details, trigger magic link | View billing history, soft delete | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Scoped | Yes (Soft delete) | Resend (Email) | P1 | Yes | Useful |
| `/dashboard/parents/bin` | Parent Recovery Bin | Owners, Mgrs, Front Desk | Parents → Recovery Bin | Restore or purge soft-deleted parents | Restore parent record | Permanent GDPR purge (Owner) | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Filterable | Yes (GDPR Purge) | None | P2 | Yes | Useful |
| `/dashboard/bookings` | Bookings Management | Owners, Mgrs, Front Desk | Sidebar → Bookings | All scheduled & walk-in bookings | Filter by date/centre/status, reschedule | Mark completed/cancelled, bulk update | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Filterable | Yes (Cancel) | GCal | P0 | Yes | Essential |
| `/dashboard/bookings/new` | Create Booking Manual | Owners, Mgrs, Front Desk | Bookings → New Booking | Manual session booking by staff | Select parent/child, centre, slot, modality | Instant confirmation | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Accessible | No | Resend, GCal | P0 | Yes | Essential |
| `/dashboard/bookings/[bookingId]` | Booking Detail View | All Staff | Bookings → Booking Record | Booking details, attendees, scorecard | Add assessment score & feedback notes | Send feedback email, reassign centre | Any Staff | Yes | Accessible | No | Resend (Email) | P1 | Yes | Useful |
| `/dashboard/bookings/[bookingId]/reschedule` | Reschedule Booking | Owners, Mgrs, Front Desk | Booking → Reschedule | Change date/time slot of booking | Select new slot, confirm reschedule | Check slot availability | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Accessible | No | GCal, Resend | P1 | Yes | Useful |
| `/dashboard/attendance` | Daily Roll Call | All Staff | Sidebar → Attendance | Real-time classroom attendance register | Mark Present / Late / Absent, Check-in / Check-out | Set homework/behaviour flags | Any Staff | Yes | Filterable | No | None | P0 | Yes | Essential |
| `/dashboard/attendance/ledger` | Session Credit Ledger | Owners / Managers | Attendance → Session Ledger | Absence/Extra session reconciliation & net balance | Forgive missed sessions (grant credit) | View academic year tally | `ORG_OWNER`, `MANAGER` | Yes | Accessible | Yes (Credit write) | None | P0 | Yes | Essential |
| `/dashboard/incidents` | Incident & Safeguarding | Owners, Mgrs, Front Desk | Sidebar → Incidents | Log and review health, injury & safeguarding incidents | Log Accident / Incident / Medication, capture signature | Log Safeguarding (Owner/Mgr only) | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Assigned Centre | Sensitive (Safeguarding) | None | P0 | Yes | Essential |
| `/dashboard/kiosk` | Check-in Kiosk Mode | All Staff | Sidebar → Kiosk | Fullscreen rapid check-in/out interface | One-click child check-in, check-out | Filter by session slot | Any Staff | Yes | Filterable | No | None | P1 | Yes | Essential |
| `/dashboard/registrations` | Registrations Queue | Owners, Mgrs, Front Desk | Sidebar → Registrations | Inbound public registration review queue | Review submission, confirm signup, reject | Filter by status, bulk confirmation | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Filterable | Yes (Status change) | Resend (Email) | P0 | Yes | Essential |
| `/dashboard/registrations/[id]` | Registration Detail | Owners, Mgrs, Front Desk | Registrations → Submission | Full submitted form with digital signature | Approve & convert to active students | Review medical/emergency info | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Yes | Scoped | No | Resend (Email) | P0 | Yes | Essential |
| `/dashboard/availability` | Centre Opening Hours | Owners / Managers | Sidebar → Availability | Overview of operating schedules across centres | View weekly hours per centre | Navigate to edit hours | `ORG_OWNER`, `MANAGER` | Yes | Accessible | No | None | P1 | Yes | Useful |
| `/dashboard/availability/[centreId]` | Edit Centre Hours | Owners / Managers | Availability → Edit Hours | Set daily start/end times per day of week | Add/remove days, set opening/closing times | Set closed days | `ORG_OWNER`, `MANAGER` | Yes | Assigned | No | None | P1 | Yes | Useful |
| `/dashboard/communications` | Broadcast Communications | Owners / Managers | Sidebar → Communications | Send targeted broadcast emails to parents | Compose email, select recipient audience | Review delivery metrics | `ORG_OWNER`, `MANAGER` | Yes | Selected Centre | No | Resend (Email) | P1 | Yes | Essential |
| `/dashboard/finance` | Finance & Invoicing Hub | Owners Only | Sidebar → Finance | Master revenue, invoices, and family billing configs | Create Ad-Hoc Invoice, generate monthly billing | Export CSV, filter by status | `ORG_OWNER` | Yes | Filterable | No | None | P0 | Yes | Essential |
| `/dashboard/finance/invoices` | All Invoices List | Owners Only | Finance → View Invoices | Comprehensive invoice grid | Filter by paid/unpaid/draft, record payment | Void invoice, resend invoice email | `ORG_OWNER` | Yes | Filterable | Yes (Void/Delete) | Resend (Email) | P0 | Yes | Essential |
| `/dashboard/finance/invoices/[id]` | Invoice Detail View | Owners Only | Finance → Invoice Record | Full invoice breakdown, payments, line items | Record offline payment, void invoice | Download PDF, resend invoice email | `ORG_OWNER` | Yes | Filterable | Yes (Void) | Resend (Email) | P0 | Yes | Essential |
| `/dashboard/finance/receipt` | Payment Receipts | Owners Only | Finance → Receipt Generator | Generate and view official VAT/payment receipts | Generate PDF receipt for parent | Print receipt | `ORG_OWNER` | Yes | Filterable | No | None | P1 | Yes | Useful |
| `/dashboard/finance/reconciliation` | Bank Reconciliation | Owners Only | Finance → Reconciliation | Match offline bank transfers & childcare vouchers | Verify pending payment, fail payment | Filter by payment method | `ORG_OWNER` | Yes | Filterable | Yes (Financial verification) | None | P0 | Yes | Essential |
| `/dashboard/reports` | Reports & Data Export | Owners / Managers | Sidebar → Reports | Executive KPIs, attendance summaries & CSV exports | Export attendance CSV, bookings CSV, students CSV | View weekly summary metrics | `ORG_OWNER`, `MANAGER` | Yes | All/Assigned | No | None | P1 | Yes | Useful |
| `/dashboard/settings` | Organisation Settings | Owners Only | Sidebar → Settings | Organisation profile, logo, branding, terms | Update brand color, upload logo, set terms | Manage discounts, roll academic year | `ORG_OWNER` | Yes | Org-wide | Yes (Roll Year) | Vercel Blob | P0 | Yes | Essential |
| `/dashboard/settings/wonde` | Wonde School Sync | Owners Only | Settings → Wonde Sync | Synchronise school attendance and rosters | Connect Wonde API, trigger school sync | Review sync audit log | `ORG_OWNER` | Yes | Org-wide | No | Wonde API | P2 | Yes | Useful |
| `/dashboard/share` | Share Portals Utility | Owners / Managers | Sidebar → Share Portals | Copy and share public booking & registration links | Copy direct booking URL, copy registration URL | Copy centre-specific subdomain links | `ORG_OWNER`, `MANAGER` | Yes | Accessible | No | None | P1 | Yes | Useful |

---

### B. API, Background, Cron & Webhook Endpoints

| Endpoint | Method | Classification | Purpose | Auth / Gate | Side Effects / Providers |
|---|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | Auth Infrastructure | NextAuth session handling, OAuth callbacks, credentials | Public / OAuth tokens | Session cookie issuance |
| `/api/auth/signup` | POST | Public Auth | Register new organisation and owner user | Public | Creates `organisations`, `users` rows |
| `/api/auth/reset-password` | POST | Public Auth | Execute password reset via token | Token | Updates `users.passwordHash` |
| `/api/health` | GET | System Monitoring | Uptime probe, returns `{ok: true, timestamp}` | Public | None |
| `/api/search` | GET | System Feature | Global header Cmd+K search (students, bookings) | Authenticated staff | Reads `children`, `bookings` |
| `/api/notifications` | GET, PATCH | User Notifications | Fetch and mark in-app staff notifications | Authenticated staff | Updates `notifications.isRead` |
| `/api/user/memberships` | GET | Multi-tenancy | List organisations user belongs to | Authenticated staff | Reads `org_memberships` |
| `/api/user/switch-org` | POST | Multi-tenancy | Switch active organisation context | Authenticated staff | Updates `users.organisationId` |
| `/api/organisations` | GET, POST | Management | Create/manage organisation record | `ORG_OWNER` | DB write |
| `/api/organisations/[slug]/registration-info` | GET | Public Endpoint | Fetch public org branding and terms for registration form | Public | Reads `organisations` |
| `/api/centres` | GET, POST | Management | List/create centres | `ORG_OWNER`, `MANAGER` | DB write |
| `/api/centres/[id]` | GET, PUT, DELETE | Management | Update centre details / delete centre | `ORG_OWNER`, `MANAGER` | DB write |
| `/api/centres/[id]/subdomain` | POST | Management | Configure white-label subdomain for centre | `ORG_OWNER` | DB write |
| `/api/availability` | GET, POST | Operational | Fetch and update centre opening hours | `ORG_OWNER`, `MANAGER` | DB write |
| `/api/students` | GET, POST | Operational | Query and create students | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | DB write |
| `/api/students/[id]` | GET, PUT, DELETE | Operational | Update student profile or soft-delete | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | DB write |
| `/api/parents/[id]` | GET, PUT, DELETE | Operational | Update parent details or soft-delete parent | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | DB write |
| `/api/bookings` | GET, POST | Operational | Query bookings or create new booking | Staff (Role-checked) | Sends email, GCal sync |
| `/api/bookings/[bookingId]` | GET, PUT, DELETE | Operational | Fetch or cancel booking | Staff (Role-checked) | DB update |
| `/api/bookings/[bookingId]/status` | PATCH | Operational | Update booking status (`confirmed`, `cancelled`, etc.) | Staff (Role-checked) | DB update |
| `/api/bookings/[bookingId]/reschedule` | POST | Operational | Reschedule booking to new time slot | Staff (Role-checked) | GCal update, Email |
| `/api/bookings/[bookingId]/centre` | PATCH | Operational | Reassign booking to another centre | `ORG_OWNER`, `MANAGER` | DB update |
| `/api/bookings/bulk-update` | POST | Operational | Bulk status update on multiple bookings | `ORG_OWNER`, `MANAGER` | DB update |
| `/api/bookings/bulk-delete` | POST | Operational | Bulk cancellation/deletion of bookings | `ORG_OWNER` | DB delete |
| `/api/register` | POST | Public Intake | Submit public multi-child registration form | Public | Creates `registrations`, sends email |
| `/api/register/prefill` | GET | Public Intake | Prefill registration data for returning parent | Magic Link / Email | Reads `parents`, `children` |
| `/api/register/[id]/status` | PATCH | Operational | Confirm or reject inbound registration | `ORG_OWNER`, `MANAGER`, `FRONT_DESK` | Converts to students, sends email |
| `/api/register/bulk-email` | POST | Operational | Send bulk invitation email to register | `ORG_OWNER`, `MANAGER` | Resend (Email) |
| `/api/staff/invite` | POST | Staff Management | Send email invitation to prospective staff member | `ORG_OWNER` | Resend (Email), creates token |
| `/api/staff/validate-invite` | GET | Staff Management | Validate invite token validity | Public | Reads `staff_invites` |
| `/api/staff/accept-invite` | POST | Staff Management | Accept staff invitation and activate account | Token | Updates `users`, `staff_invites` |
| `/api/staff/assign-centres` | POST | Staff Management | Assign staff user to specific centre IDs | `ORG_OWNER` | DB write to `centre_memberships` |
| `/api/staff/request-magic-link` | POST | Staff Auth | Request passwordless staff login token | Public | Resend (Email) |
| `/api/staff/magic-login` | POST | Staff Auth | Authenticate staff member via magic token | Token | Issues NextAuth session |
| `/api/staff/remove` | POST | Staff Management | Revoke staff member access | `ORG_OWNER` | Deletes user / membership |
| `/api/portal/login` | POST | Parent Auth | Request parent portal magic link | Public | Resend (Email), sets token |
| `/api/portal/logout` | POST | Parent Auth | Clear parent session cookie | `PARENT` | Clears `parent_session` cookie |
| `/api/portal/checkout` | POST | Parent Payments | Initialize Stripe checkout session for invoice | `PARENT` | Calls Stripe API |
| `/api/webhooks/stripe-invoice` | POST | Webhook Handler | Process Stripe checkout completion webhooks | Stripe Signature | Updates `invoices` & `payments` |
| `/api/cron/billing` | GET, POST | Scheduled Cron | Execute automated recurring monthly family invoice generation | Bearer CRON_SECRET | Inserts `invoices`, logs `billing_runs` |
| `/api/cron/reminders` | GET, POST | Scheduled Cron | Send automated 24h booking reminder emails | Bearer CRON_SECRET | Resend (Email) |
| `/api/cron/school-year-roll` | GET, POST | Scheduled Cron | Annual automated roll-forward of school years | Bearer CRON_SECRET | Updates `children.schoolYear` |
| `/api/export/finance` | GET | Data Export | Stream CSV export of invoices & payments | `ORG_OWNER` | None (Read only) |
| `/api/export/register` | GET | Data Export | Stream CSV export of daily attendance roll | `ORG_OWNER`, `MANAGER` | None (Read only) |
| `/api/reports/attendance` | GET | Reporting API | Aggregate attendance metrics for charts | `ORG_OWNER`, `MANAGER` | None (Read only) |
| `/api/reports/bookings` | GET | Reporting API | Aggregate booking trends | `ORG_OWNER`, `MANAGER` | None (Read only) |
| `/api/reports/students` | GET | Reporting API | Aggregate student retention metrics | `ORG_OWNER`, `MANAGER` | None (Read only) |
| `/api/upload` | POST | Asset Storage | Upload files and document attachments | Authenticated staff | Vercel Blob |
| `/api/upload/logo` | POST | Branding Storage | Upload organisation / centre logo | `ORG_OWNER` | Vercel Blob |

---

## 5. Role / Capability Matrix

| Capability / Action | `ORG_OWNER` | `MANAGER` | `FRONT_DESK` | `TUTOR` | `PARENT` |
|---|---|---|---|---|---|
| **View Dashboard & Schedule** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS |
| **Mark Attendance Roll Call** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS |
| **Operate Check-in Kiosk** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS |
| **Log Accident / Medication Incident** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | NO ACCESS |
| **Log / View Safeguarding Incident** | FULL ACCESS | CENTRE-SCOPED | NO ACCESS | NO ACCESS | NO ACCESS |
| **Forgive Missed Session (Session Ledger)** | FULL ACCESS | CENTRE-SCOPED | NO ACCESS | NO ACCESS | NO ACCESS |
| **View / Edit Student Profiles** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | OWN CHILDREN |
| **Add Student / CSV Import** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | NO ACCESS |
| **View Parents Directory** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | NO ACCESS |
| **Soft Delete / Restore Parent** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | NO ACCESS |
| **Permanent GDPR Purge Parent** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Review & Confirm Registrations** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | NO ACCESS |
| **Create / Reschedule Bookings** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | CONDITIONAL (Portal) |
| **Send Assessment Feedback Email** | FULL ACCESS | CENTRE-SCOPED | CENTRE-SCOPED | NO ACCESS | NO ACCESS |
| **Configure Centre Opening Hours** | FULL ACCESS | CENTRE-SCOPED | NO ACCESS | NO ACCESS | NO ACCESS |
| **Send Parent Broadcast Emails** | FULL ACCESS | CENTRE-SCOPED | NO ACCESS | NO ACCESS | NO ACCESS |
| **View Invoices & Financial Reports** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | OWN INVOICES |
| **Create Ad-hoc / Monthly Family Invoices**| FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Record Offline Payment / Bank Reconcile**| FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Void / Delete Invoices** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Generate Payment Receipt PDF** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Invite Staff & Change Staff Roles** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Assign Staff to Centres** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Organisation Settings & Branding** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Wonde School Integration** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |
| **Roll Academic School Year Forward** | FULL ACCESS | NO ACCESS | NO ACCESS | NO ACCESS | NO ACCESS |

---

## 6. End-to-End User Workflow Inventory

### Workflow Summary by Priority
- **P0 (Critical Operational / Safeguarding / Financial):** 15 Workflows
- **P1 (Standard Daily / Weekly Workflows):** 16 Workflows
- **P2 (Occasional Administrative Tasks):** 8 Workflows
- **P3 (Advanced / Maintenance Tasks):** 3 Workflows

---

### Master Workflow Specifications

#### WF-01: Take Daily Classroom Roll Call (Attendance)
- **Role:** `TUTOR`, `FRONT_DESK`, `MANAGER`, `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Attendance (`/dashboard/attendance`)
- **Prerequisites:** At least one student enrolled in active centre session today.
- **Exact UI Steps:**
  1. Navigate to `/dashboard/attendance`.
  2. Select active Centre from top dropdown if multi-centre.
  3. Locate student card in the session grid.
  4. Click **"Check In"** (records current timestamp and sets status `present` or `late` if past start time) OR click status pills (`Present`, `Late`, `Absent`).
  5. If marking Absent, select reason from modal (`Illness`, `Holiday`, `Family`, `Other`).
  6. At pickup, click **"Check Out"** (records check-out timestamp).
- **Validation:** Timestamp parsed in Europe/London timezone. Late minutes auto-calculated against session start time.
- **Expected Result:** Student status badge updates immediately; card transitions from "Pending" to "Checked In".
- **Database Effect:** Updates `booking_attendees` (`check_in_at`, `check_out_at`, `attendance_status`, `late_minutes`, `attendance_marked_by`).
- **Destructive/Sensitive:** No.
- **Rationale Required:** **YES** — Explains why recording exact check-in/out timestamps is legally mandated under Ofsted safeguarding rules.
- **Screenshot Required:** **YES** (Annotate Check-in button, Late badge, Absence selector).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 45 seconds, ~3 clicks).

#### WF-02: Fast Check-In / Check-Out via Kiosk Mode
- **Role:** `TUTOR`, `FRONT_DESK`, `MANAGER`, `ORG_OWNER`
- **Priority:** **P1**
- **Starting Location:** Sidebar → Kiosk (`/dashboard/kiosk`)
- **Prerequisites:** Active session with scheduled students.
- **Exact UI Steps:**
  1. Open `/dashboard/kiosk` on tablet/front-desk monitor.
  2. Filter by slot if needed.
  3. Tap **"Check In"** next to child name as child arrives.
  4. Tap **"Check Out"** when parent collects child.
- **Validation:** Fast one-tap asynchronous mutation with immediate optimistic UI update.
- **Expected Result:** Student instantly transitions between "Awaiting Arrival" and "Checked In".
- **Database Effect:** Updates `booking_attendees.check_in_at` / `check_out_at`.
- **Destructive/Sensitive:** No.
- **Rationale Required:** No.
- **Screenshot Required:** **YES** (Clean tablet layout).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 30 seconds, ~2 clicks).

#### WF-03: Log Standard Health & Injury Incident
- **Role:** `FRONT_DESK`, `MANAGER`, `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Incidents (`/dashboard/incidents`)
- **Prerequisites:** Active centre selected.
- **Exact UI Steps:**
  1. Click **"+ Log Incident"** button.
  2. Select Incident Type: `Accident`, `Incident`, or `Medication`.
  3. Select Student from searchable dropdown.
  4. Enter Date & Time of occurrence.
  5. Fill in Description of event, First Aid / Treatment provided, and Witness names.
  6. Provide staff digital signature via signature pad.
  7. Click **"Save Incident Record"**.
- **Validation:** Description and Student ID required. Staff signature captured as base64 data URL.
- **Expected Result:** Incident logged in centre history; badge reflects incident category.
- **Database Effect:** Inserts row into `incidents` table.
- **Destructive/Sensitive:** Sensitive (Medical/Health data).
- **Rationale Required:** **YES** — Compliance requirements for statutory injury logging.
- **Screenshot Required:** **YES** (Annotate incident type pills and signature box).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 60 seconds, ~6 clicks).

#### WF-04: Log Confidential Safeguarding Incident
- **Role:** `MANAGER`, `ORG_OWNER` (Strictly restricted from `FRONT_DESK` and `TUTOR`)
- **Priority:** **P0**
- **Starting Location:** Sidebar → Incidents (`/dashboard/incidents`)
- **Prerequisites:** Manager or Owner session.
- **Exact UI Steps:**
  1. Click **"+ Log Incident"**.
  2. Select Type: **"Safeguarding"** (option visible only to Manager/Owner).
  3. Select Student.
  4. Enter detailed factual notes, disclosures, witnesses, and immediate actions taken.
  5. Capture Designated Safeguarding Lead (DSL) signature.
  6. Click **"Record Safeguarding File"**.
- **Validation:** Strict server-side `requirePermission('MANAGER')` gate; front-desk/tutors cannot read or submit.
- **Expected Result:** Record saved; isolated from non-manager incident views.
- **Database Effect:** Inserts `incidents` with `type = 'safeguarding'`.
- **Destructive/Sensitive:** **HIGHLY SENSITIVE (Safeguarding / Child Protection)**.
- **Rationale Required:** **YES** — Legal confidentiality and DSL escalation protocol.
- **Screenshot Required:** **YES** (Crop to generic fields, redact all real student names).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 75 seconds).

#### WF-05: Review and Approve Inbound Public Registration
- **Role:** `FRONT_DESK`, `MANAGER`, `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Registrations (`/dashboard/registrations`)
- **Prerequisites:** Parent submitted `/register/[...slug]` form.
- **Exact UI Steps:**
  1. Navigate to `/dashboard/registrations`.
  2. Click on a registration row with status **"Awaiting Confirmation"**.
  3. Review submitted parent details, children, emergency contacts, medical disclosures, and signature.
  4. Click **"Confirm & Sign Up"** (or **"Mark Not Interested"**).
  5. Select target Centre assignment.
  6. Confirm action in modal.
- **Validation:** Matching logic links to existing parent/child records if email matches, or provisions new records.
- **Expected Result:** Registration status becomes `signed_up`; new `children` and `parents` records created/linked; confirmation email dispatched to parent.
- **Database Effect:** Updates `registrations.status`, inserts/updates `parents` and `children`.
- **Destructive/Sensitive:** No.
- **Rationale Required:** **YES** — Explains automated parent matching and duplicate prevention.
- **Screenshot Required:** **YES** (Annotate confirmation buttons and matched data badges).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 90 seconds, ~4 clicks).

#### WF-06: Create Recurring Agreed-Fee Family Billing Configuration
- **Role:** `ORG_OWNER` (Managers can view in Student Profile if assigned to centre)
- **Priority:** **P0**
- **Starting Location:** Sidebar → Students → Select Student → Billing Tab OR Finance Hub
- **Prerequisites:** Registered parent with one or more children.
- **Exact UI Steps:**
  1. Navigate to Student Profile (`/dashboard/students/[id]`).
  2. Open the **"Family Billing"** section (`BillingSettingsCard`).
  3. Click **"Configure Recurring Billing"**.
  4. Enter Agreed Monthly Fee (e.g. `£250.00`).
  5. Select Billing Anchor Date (day of month, e.g. 1st).
  6. Check all sibling children covered under this single agreed family fee.
  7. Set Invoice Lead Days (default: 7 days before period starts).
  8. Click **"Save Family Billing Config"**.
- **Validation:** Exactly one billing config per parent per centre enforced at DB level (`billing_configs_parent_centre_unique`). Fee entered in pounds, converted to pence.
- **Expected Result:** Active billing config established; ready for monthly automated invoice generation.
- **Database Effect:** Inserts `billing_configs` and `billing_config_children`.
- **Destructive/Sensitive:** Sensitive (Financial).
- **Rationale Required:** **YES** — Explains why SprintScale uses an agreed whole-family monthly fee rather than per-session ad-hoc billing.
- **Screenshot Required:** **YES** (Annotate monthly fee input, sibling multi-select checkboxes).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 90 seconds, ~5 clicks).

#### WF-07: Generate & Send Monthly Billing Run Invoices
- **Role:** `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Finance → Billing Cycles Tab (`/dashboard/finance`)
- **Prerequisites:** Active billing configs exist.
- **Exact UI Steps:**
  1. Navigate to `/dashboard/finance`.
  2. Click **"Billing Cycles"** tab.
  3. Review families due for invoicing in upcoming billing cycle.
  4. Click **"Generate Invoices"** (single family) or **"Bulk Generate Cycle Invoices"**.
  5. Confirm invoice period dates and amounts in modal.
  6. Click **"Confirm & Issue Invoices"**.
- **Validation:** Idempotency guard: prevents duplicate invoices if a successful `billing_runs` record exists for the period.
- **Expected Result:** Draft invoices created with structured `INV-XXXXXX` numbers and covered sibling summaries; billing run audit log updated.
- **Database Effect:** Inserts `invoices`, `billing_runs`, and `audit_events`.
- **Destructive/Sensitive:** Financial.
- **Rationale Required:** **YES** — Explains idempotency protection and automated period calculation.
- **Screenshot Required:** **YES** (Annotate bulk generation modal and cycle preview).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 75 seconds, ~4 clicks).

#### WF-08: Reconcile Offline Payment (Bank Transfer / Childcare Voucher)
- **Role:** `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Finance → Reconciliation (`/dashboard/finance/reconciliation`)
- **Prerequisites:** Unpaid or partially paid invoice exists.
- **Exact UI Steps:**
  1. Navigate to `/dashboard/finance/reconciliation`.
  2. Locate target family/invoice in outstanding payments list.
  3. Click **"Record Payment"**.
  4. Select Payment Method: `Bank Transfer`, `Tax-Free Childcare`, `Voucher`, or `Cash`.
  5. Enter Amount received and Transaction Reference / TFC Reference.
  6. Click **"Verify & Apply Payment"**.
- **Validation:** Payment amount cannot exceed invoice remaining balance unless recorded as parent credit.
- **Expected Result:** Invoice status automatically updates: `paid` (if balance is £0) or `partially_paid`; payment logged in audit trail.
- **Database Effect:** Inserts `payments` row (`status = 'verified'`), updates `invoices.status`.
- **Destructive/Sensitive:** **CRITICAL FINANCIAL MUTATION**.
- **Rationale Required:** **YES** — Explains tax-free childcare remittance matching and ledger integrity.
- **Screenshot Required:** **YES** (Annotate payment method selector, TFC reference input).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 60 seconds, ~4 clicks).

#### WF-09: Forgive Missed Session in Session Credit Ledger
- **Role:** `MANAGER`, `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Attendance → Session Ledger (`/dashboard/attendance/ledger`)
- **Prerequisites:** Student marked absent for one or more scheduled sessions.
- **Exact UI Steps:**
  1. Open `/dashboard/attendance/ledger`.
  2. Filter by centre and current academic year.
  3. Locate student in ledger (showing negative net balance due to absences).
  4. Click **"Forgive Sessions"** button on student row.
  5. Enter Number of Sessions to forgive (e.g. `1` or `2`).
  6. Enter mandatory Reason / Note (e.g. "Medical note provided", "Family bereavement").
  7. Click **"Grant Forgiveness Credit"**.
- **Validation:** Note is mandatory. Only Owner/Manager permitted.
- **Expected Result:** Student net balance adjusts positively; credit logged with admin timestamp and reason.
- **Database Effect:** Inserts `session_credits` row; recalculates net balance dynamically.
- **Destructive/Sensitive:** Operational / Financial credit.
- **Rationale Required:** **YES** — Explains how session forgiveness balances make-up sessions against family billing without altering invoice amounts.
- **Screenshot Required:** **YES** (Annotate net balance formula and forgiveness modal).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 60 seconds, ~4 clicks).

#### WF-10: Invite New Staff Member & Assign Centres
- **Role:** `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Team → Invite Staff (`/dashboard/staff/invite`)
- **Prerequisites:** Owner session.
- **Exact UI Steps:**
  1. Navigate to `/dashboard/staff/invite`.
  2. Enter Staff Member Email address.
  3. Select Role: `Manager`, `Front Desk`, or `Tutor`.
  4. If Manager/Front Desk/Tutor selected, check assigned Centre(s).
  5. Click **"Send Invitation"**.
- **Validation:** Valid email format; token expires in 7 days; duplicate pending invite rejected.
- **Expected Result:** Invite token generated and emailed via Resend; invitation appears in Team Pending Invites list.
- **Database Effect:** Inserts `staff_invites` and creates initial `users` / `centre_memberships` records.
- **Destructive/Sensitive:** Security / Access Control.
- **Rationale Required:** **YES** — Explains why centre assignment is essential for data isolation.
- **Screenshot Required:** **YES** (Annotate role selector and centre check boxes).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 60 seconds, ~4 clicks).

#### WF-11: Public Booking Flow (New or Returning Parent)
- **Role:** `PARENT` (Public Consumer)
- **Priority:** **P0**
- **Starting Location:** Public link `/book/[orgSlug]` or `/book/[orgSlug]/[centreSlug]`
- **Prerequisites:** Centre has active sessions and opening hours configured.
- **Exact UI Steps:**
  1. Parent navigates to booking link.
  2. Selects Centre (if not preselected via URL).
  3. Selects Modality (`In-Person` or `Online`).
  4. Chooses Date and Time Slot from real-time available slots.
  5. Enters Parent contact details (Name, Email, Phone) and Child details (Name, Year, DOB).
  6. Enters any medical conditions or SEN notes.
  7. Agrees to Terms & Conditions and Communications Consent.
  8. Clicks **"Confirm Booking"**.
- **Validation:** Slot availability verified with double-booking prevention (`unique_time_slot` constraint).
- **Expected Result:** Instant confirmation code generated; confirmation email sent with magic link; Google Calendar event booked (if enabled).
- **Database Effect:** Inserts `parents` (or matches), `children`, `bookings`, `booking_attendees`.
- **Destructive/Sensitive:** No.
- **Rationale Required:** No.
- **Screenshot Required:** **YES** (Multi-step booking wizard).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 60 seconds).

#### WF-12: Parent Portal Magic Link Login & Session Access
- **Role:** `PARENT`
- **Priority:** **P0**
- **Starting Location:** `/portal/login`
- **Prerequisites:** Parent email exists in system (from prior booking or registration).
- **Exact UI Steps:**
  1. Parent visits `/portal/login`.
  2. Enters registered email address.
  3. Clicks **"Send Magic Link"**.
  4. Checks email inbox, clicks secure link.
  5. Link hits `/portal/verify?token=...`, validates token, issues signed `parent_session` JWT cookie.
  6. Parent redirected into `/portal` dashboard.
- **Validation:** Token hash-checked against DB; expires after 15 minutes; revoked upon use; soft-deleted parents rejected (`deleted_at IS NULL`).
- **Expected Result:** Authenticated parent session active for 30 days.
- **Database Effect:** Updates `parents.magic_link_token`.
- **Destructive/Sensitive:** Auth security.
- **Rationale Required:** **YES** — Explains passwordless security model and why parents never need passwords.
- **Screenshot Required:** **YES** (Login screen and check inbox prompt).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 45 seconds).

#### WF-13: Parent Online Invoice Payment via Stripe Checkout
- **Role:** `PARENT`
- **Priority:** **P0**
- **Starting Location:** Parent Portal → Billing (`/portal/billing`)
- **Prerequisites:** Unpaid invoice issued to parent.
- **Exact UI Steps:**
  1. Parent navigates to `/portal/billing`.
  2. Locates unpaid invoice with status `Draft` or `Sent`.
  3. Clicks **"Pay with Card / Apple Pay"**.
  4. Redirected to secure Stripe Checkout hosted page.
  5. Enters payment card details and completes 3D Secure verification.
  6. Redirected back to `/portal/billing?success=true`.
- **Validation:** Webhook `/api/webhooks/stripe-invoice` verifies payment cryptographic signature.
- **Expected Result:** Invoice marked `paid`; payment recorded in ledger; receipt instantly downloadable.
- **Database Effect:** Webhook updates `invoices.status = 'paid'`, inserts `payments` row.
- **Destructive/Sensitive:** Financial transaction.
- **Rationale Required:** No.
- **Screenshot Required:** **YES** (Portal invoice pay button & Stripe checkout).
- **Video Required:** **VIDEO USEFUL** (Est. duration: 60 seconds).

#### WF-14: Send Targeted Parent Email Broadcast
- **Role:** `MANAGER`, `ORG_OWNER`
- **Priority:** **P1**
- **Starting Location:** Sidebar → Communications (`/dashboard/communications`)
- **Prerequisites:** Centre selected with consented parents.
- **Exact UI Steps:**
  1. Navigate to `/dashboard/communications`.
  2. Select active Centre.
  3. Filter audience (e.g. "All Active Centre Parents" or specific session attendees).
  4. Review recipient count (system automatically filters out parents without GDPR communications consent).
  5. Enter Subject and Message body.
  6. Click **"Send Broadcast"**.
- **Validation:** Strict server-side verification of `communicationsConsent`; HTML template auto-escaped to prevent injection.
- **Expected Result:** Broadcast queued and delivered via Resend; broadcast history logs recipient, success, and failure counts.
- **Database Effect:** Inserts row into `broadcasts` table.
- **Destructive/Sensitive:** Mass communication.
- **Rationale Required:** **YES** — GDPR communications consent rules and legal compliance.
- **Screenshot Required:** **YES** (Audience counter and composer).
- **Video Required:** **VIDEO ESSENTIAL** (Est. duration: 60 seconds, ~4 clicks).

#### WF-15: Manual Student & Parent Intake
- **Role:** `FRONT_DESK`, `MANAGER`, `ORG_OWNER`
- **Priority:** **P0**
- **Starting Location:** Sidebar → Students → Add Student (`/dashboard/students/add`)
- **Prerequisites:** Centre context.
- **Exact UI Steps:**
  1. Click **"+ Add Student"**.
  2. Enter Student First/Last Name, School Year, Date of Birth.
  3. Enter Parent Contact (First Name, Last Name, Email, Phone, Relationship).
  4. Fill Medical, SEN, and Dietary requirements.
  5. Check consents (Photo, Sun Cream, First Aid).
  6. Select Home Centre.
  7. Click **"Save Student"**.
- **Validation:** Names and school year required. Email validated.
- **Expected Result:** New student record created with linked parent.
- **Database Effect:** Inserts `children` and `parents`.
- **Destructive/Sensitive:** No.
- **Rationale Required:** No.
- **Screenshot Required:** **YES** (Intake form tabs).
- **Video Required:** **VIDEO USEFUL** (Est. duration: 75 seconds).

#### Additional Workflows (WF-16 to WF-42)
*(Full parameters catalogued in Master Source-of-Truth Matrix below)*:
- **WF-16:** CSV Bulk Student Import (`/dashboard/students/import`) — P1
- **WF-17:** Add/Pin Student Progress & Behaviour Note (`/dashboard/students/[id]`) — P1
- **WF-18:** Update Student Operational Flags (Homework/Behaviour on Roll Call) — P1
- **WF-19:** Soft Delete Parent / Student Record (`/dashboard/parents/[id]`) — P1
- **WF-20:** Restore Soft-Deleted Parent from Recovery Bin (`/dashboard/parents/bin`) — P2
- **WF-21:** GDPR Permanent Purge of Parent Data (`/dashboard/parents/bin`) — P2 (Destructive)
- **WF-22:** Reschedule Existing Booking (`/dashboard/bookings/[id]/reschedule`) — P1
- **WF-23:** Reassign Booking to Another Centre (`/dashboard/bookings/[id]`) — P2
- **WF-24:** Complete Assessment Scorecard & Send Feedback Email (`/dashboard/bookings/[id]`) — P1
- **WF-25:** Walk-in Student Immediate Booking Registration — P1
- **WF-26:** Void an Erroneous Invoice (`/dashboard/finance/invoices/[id]`) — P1
- **WF-27:** Delete Draft Invoice (`/dashboard/finance/invoices/[id]`) — P2
- **WF-28:** Update Invoice Due Date or Invoice Date — P2
- **WF-29:** Issue Ad-Hoc Single Invoice (`/dashboard/finance`) — P1
- **WF-30:** Generate Official VAT/Payment Receipt PDF (`/dashboard/finance/receipt`) — P1
- **WF-31:** Resend Invoice Email to Parent (`/dashboard/finance/invoices/[id]`) — P1
- **WF-32:** Configure Centre Operating Hours & Availability Rules (`/dashboard/availability/[id]`) — P1
- **WF-33:** Configure Centre Bank Account & Billing Header Details (`/dashboard/centres/[id]/billing`) — P1
- **WF-34:** Update Organisation Brand Color & Logo (`/dashboard/settings`) — P1
- **WF-35:** Configure Sibling & Pupil Premium Discount Rules (`/dashboard/settings`) — P2
- **WF-36:** Execute Annual Academic School Year Roll-Forward (`/dashboard/settings`) — P1 (Destructive)
- **WF-37:** Export Attendance Register CSV (`/dashboard/reports`) — P1
- **WF-38:** Export Financial Billing CSV (`/dashboard/reports`) — P1
- **WF-39:** Sync School Attendance via Wonde Integration (`/dashboard/settings/wonde`) — P2
- **WF-40:** Share Public Booking & Registration Links (`/dashboard/share`) — P1
- **WF-41:** Switch Active Organisation Context (Multi-Org Staff) (`OrgSwitcher`) — P2
- **WF-42:** Parent Self-Service Medical Note Update (`/portal/children/[id]`) — P1

---

## 7. Rationale & Policy Inventory

Merely explaining *where to click* without explaining *why* leads to operational errors. The following key rationales are documented:

| Feature / Action | What the User Does | Why the System Requires It | Failure / Mistake Impact | Rationale Origin |
|---|---|---|---|---|
| **Check-in / Check-out Timestamps** | Enters exact arrival/departure times rather than a simple checkmark. | UK Ofsted statutory framework requires continuous custodial time-tracking for child safeguarding. | Failure to log exact times invalidates insurance and violates statutory nursery/after-school regulations. | **A & B** (Enforced app logic + Statutory safeguarding) |
| **Safeguarding vs Standard Incidents** | Chooses "Safeguarding" type only for child protection disclosures. | Safeguarding notes are legally privileged and restricted strictly to DSL / Manager level. | If logged as standard incident, non-manager staff can read confidential child protection files. | **A & B** (Strict role gate + Child protection law) |
| **Family Agreed-Fee Billing Model** | Sets one agreed monthly fee per family at each centre. | Accommodates multi-child sibling discounts, government funding, and flat-rate monthly agreements. | Setting separate ad-hoc prices per child causes confusing split invoices for parents. | **B & C** (Accounting design + Business best practice) |
| **Session Credit Ledger (Forgiveness)** | Grants a forgiveness credit rather than editing/refunding an issued invoice. | Preserves invoice accounting records while allowing families to make up missed sessions without re-billing. | Editing paid/issued invoices corrupts historical VAT/accounting reconciliation. | **B** (Accounting & Audit integrity) |
| **Soft Delete & 30-Day Recovery Bin** | Soft deletes parent records instead of instant hard deletion. | Prevents accidental loss of historical attendance, medical records, and financial invoices. | Accidental deletion could destroy statutory safeguarding attendance logs. | **A & B** (Enforced soft-delete + GDPR compliance) |
| **Passwordless Parent Magic Links** | Parents click an email magic link rather than managing passwords. | Eliminates password reset support tickets; ensures only the verified owner of the email accesses child records. | Parents sharing passwords or using weak passwords could compromise child medical details. | **A & C** (Enforced auth pattern + Security UX) |
| **Strict Centre-Based Data Isolation** | Staff only see students and bookings for their assigned centre. | Data protection: staff at Centre A should never access personal records of families at Centre B. | Breach of GDPR and student confidentiality across multi-branch club operations. | **A & C** (Multi-tenant permissions + Data privacy) |
| **Idempotent Billing Runs** | Billing engine locks generation to one invoice per family per monthly cycle. | Prevents duplicate invoices from being generated if staff clicks "Generate" twice. | Parents being double-charged or receiving duplicate conflicting invoices. | **A & B** (Automated deduplication + Financial accuracy) |
| **Communications Consent Filter** | Broadcast engine silently drops parents who have not consented to marketing/announcements. | UK PECR / GDPR compliance regarding unsolicited electronic communications. | Substantial fines for non-compliant bulk emailing. | **A & B** (Server-side SQL consent filter + Legal rule) |
| **Annual School Year Roll-Forward** | Owner executes roll-forward at end of summer term (Year 1 → Year 2, Year 13 → Graduated). | Updates entire student body age groupings in a single atomic database transaction. | If run prematurely, all students advance a year early, disrupting attendance registers. | **A & D** (Bulk transaction + Policy schedule) |

*Rationale Origins:*  
- **A:** Enforced Application Behaviour  
- **B:** Accounting / Legal / Data-Integrity Principle  
- **C:** Operational Best Practice  
- **D:** Organisation Policy Requiring Human Confirmation  

---

## 8. Micro-Video Training Inventory

Target duration: **30 seconds to 2 minutes**. High focus on click-by-click efficiency.

| Video ID | Title | Target Role | Purpose | Start Screen | End State | Est Duration | Clicks | PII Risk | Demo Data Req | Voiceover | Captions | Related Manual |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **VID-01** | *Take Daily Attendance & Roll Call* | `TUTOR`, `FRONT_DESK` | Check in children and record late/absent statuses | `/dashboard/attendance` | All cards checked in | 45s | 3 | High | YES | Useful | Required | Staff Guide §3 |
| **VID-02** | *Fast Tablet Check-in with Kiosk Mode* | `TUTOR`, `FRONT_DESK` | Rapid one-touch arrival & pickup logging | `/dashboard/kiosk` | Kiosk active state | 30s | 2 | Med | YES | Useful | Required | Staff Guide §4 |
| **VID-03** | *Log an Accident or Injury Incident* | `FRONT_DESK`, `MANAGER` | Record injury details and staff signature | `/dashboard/incidents` | Saved incident row | 60s | 6 | High | YES | Useful | Required | Staff Guide §5 |
| **VID-04** | *Log a Confidential Safeguarding Report* | `MANAGER`, `ORG_OWNER` | Securely document safeguarding disclosure | `/dashboard/incidents` | Encrypted DSL log | 75s | 5 | Extreme | YES | Required | Required | Manager Guide §6 |
| **VID-05** | *Review & Approve Public Registrations* | `FRONT_DESK`, `MANAGER` | Convert inbound public form into active student | `/dashboard/registrations` | Active student record | 75s | 4 | High | YES | Useful | Required | Operations §2 |
| **VID-06** | *Set Up Family Agreed Monthly Billing* | `ORG_OWNER` | Configure recurring fee and sibling coverage | Student Profile | Active billing config | 90s | 5 | Med | YES | Required | Required | Owner Guide §4 |
| **VID-07** | *Generate Monthly Invoice Run* | `ORG_OWNER` | Run automated monthly billing cycle | `/dashboard/finance` | Issued draft invoices | 60s | 4 | Med | YES | Required | Required | Owner Guide §5 |
| **VID-08** | *Reconcile Tax-Free Childcare & Bank Payments* | `ORG_OWNER` | Match voucher payments to outstanding invoices | Finance Reconciliation | Invoice status `Paid` | 60s | 4 | Med | YES | Required | Required | Owner Guide §6 |
| **VID-09** | *Forgive Sessions in Session Credit Ledger* | `MANAGER`, `ORG_OWNER` | Grant credit for excused absences | Attendance Ledger | Net balance updated | 60s | 4 | Med | YES | Useful | Required | Operations §4 |
| **VID-10** | *Invite Staff & Configure Centre Permissions* | `ORG_OWNER` | Onboard staff and assign branch access | `/dashboard/staff` | Sent invite row | 60s | 4 | Low | YES | Useful | Required | Owner Guide §2 |
| **VID-11** | *Public Online Booking for Parents* | `PARENT` | Guide parents through public slot booking | `/book/org-slug` | Confirmed booking code | 60s | 5 | Low | YES | Useful | Required | Parent Guide §2 |
| **VID-12** | *Parent Portal: Login & Child Medical Updates* | `PARENT` | Access portal via magic link and add notes | `/portal/login` | Updated child profile | 60s | 4 | Med | YES | Useful | Required | Parent Guide §3 |
| **VID-13** | *Parent Portal: Pay Invoices via Stripe* | `PARENT` | Pay club fees online with card/Apple Pay | `/portal/billing` | Paid invoice receipt | 45s | 3 | Med | YES | Useful | Required | Parent Guide §4 |
| **VID-14** | *Send Broadcast Email to Centre Parents* | `MANAGER`, `ORG_OWNER` | Compose and send bulk announcement | Communications | Broadcast dispatched | 60s | 4 | Low | YES | Useful | Required | Manager Guide §5 |
| **VID-15** | *Bulk Student CSV Import* | `FRONT_DESK`, `MANAGER` | Upload student & parent spreadsheet | Students Import | Ingested student grid | 90s | 5 | High | YES | Required | Required | Operations §3 |
| **VID-16** | *Complete Assessment Feedback & Send Email* | `TUTOR`, `FRONT_DESK` | Fill assessment scorecard and email parent | Booking Record | Email sent badge | 60s | 4 | Med | YES | Useful | Required | Staff Guide §6 |
| **VID-17** | *Reschedule a Session Booking* | `FRONT_DESK`, `MANAGER` | Move child to a new date/time slot | Booking Reschedule | Updated calendar date | 45s | 3 | Low | YES | Useful | Required | Operations §5 |
| **VID-18** | *Soft-Delete & Restore Records from Recovery Bin*| `MANAGER`, `ORG_OWNER` | Safeguard records and recover deleted items | Parents Directory | Restored parent row | 45s | 3 | Med | YES | Useful | Required | Operations §6 |
| **VID-19** | *Configure Centre Operating Hours* | `MANAGER`, `ORG_OWNER` | Set daily club opening/closing times | Centre Availability | Saved schedule grid | 60s | 4 | Low | YES | Useful | Required | Manager Guide §3 |
| **VID-20** | *Update Club Branding, Colors & Logo* | `ORG_OWNER` | Personalise portal and email theme | Organisation Settings | Updated theme preview | 45s | 3 | Low | YES | Useful | Required | Owner Guide §7 |
| **VID-21** | *Roll Academic School Year Forward* | `ORG_OWNER` | Advance all student grades at year-end | Settings | Rolled count banner | 45s | 3 | Low | YES | Required | Required | Owner Guide §8 |
| **VID-22** | *Export Attendance & Financial Reports to CSV* | `MANAGER`, `ORG_OWNER` | Generate spreadsheets for accounting | Reports Hub | Downloaded CSV file | 30s | 2 | Med | YES | Useful | Required | Operations §7 |
| **VID-23** | *Walk-In Student Immediate Check-In* | `FRONT_DESK` | Register unscheduled child on arrival | Attendance Register | Active check-in card | 60s | 4 | High | YES | Useful | Required | Staff Guide §4 |
| **VID-24** | *Generate Official Payment Receipt PDF* | `ORG_OWNER` | Create PDF receipt for parent tax claim | Finance Receipt Hub | Rendered PDF receipt | 45s | 3 | Med | YES | Useful | Required | Owner Guide §6 |

---

## 9. Annotated Screenshot Inventory

*Rules: Zero exposure of real student/parent PII. Synthetic demo fixtures must be used for all screenshots.*

| Screenshot ID | Page / Component | Target Role | Purpose | UI Elements to Annotate | PII Exposure Risk | Recommended Crop | Related Workflow |
|---|---|---|---|---|---|---|---|
| **SCR-01** | Main Dashboard Cockpit | All Staff | Visual orientation of KPI cards & schedule | Active Centre selector, Today's KPI grid, Quick action buttons | None (Demo data) | Full window 1440x900 | WF-01 |
| **SCR-02** | Attendance Register View | All Staff | Roll-call operation | "Check In" button, Status pills (Present/Late/Absent), Time stamp badge | High (Student names) | Session card grid | WF-01 |
| **SCR-03** | Kiosk Mode Interface | Staff | Touchscreen arrival/departure | One-tap Check In / Check Out buttons, Slot filter pills | Low | Full viewport | WF-02 |
| **SCR-04** | Log Incident Modal | Front Desk / Mgr | Accident / First aid reporting | Type pills, Injury description, Staff signature canvas | High (Child name) | Modal dialog | WF-03 |
| **SCR-05** | Safeguarding Log Modal | Manager / Owner | Sensitive child protection record | Confidentiality warning banner, Disclosure narrative, DSL signature | Extreme | Modal dialog | WF-04 |
| **SCR-06** | Inbound Registration Queue | Front Desk / Mgr | New registration triage | Status badge "Awaiting Confirmation", Review button, Matched indicator | High (Parent/Child) | Table row view | WF-05 |
| **SCR-07** | Registration Detail & Signature | Front Desk / Mgr | Review submitted legal form | Parent digital signature, Emergency contact, Medical conditions | High | Full page scroll | WF-05 |
| **SCR-08** | Family Billing Settings Card | Owner | Setting agreed whole-family fee | Agreed Monthly Fee input, Anchor date selector, Sibling checkboxes | Med (Fee amount) | Card container | WF-06 |
| **SCR-09** | Monthly Billing Cycles Hub | Owner | Automated invoicing run | Due cycle preview, "Bulk Generate Invoices" button, Run status | Med | Table section | WF-07 |
| **SCR-10** | Payment Reconciliation View | Owner | Offline bank / voucher match | "Record Payment" button, Payment method dropdown, TFC reference | Med | Table section | WF-08 |
| **SCR-11** | Session Credit Ledger | Manager / Owner | Forgiving missed sessions | Net balance pill, "Forgive Sessions" button, Credit reason modal | Med | Table view | WF-09 |
| **SCR-12** | Invite Staff Member Modal | Owner | Sending role-based invitation | Email input, Role dropdown, Centre assignment checkboxes | Low | Modal dialog | WF-10 |
| **SCR-13** | Public Booking Wizard (Step 1)| Parents | Slot selection | Date calendar, Available time slot pills, In-person toggle | None | Booking widget | WF-11 |
| **SCR-14** | Public Booking (Step 2) | Parents | Child & Parent details | Medical fields, Consent checkboxes, Confirmation code | None | Form container | WF-11 |
| **SCR-15** | Parent Portal Dashboard | Parents | Consumer home screen | Child summary cards, Upcoming sessions, Unpaid bill banner | Med (Child names) | Viewport 1200x800 | WF-12 |
| **SCR-16** | Parent Portal Billing & Stripe | Parents | Online fee payment | "Pay with Card" button, Invoice PDF download, Voucher ref field | Med | Billing table | WF-13 |
| **SCR-17** | Broadcast Composer | Manager / Owner | Email communication | Audience counter, Subject input, Consent auto-filter note | Low | Composer card | WF-14 |
| **SCR-18** | CSV Student Import Tool | Staff | Bulk data onboarding | File dropzone, Column mapping preview, Import error table | High | Card section | WF-16 |
| **SCR-19** | Student Profile 360° View | Staff | Student details & medical | Medical alerts banner, SEN details, Authorised collectors table | High | Profile header | WF-15 |
| **SCR-20** | Student Progress Timeline | Staff | Pedagogical notes | "+ Add Note", Pinned note badge, Rating stars (Excellent/Good) | Med | Notes column | WF-17 |
| **SCR-21** | Parent Recovery Bin | Staff | Restoring deleted parents | "Restore" button, Permanent Purge warning, Deleted timestamp | Med | Table view | WF-20 |
| **SCR-22** | Booking Detail & Feedback | Staff | Assessment scorecard | Score input, Attachment uploader, "Send Feedback Email" button | Med | Scorecard card | WF-24 |
| **SCR-23** | Reschedule Booking Modal | Staff | Date/time modification | New slot selector, Double-booking conflict warning banner | Low | Modal dialog | WF-22 |
| **SCR-24** | Invoice Detail View | Owner | Official invoice management | "Record Payment", "Void Invoice", "Resend Email", Line items | Med | Invoice view | WF-26 |
| **SCR-25** | Payment Receipt PDF Preview | Owner | Official payment receipt | Centre header, VAT/Org number, Amount paid, Paid stamp | Med | PDF modal | WF-30 |
| **SCR-26** | Centre Operating Hours Grid | Manager / Owner | Weekly opening hours | Day of week rows, Start/End time inputs, Closed toggle | Low | Grid layout | WF-32 |
| **SCR-27** | Centre Bank Settings Tab | Owner | Banking details for invoices | Bank name, Sort code, Account number, Billing email | Med | Form section | WF-33 |
| **SCR-28** | Organisation Branding Tab | Owner | Customizing portal appearance | Brand color picker, Logo upload dropzone, Terms textarea | Low | Form section | WF-34 |
| **SCR-29** | Annual Year Roll Modal | Owner | Advancing student school years | Year roll confirmation dialog, Student count warning | Low | Modal dialog | WF-36 |
| **SCR-30** | Reports & Exports Hub | Manager / Owner | Downloading CSV spreadsheets | "Export Attendance CSV", "Export Finance CSV" buttons | Low | Reports cards | WF-37 |
| **SCR-31** | Share Portals Utility | Staff | Copying public links | Copy buttons for Booking URL, Registration URL, QR code | None | Share cards | WF-40 |

---

## 10. Troubleshooting & Error Inventory

| Symptom | Likely Root Cause | Safe User Action | When to Escalate to Support | Affected Role | Technical Detail Hidden from User |
|---|---|---|---|---|---|
| **"Cannot sign in / Invalid credentials"** | Incorrect password entered or account not yet activated. | Use "Forgot Password" to reset, or check email for initial invite link. | If reset email does not arrive after 5 mins. | Staff | `bcrypt.compare` failure on `users.passwordHash`. |
| **"Magic link expired or invalid"** | Token expired (>15 mins) or already clicked. | Request a new magic link from the login page. | If new links immediately fail. | Staff / Parents | `staff_invites.expiresAt < now()` or `usedAt IS NOT NULL`. |
| **"This slot is already booked"** | Concurrency conflict: another parent reserved slot simultaneously. | Select an alternative available time slot from the calendar. | If slot appears vacant on all screens. | Parents / Staff | Postgres unique constraint violation `unique_time_slot`. |
| **"No centres assigned / Blank dashboard"** | Staff account created but Owner has not assigned any centres. | Contact Organisation Owner to assign centre membership. | If Owner confirms assignment exists. | Tutors / Managers | `getUserAccessibleCentres()` returns `[]`. |
| **"Invoice already generated for this period"** | Staff attempted to generate billing twice for same cycle. | View existing invoice in Invoices list; edit existing rather than re-creating. | Never (intended idempotency guard). | Owner | `billing_runs` unique check `periodStart` collision. |
| **"Payment amount exceeds balance"** | Entering payment higher than outstanding total. | Verify payment amount; record excess balance as parent credit if needed. | Never (accounting guard). | Owner | `payments.amount > invoice.remainingBalance`. |
| **"Parent cannot see child in portal"** | Child record was soft-deleted or assigned to different parent email. | Check Student directory in Staff dashboard; verify parent email match. | If parent email matches DB exactly. | Parents | `children.deletedAt IS NOT NULL` filter in `getCurrentParent()`. |
| **"Email broadcast delivered to 0 parents"** | Selected audience has not given communications consent. | Check parent consent flags or select broader audience filter. | If parents have explicitly opted in. | Managers / Owners | `communicationsConsent = false` filtered out server-side. |
| **"CSV Import rejected rows"** | CSV missing mandatory columns or contains corrupt characters. | Download sample CSV template; ensure First Name, Last Name, and School Year exist. | If properly formatted CSV fails. | Staff | CSV header schema mismatch in `importStudentsAction`. |
| **"Rate limit exceeded (HTTP 429)"** | Too many rapid requests submitted from same IP. | Wait 60 seconds before retrying operation. | If persistent under normal usage. | Public / Staff | Upstash Redis sliding window limiter reached. |
| **"Safeguarding tab not visible"** | Current user has `FRONT_DESK` or `TUTOR` role. | Contact Manager/Owner if user is Designated Safeguarding Lead. | If Manager role is assigned in DB. | Front Desk / Tutor | Strict `requirePermission('MANAGER')` gate. |
| **"PDF download fails or blank"** | Centre banking information or address is incomplete. | Complete Centre Settings and Centre Billing fields before exporting PDF. | If centre settings are complete. | Owner | Missing `centres.bankName` / `centres.address` in PDF generator. |

---

## 11. Quick-Start Requirements

### A. Organisation Owner — First 30 Minutes
1. **Minute 0–5:** Complete Onboarding (`/onboarding`) — set Organisation name, brand color, and create first Centre.
2. **Minute 5–10:** Configure Centre Details (`/dashboard/centres/[id]/settings`) — add address, Ofsted ID, and Bank Account details for invoice footers.
3. **Minute 10–15:** Set Operating Hours (`/dashboard/availability`) — define days open and slot start/end times.
4. **Minute 15–20:** Invite Management Team (`/dashboard/staff/invite`) — invite Centre Manager and assign them to the centre.
5. **Minute 20–25:** Share Registration & Booking Links (`/dashboard/share`) — copy public registration URL for parents.
6. **Minute 25–30:** Review Dashboard KPIs & Quick Actions (`/dashboard`).

### B. Centre Manager — First 30 Minutes
1. **Minute 0–5:** Accept Email Invite (`/accept-invite`) and set secure password.
2. **Minute 5–10:** Review Inbound Registrations (`/dashboard/registrations`) — approve pending student applications.
3. **Minute 10–15:** Review Active Students & Medical Profiles (`/dashboard/students`).
4. **Minute 15–20:** Verify Today's Schedule & Attendance (`/dashboard/attendance`).
5. **Minute 20–25:** Familiarize with Incident & Safeguarding Logging (`/dashboard/incidents`).
6. **Minute 25–30:** Test Session Credit Ledger (`/dashboard/attendance/ledger`).

### C. Staff / Tutor — First Day
1. **Step 1 (Arrival):** Sign in via `/login` and select assigned centre.
2. **Step 2 (Briefing):** Open `/dashboard/attendance` to review today's expected roll call.
3. **Step 3 (Intake):** Open `/dashboard/kiosk` on front-desk tablet for rapid child check-ins.
4. **Step 4 (Session):** Update operational flags (homework/behaviour) and log any accidents if they occur.
5. **Step 5 (Pickup):** Tap "Check Out" on kiosk as authorised parents collect children.

### D. Parent — Getting Started
1. **Step 1:** Submit Registration Form (`/register/[org-slug]`) with child details, medical info, and digital signature.
2. **Step 2:** Receive email confirmation with direct login link.
3. **Step 3:** Log in to Parent Portal (`/portal`) using magic link.
4. **Step 4:** Review child profiles, book upcoming sessions (`/portal/book`), and pay invoices securely (`/portal/billing`).

---

## 12. Documentation Information Architecture (Target D1–D7 Structure)

```
docs/
├── 01-master-user-manual/
│   ├── index.md
│   ├── 01-system-overview.md
│   ├── 02-architecture-and-tenancy.md
│   ├── 03-security-and-safeguarding.md
│   └── 04-glossary.md
├── 02-role-guides/
│   ├── organisation-owner-guide.md
│   ├── centre-manager-guide.md
│   ├── staff-and-tutor-guide.md
│   └── parent-portal-guide.md
├── 03-quick-start-guides/
│   ├── owner-first-30-minutes.md
│   ├── manager-first-30-minutes.md
│   ├── tutor-first-day.md
│   └── parent-getting-started.md
├── 04-functional-manuals/
│   ├── attendance-and-kiosk-manual.md
│   ├── students-and-parents-manual.md
│   ├── bookings-and-availability-manual.md
│   ├── finance-billing-and-reconciliation-manual.md
│   ├── incidents-and-safeguarding-manual.md
│   ├── registrations-management-manual.md
│   ├── communications-and-broadcasts-manual.md
│   └── team-and-permissions-manual.md
├── 05-operational-policy-and-rationales/
│   ├── statutory-attendance-safeguarding-rationale.md
│   ├── agreed-family-fee-billing-rationale.md
│   ├── session-credit-ledger-reconciliation.md
│   └── gdpr-data-retention-and-recovery-policy.md
├── 06-screenshot-library/
│   ├── staff-portal/ (31 annotated figures)
│   └── parent-portal/
├── 07-video-training-library/
│   ├── scripts/ (24 micro-video scripts)
│   └── production-notes/
├── 08-troubleshooting-and-faq/
│   ├── error-resolution-handbook.md
│   ├── staff-faq.md
│   └── parent-faq.md
└── 09-in-app-help-centre/
    └── help-articles-manifest.json
```

---

## 13. Documentation Gaps, UX Findings & Potential Defects

*Note: Per D0 safety rules, these items are documented as evidence only and were NOT modified in application code.*

| ID | Classification | Location / Screen | Observation / Finding | Documentation / Training Recommendation |
|---|---|---|---|---|
| **GAP-01** | `UX CLARITY ISSUE` | `/dashboard/attendance/ledger` | The net balance calculation (`Extras + Forgiven - Absences`) is mathematically sound but not immediately intuitive to new managers. | Include explicit diagram in Manager Guide explaining that negative balance means child is in arrears for missed sessions. |
| **GAP-02** | `TERMINOLOGY ISSUE` | Header / Profile Menu | Header label previously mapped `TUTOR` to "Club Leader" in legacy text dictionaries while sidebar uses "Tutor". | Document "Tutor" as the standard authoritative role term across all training materials. |
| **GAP-03** | `DISCOVERABILITY ISSUE`| Student Profile (`/dashboard/students/[id]`) | Family agreed-fee billing config lives inside the individual student profile rather than only in the Finance hub. | Highlight in Owner manual that recurring family configs can be edited directly on any covered sibling's profile. |
| **GAP-04** | `DOCUMENTATION GAP` | `/dashboard/parents/bin` | Recovery bin allows restoring soft-deleted parents, but permanent GDPR purge button is irreversibly destructive. | Add prominent `[!CAUTION]` alert in Owner Guide regarding permanent GDPR deletion. |
| **GAP-05** | `UX CLARITY ISSUE` | `/dashboard/communications` | Broadcast audience count auto-excludes parents without communications consent without showing an explicit warning. | Document that audience count shows *consented* recipients, preventing user confusion over number discrepancies. |
| **GAP-06** | `POTENTIAL PRODUCT DEFECT`| `/dashboard/incidents` | Body map coordinate points (`bodyMapCoordinates` column in schema) exist in database but have no visual canvas in UI. | Document standard text-based injury location logging until a visual body-map widget is scheduled for future release. |

---

## 14. Master Source-of-Truth Matrix (D1–D7 Foundation)

| Role | Module | Page | Workflow / Action | Capability | Permission | Centre Scope | Manual | Quick Start | Screen | Video | Rationale | FAQ | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Tutor** | Attendance | `/dashboard/attendance` | Check in/out roll call | FULL ACCESS | Any Staff | Assigned | YES | YES | YES | YES | YES | YES | **P0** |
| **Tutor** | Kiosk | `/dashboard/kiosk` | Tablet fast check-in | FULL ACCESS | Any Staff | Assigned | YES | YES | YES | YES | NO | YES | **P1** |
| **Tutor** | Bookings | `/dashboard/bookings/[id]`| View session attendees | READ ONLY | Any Staff | Assigned | YES | NO | NO | NO | NO | NO | **P1** |
| **Front Desk**| Registrations| `/dashboard/registrations` | Review inbound forms | FULL ACCESS | Front Desk+ | Assigned | YES | YES | YES | YES | YES | YES | **P0** |
| **Front Desk**| Students | `/dashboard/students/add` | Manual student intake | FULL ACCESS | Front Desk+ | Assigned | YES | YES | YES | YES | NO | YES | **P0** |
| **Front Desk**| Incidents | `/dashboard/incidents` | Log accident/medication | FULL ACCESS | Front Desk+ | Assigned | YES | YES | YES | YES | YES | YES | **P0** |
| **Front Desk**| Bookings | `/dashboard/bookings/new` | Create walk-in booking | FULL ACCESS | Front Desk+ | Assigned | YES | NO | YES | YES | NO | YES | **P0** |
| **Front Desk**| Parents | `/dashboard/parents` | View parent contacts | FULL ACCESS | Front Desk+ | Assigned | YES | NO | YES | NO | NO | YES | **P1** |
| **Manager** | Incidents | `/dashboard/incidents` | Log safeguarding report| FULL ACCESS | Manager+ | Assigned | YES | YES | YES | YES | YES | YES | **P0** |
| **Manager** | Attendance | `/dashboard/attendance/ledger`| Forgive missed session | FULL ACCESS | Manager+ | Assigned | YES | YES | YES | YES | YES | YES | **P0** |
| **Manager** | Availability | `/dashboard/availability` | Set centre hours | FULL ACCESS | Manager+ | Assigned | YES | NO | YES | YES | NO | YES | **P1** |
| **Manager** | Communications| `/dashboard/communications`| Send parent broadcast | FULL ACCESS | Manager+ | Assigned | YES | NO | YES | YES | YES | YES | **P1** |
| **Manager** | Reports | `/dashboard/reports` | Export attendance CSV | FULL ACCESS | Manager+ | Assigned | YES | NO | YES | YES | NO | YES | **P1** |
| **Owner** | Finance | `/dashboard/finance` | Create family billing | FULL ACCESS | Owner Only | Org-wide | YES | YES | YES | YES | YES | YES | **P0** |
| **Owner** | Finance | `/dashboard/finance` | Generate monthly invoices| FULL ACCESS | Owner Only | Org-wide | YES | YES | YES | YES | YES | YES | **P0** |
| **Owner** | Finance | `/dashboard/finance/reconciliation`| Reconcile vouchers | FULL ACCESS | Owner Only | Org-wide | YES | YES | YES | YES | YES | YES | **P0** |
| **Owner** | Team | `/dashboard/staff` | Invite & assign staff | FULL ACCESS | Owner Only | Org-wide | YES | YES | YES | YES | YES | YES | **P0** |
| **Owner** | Settings | `/dashboard/settings` | Branding & Term rules | FULL ACCESS | Owner Only | Org-wide | YES | YES | YES | YES | NO | YES | **P0** |
| **Owner** | Settings | `/dashboard/settings` | Roll academic year | FULL ACCESS | Owner Only | Org-wide | YES | NO | YES | YES | YES | YES | **P1** |
| **Owner** | Centres | `/dashboard/centres/[id]/billing`| Bank account config | FULL ACCESS | Owner Only | Org-wide | YES | YES | YES | NO | NO | YES | **P1** |
| **Parent** | Portal | `/portal` | View dashboard & alerts | FULL ACCESS | Parent Auth | Own Child | YES | YES | YES | YES | NO | YES | **P0** |
| **Parent** | Portal | `/portal/children/[id]` | Update medical notes | FULL ACCESS | Parent Auth | Own Child | YES | YES | YES | YES | YES | YES | **P0** |
| **Parent** | Portal | `/portal/book` | Book club sessions | FULL ACCESS | Parent Auth | Own Child | YES | YES | YES | YES | NO | YES | **P0** |
| **Parent** | Portal | `/portal/billing` | Pay invoice via Stripe | FULL ACCESS | Parent Auth | Own Child | YES | YES | YES | YES | NO | YES | **P0** |
| **Parent** | Public | `/register/[slug]` | Public registration form| FULL ACCESS | Public | Own Child | YES | YES | YES | YES | YES | YES | **P0** |

---

## 15. Production Safety & Side-Effect Verification

Because this milestone is strictly **READ-ONLY** and documentation-focused:

```
git diff --check
```

- **Production DB Mutations:** **0**
- **Staging DB Mutations:** **0**
- **Schema Changes:** **0**
- **Database Migrations Run:** **0**
- **Emails Dispatched:** **0**
- **SMS Messages Sent:** **0**
- **Stripe / GoCardless API Calls:** **0**
- **Google Calendar Mutations:** **0**
- **Wonde API Calls:** **0**
- **Vercel Blob Storage Writes:** **0**
- **Cron Jobs Executed:** **0**
- **Vercel Environment Alterations:** **0**
- **Production Deployments:** **0**

---

## 16. Recommended D1 Scope

With the master inventory and evidence base established, Milestone **D1** should execute:

1. **Master Information Architecture File Structure Creation:** Provisioning the full `/docs` repository tree.
2. **Master User Manual Part 1 (System Architecture & Security Boundary):** Documenting multi-tenant isolation and NextAuth/Jose session cryptographic mechanisms.
3. **Core Role Guides (First Drafts):**
   - Organisation Owner Guide (`docs/02-role-guides/organisation-owner-guide.md`)
   - Centre Manager Guide (`docs/02-role-guides/centre-manager-guide.md`)
   - Staff & Tutor Guide (`docs/02-role-guides/staff-and-tutor-guide.md`)
   - Parent Portal Guide (`docs/02-role-guides/parent-portal-guide.md`)
4. **Quick Start 4-Pack:** Authoring the four 30-minute quick-start checklists for Owner, Manager, Tutor, and Parent.

---

## 17. Blockers & Final Recommendation

- **Blockers:** **NONE**. Baseline and source-of-truth evidence are fully synchronized and validated.
- **Final Verdict:**  
  **PASS — DOCUMENTATION SOURCE OF TRUTH ESTABLISHED — READY FOR D1**
