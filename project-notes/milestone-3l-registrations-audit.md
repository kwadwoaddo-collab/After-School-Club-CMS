# Milestone 3L — Registrations Module Audit

**Date:** 2026-08-24
**Starting SHA:** 9210cda
**Branch:** rebuild/cms-modernisation
**Auditor:** Antigravity (Implementer)

---

## A. Surface Inventory

### Staff-facing Registrations routes

| Route | Component | Type |
|---|---|---|
| `/dashboard/registrations` | `page.tsx` | Server Page — list with KPI counts, filters, bulk actions |
| `/dashboard/registrations` | `loading.tsx` | Skeleton loading state |
| `/dashboard/registrations/[id]` | `[id]/page.tsx` | Server Page — registration detail |
| `/dashboard/registrations/[id]` | `[id]/loading.tsx` | Detail skeleton loading state |

### Staff-facing component files

| File | Purpose |
|---|---|
| `src/components/dashboard/RegistrationsBulkClient.tsx` | Client: table, bulk selection, bulk status update, bulk email, CSV export, delete |
| `src/app/dashboard/registrations/[id]/StatusUpdater.tsx` | Client: single-record status dropdown (via `/api/register/[id]/status`) |
| `src/app/dashboard/registrations/[id]/EditRegistrationForm.tsx` | Client: inline edit of registration fields, parents, children |
| `src/app/dashboard/registrations/[id]/DownloadButton.tsx` | Client: PDF download via @react-pdf/renderer |
| `src/app/dashboard/registrations/[id]/BackButton.tsx` | Client: back navigation |
| `src/features/registration/components/RegistrationsFilters.tsx` | Client: search, centre filter, clear filters |
| `src/components/dashboard/CopyRegistrationLink.tsx` | Client: copy registration URL |

### Server actions

| Action | File | Role gate |
|---|---|---|
| `deleteRegistrations` | `registrations/actions.ts` | ORG_OWNER only |
| `assignRegistrationCentre` | `registrations/actions.ts` | **None** — any authenticated user |
| `updateRegistrationDetails` | `registrations/actions.ts` | Any authenticated user with organisationId |
| `updateRegistrationStatus` | `registrations/actions.ts` | Any authenticated user with organisationId |
| `generateRegistrationLink` | `registrations/actions.ts` | Any authenticated user; centre check for non-owner |

### API routes

| Method | Route | Auth | Role gate |
|---|---|---|---|
| POST | `/api/register` | Unauthenticated (public) | None (rate-limited) |
| GET | `/api/register` | Required | Org-scoped; centre-scoped for non-ORG_OWNER |
| PATCH | `/api/register/[id]/status` | Required | Org-scoped; centre-scoped for non-ORG_OWNER |
| POST | `/api/register/bulk-email` | Required | ORG_OWNER, MANAGER |
| GET | `/api/register/prefill` | Unauthenticated (public) | JWT-gated only |

---

## B. Registration Lifecycle

### Status enum (schema: `registrationStatusEnum2`)

```
awaiting_confirmation  (default on creation)
signed_up
not_interested
pending                (in DB enum; not exposed in UI — NB-1)
```

### Lifecycle

1. Public submits `POST /api/register` → registration created as `awaiting_confirmation`.
2. Parent and child canonical records created **at submission time** within the same transaction.
3. Staff see the registration in the list.
4. Staff update status via:
   - `StatusUpdater` → `PATCH /api/register/[id]/status`
   - Bulk update in `RegistrationsBulkClient` → `PATCH /api/register/[id]/status` per ID
5. On `signed_up` or `not_interested`, status notification email sent to primary parent.
6. **No approval → conversion step.** Records exist from submission. Status change is operational metadata only.
7. Status transitions are unrestricted server-side (AMBIGUITY A-1).

### Duplicate detection

Public POST checks primary parent email + child first name within org → HTTP 409 on match. Not a hard block (API returns `duplicate: true` and client may still proceed).

---

## C. Authentication and Role Policy

### Sidebar visibility

| Role | Registrations visible |
|---|---|
| ORG_OWNER | Yes |
| MANAGER | Yes |
| FRONT_DESK | **No** |
| TUTOR | No |

### Page gates

| Page | Gate |
|---|---|
| `/dashboard/registrations` | `requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] })` |
| `/dashboard/registrations/[id]` | Manual: `['ORG_OWNER', 'MANAGER', 'FRONT_DESK'].includes(userRole)` |

**Critical mismatch (A-2):** Page gates allow FRONT_DESK. Sidebar does not. FRONT_DESK can access Registrations by direct URL but cannot navigate there.

### Server action role gaps

| Action | Gap |
|---|---|
| `assignRegistrationCentre` | No role check — D1 |
| `updateRegistrationDetails` | No role check — D2 |
| `updateRegistrationStatus` | No role check — D3 |

