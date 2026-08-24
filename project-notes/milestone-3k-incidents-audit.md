# Milestone 3K — Incidents Module Audit

**Date:** 2026-08-24
**Starting SHA:** ba725cf
**Branch:** rebuild/cms-modernisation
**Auditor:** Antigravity (Implementer)

---

## Proposed Module: Incidents

Evidence:
- Route: `/dashboard/incidents`
- Sidebar entry: "Incidents" with `AlertTriangle` icon (Sidebar.tsx ROLE_NAV)
- Roles visible in sidebar: ORG_OWNER, MANAGER, FRONT_DESK, TUTOR (broadest of unfrozen modules)
- Feature dir: `src/features/incidents/actions.ts`
- UI: `IncidentsClient.tsx`, `NewIncidentModal.tsx`, `loading.tsx`
- No competing 3K milestone document in `project-notes/`

---

## A. Surface Inventory

### Dashboard Routes

| Route | Type | Purpose | Auth | Role Gate |
|---|---|---|---|---|
| `/dashboard/incidents` | Server Page | List and create incident/safeguarding records | `requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })` | ORG_OWNER, MANAGER |
| `/dashboard/incidents` loading | Server | Skeleton loading | none (loading.tsx) | — |

> **Inconsistency:** The page enforces ORG_OWNER/MANAGER but the sidebar ROLE_NAV shows Incidents to FRONT_DESK and TUTOR as well. See Ambiguity A-1.

### Client Components

| Component | Location | Purpose |
|---|---|---|
| `IncidentsClient` | `src/app/dashboard/incidents/IncidentsClient.tsx` | Incident list, search, table, modal trigger |
| `NewIncidentModal` | `src/app/dashboard/incidents/NewIncidentModal.tsx` | Log incident form with child picker, type selector, signature pad |

### Server Actions

| Action | File | Purpose |
|---|---|---|
| `getIncidents(centreId)` | `src/features/incidents/actions.ts` | Fetch incidents for a centre; filters safeguarding from non-MANAGER |
| `createIncident(data)` | `src/features/incidents/actions.ts` | Insert new incident record |
| `getCentreChildren(centreId)` | `src/features/incidents/actions.ts` | Fetch children for incident form picker |

### API Routes

None. No `/api/incidents` endpoint exists.

### Shared Dependencies

`react-signature-canvas`, `requireAuth`, `requirePermission`, `getUserAccessibleCentreIds`, `resolveActiveCentreId`

### Cross-module Consumers

No other module imports from `src/features/incidents/`. Incidents is a standalone leaf module.

---

## B. Data Model

### `incidents` Table (schema.ts:687)

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | NOT NULL | PK |
| `organisationId` | UUID | NOT NULL | FK → organisations, cascade |
| `centreId` | UUID | NOT NULL | FK → centres, cascade |
| `childId` | UUID | NOT NULL | FK → children, cascade |
| `type` | incidentTypeEnum | NOT NULL | 'accident','incident','medication','safeguarding' |
| `date` | timestamptz | NOT NULL | When incident occurred |
| `description` | text | NOT NULL | Free-text |
| `treatment` | text | NULL | For accident/medication |
| `witnesses` | text | NULL | Free-text witness names |
| `bodyMapCoordinates` | jsonb | NULL | No UI currently populates this |
| `staffSignature` | text | NULL | base64 DataURL in practice |
| `parentSignature` | text | NULL | Schema field; no UI writes it |
| `createdAt` | timestamptz | NOT NULL | defaultNow() |
| `updatedAt` | timestamptz | NOT NULL | defaultNow() |

No soft-delete on `incidents`. Permanent records (cascade delete only).

---

## C. Read-Path Authorization

### `getIncidents(centreId)`

