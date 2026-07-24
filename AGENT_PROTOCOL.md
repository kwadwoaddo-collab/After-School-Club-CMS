# Agent Protocol — Safe Development & Deployment Rules

> **This file must be read before making ANY push to the repository.**
> These rules exist to protect live user data and ensure zero-downtime deployments.

---

## 🗄️ Databases

There are two separate Neon PostgreSQL databases:

| Environment | Purpose | Used by |
|---|---|---|
| **Production** | Live data — real parents, students, bookings | Vercel (live site) |
| **Dev branch** | Safe sandbox for testing — snapshot of prod | Local development |

**`.env.local` is already correctly pointed at the dev branch** — do not change it.

- **Dev branch** (local `.env.local`): `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`
- **Production branch**: separate URL stored only in Vercel Environment Variables — never in this repo

To confirm which DB you are connected to at any time, check the host in `.env.local` against the above.

---

## 🔁 Development Workflow

Follow this order strictly for every change:

### 1. Develop locally against the DEV database
- All code changes happen on your local machine
- `.env.local` points to the **dev Neon branch** (not production)
- Never run migrations (`pnpm db:migrate` or `pnpm db:push`) against production without explicit approval

### 2. Build locally to catch errors before pushing
```bash
pnpm run build
```
This must pass with zero errors. Warnings are acceptable but must be noted.

### 3. Run tests
```bash
pnpm test              # unit tests (vitest)
pnpm test:e2e          # end-to-end (playwright) — if relevant to the change
```
All existing tests must still pass.

### 4. Smoke test in the browser
Start the dev server and manually test the changed pages:
```bash
pnpm run dev
```
Open `http://localhost:3000` and verify the affected flows work end-to-end.

### 5. Only push during the maintenance window (see below)

---

## 🕗 Deployment Window

> **Pushes to `main` (which trigger Vercel production deployments) are only allowed between:**
>
> **8:00 PM — 10:00 AM (next day) UK time**

This is when user activity is lowest. Avoid pushing during school-day working hours (10am–8pm) to prevent disrupting live sessions, active bookings, or staff using the dashboard.

**Before pushing, always check the time.** If it is outside the window, commit locally and wait.

```bash
# Good: commit without pushing, then push later during the window
git add -A
git commit -m "feat: ..."
# Do NOT run git push until inside the window
```

---

## 🛡️ Data Safety Rules

### Never run destructive operations against production without a backup plan

Destructive operations include:
- `DROP TABLE`, `TRUNCATE`, `DELETE FROM` without a `WHERE` clause
- `pnpm db:push` or `pnpm db:migrate` on a schema change that removes columns or tables
- Resetting the production DB (`pnpm db:reset`)
- Any script in `src/scripts/` that modifies data in bulk

### Before any database migration on production:
1. **Create a Neon restore point** — go to the Neon dashboard → your project → **Branches** → `main` → **Create restore point**
2. Run the migration on the **dev branch first** and verify it works
3. Only then run on production, inside the maintenance window
4. Verify the live site is still functional immediately after

### Live data currently includes:
- Real parent and student records
- Live bookings and attendance history
- Active organisation and staff accounts
- Stripe billing records

---

## 📦 Dependency Changes

When adding or updating packages:
1. Install locally first: `pnpm add <package>`
2. Verify the build still passes: `pnpm run build`
3. Check that `pnpm-lock.yaml` is updated and committed alongside `package.json`
4. Both files **must** be pushed together — a mismatch will break Vercel's install step

---

## ✅ Pre-Push Checklist

Run through this before every `git push`:

- [ ] It is within the deployment window (8pm – 10am UK)
- [ ] `.env.local` was pointing to dev DB during testing, NOT production
- [ ] `pnpm run build` passes with zero errors
- [ ] `pnpm test` passes
- [ ] The changed pages were manually tested in the browser
- [ ] No destructive DB operations are included — or a Neon restore point has been created
- [ ] `pnpm-lock.yaml` is committed if `package.json` changed
- [ ] Commit message is descriptive: `fix:`, `feat:`, `chore:` prefix

---

## 🚨 Emergency Hotfixes

If a critical production bug needs an out-of-window fix:
1. Create a Neon restore point **first** (safety net)
2. Make the minimal fix — no refactoring, no unrelated changes
3. Build and test locally even if briefly
4. Push and monitor the Vercel deployment log immediately
5. Verify the live site within 5 minutes of deployment completing

---

## 📝 Notes

- Vercel auto-deploys on every push to `main` — there is no separate deploy step
- Environment variables are managed in **Vercel Dashboard → Settings → Environment Variables** — they are NOT in this repo
- The Neon dev branch can be reset to a fresh snapshot of production at any time via the Neon dashboard if it gets into a bad state
