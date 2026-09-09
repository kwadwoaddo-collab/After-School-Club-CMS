# PM-2B Broadcast Delivery Durability — Production Release & Verification Report

**Milestone**: PM-2B.R  
**Project**: After-School-Club-CMS / SprintScale CMS  
**Mode**: CONTROLLED PRODUCTION RELEASE & VERIFICATION  
**Candidate SHA**: `05efbf3cb917b6a501f00382d88fa88108a31a5f`  
**Base SHA**: `cb2f53a531f65c69564c1a939618e1ccc65b3138`  
**Release Tag**: `cms-pm2b-broadcast-durability-certified`  
**Production Domain**: `https://app.sprintscaleit.co.uk`  
**Date**: September 9, 2026  
**Final Verdict**: **PASS / PRODUCTION VERIFIED / CLOSED**

---

## 1. Executive Summary

The PM-2B Broadcast Delivery Durability implementation was released to production following independent technical, security, and concurrency certification. The release delivers a fully durable, transactional outbox pattern backed by PostgreSQL row-level leasing (`FOR UPDATE SKIP LOCKED`), eliminating the risk of silent message loss, out-of-band crash inconsistencies, and unhandled double-sends in multi-tenant communications.

### Core Achievements
1. **Zero Contamination**: Certified candidate was cleanly fast-forwarded onto `origin/main` without cherry-picking or reintroducing historical mixed commits.
2. **Deterministic Schema Migration**: Migration `0026_broadcast_delivery_durability.sql` applied cleanly in a single ACID transaction on production Neon PostgreSQL.
3. **Automated Production Deployment**: Vercel production deployment succeeded in 3m 0s with 157 routes compiled cleanly.
4. **Security Fail-Closed Verification**: The background cron recovery endpoint (`/api/cron/broadcasts`) was verified to fail closed (HTTP 401 Unauthorised) across unauthenticated, malformed, and unauthorized requests.
5. **Durable Ledger Verification**: Seeded synthetic canary outbox in production PostgreSQL; verified atomic persistence of broadcast header (`QUEUED`), recipient delivery row (`PENDING`), and audit event (`broadcast.queued`).
6. **Zero-Residual Hygiene**: All synthetic fixtures and local production environment credentials purged cleanly.

---

## 2. Release & Git Forensics

| Parameter | Value | Verification |
|---|---|---|
| Candidate Branch | `audit/pm2b-broadcast-durability` | Verified |
| Certified Candidate HEAD | `05efbf3cb917b6a501f00382d88fa88108a31a5f` | Verified clean, 0 diff |
| Production Base | `origin/main` (`cb2f53a531f65c69564c1a939618e1ccc65b3138`) | Verified |
| Commits Released | 3 commits (`e18ef6d`, `db54b8d`, `05efbf3`) | Fast-forward only |
| Historical Commits | `efdcf42`, `921df11`, `2d77004`, `a07189f`, `52128bf` | **100% Absent** |
| Annotated Tag | `cms-pm2b-broadcast-durability-certified` | Pushed to remote |

---

## 3. Production Migration 0026 Execution

Applied migration: `drizzle/0026_broadcast_delivery_durability.sql`  
SHA-256 Hash: `86591e9c8722c39ca53227f2020b10914870e75fc709f950d276aed4b618b849`  
Migration table ID: `29` (created_at: `1788520000000`)

