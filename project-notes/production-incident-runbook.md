# Production Incident Response Runbook

**Project**: After-School-Club-CMS  
**Canonical Production URL**: https://app.sprintscaleit.co.uk  
**Production DB Endpoint**: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` (Neon `dev` branch)  
**Staging DB Endpoint**: `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech`  
**Last Updated**: 2026-08-26 (Milestone 7H)  

> [!CAUTION]
> **NEVER place secrets, database passwords, tokens, or API keys in this document.**  
> This runbook may be stored in source control.

---

## Severity Definitions

| Severity | Definition | Example |
|---|---|---|
| **SEV-1** | Production completely unavailable or database unavailable | `/api/health` returns 503 or times out, all staff/parent logins fail |
| **SEV-2** | Major functionality impaired, persistent 5xx, authentication unavailable, critical scheduled process repeatedly failing | Invoice generation cron repeatedly 500ing, staff login broken for all users |
| **SEV-3** | Provider degradation, isolated failures, non-critical integration issue | Redis fail-open (rate limiting degraded), single email failure, one cron failure |

---

## 1. First Checks (Do These First, Every Time)

1. **Open https://app.sprintscaleit.co.uk/api/health** in a browser or run:
   ```
   curl -i https://app.sprintscaleit.co.uk/api/health
   ```
   - `HTTP 200 {"ok":true}` → Application + DB healthy.
   - `HTTP 503 {"ok":false}` or timeout → **SEV-1. Application or DB is down.**

2. **Check Vercel deployment status**: https://vercel.com/dashboard  
   - Is the production deployment `READY`?
   - Known good baseline: `dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM`

3. **Check Vercel Function Logs**: https://vercel.com/dashboard → Select project → Logs  
   - Filter by time window of the incident.
   - Look for repeated 5xx responses, unhandled exceptions, timeout messages.

4. **Check Sentry** (if configured): https://sentry.io  
   - Look for new error events or spikes in the incident window.
   - Filter by `environment:production`.

---

## 2. Database Incident

### Symptoms
- `/api/health` returns `{"ok":false}` (503)
- Repeated DB errors in Vercel logs
- Staff/parent workflows fail with 500 errors

### Triage Steps

1. **Check Neon dashboard**: https://console.neon.tech  
   - Navigate to project `old-glitter-51244715`  
   - Check `dev` branch status and compute health  
   - Review Metrics tab for connection pool usage and query errors

2. **Confirm the production Neon endpoint is reachable**:  
   - Endpoint: `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`  
   - Do NOT share or expose credentials in logs, chat, or this document

3. **Check if Neon is having a service incident**: https://status.neon.tech

4. **Check Vercel env vars** to confirm `DATABASE_URL` is still set correctly:  
   https://vercel.com/dashboard → Project → Settings → Environment Variables

### Database Recovery Approach

**Option A — Wait for Neon transient recovery (SEV-1 with Neon outage)**  
- Monitor https://status.neon.tech  
- No action required; database will recover automatically

**Option B — Neon Point-In-Time Restore (data corruption)**  
- Use Neon's PITR via: https://console.neon.tech → Project → Branching → Restore  
- WAL log restoration is continuously available on the `dev` branch  
- **Do NOT restore to the live `dev` branch directly.** Restore to a new branch first, verify, then redirect the connection.  
- The pre-7D recovery branch (`pre-6c-dev-20260825-2140`, endpoint `ep-noisy-salad-abnby98d.eu-west-2.aws.neon.tech`) contains the historical 15-organisation snapshot and is available as a fallback reference.

> [!IMPORTANT]
> **Do NOT mutate production business data to "fix" an incident.** Capture evidence first. Assess root cause before writing any data.

---

## 3. Application Rollback

### When to Roll Back
- New deployment broke core functionality
- Persistent 5xx responses after a deploy
- Auth failures introduced by a code change

### Application Rollback Steps

1. **Go to Vercel**: https://vercel.com/dashboard → Project → Deployments
2. **Identify the last known-good deployment**:
   - Known good baseline: `dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM`
   - Release tag `cms-modernisation-v1.0` points to commit `64e59d5`
3. **Promote the previous deployment** using Vercel's "Redeploy" or "Rollback" button
4. **Verify**: `curl -i https://app.sprintscaleit.co.uk/api/health` returns 200

### When NOT to Roll Back
- The incident is a **data issue**, not a code issue (rolling back code will not fix data)
- The incident is an **external provider outage** (Neon, Resend, Upstash)
- The current deployment is working correctly and the issue is environmental

---

## 4. Vercel Logs Investigation

```
Vercel Dashboard → Project → Logs → Filter by:
  - Function route (e.g. /api/bookings)
  - Status code (5xx)
  - Time window
```

All application logs are structured JSON in production:
```json
{"timestamp":"2026-08-26T22:00:00.000Z","level":"error","message":"[EmailService] Failed to send confirmation:","errorName":"Error","errorMessage":"rate_limit"}
```

Fields containing `token`, `password`, `secret`, `key`, `url`, `authorization`, `cookie`, `host`, `email`, or `phone` are redacted to `[REDACTED]` before logging.

---

## 5. Sentry Investigation

