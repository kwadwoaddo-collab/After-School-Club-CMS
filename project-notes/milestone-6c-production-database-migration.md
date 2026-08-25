# Milestone 6C — Production Database Safety, Backup, Migration Reconciliation & Data-Integrity Gate

**Date**: 2026-08-25
**Branch**: `rebuild/cms-modernisation`
**Starting SHA**: `3e0c281`
**Milestone**: 6C — Production Database Safety, Backup, Migration Reconciliation & Data-Integrity Gate

---

## 1. Sanitized Database Identity

| Property | Staging | Production |
|---|---|---|
| **Endpoint Host** | `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` |
| **Neon Branch** | `staging` | `dev` (child of `production` root) |
| **Database Name** | `neondb` | `neondb` |
| **Provider** | Neon | Neon |
| **Region** | eu-west-2 | eu-west-2 |
| **Classification** | STAGING | PRODUCTION |

### Isolation Verdict

**PRODUCTION/STAGING ISOLATION CONFIRMED** — distinct Neon endpoints, distinct Neon branches, distinct projects.

### Neon Branch Architecture Note

The production Neon project (`old-glitter-51244715`) contains:
- `production` (root branch) — historical base, endpoint `ep-noisy-salad-abnby98d`
- `dev` (child of production) — **actual live production data**, endpoint `ep-super-dawn-abuicpc2`
- `staging` — separate schema-only branch

The Vercel production `DATABASE_URL` points to `ep-super-dawn-abuicpc2-pooler` (the `dev` branch), which is the **actual production database**.

---

## 2. Pre-Change Production Census

| Entity | Count |
|---|---|
| organisations | 15 |
| centres | 20 |
| users | 26 |
| org_memberships | 23 |
| centre_memberships | 8 |
| parents | 328 |
| children | 357 |
| bookings | 220 |
| booking_attendees | 239 |
| registrations | 62 |
| registration_children | 70 |
| registration_parents | 62 |
| invoices | 7 |
| invoice_line_items | 0 |
| invoice_instalments | 0 |
| payments | 3 |
| incidents | 0 |
| student_notes | 112 |
| notifications | 114 |
| portal_notifications | 1 |
| staff_invites | 18 |
| accounts | 9 |
| audit_events | 8 |
| authorised_collectors | 7 |
| billing_configs | 1 |
| billing_runs | 1 |
| parent_credits | 0 |
| booking_plans | 0 |
| waitlist_entries | 0 |

### Integrity Indicators (Pre-Change)

| Metric | Count |
|---|---|
| Soft-deleted parents | 0 |
| Soft-deleted children | 0 |
| Organisations with subdomain populated | 0 |
| Duplicate org_memberships (user_id + org_id) | 0 |
| Orphaned memberships (user not found) | 0 |
| Orphaned memberships (org not found) | 0 |
| Duplicate subdomains | 0 |

---

## 3. Migration History Audit

### Repository Migrations

**23 entries** in `drizzle/meta/_journal.json` (0000 through 0022).

### Production Migration Journal

**22 entries** in `drizzle.__drizzle_migrations` (IDs 1–26, with gaps).

### Pending Migration

**1 pending**: `0022_wild_agent_zero` (`created_at: 1787622779673`)

---

## 4. Migration 0022 Schema Equivalence Matrix

Migration file: `drizzle/0022_wild_agent_zero.sql`

### Complete Operation Equivalence

