# SprintScale CMS — Training Environment Safety & Isolation Protocol
## Zero-Production Mutation Guarantee, Environment Boundary Rules & Executable Safety Guards

---

## 1. Executive Safety Principle

**NO REAL CUSTOMER, PUPIL, STAFF, OR FINANCIAL DATA MAY BE EXPOSED IN ANY TRAINING ASSET.**
**PRODUCTION DATABASE, SERVERS, AND EXTERNAL INTEGRATIONS MUST NEVER BE TARGETED OR MUTATED DURING D6 VISUAL CAPTURE.**

Visual asset production in Milestone D6 must operate exclusively against the guarded local/staging training environment.

---

## 2. Environment Identity & Host Isolation Matrix

| Environment Parameter | Production Environment | Isolated Training Environment | Proven Boundary & Status |
|---|---|---|---|
| **Base App URL** | `https://app.sprintscaleit.co.uk` | `http://localhost:3000` (Local Dev) | **Targeting production domain during capture is strictly forbidden.** |
| **Database Host** | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` | `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` | **PROVEN DISTINCT HOSTS** (`TRAINING_HOST != PROD_HOST`). |
| **Database Path** | `/neondb` (Production Primary) | `/neondb` (Staging / Training Branch) | Completely isolated database branch. |
| **Data Scope** | Sydenham Production Roster | `Oakridge Learning Club Ltd` (100% Synthetic) | Zero real student, parent, or staff records exist in Oakridge org. |
| **Transactional Email** | Live Resend API | Mocked Email Sink / Unconfigured | Zero emails dispatched to real parent inboxes. |
| **SMS Gateway** | Twilio (Deferred) | Disabled / Stub Mode | Zero SMS dispatches. |
| **Payment Gateways** | Stripe / GoCardless (Deferred) | Mock / Offline Simulation | Zero live payment gateway transactions. |
| **Error Tracking** | Production Sentry DSN | Sentry Disabled / Mock DSN | Zero artificial training errors sent to production Sentry. |

---

## 3. Executable Hard Safety Guard (`src/lib/training-guard.ts`)

Any seed, reset, or fixture tooling must pass through `assertSafeTrainingEnvironment()` before executing any query:

```typescript
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';

// 1. Fails closed if DATABASE_URL is missing
// 2. Fails closed if host matches ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech
// 3. Fails closed if ALLOW_TRAINING_SEED !== 'true'
const { host, database } = assertSafeTrainingEnvironment();
```

---

## 4. Deterministic Seed & Reset Tooling

| Command | Script Path | Action Performed | Safety Guardrail |
|---|---|---|---|
| `npm run training:seed` | `src/scripts/seed-training-data.ts` | Cleans previous Oakridge data and re-instantiates complete synthetic dataset. | `ALLOW_TRAINING_SEED=true` required; production host blocked. |
| `npm run training:reset` | `src/scripts/reset-training-data.ts` | Clean reset and re-seed of synthetic fixtures. | `ALLOW_TRAINING_SEED=true` required; production host blocked. |

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
