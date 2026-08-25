# Production Database & Migration Runbook
## After School Club CMS

---

## 1. Overview & Architecture

The After School Club CMS uses **Drizzle ORM** with **PostgreSQL** (`postgres.js` driver).

- **Schema Source of Truth:** `src/db/schema.ts`
- **Migration Directory:** `./drizzle`
- **Drizzle Config:** `drizzle.config.ts`
- **Migration Tooling:** `drizzle-kit`

---

## 2. Pre-Deployment Checklist

Before running any migration or deploying new code to production:

1. **Verify Target Database:**
   - Ensure `DATABASE_URL` in the deployment environment points to the intended PostgreSQL instance (with SSL enabled: `?sslmode=require`).
2. **Verify Backup / Point-in-Time Recovery (PITR):**
   - In your managed PostgreSQL provider (e.g. Supabase, Neon, AWS RDS), verify that automated backups / PITR are active.
   - For high-impact schema changes, trigger a manual snapshot prior to applying migrations.
3. **Inspect Pending Migrations:**
   - Check `./drizzle` for newly added SQL files and verify that statements are additive or backward-compatible with active application instances.

---

## 3. Migration Execution

### Authoritative Command
Run migrations from your CI/CD deployment pipeline or a secure admin runner:

```bash
npm run db:migrate
```

*(This executes `drizzle-kit migrate` against the configured `DATABASE_URL` using `drizzle.config.ts`).*

### Execution Rules
- **Single-Runner Requirement:** Migrations must only be executed by one process at a time (e.g. CI/CD release step or pre-deploy hook), **never** concurrently by multiple serverless function instances.
- **Fail-Stop:** If a migration fails, the deployment pipeline must immediately halt and prevent the new application bundle from going live.

---

## 4. Post-Migration Verification

After applying migrations:

1. **Health Check:**
   - Verify `GET /api/health` returns HTTP 200 `{ ok: true }`.
2. **Critical Flow Smoke Tests:**
   - Staff login (`/login`)
   - Parent portal login & billing (`/portal/login`, `/portal/billing`)
   - Public booking flow (`/book/[orgSlug]/[centreSlug]`)
3. **Log Inspection:**
   - Check deployment logs for any database connection pool or query errors.

---

## 5. Rollback & Disaster Recovery

- **Backward-Compatible Rollout:** Always design schema changes to be non-breaking (additive) so that rolling back the application code requires no immediate database rollback.
- **Manual Snapshot Restoration:** If data corruption occurs during a migration, restore the database snapshot created during the pre-deployment phase.
