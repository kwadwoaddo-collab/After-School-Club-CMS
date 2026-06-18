# Tech Stack

After-School-Club-CMS is a multi-tenant SaaS CMS for managing after-school tutoring clubs, built with a modern TypeScript/Next.js stack.

---

## Languages

| Language | Usage |
|---|---|
| **TypeScript** | All application code (`.ts`, `.tsx`); strict mode via `tsconfig.json` |
| **SQL** | Database migrations (`drizzle/` folder) |
| **Python** | One-off utility script (`generate_receipt.py`) |

---

## Frameworks & Runtime

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.1.6 | Full-stack React framework — App Router, Server Actions, API Routes |
| **React** | 19.2.3 | UI component library |
| **Node.js** | LTS | Server runtime |

---

## Styling

| Technology | Version | Role |
|---|---|---|
| **Tailwind CSS** | v4 | Utility-first CSS framework |
| **PostCSS** | via `@tailwindcss/postcss` | CSS processing pipeline |
| **Global CSS** | `src/app/globals.css`, `landing.css` | Base styles and landing page overrides |

---

## Database

| Technology | Version | Role |
|---|---|---|
| **PostgreSQL** | — | Primary relational database |
| **Drizzle ORM** | 0.45.1 | Type-safe ORM; schema defined in `src/db/schema.ts` |
| **drizzle-kit** | 0.31.8 | Migration CLI (`db:generate`, `db:migrate`, `db:push`, `db:studio`) |
| **pg** | 8.18 | PostgreSQL client (pooled connections) |
| **postgres** | 3.4.8 | PostgreSQL client (tagged-template query interface) |

Schema covers: organisations, centres, users, bookings, students, invoices, assessments, attendance, notifications, and Stripe subscription state.

---

## Authentication

| Technology | Version | Role |
|---|---|---|
| **NextAuth.js (Auth.js)** | v5 beta | Session management — JWT strategy, 30-day sessions |
| **@auth/drizzle-adapter** | 1.11.1 | Persists NextAuth sessions/accounts in Drizzle tables |
| **Google OAuth** | — | Primary sign-in for org owners/staff |
| **Email Magic Link** | — | Passwordless sign-in via email |
| **Credentials** | — | Username/password sign-in (bcrypt-hashed) |
| **bcryptjs** | 3.0.3 | Password hashing |
| **jose** | 6.2.3 | JWT signing and verification |

---

## Third-Party Services & Integrations

| Service | Package | Role |
|---|---|---|
| **Stripe** | `stripe` 20.3, `@stripe/stripe-js` 8.7 | Subscription billing and payment processing |
| **Resend** | `resend` 6.9 | Transactional email delivery |
| **Twilio** | `twilio` 5.12 | SMS notifications |
| **Google Calendar** | `googleapis` 171, `@google-cloud/local-auth` 3.0 | Calendar sync for sessions |
| **Upstash Redis** | `@upstash/redis` 1.38, `@upstash/ratelimit` 2.0 | Serverless Redis-backed rate limiting |
| **Sentry** | `@sentry/nextjs` 10.53 | Error monitoring and performance tracing |

---

## UI Libraries & Utilities

| Package | Role |
|---|---|
| **Lucide React** 0.563 | Icon library |
| **React Hook Form** 7.71 | Performant form state management |
| **@hookform/resolvers** 3.10 | Zod integration for form validation |
| **Zod** 4.3 | Schema validation (forms, API inputs) |
| **react-hot-toast** 2.6 | Toast notifications |
| **@react-pdf/renderer** 4.4 | Server-side PDF generation (receipts, reports) |
| **react-signature-canvas** 1.1 | Digital signature capture |
| **date-fns** 4.1 | Date manipulation and formatting |
| **nanoid** 5.1 | Unique ID generation |

---

## Testing

| Technology | Version | Role |
|---|---|---|
| **Vitest** | 4.1 | Unit and integration tests (`src/lib/**/*.test.ts`) |
| **Playwright** | 1.60 | End-to-end browser tests (`tests/`) |

Test scripts: `npm test` (Vitest), `npm run test:e2e` (Playwright), `npm run test:all` (both).

---

## Build & Tooling

| Technology | Version | Role |
|---|---|---|
| **TypeScript** | 5.x | Static typing across the entire project |
| **tsx** | 4.21 | TypeScript execution for scripts and seed files |
| **ESLint** | 9.x | Code linting (`eslint-config-next`) |
| **dotenv** | 17.x | Environment variable loading for scripts |

---

## Deployment

| Technology | Role |
|---|---|
| **Vercel** | Production hosting (inferred from `check-vercel-env.sh` and Next.js first-party support) |
| **Next.js View Transitions** | Enabled via `experimental.viewTransition: true` in `next.config.ts` |
| **CSP / iFrame embedding** | Booking pages (`/book/:orgSlug/:centreSlug`) can be embedded in third-party sites via configurable `ALLOWED_FRAME_ANCESTORS` |

---

## Notable Architecture Patterns

- **App Router + Server Actions** — data mutations use Next.js Server Actions; no separate REST API layer for most operations.
- **Multi-tenancy** — data is scoped by `organisationId`/`centreId` at the DB level; role-based access (`ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR`) enforced in `src/lib/permissions.ts`.
- **Feature flags** — runtime feature toggles in `src/lib/feature-flags.ts`.
- **Rate limiting** — Upstash-backed rate limiter applied to auth and sensitive API routes (`src/lib/rate-limit.ts`).
- **Magic-link auth for parents** — separate lightweight auth flow (`src/lib/magic-link.ts`, `src/lib/parent-auth.ts`) distinct from staff NextAuth sessions.
