# After-School Club CMS — Improvement Brief

> Build brief for an AI coding agent (Claude Code / Antigravity). Each item states **Why**, **What**, **Where**, and **Done when**. Work top-to-bottom within each part — items are ordered by impact.
>
> Benchmarked against the UK market leaders in wraparound-care software: **Magicbooking** and **Kids Club HQ** (contract + ad-hoc bookings, live registers, Tax-Free Childcare, direct debit, waiting lists, incident reporting, Ofsted-ready reports).

**Stack (current):** Next.js 16 App Router · React 19 · Tailwind v4 · Drizzle ORM + Postgres · NextAuth v5 · Stripe · Resend · Twilio · Sentry · Vitest + Playwright.

**What's already good (don't regress):** per-route `loading.tsx` skeletons, HSL design tokens with light/dark parity, DB indexes + soft deletes, rate limiting, security test suites (`src/lib/security-p0..p3.test.ts`), GDPR export, kiosk mode with Web Audio feedback, mobile bottom nav, magic-link parent auth.

---

## Part 1 — Code quality & feel ("Apple-level code")

### 1.1 Remove the build-time raw-SQL script (CRITICAL)
- **Why:** `package.json` runs `tsx src/scripts/force-create.ts && next build` — a script that opens a raw connection to `DATABASE_URL` and executes ad-hoc `CREATE TABLE / ALTER TABLE` SQL on every build. This mutates production schema outside migration history, will drift from `drizzle-kit` migrations, and makes builds fail when the DB is unreachable.
- **What:** Remove `force-create.ts` from the build script. Fold any schema it creates into a proper Drizzle migration (`pnpm db:generate`), run migrations as an explicit deploy step, and make `build` just `next build`.
- **Where:** `package.json`, `src/scripts/force-create.ts`, `migrations/`, `src/db/migrations/`.
- **Done when:** `pnpm build` never touches a database; schema changes exist only as versioned migrations.

### 1.2 Delete debug/diagnostic endpoints (CRITICAL)
- **Why:** The repo ships `src/app/api/debug-invites`, `api/super-diagnostic`, `api/test-email`, `api/debug-org`, `api/debug/check-user`, `api/diagnostic-staff-email`, and `src/app/auth-test/`. They're `NODE_ENV !== 'development'`-gated, but they contain a hardcoded personal email (`brakatuaddo@gmail.com`), leak `RESEND_API_KEY` prefixes and error stacks, and `super-diagnostic` explicitly "bypasses authentication". Production code should not carry scaffolding.
- **What:** Delete all of them. If a health check is needed, add one `/api/health` returning `{ ok: true }` with no DB dumps. Move email testing to a Vitest integration test with a mocked transport.
- **Done when:** `grep -r "diagnostic\|debug" src/app/api` returns nothing; no hardcoded emails anywhere in `src/`.

### 1.3 Repo hygiene
- **Why:** `.agents/` (30+ folders of AI-agent scaffolding: BRIEFING.md, handoff.md, tsc logs), `.nextjs.log`, `final_build_v2.pid`, `tsconfig.tsbuildinfo`, `PROJECT_ROOT.lock`, and root-level one-off scripts (`generate_receipt.py`, `replace_tokens.py`) are committed or lying in the tree. This is noise that confuses every future agent/developer and bloats clones.
- **What:** `git rm -r --cached .agents` plus the stray files, add them to `.gitignore`, move or delete the one-off Python scripts.
- **Done when:** `git ls-files` shows only source, config, migrations, tests, and docs.

### 1.4 Resolve the domain-model identity crisis
- **Why:** The schema is half tutoring product, half club CMS: `bookings.assessmentType` (`initial_assessment`…), `tutorId`, `subjectEnum` (`Maths/English/Science`), `modality` (`in_person/online`), default 30-min duration, and a deprecated `bookings.childId`. Meanwhile there are **two parallel registration systems** (`studentRegistrations` + `registrations`, with `registration_status` AND `registration_status_v2` enums). This is the single biggest source of confusion for anyone (human or AI) extending the product.
- **What:**
  1. Introduce a first-class `sessions` concept (see Part 2.1) and make `bookings` reference a session instead of assessment fields.
  2. Migrate remaining `studentRegistrations` data into the `registrations` flow, then drop the old table and `registration_status` enum.
  3. Drop `bookings.childId` (attendees live in `booking_attendees`), drop `subjectEnum`/`childSubjects` if unused, rename tutoring-flavoured fields.
- **Where:** `src/db/schema.ts` (918 lines), consumers under `src/app/dashboard/bookings`, `src/features/bookings`, `src/lib/services/booking.ts`.
- **Done when:** one registration pipeline, one booking model, zero "deprecated / kept for backward compatibility" comments in `schema.ts`.

