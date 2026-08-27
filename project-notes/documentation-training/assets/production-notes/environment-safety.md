# SprintScale CMS — Training Environment Safety & Isolation Protocol
## Zero-Production Mutation Guarantee, Strict Host Allowlist & Executable Safety Guards

---

## 1. Executive Safety Principle

**NO REAL CUSTOMER, PUPIL, STAFF, OR FINANCIAL DATA MAY BE EXPOSED IN ANY TRAINING ASSET.**
**PRODUCTION DATABASE, SERVERS, AND EXTERNAL INTEGRATIONS MUST NEVER BE TARGETED OR MUTATED DURING D6 VISUAL CAPTURE.**

---

## 2. Training Environment Classification & Host Allowlist

The visual training capture environment consists of:
- **Local Application Server:** Running locally (`http://localhost:3000`).
- **Target Database:** The existing isolated **Staging Neon Branch** (`ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`).

> **Note on Environment Topology:** The training environment uses the existing isolated staging Neon database branch, strictly isolated under the `oakridge-learning` synthetic organisation namespace. It is NOT a third independent Neon database instance. Production mutations must remain exactly ZERO (0), while staging mutations for synthetic training data are expected and recorded explicitly.

| Environment Parameter | Production Environment | Isolated Staging/Training Environment | Allowlist Status |
|---|---|---|---|
| **Base App URL** | `https://app.sprintscaleit.co.uk` | `http://localhost:3000` (Local Dev) | **Production URL strictly prohibited for capture.** |
| **Database Host** | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` | `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` | **STRICT ALLOWLIST APPROVED** |
| **Database Path** | `/neondb` (Production Primary) | `/neondb` (Staging / Training Branch) | Completely isolated branch. |
| **Data Scope** | Sydenham Production Roster | `Oakridge Learning Club Ltd` (100% Synthetic) | Zero real student, parent, or staff records exist in Oakridge org. |
| **Transactional Email** | Live Resend API | Mocked Email Sink / Unconfigured | Zero emails dispatched to real parent inboxes. |
| **SMS Gateway** | Twilio (Deferred) | Disabled / Stub Mode | Zero SMS dispatches. |
| **Payment Gateways** | Stripe / GoCardless (Deferred) | Mock / Offline Simulation | Zero live payment gateway transactions. |
| **Error Tracking** | Production Sentry DSN | Sentry Disabled / Mock DSN | Zero artificial training errors sent to production Sentry. |

---

## 3. Strict Allowlist-Based Safety Guard (`src/lib/training-guard.ts`)

Any seed, reset, or fixture tooling must pass through `assertSafeTrainingEnvironment()` before executing any query:

```typescript
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';

// Rules (Fail Closed):
// 1. Missing or malformed DATABASE_URL throws immediately.
// 2. ALLOW_TRAINING_SEED !== 'true' throws immediately.
// 3. TRAINING_ENVIRONMENT !== 'oakridge' throws immediately.
// 4. Primary Allowlist: parsed DATABASE_URL hostname MUST equal 'ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech'.
// 5. Defense-in-Depth: blocks 'ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech'.
const { host, database } = assertSafeTrainingEnvironment();
```

---

## 4. Deterministic Seed & Reset Tooling

| Command | Script Path | Action Performed | Safety Guardrail |
|---|---|---|---|
| `npm run training:seed` | `src/scripts/seed-training-data.ts` | Cleans previous Oakridge data and re-instantiates complete synthetic dataset. | Strict host allowlist + `ALLOW_TRAINING_SEED=true` + `TRAINING_ENVIRONMENT=oakridge`. |
| `npm run training:reset` | `src/scripts/reset-training-data.ts` | Clean reset and re-seed of synthetic fixtures. | Strict host allowlist + `ALLOW_TRAINING_SEED=true` + `TRAINING_ENVIRONMENT=oakridge`. |

### Reset Isolation & Tenant Scoping
All reset and cleanup operations in `seed-training-data.ts` are strictly parameterized and scoped by `organisation_id` (`Oakridge Learning Club Ltd`). Reset operations **NEVER** truncate shared staging tables or affect unrelated staging organisations.

---

## 5. Visual Capture URL Safety Rules

1. **Allowed Capture URLs (D6B / D6C / D6D):**
   - Staff Dashboard: `http://localhost:3000/dashboard`
   - Attendance: `http://localhost:3000/dashboard/attendance`
   - Kiosk: `http://localhost:3000/dashboard/kiosk`
   - Finance: `http://localhost:3000/dashboard/finance`
   - Invoices: `http://localhost:3000/dashboard/finance/invoices`
   - Staff Management: `http://localhost:3000/dashboard/staff`
   - Recovery Bin: `http://localhost:3000/dashboard/parents/bin`
   - Parent Portal: `http://localhost:3000/portal`
   - Public Intake Form: `http://localhost:3000/register/oakridge-learning`

2. **Strictly Prohibited URLs for Visual Capture:**
   - ❌ `https://app.sprintscaleit.co.uk` (Production Web App)
   - ❌ `https://app.sprintscaleit.co.uk/*` (Any production route)
