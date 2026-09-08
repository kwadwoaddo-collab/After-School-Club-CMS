# Post-Modernisation Technical Note: BUG-R1 Booking/Assessment to Registration Conversion Failure Remediation

**Date:** 2026-09-08  
**Milestone:** BUG-R1  
**Status:** REMEDIATED & INTERNALLY VERIFIED  
**Target Git Branch:** `main`  
**Parent Baseline:** `dcdfd91` (UX-F1)  

---

## 1. Executive Summary & Defect Overview

A critical production-impacting failure was reported in the workflow transitioning prospects from an assessment/booking into a registered student:
```
ASSESSMENT / BOOKING
        ↓
CONVERT TO REGISTRATION
        ↓
TOKENISED REGISTRATION LINK
        ↓
PREFILLED PARENT + CHILD DATA
        ↓
PARENT COMPLETES REGISTRATION
        ↓
SUBMISSION
        ↓
CORRECT CMS RECORDS
```

Parents accessing tokenized prefilled registration links experienced catastrophic client-side crashes, missing clinical/safeguarding prefill information, bypassed terms and signature submission validations, and registered children remaining unactivated ("Leads") in CMS workflows.

This document details the forensic discovery, root-cause mechanisms, multi-child semantics, minimum remediation, automated regression coverage, and rendered visual verification.

---

## 2. Root Cause Forensic Analysis

Forensic analysis across the registration intake and student management surfaces identified four specific failure transitions:

### Defect 1: Client Component Crash on Step 2 (Uncaught TypeError: Cannot read properties of undefined (reading 'map'))
- **Location:** `src/app/register/[...slug]/page.tsx`
- **Mechanism:** In the prefill hydration effect, `setChildList` mapped incoming child records with `{ childId, firstName, lastName, dateOfBirth, schoolYear, sessions }`, leaving `allergies`, `dietaryRequirements`, `medicalConditions`, and consent fields `undefined`.
- **Failure Trigger:** When the user proceeded from Step 1 to Step 2, the JSX expression:
  ```tsx
  {c.allergies.map((allergy, aIdx) => ...)}
  ```
  attempted property access on `undefined`, triggering an uncaught runtime error that unmounted the React tree and left parents on an unrecoverable blank screen.
- **Remediation:**
  1. Hydrated `setChildList` with `...emptyChild()` defaults and explicit `allergies: Array.isArray(c.allergies) ? c.allergies : []`.
  2. Applied defensive fallback guards across Step 2 rendering: `(c.allergies || []).map(...)` and `(c.allergies || []).filter(...)`.

### Defect 2: Submission Gate Validation Bypass (validateStep(6) on a 4-Step Form)
- **Location:** `src/app/register/[...slug]/page.tsx`
- **Mechanism:** `handleSubmit` called `if (!validateStep(6)) return;`. However, `TOTAL_STEPS` is 4, and the `validateStep` handler only checked `s === 1`, `s === 2`, `s === 3`, and `s === 4`. For `s === 6`, `validateStep` returned `true` unconditionally.
- **Failure Trigger:** Parents could submit registrations without agreeing to the terms or providing their digital legal signature, causing server-side 400 rejection or unvalidated intake records.
- **Remediation:** Updated `handleSubmit` to call `if (!validateStep(4)) return;`.

### Defect 3: Prefill Clinical & Safeguarding Information Loss
- **Location:** `src/app/api/register/prefill/route.ts`
- **Mechanism:** The prefill route only mapped basic identity fields (`childId, firstName, lastName, dateOfBirth, schoolYear, sessions`) and discarded existing medical flags, dietary requirements, allergies, doctor information, SEN notes, and consent selections.
- **Remediation:** Extended `transformedChildren` in `GET /api/register/prefill` to project `allergies`, `dietaryRequirements`, `medicalConditions`, `medicationNotes`, `gpName`, `gpPhone`, `senDetails`, `photoConsent`, `sunCreamConsent`, and `firstAidConsent`.

### Defect 4: Sibling Section Soft-Deleted Record Leakage
- **Location:** `src/app/dashboard/students/[id]/page.tsx`
- **Mechanism:** The student profile query for sibling children checked `eq(children.parentId, student.parentId)` and `ne(children.id, student.id)` but omitted `isNull(children.deletedAt)`.
- **Failure Trigger:** Deleted children residing in the Recovery Bin appeared as active siblings on student profiles.
- **Remediation:** Added `isNull(children.deletedAt)` and imported `isNull` from `drizzle-orm`.

### Defect 5: Student Record Activation Gap on Registration Approval
- **Locations:** `src/app/api/register/[id]/status/route.ts` and `src/app/dashboard/registrations/actions.ts`
- **Mechanism:** When staff approved a registration ("Confirm & Sign Up" -> status = `signed_up`), the registration table status updated, but linked child records in `children` remained `isRegistered = false`. They remained classified as "Leads" in the Students grid and were omitted from Attendance rolls and Kiosk check-in.
- **Remediation:** Added automatic batch activation: when registration status updates to `signed_up`, linked `children` records have `isRegistered = true` and `registeredAt = new Date()` stamped atomically.