### 1.5 Pick one code organisation: `src/features/*` vs `src/components/*`
- **Why:** Booking UI exists in BOTH `src/features/bookings/components/` and `src/components/bookings/`; same duplication for attendance, billing, staff, students, registration. Meta-scale codebases live or die on predictable file placement.
- **What:** Standardise on the feature-folder pattern: `src/features/<domain>/{components,actions,queries,types}`. Keep `src/components/ui` for pure primitives only. Move, don't duplicate; update imports via codemod.
- **Done when:** no domain name appears under both trees; `src/components/` contains only `ui/`, `providers/`, and the `dashboard/` shell (Sidebar/Header).

### 1.6 Type safety: eliminate `any` (212 occurrences)
- **Why:** `let org: any` in `src/app/dashboard/page.tsx` and 211 friends defeat the point of TypeScript + Drizzle, which already generates exact row types.
- **What:** Replace with inferred Drizzle types (`typeof organisations.$inferSelect`), Zod-parsed inputs, and `unknown` + narrowing at boundaries. Enable ESLint `@typescript-eslint/no-explicit-any: error`; fix violations directory-by-directory.
- **Done when:** `grep -rn ": any" src --include="*.ts*"` returns <10 documented exceptions; CI lint enforces it.

### 1.7 Replace `console.log` with a structured logger (168 occurrences)
- **Why:** Server logs are the only forensic tool in production; unstructured `console.log` can't be filtered, and several log PII (emails, tokens).
- **What:** Add `src/lib/logger.ts` (pino or a levelled wrapper) that redacts PII, tags module + orgId, and forwards warn/error to Sentry breadcrumbs. Codemod all call sites. ESLint `no-console: error` in `src/`.
- **Done when:** zero raw `console.*` in `src/` outside the logger.

### 1.8 Make mutations feel instant (the "Apple feel" item)
- **Why:** Zero uses of `useOptimistic` in the app; `src/features/bookings/components/BookingForm.tsx:495` does `window.location.reload()`; roll-call, kiosk and notification actions round-trip the server before the UI responds. Native-feeling apps acknowledge the tap in <100 ms.
- **What:**
  1. Ban `window.location.reload()`; use `router.refresh()` + server-action return values.
  2. Add `useOptimistic` to the highest-frequency interactions: attendance roll-call (`AttendanceRollCall.tsx`), kiosk check-in/out (`KioskRegister.tsx`), notification mark-as-read, booking status changes. Show the new state immediately, reconcile on response, roll back with a toast on error.
  3. Wrap tab/filter navigation (dashboard `?view=`, `?centre=`) in `useTransition` so the old UI stays interactive while the RSC payload streams.
- **Done when:** roll-call taps update the status pill instantly with no spinner; no full-page reloads anywhere.

### 1.9 Move base64 attachments out of the database
- **Why:** `booking_attendees.feedbackAttachmentBase64` stores files as text in Postgres — bloats rows, slows every `SELECT *`, caps attachment size. Same risk for `parentSignature` and logo data-URIs.
- **What:** Add object storage (Vercel Blob or S3), store only key + mime + size, stream via signed URL. Backfill existing rows with a one-off script, then drop the base64 columns.
- **Done when:** no `text` column stores file bytes; attachments >5 MB work.

### 1.10 Fix time handling
- **Why:** `checkInTime`/`checkOutTime` are `varchar(5)` "HH:mm" with no date or timezone; `startAt` is `timestamp` (not `timestamptz`). BST/GMT transitions will corrupt registers and any billing-by-hours.
- **What:** Migrate check-in/out to `timestamptz` columns (`checkInAt`, `checkOutAt`); migrate `timestamp` columns to `timestamptz`; centralise formatting in `src/lib/datetime.ts` using the centre's timezone (`Europe/London` default per org).
- **Done when:** a kiosk check-in at 15:47 BST renders 15:47 regardless of server timezone; a DST-boundary unit test passes.

### 1.11 Design-system consolidation ("Meta-level design")
- **Why:** `globals.css` is 934 lines with 50 `!important`s and three coexisting token vocabularies (shadcn HSL vars, Apple HIG values, dead "Midnight Luminary / SprintScale" MD3 tokens like `--color-tertiary: #b8ffbb`). PROJECT.md milestone 5 flagged this; it's only partly done.
- **What:**
  1. Delete unused MD3 tokens (grep each `--color-*` for usage first).
  2. Reduce `!important` to zero by scoping overrides to components.
  3. Extract the primitives that are currently ad-hoc per page: `<Button variant>`, `<Badge>`, `<EmptyState>`, `<Field>` — inline re-styling is why pages drift.
  4. Document tokens in a short `DESIGN.md` (spacing scale, radius scale, status colors, elevation) so agents stop inventing values.