| Check | Status | Notes |
|---|---|---|
| Authentication | PASS | throws if no session |
| Organisation scoping | PASS | `eq(incidents.organisationId, session.user.organisationId)` |
| Centre filter | PASS | `eq(incidents.centreId, centreId)` |
| Centre-membership check | MISSING | Caller-supplied centreId not verified against user's accessible centres. FRONT_DESK calling directly could read another centre's incidents within the same org. |
| Safeguarding filtered for lower roles | PASS | `requirePermission('MANAGER')` try/catch |
| Soft-deleted children in join | MISSING | `innerJoin(children...)` has no `isNull(children.deletedAt)` |
| Direct URL access | PASS | page requires ORG_OWNER/MANAGER |

### `getCentreChildren(centreId)`

| Check | Status | Notes |
|---|---|---|
| Authentication | PASS | throws if no session |
| Organisation scoping | PASS | `eq(children.organisationId, session.user.organisationId)` |
| centreId filter used | MISSING | centreId parameter completely ignored — returns ALL org children |
| Soft-deleted children | MISSING | No `isNull(children.deletedAt)` |
| Unregistered children | MISSING | No `eq(children.isRegistered, true)` — assessment/unregistered children appear |

---

## D. Mutation Authorization

### `createIncident(data)`

| Check | Status | Notes |
|---|---|---|
| Authentication | PASS | throws if no session |
| Organisation from session | PASS | `session.user.organisationId` |
| Safeguarding restricted to MANAGER+ | PASS | `requirePermission('MANAGER')` for type='safeguarding' |
| centreId belongs to session org | MISSING | Caller-supplied centreId not verified. Cross-org centreId injection possible. |
| childId belongs to session org | MISSING | Caller-supplied childId not verified. Cross-org childId injection possible. |
| Non-safeguarding role gate | AMBIGUOUS | Any authenticated user can call action for accident/incident/medication. Page gates ORG_OWNER/MANAGER but action does not. Product policy question — see A-1. |

---

## E. Input Validation / Output Safety

| Field | Validation | Notes |
|---|---|---|
| `centreId` | TypeScript type only | No org-ownership server check |
| `childId` | TypeScript type only | No org-ownership server check |
| `type` | DB enum enforced | Safe |
| `date` | Server-set `new Date()` | Not trusted from client |
| `description` | Non-empty client check | No server-side length limit |
| `staffSignature` | None | base64 DataURL, can be 50-200 KB; no size cap server-side |
| Output (description, names) | Rendered as text content | No XSS risk via React text nodes |

---

## F. Behavioural Correctness

### F-1 — Dead "View PDF" button [CONFIRMED DEFECT D1]

`IncidentsClient.tsx:132` — `<button>View PDF</button>` has no onClick handler. No PDF route or library exists. Raises user expectations it cannot fulfil.

### F-2 — `glassmorphic-card` class not in frozen design system [CONFIRMED DEFECT D2]

Used in `IncidentsClient.tsx` empty state (line 99) and `loading.tsx` (line 8). Not in the frozen CSS token set.

### F-3 — `getCentreChildren` ignores centreId [CONFIRMED DEFECT D3]

Function signature accepts `centreId` but the query only filters by `organisationId`. All org children appear in the picker regardless of active centre.

### F-4 — Soft-deleted children not filtered [CONFIRMED DEFECT D4]

`children.deletedAt` exists for soft-delete. Neither `getCentreChildren` nor `getIncidents` join filters `isNull(children.deletedAt)`.

### F-5 — createIncident accepts cross-org centreId / childId [CONFIRMED DEFECT D5]

No verification that caller-supplied `centreId` or `childId` belongs to the session org before insert.

### F-6 — Page shell on pre-modernisation tokens [CONFIRMED DEFECT D6]

`page.tsx` uses `text-foreground`, `text-muted-foreground` — pre-modernisation Tailwind/shadcn tokens, not the frozen CMS design system (`text-text`, `text-text-muted`, etc.).

### F-7 — IncidentsClient / NewIncidentModal on pre-modernisation tokens [CONFIRMED DEFECT D7]