---

## 3. Multi-Child Token Architecture & Tenant Semantics

1. **Token Payload Model:** A registration prefill token is a stateless HS256 JWT containing:
   ```json
   {
     "parentId": "uuid",
     "centreId": "uuid",
     "childIds": ["uuid-child-1", "uuid-child-2", "uuid-child-3"],
     "exp": 1791439487
   }
   ```
2. **Tenant Isolation:** The prefill endpoint resolves `centres` from `token.centreId` to enforce that `parent.organisationId === centre.organisationId`. Cross-tenant token replay returns 404 or 400.
3. **Multi-Child Sibling Isolation:** For a 3-child registration, each child maintains distinct session preferences, medical histories, allergies, dietary constraints, and individual photo/sun-cream/first-aid consent states.

---

## 4. Quality Gate & Regression Verification

- **Automated Test Suite:** `src/app/api/register/bug-r1-conversion.test.ts` (14 dedicated tests passing).
- **Full Repository Test Suite:** 80 test files, 883 tests passing (0 failures).
- **TypeScript Typecheck:** `tsc --noEmit` cleanly passed (0 errors).
- **ESLint Gate:** `eslint` cleanly passed (0 warnings, 0 errors).
- **Rendered Visual QA:** R1 through R12 captured at desktop (1280x900) and mobile (390px), assembled into `bug-r1-contact-sheet.png`.
- **Production Safety:** Zero production mutations; zero external communications sent; no code pushed or deployed.

---

## 5. BUG-R1.C Certification Reconciliation

### 5.1 Token Architecture Reconciliation
- **Definitive Architecture:** The registration token implementation is **stateless HS256 JWT**, signed using `jose.SignJWT({ parentId, centreId, childIds })` using `AUTH_SECRET` / `NEXTAUTH_SECRET` with a 30-day expiration (`30d`).
- **Resolution of Contradiction:** There is no database table for registration tokens (such as `registration_invitations` or `registration_tokens`). Historical references to an opaque database token in earlier documentation were inaccurate. The system relies purely on signed cryptographic JWT claims validated server-side by `/api/register/prefill`.
- **Public URL Structure:**
  `/register/[orgSlug]/[centreSlug]?token=${encodeURIComponent(jwtToken)}`

### 5.2 Token Replay and Concurrency Semantics
- **Replay Behavior:** The JWT itself is stateless and remains cryptographically valid until its 30-day expiration window elapses.
- **Submission Guard:** The server action `submitPublicRegistration` handles duplicate submissions deterministically:
  - Validates parent and child data integrity.
  - Concurrency conflict handling prevents corrupted duplicate records.
  - Runtime regression tests in `src/app/api/register/bug-r1-conversion.test.ts` verify replay handling, 409 conflict responses on identical duplicate payloads, and tamper-resistance against invalid HMAC signatures.

### 5.3 Database Multi-Child Audit (Eleanor Vance Family)
- **Centre:** Oakridge Central (`e9e4d3bf-23eb-4ac6-8600-8658d05dad9e`)
- **Parent:** Eleanor Vance (`4c8eec71-0ba7-4c50-9f9a-bfb2e88b590b`, `eleanor.vance@training.test`)
- **Children:**
  1. Theodora Vance (`ea01b2e1-cc8a-4bb1-9b5c-1832a564c554`, Year 4 / Y4, Allergies: Peanuts)
  2. Luke Vance (`52278757-0398-4a3f-b6ad-52f5272db4dd`, Year 2 / Y2, Allergies: Penicillin)
  3. Nell Vance (`e83df08d-7629-4f33-b28f-3baaa381e63c`, Reception, Allergies: None)
  - Soft-deleted child Arthur Vance (`529323c2-d4b9-4fcf-8472-87ba4ebc210d`, `deleted_at: 2026-09-08`) is excluded from prefill tokens and student profile sibling listings.
- **Resulting Intake Record:**
  - `registrations`: `e6cf966f-36fe-4294-a285-f94e16940ea2` (`status: awaiting_confirmation`)
  - `registration_children`: 3 child records linking each child with `was_matched: true`.

