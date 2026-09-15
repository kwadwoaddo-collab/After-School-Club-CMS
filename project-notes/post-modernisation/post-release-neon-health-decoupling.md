# Post-Release Neon Compute Optimisation: Health-Check Decoupling

## Executive Summary

Following the formal certification of SprintScale CMS for live production use (`cms-final-production-live-use-certified` at commit `723b8ee`), an operational investigation was initiated regarding monthly Neon compute consumption.

On 15 September 2026, Neon reported **89.68 / 100 CU-hours consumed (~89.7% of monthly Free allowance)** within 15 days of the billing cycle (~6.0 CU-hours/day), despite zero active user load.

This document records the empirical root cause, architectural fix, deployment verification, and operational guidance.

---

## 1. Context & Operational Problem

- **Certified Main Baseline**: `723b8ee87c2682a72e87d02bb09d31bba0568775`
- **Production URL**: `https://app.sprintscaleit.co.uk`
- **Neon Project**: `after-school-club-prod` (`old-glitter-51244715`)
- **Active Branch**: `dev` (`br-steep-hall-ab5smj8b`)
- **Production Endpoint**: `ep-super-dawn-abuicpc2`
- **Neon Sizing**: Min 0.25 CU, Max 2.0 CU
- **Autosuspend Window**: 300 seconds (5 minutes)

### Observed Metric
Neon reported continuous compute activity at 0.25 CU:
$$0.25\text{ CU} \times 24\text{ hours/day} \times 15\text{ days} = 90.00\text{ CU-hours}$$
Measured usage of 89.68 CU-hours matched 99.64% of theoretical maximum continuous 0.25 CU operation.

---

## 2. Root Cause Discovery

Empirical analysis of production Vercel logs identified an external uptime monitor sending paired `HEAD` and `GET` requests to `https://app.sprintscaleit.co.uk/api/health` every **305 seconds (5 minutes 5 seconds)**:

- `03:00:10 UTC` -> HEAD /api/health (200), GET /api/health (200)
- `03:05:16 UTC` -> HEAD /api/health (200), GET /api/health (200)
- `03:10:22 UTC` -> HEAD /api/health (200), GET /api/health (200)
- `03:15:28 UTC` -> HEAD /api/health (200), GET /api/health (200)
- ... continuous 24/7 cadence (288 cycles / 576 requests per day)

### Failure Mechanism
The legacy `/api/health` handler executed `await db.execute(sql\`SELECT 1\`);` on every probe without caching.
Because Neon requires 300 seconds (5 minutes) of complete silence before autosuspending, incoming queries every 305 seconds kept compute awake for ~300 of every ~305 seconds (98.4% duty cycle), preventing meaningful sleep.

Other potential causes (PM-2B broadcast worker, billing cron, auth session polling, frontend polling, other Neon branches) were forensically audited and completely ruled out. All crons run strictly once daily.

---

## 3. Architecture Remediation

The application and database health monitoring paths were decoupled cleanly:

### 1. Shallow Health Endpoint (`/api/health`)
- **Purpose**: High-frequency uptime monitoring (e.g. 1-to-5 minute probes).
- **Behaviour**: Validates Next.js runtime responsiveness.
- **Invariants**:
  - **Zero database queries** (`@/db` and Drizzle ORM completely removed).
  - **Zero external network calls**.
  - **Zero auth/session processing**.
  - **Explicit HEAD handler**: Returns HTTP 200 with empty body (`new Response(null, { status: 200 })`).
  - **GET Response**: `HTTP 200 {"ok": true}` (100% backwards compatible).

### 2. Deep Health Endpoint (`/api/health/deep`)
- **Purpose**: Low-frequency infrastructure dependency monitoring (e.g. 30-to-60 minute probes).
- **Behaviour**: Executes `SELECT 1` against Neon.
- **Invariants**:
  - Success: `HTTP 200 {"ok": true, "database": "healthy"}`.
  - Failure: `HTTP 503 {"ok": false, "database": "unreachable"}`.
  - **Error Boundary**: Catches all connection errors and suppresses hostnames, credentials, database URLs, error messages, and stack traces.

---

## 4. Quality Assurance Evidence

All quality gates passed before deployment:

| Gate | Target | Result | Status |
| :--- | :--- | :--- | :--- |
| **Vitest Tests** | Full regression suite | **90 suites passed (90), 1,101 tests passed (1,101)** | **PASS** |
| **TypeScript** | `tsc --noEmit` | **0 TypeScript errors** | **PASS** |
| **ESLint** | `eslint` | **0 errors, 4 known warnings** | **PASS** |
| **Next.js Build** | Production Turbopack build | **160 routes compiled cleanly (exit 0)** | **PASS** |
| **Git Diff Check** | Whitespace & EOF check | **Clean (exit 0)** | **PASS** |

---

## 5. Deployment Record

- **Implementation Commit**: `320e7ec67982873af1bb0a5ed32af02eb2baa511`
- **Branch**: `main`
- **Vercel Production Deployment ID**: `dpl_9CF11j77a2xhf72feV15bFQVYH8o`
- **Deployment URL**: `https://after-school-club-live-6k3ulzaq4-kwadwo-addos-projects.vercel.app`
- **Canonical Alias**: `https://app.sprintscaleit.co.uk`
- **Status**: `● Ready`

---

## 6. Live Production Verification

### Shallow Health Probe Verification
```http
HEAD /api/health
HTTP/2 200
(empty body)

GET /api/health
HTTP/2 200
{"ok":true}
```

### Deep Health Probe Verification
```http
GET /api/health/deep
HTTP/2 200
{"ok":true,"database":"healthy"}
```

### Public Smoke Tests
- `/` -> HTTP 200
- `/login` -> HTTP 200
- `/signup` -> HTTP 200
- `/portal/login` -> HTTP 200

### Proof of DB-Free Health Probes & Empirical Autosuspend Observation
At `04:37:03 BST` (03:37:03 UTC) and `04:42:08 BST` (03:42:08 UTC), the external monitor executed paired `HEAD` and `GET /api/health` probes.
Inspection of the Neon endpoint via API confirmed:
1. `last_active` timestamp remained at `2026-09-15T03:38:30Z` despite external monitor probes arriving.
2. At `2026-09-15T03:43:46Z` (04:43:46 BST), exactly 316 seconds after the last database connection activity:
   - `current_state`: `idle`
   - `suspended_at`: `2026-09-15T03:43:46Z`
3. The Neon compute engine entered an idle/suspended state while external probes continued arriving, definitively confirming that high-frequency health probes no longer keep Neon awake.

---

## 7. Operational Recommendations for Uptime Monitors

1. **High-Frequency Uptime Monitor (1m to 5m)**:
   - Target URL: `https://app.sprintscaleit.co.uk/api/health`
   - Expected status: `200`
2. **Deep Database Connectivity Monitor (30m to 60m)**:
   - Target URL: `https://app.sprintscaleit.co.uk/api/health/deep`
   - Expected status: `200`
   - Interval: **30 minutes minimum** (ensures Neon has ample time to suspend between probes during idle periods).

---

## 8. Limitations & Forward Projections

- **Cold Starts**: When Neon autosuspends after 5 minutes of genuine inactivity, the first subsequent user request will incur a cold-start latency of approximately 500ms to 1.5s.
- **Consumption Projections**: Prior calculations project that idle periods will drop daily compute burn from ~6.0 CU-hours/day to significantly lower levels. However, exact monthly consumption figures remain projections until empirical telemetry accumulates over future billing cycles.