`bg-card`, `bg-secondary`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground` throughout both client components.

### F-8 — Combined view redirect is silent [ARCHITECTURAL DEBT, not a defect]

When `activeCentreId === 'all'` the page silently redirects to Dashboard with no explanation. Intentional (incidents require centre context) but poor UX. Document only — not a code defect.

---

## G. Integration Audit

### react-signature-canvas

- Client-side; captures staff signature as base64 DataURL
- Stored in `incidents.staffSignature` text column
- No size validation, format validation, or deduplication
- No external service; stored directly in DB

### PDF Generation

- Non-existent. "View PDF" button is dead UI (D1).

---

## H. Cross-module Interactions

| Frozen module | Interaction | Impact |
|---|---|---|
| `src/lib/permissions.ts` | `requirePermission('MANAGER')` called in actions | Read-only; no change needed |
| `src/components/dashboard/Sidebar.tsx` | ROLE_NAV controls sidebar visibility | May need narrow edit pending A-1 resolution |
| `children` table / schema | `getCentreChildren` and `getIncidents` join read children | Adding `isNull(deletedAt)` filter is a safe, narrow fix |

---

## I. Ambiguities

### A-1 [BLOCKING — Requires Orchestrator Decision]

**Role policy for incident access.**

Evidence in tension:
- Sidebar shows Incidents to: ORG_OWNER, MANAGER, **FRONT_DESK, TUTOR**
- Page gate restricts to: ORG_OWNER, MANAGER only
- `createIncident` action has no role gate for non-safeguarding types

**Options:**
- **Option A:** FRONT_DESK (and possibly TUTOR) can log accident/incident/medication (not safeguarding). Page gate expands to include FRONT_DESK. Safeguarding gate stays in action.
- **Option B:** Only ORG_OWNER/MANAGER access Incidents. Remove FRONT_DESK/TUTOR from sidebar ROLE_NAV. Page gate correct as-is.
- **Option C:** Hybrid — FRONT_DESK can access Incidents but not TUTOR.

**Cannot resolve without orchestrator input. This determines Sidebar.tsx changes and page gate.**

### A-2 [Non-blocking]

Combined view (activeCentreId='all') silently redirects. Intentional but unexplained to user.

### A-3 [Non-blocking]

`parentSignature` schema column — no UI writes it. Dead schema or planned feature.

### A-4 [Non-blocking]

`bodyMapCoordinates` JSONB — no UI implements it. Partial implementation or dead debt.

---

## J. Out-of-scope Debt

| Item | Reason |
|---|---|
| PDF generation implementation | Major feature; D1 fix is to remove dead button |
| Parent signature flow | Requires parent portal integration |
| Body map UI | Requires specialist diagram assets |
| `staffSignature` server-side size validation | Architectural debt; no production issue |
| Incident pagination | No scale issue at current org+centre scope |
| npm audit vulnerabilities | Repository-level; separate track |

---

## Stage A Checkpoint Summary

### Confirmed Defects: 7

| ID | Description | Type |
|---|---|---|
| D1 | Dead "View PDF" button (no onClick, no route, no library) | Behavioural |
| D2 | `glassmorphic-card` class in empty state and loading — not in frozen design system | Visual |
| D3 | `getCentreChildren` ignores centreId parameter — returns all-org children | Behavioural |
| D4 | Soft-deleted children not filtered from picker or incident join | Security/Behavioural |
| D5 | `createIncident` does not verify centreId/childId org ownership | Security |
| D6 | Page shell uses pre-modernisation tokens | Visual |
| D7 | IncidentsClient + NewIncidentModal use pre-modernisation tokens throughout | Visual |

### Blocking Ambiguity: A-1

Role policy for FRONT_DESK/TUTOR incident access must be decided by orchestrator before modifying Sidebar.tsx or the page gate.

### Proposed Stage B (after A-1 resolution)

Fix D1–D7, add regression tests for D3/D4/D5, modernise all surfaces onto frozen design system, verify responsive/dark/light presentation.
