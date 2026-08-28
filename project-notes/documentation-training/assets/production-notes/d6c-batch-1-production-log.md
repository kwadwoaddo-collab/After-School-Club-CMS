# Milestone D6C Batch 1 Visual Production Log: Remaining Screenshots (SS-D6-S047 → SS-D6-S056)

**Milestone**: D6C — Production Batch 1 (10 Canonical Assets)  
**Production Date**: 2026-08-28  
**Agent**: Visual Production Agent (SprintScale CMS)  
**Target Environment**: Neon Training Database (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`)  
**Safety Protocol**: `assertSafeTrainingEnvironment()` (`ALLOW_TRAINING_SEED=true`, `TRAINING_ENVIRONMENT=oakridge`)  
**Base Commit**: `491f927` (`docs(training-d6b): complete essential screenshot production`)  
**Frozen Essential Baseline**: Certified `SS-D6-S001` → `SS-D6-S046` (46 Assets — Immutable)  
**Batch Scope**: Exactly 10 Canonical Assets (`SS-D6-S047` → `SS-D6-S056`)

---

## 1. Executive Summary & Batch Arithmetic

Milestone D6C initiates visual production for the 32 supplementary/advanced screenshot assets identified in the canonical visual production manifest. Batch 1 delivers exactly 10 production screenshots covering Parent Portal interactions, passwordless authentication flows, cryptographic staff onboarding, real-time in-app notification center, and organisation/venue administrative configurations.

### Master Asset Inventory Arithmetic
- **Total Master Screenshot Inventory**: 78 Canonical Screenshots
- **Certified Essential Baseline (D6A/D6B)**: 46 Screenshots (`SS-D6-S001` → `SS-D6-S046`) — **100% Frozen & Certified**
- **Remaining Supplementary Inventory**: 32 Screenshots (`SS-D6-S047` → `SS-D6-S078`)
- **Batch 1 Completed Scope**: Exactly 10 Screenshots (`SS-D6-S047` → `SS-D6-S056`)
- **Post-Batch 1 Certified Total**: 56 / 78 Screenshots (71.8% Total Inventory Complete)
- **Remaining for Batches 2–4**: 22 Screenshots (`SS-D6-S057` → `SS-D6-S078`)

---

## 2. D6C Batch 1 Asset Inventory & Verification Table

| Asset ID | Title | Route | Persona / Role | Source File Size | Annotated File Size | Dimensions | Visual QA Status |
|---|---|---|---|---|---|---|---|
| `SS-D6-S047` | Parent Portal Family Home View | `/portal` | Sarah Jenkins (Parent) | 63,023 B | 83,473 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S048` | Parent Portal Booking Wizard | `/portal/book` | Sarah Jenkins (Parent) | 40,064 B | 65,825 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S049` | Parent Portal Billing & Invoices List | `/portal/billing` | David Patel (Parent) | 62,022 B | 84,524 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S050` | Passwordless Magic Link Login Prompt | `/portal/login` | Public (Unauthenticated) | 36,413 B | 64,165 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S051` | Passwordless Login Email Verification | `/portal/login` | Public (Unauthenticated) | 41,016 B | 67,290 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S052` | Staff Cryptographic Invite Acceptance | `/accept-invite?token=...` | Sophie Reed (Tutor Invite) | 301,182 B | 219,919 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S053` | Header Notification Bell & Alerts Dropdown | `/dashboard` | Eleanor Vance (Owner) | 177,729 B | 177,606 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S054` | Organisation Profile & Contact Details | `/dashboard/settings?tab=general` | Eleanor Vance (Owner) | 158,821 B | 169,235 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S055` | GDPR Subject Access JSON Export Button | `/dashboard/settings?tab=danger_zone` | Eleanor Vance (Owner) | 152,559 B | 155,640 B | 1440 × 900 | **PASS — VERIFIED** |
| `SS-D6-S056` | Venue Operating Times Configuration | `/dashboard/centres/[id]/settings` | Eleanor Vance (Owner) | 128,377 B | 140,430 B | 1440 × 900 | **PASS — VERIFIED** |

*Review Contact Sheet*: `project-notes/documentation-training/assets/review/d6c-batch-1-contact-sheet.png` (860 × 1470, 357,371 B) — **PASS — VERIFIED**

---

## 3. Detailed Per-Asset Production Notes

### `SS-D6-S047`: Parent Portal Family Home View
- **Route**: `http://localhost:3000/portal`
- **Authenticated Persona**: Sarah Jenkins (`sarah.jenkins@example.test`) via cryptographically signed JWT `parent_session` cookie.
- **Fixture State**: Displays personalized header "Sarah's Portal", quick action "Book a Session", cards for Oliver Jenkins (Year 3) and Emma Jenkins (Reception), and past completed booking history.
- **Bounding Box Callouts**:
  - **[1]** `a[href="/portal/book"]`: Quick Action "Book a Session" callout banner.
  - **[2]** `section:has(h2:has-text("My Children"))`: "My Children" child overview grid showing enrolled siblings.
  - **[3]** `section:has(h2:has-text("Upcoming Sessions"))`: Active bookings status container.
- **Pedagogical Objective**: Demonstrates the modern, self-service parent portal landing experience where guardians manage all family enrollments from one intuitive screen.

### `SS-D6-S048`: Parent Portal Booking Wizard
- **Route**: `http://localhost:3000/portal/book`
- **Authenticated Persona**: Sarah Jenkins (`sarah.jenkins@example.test`)
- **Fixture State**: Step 1 ("Who is this booking for?") with Oliver Jenkins actively selected (marked with blue checkmark) and Emma Jenkins available as sibling selection.
- **Bounding Box Callouts**:
  - **[1]** `button:has-text("Oliver Jenkins")`: Active child selector card with confirmation badge.
  - **[2]** `button:has-text("Emma Jenkins")`: Sibling selection option card.
  - **[3]** `button:has-text("Next")`: Primary wizard step forward progression CTA.
- **Pedagogical Objective**: Illustrates the streamlined multi-step booking experience for parents booking sessions for single or multiple children.

### `SS-D6-S049`: Parent Portal Billing & Invoices List
- **Route**: `http://localhost:3000/portal/billing`
- **Authenticated Persona**: David Patel (`david.patel@example.test`)
- **Fixture State**: Outstanding balance summary card showing £70.00 outstanding balance, partially paid invoice `#INV-2026-002` (£140.00 total, £70.00 due), and the Tax-Free Childcare voucher self-reporting form.
- **Bounding Box Callouts**:
  - **[1]** `section:has-text("Total Outstanding Balance")`: Total outstanding balance hero card with "Pay All Outstanding" action.
  - **[2]** `#outstanding-invoices .space-y-4 > div`: Outstanding invoice row `#INV-2026-002` with partial payment status.
  - **[3]** `form:has-text("Log Childcare Voucher Payment")`: Childcare voucher self-reporting remittance form.
- **Pedagogical Objective**: Educates parents on viewing invoices, balances, and logging Tax-Free Childcare or voucher references without administrative friction.

### `SS-D6-S050`: Passwordless Magic Link Login Prompt
- **Route**: `http://localhost:3000/portal/login`
- **Authenticated Persona**: Public / Unauthenticated Parent
- **Fixture State**: Clean passwordless authentication card displaying welcoming wave icon, security guidance ("No password needed — we'll email you a secure one-tap login link"), email input `#portal-login-email`, and submission CTA.
- **Bounding Box Callouts**:
  - **[1]** `.max-w-md .p-8`: Parent portal card header and passwordless security guidance.
  - **[2]** `div:has(> #portal-login-email)`: Secure email address input field.
  - **[3]** `button[type="submit"]`: "Send Magic Link" primary submission action.
- **Pedagogical Objective**: Teaches new guardians how passwordless security eliminates password fatigue and prevents credential stuffing.

### `SS-D6-S051`: Passwordless Login Email Verification
- **Route**: `http://localhost:3000/portal/login` (State: `isSent = true`)
- **Authenticated Persona**: Public / Unauthenticated Parent (`sarah.jenkins@example.test`)
- **Fixture State**: Confirmation screen displaying green-tinted success card, confirmation message ("Check your email! We've sent a secure login link to **sarah.jenkins@example.test**"), and "Try another email" reset action.
- **Bounding Box Callouts**:
  - **[1]** `div.bg-success\/10`: "Check your email!" confirmation banner container.
  - **[2]** `div.bg-success\/10 p:first-of-type`: Recipient address confirmation statement.
  - **[3]** `button:has-text("Try another email")`: Action link to return to input or correct typos.
- **Pedagogical Objective**: Shows parents what to expect immediately after requesting a magic link and provides clarity on email delivery.

### `SS-D6-S052`: Staff Cryptographic Invite Acceptance
- **Route**: `http://localhost:3000/accept-invite?token=d6c-invite-token-synthetic-2026`
- **Authenticated Persona**: Sophie Reed (`sophie.reed@example.test`, role `TUTOR`)
- **Fixture State**: Cryptographic invite validation screen displaying Sparkles gradient badge, "You're invited!" heading, "Tutor" role badge, green-dot email pill badge (`sophie.reed@example.test`), and "Enter Dashboard" CTA button.
- **Bounding Box Callouts**:
  - **[1]** `h1:has-text("You're invited!")`: Invitation heading and assigned staff role badge ("Tutor").
  - **[2]** `div.rounded-full:has-text("sophie.reed@example.test")`: Cryptographically verified recipient email pill badge.
  - **[3]** `button:has-text("Enter Dashboard")`: One-click invite redemption and dashboard sign-in CTA.
- **Pedagogical Objective**: Demonstrates seamless staff onboarding via single-use, cryptographically verified tokens without manual credential transmission.

### `SS-D6-S053`: Header Notification Bell & Alerts Dropdown
- **Route**: `http://localhost:3000/dashboard`
- **Authenticated Persona**: Eleanor Vance (`eleanor.vance@example.test`, Owner)
- **Fixture State**: Dashboard header with active Notification Bell showing unread badge count (2 new), and `#notifications-menu` popover expanded with real-time operational alerts (New Session Booking, Childcare Voucher Submitted, Student Progress Note).
- **Bounding Box Callouts**:
  - **[1]** `button[aria-label="Notifications"]`: Header notification bell button with unread counter.
  - **[2]** `#notifications-menu`: Notification dropdown container with header and unread count.
  - **[3]** `#notifications-menu button:first-of-type`: Top unread notification card ("New Session Booking").
- **Pedagogical Objective**: Teaches staff how to monitor operational events, incoming bookings, and financial submissions from the persistent navigation header.

### `SS-D6-S054`: Organisation Profile & Contact Details
- **Route**: `http://localhost:3000/dashboard/settings?tab=general`
- **Authenticated Persona**: Eleanor Vance (`eleanor.vance@example.test`, Owner)
- **Fixture State**: Organisation workspace settings displaying "General Info" active sidebar tab, Organisation Name ("Oakridge Learning Club Ltd"), Slug ("oakridge-learning"), and Contact Details (Email: `support@oakridge-learning.example.test`, Phone: `020 7946 0123`, Address: `12 High Street, Oakridge, London, SE1 1AA`).
- **Bounding Box Callouts**:
  - **[1]** `button:has-text("General Info")`: General Info sidebar navigation tab.
  - **[2]** `div.grid.grid-cols-1.sm:grid-cols-2`: Organisation Name and Slug configuration block.
  - **[3]** `div.grid.grid-cols-1.sm:grid-cols-3`: Contact details cards (Email, Phone, Address).
- **Pedagogical Objective**: Guides club owners through setting up their legal organisation identity, sharing URL slug, and public contact information.

### `SS-D6-S055`: GDPR Subject Access JSON Export Button
- **Route**: `http://localhost:3000/dashboard/settings?tab=danger_zone`
- **Authenticated Persona**: Eleanor Vance (`eleanor.vance@example.test`, Owner)
- **Fixture State**: Danger Zone settings page displaying Privacy & Compliance section, GDPR Data Export explanation card ("Download all personal data stored by your organisation as a JSON file"), and "Export Data" button.
- **Bounding Box Callouts**:
  - **[1]** `button:has-text("Danger Zone")`: Danger Zone sidebar navigation tab.
  - **[2]** `div.bg-card.rounded-2xl:has(button:has-text("Export Data"))`: Privacy & Compliance Subject Access Request compliance card.
  - **[3]** `button:has-text("Export Data")`: One-click JSON data export action button.
- **Pedagogical Objective**: Teaches organisation compliance officers and owners how to fulfil GDPR Subject Access Requests (SAR) instantly with structured JSON exports.

### `SS-D6-S056`: Venue Operating Times Configuration
- **Route**: `http://localhost:3000/dashboard/centres/[centreId]/settings` (Oakridge Central)
- **Authenticated Persona**: Eleanor Vance (`eleanor.vance@example.test`, Owner)
- **Fixture State**: Centre settings page displaying active "Sessions" tab, Session Builder list containing configured time blocks ("Breakfast Club" 07:30–09:00, £5.00, cap 30; "After School" 15:30–18:00, £12.00, cap 30) with active weekday toggles, and "+ Add session" button.
- **Bounding Box Callouts**:
  - **[1]** `button:has-text("Sessions")`: Centre Sessions navigation tab button.
  - **[2]** `div.space-y-3:has(div.bg-page)`: Configured session slot cards showing start/end times, name, price, capacity, and active days.
  - **[3]** `button:has-text("Add session")`: "+ Add session" slot addition CTA button.
- **Pedagogical Objective**: Demonstrates how centre managers and owners configure recurring bookable session blocks, timings, and capacity limits.

---

## 4. Privacy, Safety, and Compliance Verification

1. **Synthetic Persona Compliance**:
   - 100% of rendered data belongs to `Oakridge Learning Trust` / `Oakridge Learning Club Ltd`.
   - Staff personas: `Eleanor Vance`, `Marcus Sterling`, `Chloe Bennett`, `Liam Harper`, `Sophie Reed`.
   - Family personas: `Sarah Jenkins` (Oliver & Emma), `David Patel` (Aanya), `Rachel Taylor` (Leo), `James Walker` (Lucas).
   - Zero real-world PII, zero real customer names, zero real student names, zero real addresses.
2. **Database Isolation**:
   - Target DB: `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (Neon training branch).
   - Blocked host `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` remained 100% untouched.
   - All executions guarded by `assertSafeTrainingEnvironment()`.
3. **Zero External Side-Effects**:
   - Resend email sends: 0 external API calls made (magic link verification intercepted cleanly in Playwright for visual capture).
   - Stripe / payment gateway sends: 0 live transactions.
4. **Frozen Baseline Immutability**:
   - Certified essential screenshots `SS-D6-S001` → `SS-D6-S046` remain completely unaltered.
   - `git diff --stat` confirms zero changes to any existing S001–S046 PNGs.

---

## 5. Adversarial 30-Question Certification Review

1. **Q01: Were exactly 10 screenshots produced in this batch?**  
   *Answer*: Yes. Exactly `SS-D6-S047` through `SS-D6-S056` (10 clean source PNGs + 10 annotated PNGs + 1 contact sheet).
2. **Q02: Were any screenshots S057+ produced prematurely?**  
   *Answer*: No. S057 through S078 remain in READY status for subsequent batches.
3. **Q03: Were any certified screenshots S001–S046 modified?**  
   *Answer*: No. All 46 essential baseline screenshots remain 100% unmodified and frozen.
4. **Q04: Are all source screenshot files strictly 1440 × 900 pixels?**  
   *Answer*: Yes. Programmatic validation confirms all 10 source images are exactly 1440 × 900 px.
5. **Q05: Are all annotated screenshot files strictly 1440 × 900 pixels?**  
   *Answer*: Yes. Programmatic validation confirms all 10 annotated images are exactly 1440 × 900 px.
6. **Q06: Does every annotated screenshot have exactly 3 bounding boxes with numbered badges (1, 2, 3)?**  
   *Answer*: Yes. Every asset features callouts `[1]`, `[2]`, and `[3]` rendered in `#2563EB` with 3px dashed border and white text.
7. **Q07: Is the annotation style consistent across all 10 assets?**  
   *Answer*: Yes. Uniform `#2563EB` stroke (dash `8,4`), 4% fill opacity, 14px circular badge with 2px white border, and 14px bold system font.
8. **Q08: Was the review contact sheet generated?**  
   *Answer*: Yes. `project-notes/documentation-training/assets/review/d6c-batch-1-contact-sheet.png` (860 × 1470 px).
9. **Q09: Does the contact sheet include all 10 batch assets in order?**  
   *Answer*: Yes. S047 through S056 arranged in a 2-column × 5-row structured grid with header.
10. **Q10: Were all captures taken against the approved Neon training host?**  
    *Answer*: Yes. Connected exclusively to `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`.
11. **Q11: Was the production database ever touched?**  
    *Answer*: No. Protected by hostname check in `assertSafeTrainingEnvironment()`.
12. **Q12: Are all rendered records scoped to the Oakridge Learning organisation?**  
    *Answer*: Yes. Slug `oakridge-learning`, centres `Oakridge Central` and `Oakridge Riverside`.
13. **Q13: Does SS-D6-S047 accurately display the Parent Portal family home?**  
    *Answer*: Yes. Shows Sarah Jenkins' portal, children Oliver and Emma, and "Book a Session" action.
14. **Q14: Does SS-D6-S048 show the active child selection state in the booking wizard?**  
    *Answer*: Yes. Oliver Jenkins card shows active selected checkmark with Next CTA enabled.
15. **Q15: Does SS-D6-S049 show the £70.00 outstanding balance and partial invoice?**  
    *Answer*: Yes. Invoice INV-2026-002 is displayed with £70.00 due and voucher payment form.
16. **Q16: Does SS-D6-S050 show the passwordless login prompt with clean input fields?**  
    *Answer*: Yes. Clean input `#portal-login-email` and "Send Magic Link" CTA.
17. **Q17: Does SS-D6-S051 show the email confirmation state with the synthetic address?**  
    *Answer*: Yes. "Check your email!" card confirming link sent to `sarah.jenkins@example.test`.
18. **Q18: Were any live emails sent to real mailboxes during S051 capture?**  
    *Answer*: No. 0 external emails sent; route intercepted in Playwright without source changes.
19. **Q19: Does SS-D6-S052 display the cryptographic staff invite acceptance screen?**  
    *Answer*: Yes. Shows "You're invited!", "Tutor" badge, `sophie.reed@example.test`, and CTA.
20. **Q20: Does SS-D6-S053 display the active header notification dropdown?**  
    *Answer*: Yes. Notification bell active with 2 unread badge count and dropdown popover visible.
21. **Q21: Does SS-D6-S054 display the organisation profile and contact details?**  
    *Answer*: Yes. General Info tab, organisation name/slug, and 3 contact cards.
22. **Q22: Does SS-D6-S055 show the GDPR Subject Access JSON export card and CTA?**  
    *Answer*: Yes. Danger Zone tab, Privacy & Compliance explanation, and "Export Data" button.
23. **Q23: Does SS-D6-S056 show the centre operating session slots?**  
    *Answer*: Yes. Sessions tab, Breakfast Club (07:30-09:00), After School (15:30-18:00), and Add Session button.
24. **Q24: Are there any real person names, phone numbers, or addresses anywhere in the screenshots?**  
    *Answer*: No. 0 real PII; 100% synthetic personas with `.test` and `example.test` domains.
25. **Q25: Are there any API keys, secrets, or internal auth tokens visible in any screenshot?**  
    *Answer*: No. All credentials, JWTs, and session tokens are strictly concealed.
26. **Q26: Did `git diff --check` pass with zero whitespace or line ending errors?**  
    *Answer*: Yes. 0 whitespace errors.
27. **Q27: Did TypeScript typecheck pass with zero errors?**  
    *Answer*: Yes. `tsc --noEmit` exited with code 0.
28. **Q28: Did ESLint pass with zero errors?**  
    *Answer*: Yes. `npm run lint` exited with code 0.
29. **Q29: Did the test suite pass with 100% success?**  
    *Answer*: Yes. 66 test files passed, 618 tests passed.
30. **Q30: Are all changes properly tracked and ready for local commit?**  
    *Answer*: Yes. Registry updated, production log documented, capture script saved, ready for local commit `docs(training-d6c): produce remaining screenshot batch 1`.

---

## 6. Certification Sign-Off

- **Visual Production Status**: **MILESTONE D6C BATCH 1 COMPLETE & CERTIFIED**
- **Assets Produced**: 10 Source PNGs + 10 Annotated PNGs + 1 Contact Sheet
- **Registry Updated**: Lines 70–79 of `asset-registry.md` set to `**CAPTURED — VISUAL QA VERIFIED**`
- **Next Step**: Local commit and proceed to Batch 2 planning.
