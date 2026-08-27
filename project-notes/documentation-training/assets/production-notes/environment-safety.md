# SprintScale CMS — Training Environment Safety & Isolation Protocol
## Zero-Production Mutation Guarantee, Environment Boundary Rules & Seed Guardrails

---

## 1. Executive Safety Principle

**NO REAL CUSTOMER, PUPIL, STAFF, OR FINANCIAL DATA MAY BE EXPOSED IN TRAINING ASSETS.**  
**PRODUCTION DATA, SERVERS, AND INTEGRATIONS MUST NEVER BE TARGETED OR MUTATED DURING D6 CAPTURE.**

Visual asset production in Milestone D6 must operate exclusively against an isolated, synthetic training environment.

---

## 2. Environment Identity & Boundary Matrix

| Environment Parameter | Production Environment | Isolated Training Environment | Safety Guardrail |
|---|---|---|---|
| **Base URL** | `https://app.sprintscaleit.co.uk` | `http://localhost:3000` (Local Dev) | **Targeting production domain during capture is strictly forbidden.** |
| **Database Host** | Neon Production Primary | Local PostgreSQL / In-Memory Mock | `DATABASE_URL` for training must never contain production Neon hostnames. |
| **Data Scope** | Sydenham Production Roster | `Oakridge Learning Club` (100% Synthetic) | All entity names must match the synthetic specification. |
| **Transactional Email** | Live Resend API | Mocked Email Sink / Unconfigured | Zero emails dispatched to real parent inboxes. |
| **SMS Gateway** | Twilio (Deferred) | Disabled / Stub Mode | Zero SMS dispatches. |
| **Payment Gateways** | Stripe / GoCardless (Deferred) | Mock / Offline Simulation | Zero live payment gateway transactions. |
| **Error Tracking** | Production Sentry DSN | Sentry Disabled / Mock DSN | No artificial training errors sent to production Sentry. |

---

## 3. Seed Tooling Safety Guardrails

Any seed or fixture script used to generate synthetic training data must enforce the following guardrails:

```typescript
// Guardrail: Reject execution if connected to production host
const dbUrl = process.env.DATABASE_URL || '';
const isProductionHost = dbUrl.includes('neon.tech') || dbUrl.includes('prod') || process.env.NODE_ENV === 'production';

if (isProductionHost && !process.env.ALLOW_TRAINING_SEED) {
  throw new Error('[CRITICAL] Training seed refused: Production database detected. Aborting immediately.');
}
```

---

## 4. Visual Privacy & Redaction Standards

During screenshot and video recording:

1. **Clean Browser Chrome:**
   - Hide personal bookmarks bar.
   - Close personal tabs and external applications.
   - Disable OS notifications (macOS Focus / Do Not Disturb active).
   - Ensure browser password autofill / credit card suggestions are disabled.
2. **Zero Credentials on Screen:**
   - No `.env` files, terminal windows with secrets, or API keys visible.
   - No session cookies or authorization bearer tokens displayed.
3. **Generic Safeguarding Content:**
   - Safeguarding demonstrations must use generic training placeholders (e.g. *"Observation logged for training demonstration"*).
   - Realistic abuse, neglect, or injury narratives are strictly prohibited.
