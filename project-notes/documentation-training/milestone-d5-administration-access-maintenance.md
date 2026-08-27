# SprintScale CMS — Milestone D5: Functional User Manuals
## Administration, Multi-Centre Settings, Staff & Access, Parent Communications, Academic-Year Roll & Data Maintenance

**Document Type:** Milestone Completion Report & Administration Documentation Baseline  
**Milestone:** D5 (Functional User Manuals: Administration & Operations)  
**Authoritative Starting SHA:** `7d4e5b0`  
**Branch:** `rebuild/cms-modernisation`  
**Phase-7 Reference Tag:** `cms-modernisation-phase7-complete` (`0c03442`)  
**Date:** 2026-08-27  
**Status:** COMPLETE — 50/50 ADVERSARIAL PASS — ZERO CODE MUTATION  

---

## 1. Executive Verdict

**PASS — ADMINISTRATION, ACCESS & MAINTENANCE DOCUMENTATION COMPLETE — READY FOR D6**

Milestone D5 has successfully established the authoritative, source-grounded functional user manuals, master administration journey, operational rationales, D6-ready video scripts, screenshot specifications, and troubleshooting handbooks covering the multi-centre administration and access layer of SprintScale CMS.

- **10 New Documentation Deliverables Created:** 5 functional deep-dive manuals (`administration-settings.md`, `centres-multi-centre.md`, `staff-access-permissions.md`, `communications-notifications.md`, `academic-year-data-maintenance.md`), Master Manual Part 5 (Administration and Operations), Operational Rationale Library (13 administrative integrity controls), 14 micro-video scripts (8 essential), 18 screenshot specifications, and 20 troubleshooting scenarios.
- **Zero Application Code Changes:** `src/`, `drizzle/`, `migrations/`, `package.json`, and deployment configs remain 100% untouched.
- **Zero Production/Staging Side Effects:** 0 DB mutations, 0 emails, 0 SMS, 0 external provider calls, 0 schema changes, 0 deployments.
- **Strict Data Protection & Security:** Zero real staff, parent, child, or invitation token PII exposed; standardized synthetic demo accounts used exclusively.
- **Source-Truth Reconciled:** Verified exact server-side gates across all 4 roles, centre membership isolation, Resend email dispatch, server-side communications consent re-derivation, September 1st rollover cron (`/api/cron/school-year-roll`), 30-day Recovery Bin (`purgeStaleBinItems`), and structured audit logging.
- **50/50 Adversarial Matrix:** 50 SAFE, 0 DEBT, 0 DEFECT, 0 BLOCKED.

---

## 2. Milestone Deliverables Summary