- **Done when:** `globals.css` < 400 lines, 0 `!important`, every page uses the shared primitives.

### 1.12 Accessibility & motion polish
- **What:** `prefers-reduced-motion` guards on all keyframe animations; consistent focus-visible rings (the `--shadow-focus` token exists — apply it everywhere); `aria-label` on icon-only buttons; keyboard-navigable kiosk grid; Playwright + axe-core in CI.
- **Done when:** axe reports zero serious/critical violations on dashboard, portal, kiosk, and booking flow.

---

## Part 2 — New features (competitive parity → advantage)

Ordered by how often UK clubs cite them when choosing Magicbooking / Kids Club HQ.

### 2.1 Real session & term model with contract + ad-hoc bookings
- **Why:** Competitors' core object is a *recurring session* (Breakfast Club Mon–Fri 07:30–08:45, After-School Club 15:15–18:00, Holiday Club days), booked either as a **contract** (every Tue/Thu all term) or **ad-hoc** (just next Wednesday). The current model is one-off 30-min "assessment" slots — the biggest functional gap.
- **What:**
  - New tables: `terms` (org, name, start/end, holidays), `clubSessions` (centre, type: breakfast/after_school/holiday, weekday, start/end time, capacity, price), `sessionExceptions` (closures, inset days), `bookingPlans` (child, session, weekday pattern, term, status) that materialise into per-date `bookings`.
  - Parent portal: "Book whole term" (weekday pattern picker + live price) and "Book single days" calendar view.
  - Capacity enforcement per session-date, reusing the existing `slotHolds` pattern.
- **Done when:** a parent can book Tue+Thu after-school for the whole autumn term in one checkout, and staff see it on every relevant register.

### 2.2 Child safety profile + authorised collectors (safeguarding-critical)
- **Why:** `children` has no allergy, dietary, medical, or photo-consent fields — only free-text `notes`; the emergency contact lives on the *registration*, not the child. Every competitor surfaces allergies on the live register; this is a safeguarding requirement, not a nicety.
- **What:**
  - Extend `children`: `allergies[]`, `dietaryRequirements`, `medicalConditions`, `medicationNotes`, `gpName/gpPhone`, `senDetails`, `photoConsent`, `sunCreamConsent`, `firstAidConsent`.
  - New `authorisedCollectors` table (child, name, relationship, phone, collection password).
  - Registration form collects all of it; parents can edit in the portal (staff-notified audit trail).
  - **Surface allergy/medical badges on roll-call, kiosk, and printed registers** (red badge + expandable detail).
- **Done when:** a child with a nut allergy shows a red badge everywhere staff mark attendance, and checkout requires collector confirmation.

### 2.3 Waiting lists with automatic offers
- **Why:** Full sessions currently just fail; both competitors auto-manage waitlists.
- **What:** `waitlistEntries` (session-date or plan, child, position, status). On freed capacity, auto-offer to position 1 via email/SMS with a 24 h expiring claim link (reuse magic-link infra), then cascade. Staff dashboard shows the queue with manual override.
- **Done when:** cancelling a booking on a full session triggers an offer email within a minute.

### 2.4 UK childcare payments: Tax-Free Childcare, vouchers, direct debit, instalments
- **Why:** The registration form already *asks* about funding type (`tax_free_childcare`, `childcare_vouchers`…) but billing can't receive or reconcile those payments. Magicbooking's headline feature is HMRC TFC handling; Kids Club HQ offers Direct Debit + Instant Bank Pay.
- **What:**
  - `paymentMethodEnum` already includes voucher/bank_transfer — build the reconciliation UI: an incoming-payments inbox where staff match a TFC/voucher remittance (child reference code) to invoices; store per-child TFC reference.
  - Add GoCardless (direct debit + Instant Bank Pay) alongside Stripe for recurring contract billing.
  - Instalment plans: split a term invoice into monthly `invoicePayments` with scheduled collection and automatic reminders (reminder infra exists in `src/lib/services/email.ts`).
  - Account credit ledger (`parentCredits`): in-policy cancellations credit the account; credits auto-apply at next checkout.
- **Done when:** a parent can pay a term contract by monthly direct debit, part-pay with TFC, and staff reconcile in two clicks.