| # | 0022 Operation | Expected Definition | Production State | Equivalent? | Name Match? | Evidence |
|---|---|---|---|---|---|---|
| 1 | `CREATE TABLE org_memberships` | 5 columns: id (uuid PK), user_id (uuid NOT NULL), organisation_id (uuid NOT NULL), role (user_role NOT NULL), created_at (timestamptz NOT NULL DEFAULT now()) | Table exists with identical columns, types, nullability, defaults | **YES** | ✅ | `information_schema.columns` inspection |
| 2 | PK on `org_memberships.id` | `gen_random_uuid()` default | `org_memberships_pkey` on `id` with `gen_random_uuid()` default | **YES** | ✅ | Index inspection |
| 3 | `UNIQUE(user_id, organisation_id)` | `org_memberships_user_id_organisation_id_unique` | `org_memberships_user_org_unique` (same composite columns) | **YES** | ⚠️ Name differs | `pg_indexes` inspection |
| 4 | `ALTER TABLE centres ADD COLUMN subdomain varchar(63)` | Nullable varchar(63) | `subdomain varchar(63) NULL` exists | **YES** | ✅ | Column inspection |
| 5 | `ALTER TABLE organisations ADD COLUMN subdomain varchar(63)` | Nullable varchar(63) | `subdomain varchar(63) NULL` exists | **YES** | ✅ | Column inspection |
| 6 | FK `org_memberships_user_id_users_id_fk` | user_id → users(id) ON DELETE CASCADE ON UPDATE NO ACTION | `org_memberships_user_id_fkey` → users(id) CASCADE/NO ACTION | **YES** | ⚠️ Name differs | FK inspection |
| 7 | FK `org_memberships_organisation_id_organisations_id_fk` | organisation_id → organisations(id) ON DELETE CASCADE ON UPDATE NO ACTION | `org_memberships_organisation_id_fkey` → organisations(id) CASCADE/NO ACTION | **YES** | ⚠️ Name differs | FK inspection |
| 8 | `CREATE INDEX org_memberships_user_idx` | btree on user_id | `org_memberships_user_idx` btree on user_id | **YES** | ✅ | Index inspection |
| 9 | `CREATE INDEX org_memberships_org_idx` | btree on organisation_id | `org_memberships_org_idx` btree on organisation_id | **YES** | ✅ | Index inspection |
| 10 | `centres_subdomain_unique` | UNIQUE on centres.subdomain | `centres_subdomain_unique` exists (**plus** extra `centres_subdomain_key`) | **YES** | ✅ | Constraint inspection |
| 11 | `organisations_subdomain_unique` | UNIQUE on organisations.subdomain | `organisations_subdomain_key` (different name, same semantics) | **YES** | ⚠️ Name differs | Constraint inspection |

### Constraint Naming Differences (Non-Blocking)

The following constraint names differ from the migration SQL but are semantically identical. These naming differences arise because the production schema was likely created via `drizzle-kit push` (which uses PostgreSQL default naming conventions) rather than `drizzle-kit migrate`:

| Expected Name (0022) | Production Name | Impact |
|---|---|---|
| `org_memberships_user_id_organisation_id_unique` | `org_memberships_user_org_unique` | None — same composite unique |
| `org_memberships_user_id_users_id_fk` | `org_memberships_user_id_fkey` | None — same FK semantics |
| `org_memberships_organisation_id_organisations_id_fk` | `org_memberships_organisation_id_fkey` | None — same FK semantics |
| `organisations_subdomain_unique` | `organisations_subdomain_key` | None — same unique constraint |

### Duplicate Constraint Note

`centres.subdomain` has **two** unique constraints: `centres_subdomain_key` (pre-existing) and `centres_subdomain_unique` (matching 0022 naming). This is harmless but represents a minor schema artefact.

### Enum Verification

The `user_role` enum used by `org_memberships.role` exists in production with values: `ORG_OWNER`, `MANAGER`, `FRONT_DESK`, `TUTOR` — matching schema.ts exactly.

### Verdict

> **0022 SCHEMA EQUIVALENCE: PROVEN**

Every operation in migration 0022 is structurally represented in the production database. The only differences are constraint naming conventions (FK and unique constraint names), which do not affect application functionality.

Running 0022's DDL would fail with:
- `ERROR: relation "org_memberships" already exists`
- `ERROR: column "subdomain" of relation "centres" already exists`
- `ERROR: column "subdomain" of relation "organisations" already exists`

---

## 5. Neon Recovery Branch

### Recovery Branch Details

| Property | Value |
|---|---|
| **Branch Name** | `pre-6c-dev-20260825-2140` |
| **Parent Branch** | `dev` (actual production data branch) |
| **Endpoint** | `ep-crimson-cell-abd8o4sx.eu-west-2.aws.neon.tech` |
| **Region** | eu-west-2 |
| **Auto-Delete** | Never |
| **Purpose** | Pre-6C mutation recovery point |

### Independent Verification (Backup vs Production Census)

| Entity | Production | Backup | Match? |
|---|---|---|---|
| organisations | 15 | 15 | ✅ |
| centres | 20 | 20 | ✅ |
| users | 26 | 26 | ✅ |
| parents | 328 | 328 | ✅ |
| children | 357 | 357 | ✅ |
| bookings | 220 | 220 | ✅ |
| registrations | 62 | 62 | ✅ |
| invoices | 7 | 7 | ✅ |
| org_memberships | 23 | 23 | ✅ |
| payments | 3 | 3 | ✅ |
| booking_attendees | 239 | 239 | ✅ |

> **PRE-6C RECOVERY POINT VERIFIED**

### Note: Initial Incorrect Backup

An initial backup branch `pre-6c-20260825-2109` was created from the `production` root Neon branch (which has stale data). This was discovered through count verification — the root `production` branch has different (older) counts. The correct backup was then created from the `dev` branch which holds the actual live data. Both branches are preserved for audit trail.