- URL: https://sentry.io (requires operator account access)
- All `logger.error()` and `logger.warn()` calls forward to Sentry via `captureMessage`
- The `onRequestError` hook in `src/instrumentation.ts` captures unhandled server exceptions
- Filter events by `environment:production` and the incident time window

> [!NOTE]
> Sentry is only active when `NEXT_PUBLIC_SENTRY_DSN` is configured in Vercel Production environment variables. If DSN is not set, `enabled: false` is passed to `Sentry.init()` and no events are sent. See Stage F of the 7H report for current configuration status.

---

## 6. Upstash / Rate Limiting Investigation

- Dashboard: https://console.upstash.com
- Redis credentials are stored in Vercel Production environment only (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- If Redis is down, the application **fails open** (rate limiting is suspended, all requests pass)
- Redis failures are logged via `logger.error('[RateLimit] Redis error, failing open:', error)`
- **SEV-3 behaviour**: The application remains fully available; only rate-limit protection is degraded

### Indicators of Redis failure
- Vercel logs contain `[RateLimit] Redis error, failing open`
- Upstash console shows connectivity issues
- Check Upstash status: https://status.upstash.com

---

## 7. Resend / Email Investigation

- Dashboard: https://resend.com/emails
- Failed email sends are logged via `logger.error('[EmailService] Failed to send ...')`
- The application workflow **continues** even if email delivery fails (fail-safe design)
- **SEV-3 behaviour**: Core booking/registration flows succeed; email confirmation may not reach parents

### Indicators of email failure
- Parents report not receiving confirmation emails
- Vercel logs contain `[EmailService] Failed to send`
- Resend dashboard shows failed deliveries or bounces
- Check Resend status: https://status.resend.com

---

## 8. Cron Job Investigation

**Scheduled cron jobs** (from `vercel.json`):

| Route | Schedule | Purpose | Authentication |
|---|---|---|---|
| `/api/cron/billing` | `0 6 * * *` (6am UTC daily) | Monthly invoice generation | `CRON_SECRET` Bearer header |
| `/api/cron/reminders` | `0 17 * * *` (5pm UTC daily) | Session + invoice reminder emails | `CRON_SECRET` Bearer header |
| `/api/cron/school-year-roll` | `0 3 1 8 *` (3am UTC, 1 Aug) | Annual school year rollover | `CRON_SECRET` Bearer header |

### Indicators of cron failure
- Vercel cron execution logs show 4xx or 5xx responses
- Vercel Logs tab → Cron tab shows failed executions
- Parents report not receiving reminders
- Invoices not generated on expected dates

### Cron failure response
- Do NOT manually invoke `/api/cron/reminders` or `/api/cron/billing` unless confident it is idempotent and the CRON_SECRET is known
- The billing cron is idempotent (will skip already-generated invoices)
- The reminders cron sends emails if invoked — only trigger if the missed send is operationally necessary

---

## 9. Evidence to Capture Before Remediation

Before taking any recovery action, capture:

1. **Exact time** the incident was first observed
2. **Full Vercel log output** for the affected time window (copy/export)
3. **Current `/api/health` response** with HTTP status code and timestamp
4. **Sentry event IDs** if available
5. **Any Neon metrics or errors** from the dashboard
6. **Screenshot/record of the deployment** that was live at the time
7. **Whether a new deploy happened** within the last 30 minutes

Do NOT take recovery action before capturing this evidence — it helps prevent repeat incidents.

---

## 10. Post-Recovery Validation

After any recovery action:

1. `curl -i https://app.sprintscaleit.co.uk/api/health` → HTTP 200 `{"ok":true}`
2. Navigate to https://app.sprintscaleit.co.uk — confirm page loads
3. Attempt staff login at https://app.sprintscaleit.co.uk/login
4. Check Vercel Logs — confirm no new 5xx errors for 5 minutes
5. Verify the Sydenham org data is intact (1 org, 2 centres, parents, children, bookings)
6. Confirm Upstash Redis is operational (rate limiting restored)
7. Confirm Resend is operational (email delivery restored)
8. Document the incident: what failed, what fixed it, when it was resolved

---

## 11. Known Recovery Assets

| Asset | Type | Identifier | Notes |
|---|---|---|---|
| Vercel rollback target | Application rollback | `dpl_E6xMFiTpk865YpfxjGKLq1M3MkZM` | Known-good production deployment |
| Git release tag | Code baseline | `cms-modernisation-v1.0` (commit `64e59d5`) | Phase 6 release |
| Neon PITR | DB point-in-time restore | `dev` branch, continuous WAL | Restore any point before incident |
| Recovery branch | DB historical snapshot | `pre-6c-dev-20260825-2140` (endpoint `ep-noisy-salad-abnby98d`) | Pre-7D 13-org historical snapshot |
| Staging environment | Safe test environment | `ep-aged-morning-abr2278f` | Fully isolated from production |

---

## 12. Escalation Path

| Severity | Action | Owner |
|---|---|---|
| **SEV-1** | Immediate: check health + Vercel + Neon status; if external outage wait; if code issue rollback immediately | Primary operator |
| **SEV-2** | Investigate via logs and Sentry; determine if rollback or hotfix is needed; resolve within hours | Primary operator |
| **SEV-3** | Log and monitor; address at next working session; no emergency action required unless repeated | Next working day |

> This CMS does not have a defined 24/7 SLA. Response times are best-effort based on operator availability.

---