### API route protection

| Route | Protection |
|---|---|
| `GET /api/register` | Auth + org + centre scope |
| `PATCH /api/register/[id]/status` | Auth + org + centre scope |
| `POST /api/register/bulk-email` | Auth + ORG_OWNER/MANAGER role + org scope |

---

## D. Organisation Isolation

- **List page:** `eq(registrations.organisationId, orgId)` on all queries. Centre scope layered on top. OK.
- **Detail page:** `and(eq(registrations.id, id), eq(registrations.organisationId, orgId))`. Cross-org ID rejected with `notFound()`. OK.
- **`assignRegistrationCentre`:** No `organisationId` verification in WHERE clause → cross-org `centreId` mutation possible. **D1**
- **`updateRegistrationDetails`:** Verifies registration belongs to org. But does not verify that supplied `parentId` / `childId` belong to session org when updating canonical records. Cross-org PII mutation possible. **D2**
- **`POST /api/register` prefill replay:** `prefillParentId` from JWT not verified as belonging to resolved org — cross-org parent record update possible. **D4**

---

## E. Centre Isolation

- **List page:** `getUserAccessibleCentres` returns assigned centres for non-owners. `inArray(centreIds)` applies. Safety valve for 0 centres. OK.
- **Registrations with `centreId = null`:** Hidden from non-owners (inArray does not match null). Existing behaviour. **AMBIGUITY A-3**
- **`assignRegistrationCentre`:** No centre-access check — any authenticated user can assign any centreId. **D1**
- **`PATCH /api/register/[id]/status`:** Centre check for non-ORG_OWNER. OK.
- **`POST /api/register/bulk-email`:** No centre check for MANAGER. **D5**

---

## F. Registration → Student/Parent Conversion

No separate conversion step. Records created at submission time in `db.transaction()`. Transaction is atomic; failure rolls back entirely. OK.

**Prefill cross-org replay (D4):** If a valid JWT for org A's parent is replayed against org B's registration form, org A's parent record is updated with B's submitted data, and the new registration is linked to A's parent.

---

## G. Bulk Email

- Auth + ORG_OWNER/MANAGER role gate. OK.
- Org isolation: server re-fetches with org scope. Cross-org IDs silently excluded. OK.
- Centre isolation: **absent for MANAGER.** D5.
- Recipients derived server-side from `submittedEmail`. OK.
- Failure accounting: `Promise.allSettled()` with sent/skipped/failed counts. OK.

---

## H. Prefill

- Unauthenticated (intentional for public form usage).
- HMAC-HS256 JWT verification required. OK.
- No org-scoping on parent lookup — PII returned to any valid-token holder without org verification.
- Combined with D4: cross-org token replay can expose PII and mutate parent records.

---

## I. Public Registration Creation

- Rate limited (IP). OK.
- Zod validation schema. OK.
- Org resolved by `orgSlug` (not client-supplied orgId). OK.
- `centreId` verified against org. OK.
- `termsAgreed: z.literal(true)`. OK.
- Cross-org prefill replay gap. D4.

---

## J. Soft Deletion

- `registrations` table has no `deletedAt`. Hard-deleted by ORG_OWNER only.
- `parents` / `children` have `deletedAt`.
- Status update email flow fetches parents/children **without `isNull(deletedAt)` filter**. D6.

---

## K. Search / Filtering / Counts

- Two-phase search (ID lookup → main query). Org + centre scoped in both phases. OK.
- Status counts: aggregate query with same org/centre WHERE. OK.
- `pending` status in DB enum not exposed in UI. NB-1.

---

## L. Input Validation

- `assignRegistrationCentre`: accepts any string `centreId`, no UUID validation, no org check. D1.
- `updateRegistrationDetails`: `parentsData[i].id` used in WHERE with no ownership verification. D2.
- `updateRegistrationStatus` (server action): status not validated at runtime (only TypeScript). Low exploitability from UI; action is effectively dead.

---

## M. Sensitive Data / Safeguarding

Fields exposed: child name, DOB, school year, sessions; parent name, relationship, email, phone, address; emergency contact; medical/SEN details; funding type; parent signature (base64); `termsAgreed`.

FRONT_DESK can view medical/SEN data. No precedent from Incidents (safeguarding restricted to MANAGER+) explicitly covers registration medical data. Documented as **AMBIGUITY A-4**.

---

## N. Error Handling / UX

- **D7:** `bulkUpdateStatus` reports `✓ Updated N registrations` unconditionally — does not inspect individual fetch responses.
- **D8:** `StatusUpdater` calls `router.refresh()` without checking the fetch response status — silent failure on 403/500.

---