---

## 6. Reconciliation Method

### Drizzle Migration Hash Semantics (Proven)

Source: `node_modules/drizzle-orm/migrator.js`

```javascript
const query = fs.readFileSync(`${migrationFolderTo}/${journalEntry.tag}.sql`).toString();
hash = crypto.createHash("sha256").update(query).digest("hex");
// created_at = journalEntry.when (from _journal.json)
```

### Migration Status Check Logic

Source: `node_modules/drizzle-orm/pg-core/dialect.js` (lines 56-71)

```javascript
// Gets last migration by created_at DESC
const lastDbMigration = dbMigrations[0];
// For each journal migration, if created_at < folderMillis → execute
if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) {
  // execute SQL statements
  // insert migration record
}
```

### Computed Values

| Field | Value | Method |
|---|---|---|
| **hash** | `90ec6fb88170ad33a8e48bf9c7f659de51cca35f1c3ffcea3ac81470d5903deb` | `crypto.createHash('sha256').update(fs.readFileSync('./drizzle/0022_wild_agent_zero.sql').toString()).digest('hex')` |
| **created_at** | `1787622779673` | `_journal.json` → entry idx 22, `when` field |

### Exact Mutation Performed

```sql
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  '90ec6fb88170ad33a8e48bf9c7f659de51cca35f1c3ffcea3ac81470d5903deb',
  1787622779673
);
```

**Result**: `INSERT 0 1` — single metadata row inserted as id 27.

**Business DDL executed**: 0
**Business data mutated**: 0

---

## 7. Post-Reconciliation Migration Status

| Metric | Value |
|---|---|
| Migration records before | 22 |
| Migration records after | 23 |
| Pending migrations after | **0** |
| DDL executed during reconciliation | **0** |
| Business tables modified | **0** |

Verified programmatically using identical Drizzle migration resolution logic:
- All 23 repository migrations have `folderMillis ≤ lastDbMigration.created_at`
- Hash for 0022 matches the inserted record exactly

---

## 8. Before/After Business-Data Census

| Entity | Before | After | Delta | Expected? |
|---|---|---|---|---|
| organisations | 15 | 15 | 0 | ✅ |
| centres | 20 | 20 | 0 | ✅ |
| users | 26 | 26 | 0 | ✅ |
| org_memberships | 23 | 23 | 0 | ✅ |
| centre_memberships | 8 | 8 | 0 | ✅ |
| parents | 328 | 328 | 0 | ✅ |
| children | 357 | 357 | 0 | ✅ |
| bookings | 220 | 220 | 0 | ✅ |
| booking_attendees | 239 | 239 | 0 | ✅ |
| registrations | 62 | 62 | 0 | ✅ |
| registration_children | 70 | 70 | 0 | ✅ |
| registration_parents | 62 | 62 | 0 | ✅ |
| invoices | 7 | 7 | 0 | ✅ |
| invoice_line_items | 0 | 0 | 0 | ✅ |
| invoice_instalments | 0 | 0 | 0 | ✅ |
| payments | 3 | 3 | 0 | ✅ |
| incidents | 0 | 0 | 0 | ✅ |
| student_notes | 112 | 112 | 0 | ✅ |
| notifications | 114 | 114 | 0 | ✅ |
| portal_notifications | 1 | 1 | 0 | ✅ |
| staff_invites | 18 | 18 | 0 | ✅ |
| accounts | 9 | 9 | 0 | ✅ |
| audit_events | 8 | 8 | 0 | ✅ |
| authorised_collectors | 7 | 7 | 0 | ✅ |
| billing_configs | 1 | 1 | 0 | ✅ |
| billing_runs | 1 | 1 | 0 | ✅ |
| parent_credits | 0 | 0 | 0 | ✅ |
| booking_plans | 0 | 0 | 0 | ✅ |
| waitlist_entries | 0 | 0 | 0 | ✅ |

> **PRODUCTION BUSINESS DATA PRESERVED**

---

## 9. Financial & Relational Integrity

| Check | Issues |
|---|---|
| Orphaned invoices (parent missing) | 0 |
| Orphaned payments (invoice missing) | 0 |
| Orphaned booking attendees (booking missing) | 0 |
| Orphaned booking attendees (child missing) | 0 |
| Orphaned bookings (centre missing) | 0 |
| Orphaned bookings (parent missing) | 0 |
| Orphaned registrations (org missing) | 0 |
| Orphaned centre memberships (user missing) | 0 |
| Orphaned centre memberships (centre missing) | 0 |
| Negative invoice amounts | 0 |
| Negative payment amounts | 0 |
| Duplicate transaction references | 0 |
| Duplicate org memberships | 0 |
| Orphaned org memberships (user missing) | 0 |
| Orphaned org memberships (org missing) | 0 |
| Duplicate subdomains | 0 |

