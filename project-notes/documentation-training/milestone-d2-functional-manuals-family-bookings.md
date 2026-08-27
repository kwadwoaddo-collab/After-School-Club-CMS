# SprintScale CMS — Milestone D2: Functional User Manuals
## Parents, Children/Students, Registrations & Bookings

**Document Type:** Milestone Completion Report & Functional Documentation Baseline  
**Milestone:** D2 (Functional User Manuals: Family-to-Booking Lifecycle)  
**Authoritative Starting SHA:** `8554e29`  
**Branch:** `rebuild/cms-modernisation`  
**Phase-7 Reference Tag:** `cms-modernisation-phase7-complete` (`0c03442`)  
**Date:** 2026-08-27  
**Status:** COMPLETE — 50/50 ADVERSARIAL PASS — ZERO CODE MUTATION  

---

## 1. Executive Verdict

**PASS — FAMILY, REGISTRATION & BOOKING DOCUMENTATION COMPLETE — READY FOR D3**

Milestone D2 has successfully established the authoritative, detailed functional manuals for the entire family-to-booking operational lifecycle across Parents, Children/Students, Registrations, and Bookings.

- **9 New Documentation Deliverables Created:** 4 functional deep-dive manuals, Master Manual Part 2 (Family-to-Booking Journey), Operational Rationale Library (15 legal/security controls), 14 micro-video scripts (7 essential), 16 screenshot specifications, and 15 troubleshooting scenarios.
- **Zero Application Code Changes:** `src/`, `drizzle/`, `migrations/`, `package.json`, and deployment configs remain 100% untouched.
- **Zero Production/Staging Side Effects:** 0 DB mutations, 0 emails, 0 SMS, 0 Stripe/GoCardless calls, 0 schema changes, 0 deployments.
- **Strict Data Protection:** Zero real parent, child, medical, or financial PII exposed; standardized synthetic demo accounts used exclusively.
- **Source-Truth Reconciled:** Every documented click sequence, form validation rule, database transition (`awaiting_confirmation` → `signed_up`, `confirmed` → `cancelled`), slot uniqueness constraint (`unique_time_slot`), and role permission gate is verified against active source code.
- **50/50 Adversarial Matrix:** 50 SAFE, 0 DEBT, 0 DEFECT, 0 BLOCKED.

---

## 2. Milestone Deliverables Summary