## O. Accessibility

- StatusUpdater: correct listbox/option ARIA. OK.
- EditRegistrationForm: label-to-input association via wrapping label. OK.
- **D9:** Individual row checkboxes in table lack accessible labels.

---

## P. Responsive Behaviour

- Detail page: `max-w-4xl`, `flex-wrap`, `grid-cols-1 md:grid-cols-2`. Generally OK structurally.
- Table: `overflow-x-auto` wrapper. OK.
- Loading skeletons use `glassmorphic-card`. D10.
- Detail page cards all use `glassmorphic-card`. D10.

---

## Q. Light / Dark Mode

- Detail page uses `text-foreground`, `text-on-surface-variant`, `text-slate-400` (hardcoded). Minor.
- **D11:** `EditRegistrationForm` uses `text-white`, `text-white/90`, `border-white/5`, `bg-white/5` throughout — broken in light mode.

---

## R. Dead / Orphaned Code

- `updateRegistrationStatus` server action: exported but no UI component calls it; StatusUpdater uses the API route. AD-2.
- List `loading.tsx`: renders KPI card grid; actual page renders a filter bar + table. D12.

---

## S. Finding Classification

### Confirmed Defects: 12

| ID | Description | Type |
|---|---|---|
| D1 | `assignRegistrationCentre`: no role check; no org ownership check on registration or centreId | Security |
| D2 | `updateRegistrationDetails`: no role check; canonical parentId/childId not verified as belonging to session org | Security |
| D3 | `updateRegistrationStatus` server action: no role check (dead code but exploitable) | Security |
| D4 | `POST /api/register`: prefillParentId from JWT not org-verified — cross-org parent mutation via token replay | Security |
| D5 | `POST /api/register/bulk-email`: no centre-level check for MANAGER role | Security |
| D6 | Status update email flow lacks `isNull(deletedAt)` filter on parent/child lookups | Correctness |
| D7 | `bulkUpdateStatus`: success message unconditionally uses `ids.length`, ignoring individual response codes | UX |
| D8 | `StatusUpdater`: does not check fetch response before `router.refresh()` — silent failure | UX |
| D9 | Row checkboxes in registration table lack accessible labels | Accessibility |
| D10 | `glassmorphic-card` in detail page, EditRegistrationForm, and both loading.tsx files — not in frozen design system | Visual |
| D11 | `EditRegistrationForm`: hardcoded `text-white`, `bg-white/5` etc. — broken in light mode | Visual |
| D12 | List `loading.tsx` skeleton structure (KPI cards + card grid) does not match actual page (filter bar + table) | Visual |

### Ambiguities: 4

| ID | Description | Blocking? |
|---|---|---|
| A-1 | Status transition enforcement: should reversals be server-side blocked? | No |
| A-2 | FRONT_DESK sidebar vs page gate mismatch — intentional or oversight? | **Yes** |
| A-3 | Registrations with `centreId = null` invisible to non-owners | No |
| A-4 | FRONT_DESK access to medical/SEN registration data | No |

### Architectural Debt

| ID | Description |
|---|---|
| AD-1 | TOCTOU duplicate detection race in concurrent POST requests |
| AD-2 | `updateRegistrationStatus` server action is dead code |

### Non-Blocking Observations

| ID | Description |
|---|---|
| NB-1 | DB enum has `pending` status; no UI handling |
| NB-2 | Prefill endpoint returns extensive PII to valid-token holders (by design) |
| NB-3 | `text-on-surface-variant`, `border-outline-variant` tokens used — verify against frozen token set |

---

## Stage A Checkpoint Summary

### Confirmed Defects: 12 (D1–D12)

### Blocking Ambiguity: A-2

**A-2 requires orchestrator direction before Stage B.**

Evidence:
- `page.tsx`: `requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] })`
- `[id]/page.tsx`: manual check includes FRONT_DESK
- `Sidebar.tsx` ROLE_NAV: FRONT_DESK does not include 'Registrations'
- FRONT_DESK can reach Registrations by direct URL; cannot navigate there via sidebar

Current behaviour: FRONT_DESK has server-side access but no navigation entry.

Established precedent: Incidents A-1 (3K) resolved with FRONT_DESK access granted and sidebar updated. Registrations is similar operational workflow.

Options:
- **Option A:** Remove FRONT_DESK from page gates → restrict to ORG_OWNER/MANAGER only
- **Option B:** Add Registrations to FRONT_DESK ROLE_NAV → make access consistent
- **Option C:** Leave page gate and sidebar mismatched (not recommended — confusing)

Implementer recommendation: **Option B**, consistent with Incidents A-1 resolution and the operational reality that FRONT_DESK staff need to track registration status.

### Stage B deferred pending orchestrator decision on A-2.