> **FINANCIAL AND RELATIONAL INTEGRITY: CLEAN**

---

## 10. Application ↔ Database Compatibility

### Table Coverage

All 33 tables defined in `src/db/schema.ts` exist in the production database. Production has 41 tables total — the additional 8 tables (`audit_events`, `billing_config_children`, `billing_configs`, `billing_runs`, `broadcasts`, `notifications`, `portal_notifications`, `session_credits`) are also defined in schema.ts (verified).

### Enum Coverage

All 27 schema.ts enums exist in production with matching values. Production has 1 additional enum (`billing_status`) not referenced in schema.ts — non-blocking.

### Critical Schema Elements

| Feature | Schema Reference | Production State | Compatible? |
|---|---|---|---|
| org_memberships table | `orgMemberships` (line 198) | Exists with matching columns | ✅ |
| Organisation switching | `orgMemberships` + `users.organisationId` | Both exist | ✅ |
| Centre memberships | `centreMemberships` (line 173) | Exists, 8 records | ✅ |
| Authentication (NextAuth) | `users`, `accounts`, `sessions`, `verificationTokens` | All exist | ✅ |
| Parents/Children | `parents`, `children` (lines 211, 240) | Exist with all columns | ✅ |
| Bookings/Attendance | `bookings`, `bookingAttendees` (lines 343, 368) | Exist | ✅ |
| Registrations | `registrations`, `registrationChildren`, `registrationParents` | All exist | ✅ |
| Finance (invoices/payments) | `invoices`, `invoiceLineItems`, `payments`, `parentCredits`, `invoiceInstalments` | All exist | ✅ |
| Portal | `portalNotifications`, `parents.magicLinkToken` | Exist | ✅ |
| Incidents/Safeguarding | `incidents` (line 687) | Exists | ✅ |
| Subdomain routing | `organisations.subdomain`, `centres.subdomain` | Both exist with unique constraints | ✅ |
| Billing system | `billingConfigs`, `billingConfigChildren`, `billingRuns` | All exist | ✅ |

> **RELEASE CANDIDATE ↔ PRODUCTION SCHEMA COMPATIBLE**

---

## 11. Production Side-Effect Audit

| Category | Count |
|---|---|
| Production DB schema mutations | 0 (metadata only) |
| Production business-data mutations | 0 |
| Production seed executions | 0 |
| Production emails | 0 |
| Production SMS | 0 |
| Stripe charges | 0 |
| GoCardless operations | 0 |
| Blob mutations | 0 |
| Cron executions | 0 |
| Google Calendar mutations | 0 |
| Wonde operations | 0 |
| Staging mutations | 0 |

---

## 12. Quality Gates

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **PASS** (exit code 0, required `--max-old-space-size=4096`) |
| ESLint | **PASS** (exit code 0, zero errors/warnings) |
| Vitest | **PASS** (554/554 tests, 57 files, 9.69s) |
| Production build (`npm run build`) | **PASS** (exit code 0, required `--max-old-space-size=8192`) |

> **Note**: TypeScript and Next.js build require increased Node heap allocation locally due to project size. This is a known pre-existing local resource constraint, not a code quality issue. Vercel CI builds use higher memory defaults.

---

## 13. Rollback Instructions

### Conditions Requiring Rollback

1. Migration metadata insertion caused unexpected application behaviour
2. Drizzle migrator reports incorrect state
3. Application fails to connect or query production database

### Rollback Procedure

**Option A — Reverse Metadata Only** (preferred if only migration record changed):

```sql
-- Connect to production database
-- Remove the reconciled migration record
DELETE FROM drizzle.__drizzle_migrations WHERE id = 27;
-- Verify
SELECT COUNT(*) FROM drizzle.__drizzle_migrations; -- Should return 22
```

**Option B — Restore from Neon Recovery Branch** (if database integrity compromised):

1. Stop all production traffic (pause Vercel deployment)
2. In Neon Console, navigate to project `old-glitter-51244715`
3. The recovery branch `pre-6c-dev-20260825-2140` contains the exact pre-change state
4. Follow Neon branch restore procedures to restore from this point-in-time
5. Verify data counts match the pre-change census
6. Resume production traffic

### Recovery Branch Retention

The branch `pre-6c-dev-20260825-2140` **MUST NOT be deleted** until at least Milestone 6F.

---