### 5.4 Visual Evidence Index (R1–R12 & Contact Sheet)
- **Contact Sheet:** `/Users/KWADW/.gemini/antigravity/brain/eb75c24a-b79b-4e86-81e7-ce60906286fb/bug-r1-screenshots/bug-r1-contact-sheet.png`
- **Screenshots Directory:** `/Users/KWADW/.gemini/antigravity/brain/eb75c24a-b79b-4e86-81e7-ce60906286fb/bug-r1-screenshots/`
  1. `R1-source-booking-before-conversion.png`: Source booking for Eleanor Vance with 3 attendees at Oakridge Central.
  2. `R2-convert-action-visible.png`: Student profile Registration tab showing "Generate & copy prefilled link".
  3. `R3-conversion-succeeds-modal.png`: Prefilled registration link modal with Theodora, Luke, and Nell Vance; soft-deleted Arthur Vance cleanly excluded.
  4. `R4-public-link-opened.png`: Public prefill landing view with fee structure and registration intake CTA.
  5. `R5-single-child-prefilled.png`: Single-child prefilled intake view for Eleanor Vance showing pre-fill indicator banner.
  6. `R6-three-child-presence.png`: Three-child prefilled intake view showing child cards for Theodora, Luke, and Nell.
  7. `R7-three-child-medical-isolation.png`: Step 2 medical isolation showing distinct clinical data (Theodora: Peanuts, Luke: Penicillin, Nell: None).
  8. `R8-step4-validation-enforced.png`: Step 4 validation gate enforcing signature and terms agreement before submission.
  9. `R9-submission-success-confirmation.png`: Parent confirmation view with green checkmark "Registration Submitted!" and PDF download option.
  10. `R10-cms-registration-record.png`: CMS Registrations queue showing Eleanor Vance intake with status "Awaiting confirmation".
  11. `R11-cms-resulting-students.png`: CMS Students list displaying active Vance student profiles.
  12. `R12-token-fail-closed-state.png`: Security boundary showing amber warning banner "Booking link expired or invalid" when an invalid token is supplied.

---

## 6. BUG-R1.D Replay & Final Certification Gate

### 6.1 Token Replay & Concurrency Semantics
- **JWT Lifespan & Replay Characteristics:** The JWT is stateless and valid for 30 days. It is **NOT** single-use and is **NOT** destroyed or marked consumed upon parent submission (no token table exists). Opening the link again during the 30-day window re-renders the prefilled wizard.
- **Sequential Replay Protection:** When a parent attempts a second submission using the same valid JWT and child names, `POST /api/register` executes an exact duplicate check:
  - Scoped by `organisations.id`, `parents.email`, and child `first_name`s.
  - Replay attempts are rejected with HTTP 409:
    `{ duplicate: true, error: 'A registration for this child already exists. Please contact the centre if you need to make changes.' }`
  - Replay attempts create **0** new registrations, **0** new parents, and **0** new students.
- **Concurrent Replay Protection:** To prevent race conditions where simultaneous requests slip past duplicate detection before either inserts a record, `POST /api/register` acquires a PostgreSQL transactional advisory lock (`pg_advisory_xact_lock`) derived deterministically from `org.id` and the primary parent's normalized email (`reg_submit_${org.id}_${email}`). Under concurrency testing:
  - Request 1: HTTP 201 Created (registration record inserted).
  - Request 2: HTTP 409 Conflict (blocked by duplicate check serialized behind Request 1).
  - Registrations created: exactly 1.
- **Reused-Link UX Debt:** Reopening a previously submitted link renders the prefilled wizard again. If the parent resubmits, the UI displays the error banner: *"A registration for this child already exists. Please contact the centre if you need to make changes."* This is classified as **ACCEPTABLE FOLLOW-UP UX DEBT** (data integrity and privacy boundaries remain fully protected).

### 6.2 Registration Status vs Student Activation
- **Parent Submission State:** Submitting the registration sets `status = 'awaiting_confirmation'`. Linked child records in `children` remain `isRegistered = false` and `registeredAt = null`. Unconfirmed students are **NOT** active registered students.
- **Staff Confirmation State:** When staff reviews the submission in CMS and confirms it (transitioning status to `signed_up`), linked `children` records are atomically updated to `isRegistered = true` and `registeredAt = NOW()`.

### 6.3 Privacy & Tenant Isolation Boundaries
- **Cross-Tenant Isolation:** `GET /api/register/prefill` resolves the centre from `token.centreId` and enforces that `parent.organisationId === centre.organisationId`. Presenting an Org A token in an Org B context returns HTTP 404.
- **Tampering Resistance:** Tampering with any payload claims invalidates the HS256 HMAC signature; `jwtVerify` throws and the endpoint returns HTTP 400.
- **Soft-Deleted Children:** Children with `deleted_at IS NOT NULL` are excluded from prefill hydration even if their IDs are present in the token's `childIds` array.

---

## 7. Automated Quality Gates

- **Dedicated Test Suite:** `npx vitest run src/app/api/register/bug-r1-conversion.test.ts` -> 28/28 tests passing.
- **Full Test Suite:** `npm test` -> 80 test files passed (80/80), 897 tests passed (897/897).
- **TypeScript Typecheck:** `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` -> 0 errors.
- **ESLint Gate:** `npm run lint` -> 0 warnings, 0 errors.
- **Production Build:** `NODE_OPTIONS="--max-old-space-size=4096" npm run build` -> 0 errors, 157 routes compiled.
- **Git Diff Check:** `git diff --check` -> Clean.