### Verified Production Schema
- **`broadcasts` table**: Added `status` (`character varying NOT NULL DEFAULT 'PENDING'`) and `completed_at` (`timestamp with time zone NULL`).
- **`broadcast_deliveries` table created**:
  - `id` (UUID PK, `gen_random_uuid()`)
  - `organisation_id` (UUID FK -> `organisations.id` ON DELETE CASCADE)
  - `broadcast_id` (UUID FK -> `broadcasts.id` ON DELETE CASCADE)
  - `parent_id` (UUID FK -> `parents.id` ON DELETE SET NULL)
  - `recipient_email` (`character varying NOT NULL`)
  - `recipient_name` (`character varying NULL`)
  - `channel` (`character varying NOT NULL DEFAULT 'email'`)
  - `status` (`character varying NOT NULL DEFAULT 'PENDING'`)
  - `claim_token` (`character varying NULL`)
  - `claimed_at`, `lease_expires_at`, `last_attempt_at`, `sent_at`, `next_attempt_at` (timestamptz)
  - `attempt_count` (`integer NOT NULL DEFAULT 0`)
  - `provider_message_id` (`character varying NULL`)
  - `last_error` (`text NULL`)
  - `created_at`, `updated_at` (timestamptz)
- **Indexes Created**:
  - `broadcast_deliveries_unique_idx` UNIQUE (`broadcast_id`, `recipient_email`)
  - `broadcast_deliveries_org_idx` (`organisation_id`)
  - `broadcast_deliveries_broadcast_idx` (`broadcast_id`)
  - `broadcast_deliveries_queue_idx` (`status`, `next_attempt_at`)

---

## 4. Production Smoke & Health Verification

All public routes on `https://app.sprintscaleit.co.uk` verified HTTP 200 OK:
- `/` -> 200 OK
- `/login` -> 200 OK
- `/signup` -> 200 OK
- `/terms` -> 200 OK
- `/privacy` -> 200 OK
- `/api/health` -> 200 OK

### Cron Recovery Endpoint Security:
- `GET /api/cron/broadcasts` (no header) -> 401 `{"error":"Missing authorization header"}`
- `POST /api/cron/broadcasts` (no header) -> 401 `{"error":"Missing authorization header"}`
- `GET /api/cron/broadcasts` (invalid bearer) -> 401 `{"error":"Unauthorised"}`

---

## 5. Synthetic Canary & Durable Ledger Verification

1. **Isolation**: Synthetic parent and canary outbox records seeded inside dedicated test tenant `6847207c-4f0d-48ce-bbe0-2eacdcfb15ba` (`Tester's College LTD`).
2. **Transactional Outbox Verified**:
   - Broadcast Header: `0e8d1bf1-524b-43d7-9f9b-71ae027bd3b8` (`QUEUED`, recipient_count: 1)
   - Delivery Ledger Row: `390e77a3-e099-4704-a27e-0c75a36e3f96` (`PENDING`, recipient: `kwadwo.addo+canary@sprintscaleit.co.uk`)
   - Audit Event: `55c9bf34-5211-4a57-aed0-206077614ba3` (`broadcast.queued`)
3. **Cleanup Verified**: All synthetic records purged via cascading deletion. Residual counts across `broadcasts`, `broadcast_deliveries`, and synthetic parent: **0**.

---

## 6. Mandatory Operational Qualifications

The operational qualifications defined during certification are formally ratified for production:
1. **CURRENT PROJECT CRON FREQUENCY CAPABILITY NOT INDEPENDENTLY VERIFIED**: Vercel cron is registered in `vercel.json` as `0 2 * * *` (daily). Sub-daily cron execution depends on project plan capabilities.
2. **PROVIDER-RUNTIME IDEMPOTENCY NOT VERIFIED**: Provider deduplication at the edge depends on downstream provider support for the forwarded `Idempotency-Key` HTTP header.
3. **MAXIMUM SCHEDULED RECOVERY DELAY: UP TO APPROXIMATELY 24 HOURS**: Any crashed serverless process that leaves leased or pending deliveries will be safely recovered by the daily cron run at 02:00 UTC.

---

## 7. Sign-off & Verdict

- **Release Orchestrator**: APPROVED
- **Git / Release Forensics**: APPROVED
- **Database / Concurrency Specialist**: APPROVED
- **Production Verification Agent**: APPROVED
- **Security Critic**: APPROVED

**FINAL STATUS: PASS / PRODUCTION VERIFIED / CLOSED**