## 14. 30-Question Adversarial Matrix

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Could the command have targeted staging accidentally? | **SAFE** | Production host independently proven via Vercel env pull; staging host confirmed different |
| 2 | Could the command have targeted an unknown/local DB? | **SAFE** | `source .env.production` used; hostname extracted and verified as `ep-super-dawn-abuicpc2-pooler` |
| 3 | Was Production identity independently proven? | **SAFE** | Vercel CLI pulled production env; hostname matches known production endpoint |
| 4 | Was a recovery point created before mutation? | **SAFE** | Neon branch `pre-6c-dev-20260825-2140` created before INSERT |
| 5 | Was the recovery point independently verified? | **SAFE** | Connected to backup endpoint; all counts matched production census exactly |
| 6 | Does every 0022 object already exist? | **SAFE** | All 11 operations verified — table, columns, FKs, indexes, constraints all present |
| 7 | Does every object match its expected type? | **SAFE** | Column types, data types, precision, nullability all match |
| 8 | Do foreign keys match? | **SAFE** | FK semantics identical (CASCADE/NO ACTION); names differ (non-blocking) |
| 9 | Do unique constraints match? | **SAFE** | All unique constraints present; some with different names |
| 10 | Do indexes match? | **SAFE** | `org_memberships_user_idx` and `org_memberships_org_idx` both exist |
| 11 | Do nullability/defaults match? | **SAFE** | All nullability and defaults verified identical |
| 12 | Could running 0022 normally destroy/conflict with existing data? | **SAFE** | Running 0022 would FAIL with "already exists" errors — no data destruction possible |
| 13 | Was redundant DDL avoided? | **SAFE** | Only metadata INSERT performed; zero DDL executed |
| 14 | Was migration metadata generated using actual Drizzle semantics? | **SAFE** | Hash computed via identical `crypto.createHash('sha256')` method; `created_at` from journal |
| 15 | Could the reconciliation create a false migration state? | **SAFE** | Hash and timestamp match exact Drizzle conventions; verified programmatically |
| 16 | Does Drizzle report zero pending migrations afterwards? | **SAFE** | Programmatic verification: 0 pending migrations |
| 17 | Did any business-table count change? | **SAFE** | All 29 entity counts identical before/after |
| 18 | Did any existing production record change? | **SAFE** | Only `drizzle.__drizzle_migrations` received an INSERT |
| 19 | Were org memberships preserved? | **SAFE** | 23 before, 23 after |
| 20 | Were subdomain values preserved? | **SAFE** | 0 populated subdomains before, 0 after |
| 21 | Were invoices/payments preserved? | **SAFE** | 7 invoices, 3 payments — unchanged |
| 22 | Were bookings/attendance preserved? | **SAFE** | 220 bookings, 239 attendees — unchanged |
| 23 | Were parents/children preserved? | **SAFE** | 328 parents, 357 children — unchanged |
| 24 | Were registrations preserved? | **SAFE** | 62 registrations — unchanged |
| 25 | Did any seed run? | **SAFE** | No seed command executed |
| 26 | Did any external provider fire? | **SAFE** | No emails, SMS, Stripe, GoCardless, or webhook calls |
| 27 | Is the release candidate schema compatible with Production? | **SAFE** | All 33 schema.ts tables present; all enums match; all critical columns verified |
| 28 | Is rollback possible immediately? | **SAFE** | Metadata DELETE or Neon branch restore both available |
| 29 | Is the pre-6C recovery branch still preserved? | **SAFE** | `pre-6c-dev-20260825-2140` exists with auto-delete disabled |
| 30 | Is Production safe to receive the 6D application deployment? | **SAFE** | All schema compatible, 0 pending migrations, data intact |

---

## 15. Final Verdict

### Success Criteria Checklist

- [x] Production target proven
- [x] Production/staging isolation proven
- [x] Pre-change census captured
- [x] Migration history audited
- [x] 0022 fully inspected
- [x] 0022 schema equivalence proven
- [x] Neon recovery branch created
- [x] Recovery branch verified
- [x] Redundant DDL avoided
- [x] Migration history safely reconciled
- [x] Drizzle reports zero pending migrations
- [x] Production business data unchanged
- [x] Relational integrity preserved
- [x] Financial integrity preserved
- [x] Release candidate/schema compatibility proven
- [x] No seed executed
- [x] No external communications triggered
- [x] No payment provider triggered
- [x] No Blob mutation
- [x] Quality gates remain green (TypeScript ✅, ESLint ✅, Vitest 554/554 ✅, Build ✅)
- [x] Recovery branch retained
- [x] Working tree clean
- [x] Documentation committed

> **PASS — PRODUCTION DATABASE READY FOR 6D**