### 2.5 Incident, accident & medication records
- **Why:** Statutory for Ofsted-registered provision; Magicbooking notifies parents of injuries/incidents/medications from the system.
- **What:** `incidents` table (child, session-date, type: accident/incident/medication/safeguarding, body-map coordinates, description, treatment, witnesses, staff signature, parent signature). Tablet flow using the existing `react-signature-canvas`; parent notified and countersigns via magic link; per-incident PDF export (reuse `@react-pdf/renderer` in `src/lib/pdf-report.ts`). Safeguarding-type records restricted to MANAGER+ via existing `permissions.ts`.
- **Done when:** an accident logged at 16:02 reaches the parent's phone before pickup, with signature capture on collection.

### 2.6 Printable & offline-capable registers
- **Why:** Kids Club HQ generates printable registers automatically; clubs need a paper fallback (fire drills, dead Wi-Fi) and Ofsted inspections ask for them.
- **What:** "Print register" per session-date: A4 PDF with name, year, allergies (bold), collector, check-in/out signature lines. Make the kiosk a PWA with an offline queue: cache today's register, queue check-ins in IndexedDB, sync on reconnect (PWA plumbing already started per `src/app/layout.tsx`).
- **Done when:** the kiosk survives a 10-minute network outage without losing a check-in; the PDF register prints cleanly.

### 2.7 Parent broadcast messaging + activity feed
- **Why:** Clubs currently can't message "all parents booked Thursday" (closure, trip reminder). Competitors bundle targeted email/SMS.
- **What:** Compose UI with audience picker (centre, session, date, or manual selection) → send via existing Resend/Twilio services with per-message delivery status; store in `broadcasts` for audit. Respect `communicationsConsent`. Phase 2: web-push for the portal PWA and an optional photo-of-the-day activity feed per session (photo consent enforced from 2.2).
- **Done when:** "Message everyone booked tomorrow at Dagenham" takes <30 seconds and shows delivery/failure counts.

### 2.8 Ofsted-ready reporting & staff compliance
- **Why:** Magicbooking markets "Ofsted-ready reporting"; managers need occupancy, staff:child ratios, and records at inspection time.
- **What:** Extend `src/app/dashboard/reports` with occupancy % per session over time, staff:child ratio per session-date (needs a light rota: which staff worked which session), booked-vs-attended (no-show rates), incident summaries, and a one-click "inspection pack" PDF. Add DBS number + expiry and first-aid/safeguarding training expiry to staff profiles, with dashboard warnings 60 days out.
- **Done when:** a manager can produce an inspection pack for any date range in one click, and expiring DBS checks surface on the dashboard.

### 2.9 School/MIS integration (differentiator for school-run clubs)
- **Why:** Magicbooking's school tier syncs pupils from the school MIS. One Wonde/Xporter integration imports children, classes, and parent contacts — eliminating registration data entry for schools.
- **What:** Integrate the Wonde API: nightly sync of pupils + guardians into `children`/`parents` with match-or-create logic (the `wasMatched` pattern in `registrationChildren` already anticipates this). Keep the existing CSV import (`students/import`) as fallback.
- **Done when:** a school can connect Wonde and see its pupil roster in under an hour.

### 2.10 Holiday club support
- **Why:** Most after-school clubs also run holiday provision — same customers; both competitors treat it as a first-class club type.
- **What:** On the session model from 2.1: day-long sessions with AM/PM/full-day pricing, early-bird discount windows (extend `src/lib/services/discount.ts`), per-day activity descriptions shown at booking, and sibling discounts.
- **Done when:** a parent books Mon–Wed of half-term for two siblings with sibling discount auto-applied.

---

## Suggested build order

| Phase | Items | Rationale |
|-------|-------|-----------|
| 0 — Stop the bleeding (1 day) | 1.1, 1.2, 1.3 | Deploy-safety and hygiene; zero product risk |
| 1 — Foundations (1–2 wks) | 1.4, 1.5, 1.6, 1.7, 1.10 | Everything in Part 2 builds on a clean domain model |
| 2 — Feel (1 wk) | 1.8, 1.9, 1.11, 1.12 | Visible polish; can run in parallel with Phase 3 |
| 3 — Core parity (2–4 wks) | 2.1, 2.2, 2.3 | The features clubs actually switch software for |
| 4 — Money (2–3 wks) | 2.4, then 2.10 | Revenue features; depends on 2.1 |
| 5 — Trust & scale (ongoing) | 2.5, 2.6, 2.7, 2.8, 2.9 | Compliance + differentiation |

**Regression guardrails for the agent:** run `pnpm test` (Vitest) and `pnpm test:e2e` (Playwright) after each item. The security suites in `src/lib/security-p*.test.ts` and tenant-scoping helpers (`getUserAccessibleCentreIds`, `resolveActiveCentreId`) must keep passing — every new table needs `organisationId` scoping and a matching index, following the existing pattern in `schema.ts`.
