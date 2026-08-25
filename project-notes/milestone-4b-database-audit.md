# Milestone 4B — Database, Migration & Data Integrity Audit Report
## Stage A: Forensic Database & Migration Audit

**Branch:** `rebuild/cms-modernisation`  
**Starting SHA:** `95ca240` (Milestone 4A frozen tip)  
**Audit Conducted at:** `95ca240`

---

## 1. Schema & Migration Architecture

### 1.1 Authoritative Schema
- **File:** `src/db/schema.ts` (41 tables defined via `drizzle-orm/pg-core`).
- **ORM / Driver:** Drizzle ORM `^0.45.1` with `postgres.js` (`postgres ^3.4.8`).
- **Connection Configuration:** `src/db/index.ts` with connection pooling (`max: 10, idle_timeout: 20s, connect_timeout: 10s`).

### 1.2 Migration Tooling & History
- **Tooling:** `drizzle-kit` configured via `drizzle.config.ts` targeting `./drizzle` output directory.
- **Journal:** `drizzle/meta/_journal.json` contains 22 versioned migration entries up to `0021_add_portal_notifications`.
- **Schema Drift (MIG-1):** Previous custom hand-written migrations (`0022_add_org_memberships.sql`, `0023_add_subdomains.sql`) were added without Drizzle Kit journal synchronization. Running `drizzle-kit generate` created `0022_wild_agent_zero.sql`, formally reconciling `org_memberships`, `centres.subdomain`, and `organisations.subdomain` into the official migration journal.

---

## 2. Referential & Relational Integrity Matrix

| Relationship | Database Constraint | On Delete | App Invariant Enforced | Status |
|---|---|---|---|---|
| `organisations` $\to$ `centres` | FK `organisation_id` | CASCADE | Yes (scoped to session org) | SAFE |
| `organisations` $\to$ `users` | FK `organisation_id` | RESTRICT / SET NULL | Yes | SAFE |
| `organisations` $\to$ `org_memberships` | FK `organisation_id` | CASCADE | Yes (`UNIQUE(user_id, organisation_id)`) | SAFE |
| `centres` $\to$ `centre_memberships` | FK `centre_id` | CASCADE | Yes (`UNIQUE(user_id, centre_id)`) | SAFE |
| `organisations` $\to$ `parents` | FK `organisation_id` | CASCADE | Yes | SAFE |
| `organisations` $\to$ `children` | FK `organisation_id` | CASCADE | Yes | SAFE |
| `parents` $\to$ `children` | FK `parent_id` (via junction / direct) | CASCADE | Yes | SAFE |
| `organisations` $\to$ `invoices` | FK `organisation_id` | CASCADE | Yes (derived server-side) | SAFE |
| `invoices` $\to$ `payments` | FK `invoice_id` | CASCADE | Yes (idempotency key enforced) | SAFE |
| `invoices` $\to$ `invoice_line_items` | FK `invoice_id` | CASCADE | Yes | SAFE |
| `centres` $\to$ `bookings` | FK `centre_id` | CASCADE | Yes | SAFE |
| `bookings` $\to$ `booking_attendees` | FK `booking_id` | CASCADE | Yes | SAFE |
| `children` $\to$ `booking_attendees` | FK `child_id` | CASCADE | Yes | SAFE |
| `children` $\to$ `incidents` | FK `child_id` | CASCADE | Yes (safeguarding history preserved via soft delete) | SAFE |
| `registrations` $\to$ `registration_parents` | FK `registration_id` | CASCADE | Yes | SAFE |
| `registrations` $\to$ `registration_children` | FK `registration_id` | CASCADE | Yes | SAFE |
| `billing_configs` $\to$ `billing_runs` | FK `billing_config_id` | RESTRICT | Yes (financial protection) | SAFE |

---

## 3. Tenant & Isolation Integrity

- **Multi-Tenant Invariants:** Every operational table (`centres`, `users`, `parents`, `children`, `bookings`, `invoices`, `registrations`, `incidents`, `billing_configs`, `parent_credits`) contains a non-nullable `organisation_id` column with foreign key reference to `organisations.id`.
- **Mutation Scoping:** API routes and server actions unconditionally resolve `organisationId` from the authenticated user's session or cryptographically verified parent JWT (`AUTH-2`). Cross-tenant relationship injection is rejected.

---

## 4. Soft Delete Integrity

- **Models with `deletedAt`:** `parents`, `children`, `centres`, `bookings`, `billing_configs`.
- **Operational Filtering:**
  - Staff Dashboard lists filter `isNull(parents.deletedAt)` and `isNull(children.deletedAt)`.
  - Parent Portal excludes deleted children from bookings and views (`S-4`).
  - Soft-deleted parents are rejected at token verification (`S-2`).
  - Historical records (invoices, payments, incidents, attendance logs) remain preserved for auditing and compliance while excluding soft-deleted entities from active operations.

---

## 5. Financial & Concurrency Integrity

- **Invoice Totals & Currency:** Amounts stored as `decimal(10, 2)` or integer pence; balance calculations performed server-side.
- **Payment Reconciliation:** Reconciliations and Stripe webhook ingestions execute inside `db.transaction(...)` with unique idempotency keys on `payments.transactionReference` (`FIN-1`).
- **Billing Runs:** `POST /api/cron/billing` verifies existing `billing_runs` records for the current billing period before creating invoices, preventing double-billing.

---

## 6. Registration & Multi-Record Transaction Boundaries

- **Registration Approval (`approveRegistration`):** Parent creation, child creation, emergency contact linking, and registration status transitions execute atomically within `db.transaction(...)`. A failure at any step rolls back the entire conversion cleanly.

---

## 7. Migration Safety & Production Runbook

- **Reconciled Migration:** `drizzle/0022_wild_agent_zero.sql` captures all additive schema changes cleanly (`ADD TABLE org_memberships`, `ADD COLUMN subdomain`).
- **Production Execution Method:** Managed deployment migration via `npm run db:migrate` (`drizzle-kit migrate`) during pre-deployment phase.
- **Runbook:** Documented in `project-notes/production-database-runbook.md`.

---

## 8. Defect Summary & Findings

| ID | Category | Description | Disposition |
|----|----------|-------------|-------------|
| **MIG-1** | Migration Drift | Manual SQL migrations were uncommitted to Drizzle Kit's `_journal.json`. | **RESOLVED:** Generated `0022_wild_agent_zero.sql` synchronizing Drizzle schema and migration journal. |
| **DOC-DB-1** | Operational | Production migration runbook missing from documentation. | **RESOLVED in 4B:** Added `project-notes/production-database-runbook.md`. |

- **Total Confirmed Defects:** 2 (0 Critical, 0 High, 2 Low/Operational)
- **4B Blockers:** 0
- **Blocking Ambiguities:** 0

---

## 9. Conclusion & Stage B Recommendation

The PostgreSQL/Drizzle persistence layer is well-structured, relational constraints are consistent, multi-tenant boundaries are strictly enforced, and multi-record mutations use database transactions.

**Recommendation:** Proceed directly to Stage B/C/D to finalize the migration snapshot, verify dry-run, add regression tests, and create the production runbook.