| Deliverable | File Path | Scope & Key Contents | Status |
|---|---|---|---|
| **Functional Manual: Parents** | [`functional-manuals/parents.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/parents.md) | Family directory, contact records, GDPR marketing consent, sibling linking, 30-day soft deletion, and permanent GDPR erasure. | **COMPLETE** |
| **Functional Manual: Children / Students** | [`functional-manuals/children-students.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/children-students.md) | Pupil 360°, bulk CSV import, medical alerts (EpiPen, Asthma), dietary badges, parental consents, authorised collectors, and operational flags. | **COMPLETE** |
| **Functional Manual: Registrations** | [`functional-manuals/registrations.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/registrations.md) | Public intake form, rate limiting, CRM duplicate matching, review queue triage, approval state transitions, and welcome notifications. | **COMPLETE** |
| **Functional Manual: Bookings & Scheduling** | [`functional-manuals/bookings.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/functional-manuals/bookings.md) | Public wizards, portal bookings, staff & walk-in creation, slot capacity, `unique_time_slot` constraint, rescheduling, and scorecards. | **COMPLETE** |
| **Master Manual (Part 2)** | [`master-manual/02-family-to-booking-journey.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/master-manual/02-family-to-booking-journey.md) | End-to-end 6-stage lifecycle narrative: Enquiry → Registration → Triage → Approval → Booking → Attendance → Billing. | **COMPLETE** |
| **Operational Rationale Library** | [`rationale/family-registration-booking-controls.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/rationale/family-registration-booking-controls.md) | 15 detailed operational rationales covering Ofsted statutory care, DSL confidentiality, multi-tenancy, and data protection. | **COMPLETE** |
| **Micro-Video Scripts** | [`videos/d2-video-scripts.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/videos/d2-video-scripts.md) | 14 D6-ready screencast scripts with second-by-second timelines, narrations, synthetic demo data, and UI highlight callouts. | **COMPLETE** |
| **Screenshot Plan** | [`screenshots/d2-screenshot-plan.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/screenshots/d2-screenshot-plan.md) | 16 annotated screenshot specifications with route mappings, synthetic data fixtures, crop guidance, and badge numbering. | **COMPLETE** |
| **Troubleshooting Handbook** | [`troubleshooting/d2-family-booking-troubleshooting.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/troubleshooting/d2-family-booking-troubleshooting.md) | 15 detailed operational troubleshooting scenarios with symptoms, root causes, resolution steps, and anti-patterns. | **COMPLETE** |
| **Master Documentation Index** | [`README.md`](file:///Users/KWADW/Ai-Lab/agent-os/cms-rebuild/After-School-Club-CMS/project-notes/documentation-training/README.md) | Updated with full navigation, cross-links, and roadmap progress tracking. | **COMPLETE** |

---

## 3. D2 Permission Matrix Summary

| Capability / Action | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) | Evidence Source |
|---|---|---|---|---|---|---|
| **Parent Directory List & Search** | FULL (All Centres) | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `parents/page.tsx` |
| **View Parent Profile 360°** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | OWN-RECORDS-ONLY | `parents/[id]/page.tsx` |
| **Add / Edit Parent Details** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | OWN-RECORDS-ONLY | `parents/actions.ts` |
| **Soft Delete / Restore Parent** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `parents/bin/page.tsx` |
| **Permanent GDPR Purge** | FULL | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | `parents/bin/page.tsx` |
| **Student Directory List & Search** | FULL (All Centres) | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `students/page.tsx` |
| **View Student Profile 360°** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | READ-ONLY (Roll Call)| OWN-RECORDS-ONLY | `students/[id]/page.tsx` |
| **Add / Edit Student Details** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | OWN-RECORDS-ONLY | `students/actions.ts` |
| **Bulk CSV Student Import** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `students/import/page.tsx` |
| **Registrations Queue List** | FULL (All Centres) | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `registrations/page.tsx` |
| **Review Registration Dossier** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `registrations/[id]/page.tsx` |
| **Approve Registration (`signed_up`)**| FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `api/register/[id]/status` |
| **Reject Registration (`not_interested`)**| FULL| CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `api/register/[id]/status` |
| **Create Staff Booking** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `bookings/new/page.tsx` |
| **Create Walk-In Booking** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | NOT AVAILABLE | `bookings/actions.ts` |
| **Public Booking Form** | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC | `book/[orgSlug]/page.tsx` |
| **Parent Portal Booking** | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | OWN-RECORDS-ONLY | `portal/book/page.tsx` |
| **Reschedule / Cancel Booking** | FULL | CENTRE-SCOPED | CENTRE-SCOPED | NOT AVAILABLE | OWN-RECORDS-ONLY | `bookings/actions.ts` |
| **Assessment Scorecard Feedback**| FULL | FULL | FULL | DRAFT FEEDBACK | VIEW SENT ONLY | `AppointmentScorecard.tsx` |

---

## 4. Operational Rationales & Policy Coverage (15 Controls)

1. **Separation of Parent and Child Entities:** Enables multi-sibling family billing, single invoices, and distinct legal vs. custodial responsibility.
2. **Mandatory Adult Linking:** Guarantees every student in custody has verified emergency contacts and collection passwords.
3. **Universal Medical Alert Visibility:** Automatically projects high-contrast Red Allergy Badges to attendance registers and kiosk screens for life safety.
4. **Safeguarding File Isolation:** Confines child protection files exclusively to Managers/Owners (DSLs), preventing exposure to tutors.
5. **Controlled Registration Triage:** Mandates staff verification of medical disclosures and centre capacity before activating enrolments.
6. **Intelligent CRM Matching:** Resolves existing parent accounts by email and matches children by full name/DOB, preventing split accounts.
7. **Organisation & Centre Tenancy Isolation:** Cryptographically isolates businesses and scopes staff strictly to assigned physical venues.
8. **Real-Time Booking Capacity Limits:** Prevents Ofsted ratio breaches by calculating slot capacity dynamically inside database transactions.
9. **Duplicate Time-Slot Prevention:** Enforces composite DB constraint `(centre_id, modality, start_at, parent_id)` to stop double-booking race conditions.
10. **Booking Intent vs. Attendance Fact:** Distinguishes reservations from statutory custodial check-in timestamps.
11. **30-Day Soft Delete Model:** Protects against accidental deletion of statutory child histories.
12. **Owner-Only Permanent GDPR Purge:** Restricts irreversible data destruction to the legal account owner.
13. **GDPR Communications Consent Filter:** Excludes non-consented parents server-side from marketing and announcement broadcasts.
14. **Passwordless Magic-Link Access:** Eliminates credential theft and password sharing while scoping portal access strictly to family children.
15. **Graceful Integration Fallback:** Ensures external outages (Google Calendar / Stripe) do not block core CMS bookings or child check-ins.

---

## 5. Production Side-Effect Audit

As mandated by Stage B of the specification:
- Production DB mutations = **0**
- Staging DB mutations = **0**
- Schema changes = **0**
- Database migrations = **0**
- Emails dispatched = **0**
- SMS messages sent = **0**
- Stripe / GoCardless API calls = **0**
- Google Calendar mutations = **0**
- Wonde API calls = **0**
- Vercel Blob storage writes = **0**
- Cron jobs executed = **0**
- Environment variable changes = **0**
- Production deployments = **0**

---

## 6. 50-Question Adversarial Acceptance Matrix

| # | Adversarial Audit Question | Classification | Evidence & Notes |
|---|---|---|---|
| 1 | Did D2 start exactly from SHA `8554e29`? | **SAFE** | Confirmed via `git rev-parse --short HEAD`. |
| 2 | Was the working tree clean? | **SAFE** | Confirmed via `git status`. |
| 3 | Was D1 treated as the documentation contract? | **SAFE** | Canonical terms, role names, and alert styles preserved. |
| 4 | Were all 4 functional manuals created? | **SAFE** | `parents.md`, `children-students.md`, `registrations.md`, `bookings.md`. |
| 5 | Was Master User Manual Part 2 created? | **SAFE** | `master-manual/02-family-to-booking-journey.md`. |
| 6 | Was the Operational Rationale library created? | **SAFE** | `rationale/family-registration-booking-controls.md`. |
| 7 | Were micro-video scripts created for D6? | **SAFE** | 14 scripts in `videos/d2-video-scripts.md`. |
| 8 | Were screenshot specifications created for D6? | **SAFE** | 16 specifications in `screenshots/d2-screenshot-plan.md`. |
| 9 | Was the troubleshooting handbook created? | **SAFE** | 15 scenarios in `troubleshooting/d2-family-booking-troubleshooting.md`. |
| 10 | Was README.md updated with all D2 links? | **SAFE** | Updated with clean relative markdown links. |
| 11 | Were parent search and filtering mechanics verified?| **SAFE** | Verified in `ParentsTable.tsx` and `parents/page.tsx`. |
| 12 | Were parent manual creation fields verified? | **SAFE** | Matched `parents` table schema and `parents/actions.ts`. |
| 13 | Was GDPR communications consent documented? | **SAFE** | Verified server-side filter in `communications/actions.ts`. |
| 14 | Were sibling linking mechanics verified? | **SAFE** | Matched `children.parentId` relational model. |
| 15 | Was 30-day soft deletion verified? | **SAFE** | Matched `parents.deletedAt` in `parents/bin/page.tsx`. |
| 16 | Was permanent GDPR purge verified as Owner-only? | **SAFE** | Verified role gate `requirePermission('ORG_OWNER')`. |
| 17 | Was Child vs Student canonical distinction maintained?| **SAFE** | Defined in Style Guide and Children Manual §2. |
| 18 | Were pupil 360° demographics verified? | **SAFE** | Matched `StudentProfile.tsx` and `children` table. |
| 19 | Was bulk CSV student import verified? | **SAFE** | Matched `students/import/page.tsx` and `import-actions.ts`. |
| 20 | Were medical and severe allergy alerts verified? | **SAFE** | High-contrast red/yellow badge logic documented. |
| 21 | Were parental consents verified? | **SAFE** | Photo, Sun Cream, First Aid consents mapped to DB columns. |
| 22 | Were authorised collectors and passwords verified? | **SAFE** | Matched `authorisedCollectors` table and pickup checks. |
| 23 | Were operational flags (homework/behaviour) verified?| **SAFE** | Matched attendance card toggle buttons. |
| 24 | Were safeguarding boundaries strictly isolated? | **SAFE** | Safeguarding confirmed isolated to DSLs in `/dashboard/incidents`. |
| 25 | Was the public registration journey mapped? | **SAFE** | Verified `/register/[...slug]` and `RegistrationForm.tsx`. |
| 26 | Were rate limiting rules documented? | **SAFE** | Upstash Redis IP rate limiting documented. |
| 27 | Was registration duplicate prevention verified? | **SAFE** | 409 conflict detection and CRM email matching verified. |
| 28 | Were canonical registration statuses verified? | **SAFE** | `awaiting_confirmation`, `signed_up`, `not_interested`. |
| 29 | Was registration approval traced to source code? | **SAFE** | Traced in `api/register/[id]/status/route.ts`. |
| 30 | Were registration approval side effects verified? | **SAFE** | Status update, welcome email, and child directory activation. |
| 31 | Were registration rejection mechanics verified? | **SAFE** | `not_interested` transition and rejection email verified. |
| 32 | Were all 4 booking surfaces mapped? | **SAFE** | Public, Portal, Staff Back-Office, and Walk-In. |
| 33 | Were canonical booking statuses verified? | **SAFE** | `confirmed`, `cancelled`, `rescheduled`, `completed`, `signed_up`. |
| 34 | Was staff booking creation verified? | **SAFE** | Verified in `BookingForm.tsx` and `BookingService.ts`. |
| 35 | Was walk-in booking creation verified? | **SAFE** | Fast on-demand reception workflow documented. |
| 36 | Was public booking wizard mapped? | **SAFE** | Verified `/book/[orgSlug]` public flow. |
| 37 | Was parent portal booking mapped? | **SAFE** | Verified `/portal/book` with child prefill. |
| 38 | Was slot capacity management verified? | **SAFE** | Capacity calculation in `availability.ts` documented. |
| 39 | Was duplicate slot uniqueness verified? | **SAFE** | `unique_time_slot` constraint documented. |
| 40 | Was rescheduling lifecycle verified? | **SAFE** | Old booking cancelled, new booking created, calendar updated. |
| 41 | Were assessment scorecards and feedback verified? | **SAFE** | Matched `bookingAttendees` feedback fields and draft/sent status. |
| 42 | Was Google Calendar fallback verified? | **SAFE** | Graceful error handling in `BookingService.ts` verified. |
| 43 | Was attendance relationship documented? | **SAFE** | Auto-population of roll call from confirmed bookings. |
| 44 | Was finance relationship documented? | **SAFE** | Consumption of agreed-fee monthly sessions vs. ad-hoc. |
| 45 | Were 15 troubleshooting scenarios covered? | **SAFE** | Comprehensive symptom-cause-resolution guide provided. |
| 46 | Were 15 operational rationales documented? | **SAFE** | "Why SprintScale works this way" fully articulated. |
| 47 | Was production PII 100% excluded? | **SAFE** | Zero real customer data; synthetic accounts used exclusively. |
| 48 | Were all internal markdown links validated? | **SAFE** | 100% of relative links verified and resolve. |
| 49 | Was source code left 100% untouched? | **SAFE** | Confirmed via `git diff --stat 8554e29..HEAD`. |
| 50 | Is D2 safe to freeze and proceed to D3? | **SAFE** | All deliverables complete, verified, and unpushed. |

### Adversarial Arithmetic
- **SAFE:** **50 / 50 (100%)**
- **DEBT:** **0**
- **DEFECT:** **0**
- **BLOCKED:** **0**
- **NOT APPLICABLE:** **0**

---

## 7. Recommended D3 Scope

With the family-to-booking foundation, registration triage, and scheduling manuals complete, Milestone **D3** should execute:

1. **Functional Manual: Attendance & Roll Call** (Live registers, time-stamped check-in/out, late minutes, absence reasons).
2. **Functional Manual: Tablet Kiosk Mode** (Fullscreen PIN/touch kiosk, fast family arrivals and departures).
3. **Functional Manual: Session Credit Ledger** (Arrears balancing, forgiveness credits, audit notes).
4. **Functional Manual: Child Incidents & Safeguarding** (Accident/injury logs, medication tracking, confidential DSL files).

---

## 8. Final Recommendation

**PASS — FAMILY, REGISTRATION & BOOKING DOCUMENTATION COMPLETE — READY FOR D3**
