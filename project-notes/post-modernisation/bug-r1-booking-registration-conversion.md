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

## 5. Contact Sheet & Screenshot Index

- **Contact Sheet:** `/Users/KWADW/.gemini/antigravity/brain/eb75c24a-b79b-4e86-81e7-ce60906286fb/bug-r1-screenshots/bug-r1-contact-sheet.png`
- **Screenshot Directory:** `/Users/KWADW/.gemini/antigravity/brain/eb75c24a-b79b-4e86-81e7-ce60906286fb/bug-r1-screenshots/`
  - `R1-student-profile-siblings.png`: Student profile with active siblings only.
  - `R2-single-child-link.png`: Tokenized link landing / fees intro.
  - `R3-single-child-step1-prefilled.png`: Step 1 prefilled parent details.
  - `R4-single-child-step2-allergies.png`: Step 2 remediated crash site with prefilled allergies & medical details.
  - `R5-single-child-step3-contacts.png`: Step 3 preferred sessions and funding.
  - `R6-single-child-step4-signature.png`: Step 4 digital signature and terms agreement gate.
  - `R7-three-child-step1-prefilled.png`: Three-child multi-intake intake cards.
  - `R8-three-child-step2-medical.png`: Three-child medical isolation.
  - `R9-invalid-token-error.png`: Security fallback for invalid/expired token.
  - `R10-mobile-step1-single.png`: Mobile 390px Step 1 view.
  - `R11-mobile-step2-allergies.png`: Mobile 390px Step 2 view.
  - `R12-cms-registrations-queue.png`: CMS registrations queue with status actions.