| Deliverable | File Path | Scope & Key Contents | Status |
|---|---|---|---|
| **Functional Manual: Organisation Settings** | [`functional-manuals/administration-settings.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/administration-settings.md) | Organisation profile, GDPR data export (`exportOrganisationData`), integration surface classifications, and system limits. | **COMPLETE** |
| **Functional Manual: Multi-Centre Administration** | [`functional-manuals/centres-multi-centre.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/centres-multi-centre.md) | Venue directory, creation (`/dashboard/centres/add`), operating session slots, bank details, and multi-site access scoping. | **COMPLETE** |
| **Functional Manual: Staff Access & Permissions** | [`functional-manuals/staff-access-permissions.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/staff-access-permissions.md) | Team roster, 7-day cryptographic email invitations, role updates, centre memberships, safe deactivation, and historical attribution. | **COMPLETE** |
| **Functional Manual: Communications & Notifications** | [`functional-manuals/communications-notifications.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/communications-notifications.md) | Parent email broadcasts (`sendBroadcast`), server-side consent filtering, Resend dispatch, Twilio status, and in-app header alerts. | **COMPLETE** |
| **Functional Manual: Academic Year & Maintenance** | [`functional-manuals/academic-year-data-maintenance.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/academic-year-data-maintenance.md) | School year progression, Sept 1st cron rollover, 30-day Recovery Bin, soft deletion, and permanent purge controls. | **COMPLETE** |
| **Master Manual (Part 5)** | [`master-manual/05-administration-and-operations.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/master-manual/05-administration-and-operations.md) | End-to-end administrative lifecycle: Org → Centres → Staff → Roles → Memberships → Comms → Rollover → Data Maintenance. | **COMPLETE** |
| **Operational Rationale Library** | [`rationale/administration-access-data-integrity.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/rationale/administration-access-data-integrity.md) | 13 operational rationales covering least privilege, centre isolation, historical attribution preservation, and consent re-derivation. | **COMPLETE** |
| **Micro-Video Scripts** | [`videos/d5-video-scripts.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/videos/d5-video-scripts.md) | 14 D6-ready screencast scripts with timelines, narrations, synthetic data fixtures, and UI callouts. | **COMPLETE** |
| **Screenshot Plan** | [`screenshots/d5-screenshot-plan.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/screenshots/d5-screenshot-plan.md) | 18 annotated screenshot specifications with route mappings, crop guidance, and badge numbering. | **COMPLETE** |
| **Troubleshooting Handbook** | [`troubleshooting/d5-administration-troubleshooting.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/troubleshooting/d5-administration-troubleshooting.md) | 20 detailed operational scenarios covering staff invites, permissions, centre access, broadcasts, and data recovery. | **COMPLETE** |
| **Master Documentation Index** | [`README.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/README.md) | Updated with full navigation, cross-links, and roadmap progress tracking. | **COMPLETE** |

---

## 3. Comprehensive Server-Side Role Matrix

| System Capability | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) | Evidence Source |
|---|---|---|---|---|---|---|
| **Global Settings (`/settings`)** | FULL | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `src/app/dashboard/settings/page.tsx` |
| **GDPR JSON Export** | FULL | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `exportOrganisationData` |
| **View Centres Directory** | FULL | ASSIGNED CENTRES | ASSIGNED CENTRES | BLOCKED | NOT AVAILABLE | `src/app/dashboard/centres/page.tsx` |
| **Create New Centre** | FULL | FULL | BLOCKED | BLOCKED | NOT AVAILABLE | `createCentre` |
| **Edit Centre General Settings** | FULL | ASSIGNED CENTRES | BLOCKED | BLOCKED | NOT AVAILABLE | `updateCentreAction` |
| **Edit Centre Bank Details** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `updateCentreAction` |
| **Staff Directory (`/staff`)** | FULL | VIEW ONLY | BLOCKED | BLOCKED | NOT AVAILABLE | `src/app/dashboard/staff/page.tsx` |
| **Invite Staff (`/staff/invite`)** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `/api/staff/invite` |
| **Change Staff Role / Remove** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `updateStaffRole` / `/api/staff/remove` |
| **Send Parent Broadcasts** | FULL | ASSIGNED CENTRES | BLOCKED | BLOCKED | NOT AVAILABLE | `sendBroadcast` |
| **Attendance & Tablet Kiosk** | FULL | ASSIGNED CENTRES | ASSIGNED CENTRES | ASSIGNED (Live) | NOT AVAILABLE | `src/features/attendance/actions.ts` |
| **Restricted Safeguarding Files** | FULL | ASSIGNED CENTRES | BLOCKED | BLOCKED | NOT AVAILABLE | `src/features/incidents/actions.ts` |
| **Global Finance Dashboard** | FULL | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `src/app/dashboard/finance/page.tsx` |
| **Record Offline Payments** | FULL | ASSIGNED CENTRES | ASSIGNED CENTRES | BLOCKED | NOT AVAILABLE | `recordPayment` |
| **Void / Delete Invoices** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `voidInvoice` / `deleteInvoice` |
| **Recovery Bin & Restore** | FULL | ASSIGNED CENTRES | ASSIGNED CENTRES | BLOCKED | NOT AVAILABLE | `restoreParent` / `softDeleteParent` |
| **Permanent Purge** | FULL | ASSIGNED CENTRES | ASSIGNED CENTRES | BLOCKED | NOT AVAILABLE | `hardDeleteParent` |
| **Parent Portal (`/portal`)** | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | OWN FAMILY ONLY | `src/app/portal/` |

---

## 4. Production Side-Effect Audit

As mandated by the specification:
- Production DB INSERTs = **0**
- Production DB UPDATEs = **0**
- Production DB DELETEs = **0**
- Staging mutations = **0**
- Schema changes = **0**
- Database migrations = **0**
- Emails dispatched = **0**
- SMS messages sent = **0**
- Stripe / GoCardless / Twilio / Wonde API calls = **0**
- Google Calendar mutations = **0**
- Vercel Blob storage writes = **0**
- Cron jobs executed = **0**
- Environment variable changes = **0**
- Production deployments = **0**

---

## 5. 50-Question Adversarial Acceptance Matrix

| # | Adversarial Audit Question | Classification | Evidence & Notes |
|---|---|---|---|
| 1 | Did D5 start exactly from SHA `7d4e5b0`? | **SAFE** | Confirmed via `git rev-parse --short HEAD`. |
| 2 | Was the working tree clean? | **SAFE** | Confirmed via `git status`. |
| 3 | Was the documentation contract followed? | **SAFE** | D1 style guide, canonical terms, and alert hierarchy preserved. |
| 4 | Was organisation model verified in source? | **SAFE** | Verified `organisations` schema and settings actions. |
| 5 | Was centre creation capability verified? | **SAFE** | `createCentre` allows `ORG_OWNER` and `MANAGER`. |
| 6 | Were centre general settings verified? | **SAFE** | `updateCentreAction` allows `ORG_OWNER` and `MANAGER`. |
| 7 | Were centre bank details restricted to Owner? | **SAFE** | Verified `isUpdatingBankDetails` throws if not `ORG_OWNER`. |
| 8 | Was centre deletion limitation documented? | **SAFE** | Self-service deletion omitted to protect historical audit dependencies. |
| 9 | Was staff invitation workflow verified? | **SAFE** | `/api/staff/invite` verified: 7-day token hash, Resend email. |
| 10 | Was staff invitation restricted to Owner? | **SAFE** | `currentUser.role !== 'ORG_OWNER'` throws 403. |
| 11 | Was staff role change restricted to Owner? | **SAFE** | `updateStaffRole` verifies `currentUser.role === 'ORG_OWNER'`. |
| 12 | Was staff self-role-change blocked? | **SAFE** | `targetUserId === session.user.id` check verified. |
| 13 | Was staff deactivation verified? | **SAFE** | `/api/staff/remove` deletes `centreMemberships`, sets `orgId = null`. |
| 14 | Was owner deactivation safeguard verified? | **SAFE** | Cannot remove another `ORG_OWNER` without demoting first. |
| 15 | Was historical staff attribution preserved? | **SAFE** | Attendance, notes, incidents retain original user ID foreign keys. |
| 16 | Was centre scoping verified for non-owners? | **SAFE** | `assertCentreAccess` checks `centreMemberships`. |
| 17 | Was parent broadcast capability verified? | **SAFE** | `sendBroadcast` restricted to `ORG_OWNER` and `MANAGER`. |
| 18 | Was communications consent re-derived server-side? | **SAFE** | `COALESCE(bool_or(bookings.communicationsConsent), false)` verified. |
| 19 | Were unconsented parents excluded from broadcast? | **SAFE** | Filtered server-side before queue insertion. |
| 20 | Was operational email exemption documented? | **SAFE** | Invoices, magic links, emergency reports documented as operational. |
| 21 | Was Resend email dispatch verified? | **SAFE** | Async background task with HTML escaping verified. |
| 22 | Was Twilio SMS classified as deferred? | **SAFE** | Classified as Ready to Activate / Deferred in production. |
| 23 | Was in-app notification bell verified? | **SAFE** | `NotificationBell.tsx` with `notifications` table verified. |
| 24 | Was school year rollover cron verified? | **SAFE** | `/api/cron/school-year-roll` running on September 1st verified. |
| 25 | Was rollover grade progression verified? | **SAFE** | Nursery $\to$ Reception $\to$ 1..13 $\to$ Graduated verified in code. |
| 26 | Was rollover historical integrity verified? | **SAFE** | Past session registers and invoices remain untouched. |
| 27 | Was Recovery Bin verified in source? | **SAFE** | `/dashboard/parents/bin` and `softDeleteParent` verified. |
| 28 | Was 30-day Recovery Bin retention verified? | **SAFE** | `purgeStaleBinItems` deletes `deleted_at < NOW() - 30 days`. |
| 29 | Was record restore capability verified? | **SAFE** | `restoreParent` resets `deletedAt = null` for parent & children. |
| 30 | Was permanent purge verified? | **SAFE** | `hardDeleteParent` executes irreversible cascading delete. |
| 31 | Was permanent purge caution-flagged? | **SAFE** | Documented with `[!CAUTION]` alert in manuals. |
| 32 | Was GDPR organisation export verified? | **SAFE** | `exportOrganisationData` aggregates all JSON data for Owner. |
| 33 | Was Wonde classified as not required? | **SAFE** | Documented as deferred/not required for standalone CMS use. |
| 34 | Was Google Calendar classified as deferred? | **SAFE** | Documented as deferred in production. |
| 35 | Was Stripe card payment classified as deferred? | **SAFE** | Documented as Code Complete / Deferred in production. |
| 36 | Was GoCardless classified as deferred? | **SAFE** | Documented as Code Complete / Deferred in production. |
| 37 | Was Sentry error monitoring documented? | **SAFE** | Documented as active runtime monitoring. |
| 38 | Was UptimeRobot health monitoring documented? | **SAFE** | Documented as live external health monitor. |
| 39 | Were 13 operational rationales documented? | **SAFE** | Articulated in `administration-access-data-integrity.md`. |
| 40 | Were 14 micro-video scripts created? | **SAFE** | Second-by-second timeline scripts provided. |
| 41 | Were 8 essential video scripts prioritized? | **SAFE** | Core admin, venue, staff, and recovery tasks marked essential. |
| 42 | Were 18 screenshot specifications created? | **SAFE** | Complete D6-ready plan with annotations provided. |
| 43 | Were 20 troubleshooting scenarios covered? | **SAFE** | Practical resolution handbook provided. |
| 44 | Were documentation gaps identified? | **SAFE** | 0 gaps; all current admin features covered. |
| 45 | Were UX findings recorded? | **SAFE** | 0 new UX blockers. |
| 46 | Were potential product defects checked? | **SAFE** | 0 defects discovered. |
| 47 | Were deferred features clearly marked? | **SAFE** | Twilio, Wonde, Stripe, GoCardless, Google Calendar marked. |
| 48 | Was PII 100% excluded? | **SAFE** | Clean synthetic fixtures used across all manuals. |
| 49 | Were all markdown relative links validated? | **SAFE** | 100% of internal links resolve. |
| 50 | Is D5 safe to freeze and proceed to D6? | **SAFE** | All deliverables complete, verified, and unpushed. |

### Adversarial Arithmetic
- **SAFE:** **50 / 50 (100%)**
- **DEBT:** **0**
- **DEFECT:** **0**
- **BLOCKED:** **0**
- **NOT APPLICABLE:** **0**

---

## 6. Recommended D6 Scope

With all foundational and functional manuals (D0–D5) complete, Milestone **D6** will execute:

1. **Visual Screenshot Asset Generation:** Capturing and annotating all 90+ specifications established across D2, D3, D4, and D5 plans.
2. **Micro-Video Screencast Production:** Recording and synchronizing all 57 micro-video scripts across the core user journeys.

---

## 7. Final Recommendation

**PASS — ADMINISTRATION, ACCESS & MAINTENANCE DOCUMENTATION COMPLETE — READY FOR D6**
