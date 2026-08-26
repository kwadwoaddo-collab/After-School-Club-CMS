# Milestone 6F.1 — Incident Closure Report

**Date**: 2026-08-26
**Project**: After-School-Club-CMS / CMS Modernisation
**Incident Reference**: Milestone 6F.1 Production Tenant / Data-Routing Investigation
**Final Incident Verdict**: **FALSE ALARM CLOSED — OPERATOR LOGIN ACCOUNT MIX-UP CONFIRMED — SYSTEM OPERATED AS DESIGNED — NO REMEDIATION REQUIRED — PHASE 6 RELEASE REMAINS VALID**

---

## 1. Executive Summary

A reported production data-routing incident where an authenticated user observed test/synthetic data (`Bright Star Academy`) on `https://app.sprintscaleit.co.uk` has been **investigated and formally closed as a FALSE ALARM**.

The operator confirmed that the wrong login account was used during the reported incident:
- Account used: `kwadwoaddo@googlemail.com` (Associated with `Bright Star Academy` in the database).
- Intended operational account: **`kaddo@sydenhamasc.co.uk`** (Associated with `Sydenham After School Club LTD`).

The application correctly authenticated `kwadwoaddo@googlemail.com` and displayed `Bright Star Academy` because that is the registered organisation for that account. When logging in with **`kaddo@sydenhamasc.co.uk`**, the user accesses `Sydenham After School Club LTD` and its live operational records.

---

## 2. Incident Audit & Technical Verification Findings

| Verification Item | Result | Findings |
|---|---|---|
| Production Deployment | **PASS** | `https://app.sprintscaleit.co.uk` resolves to deployment `dpl_5sQpg8PtHwcV2wha4Z8UXWkRnyKq`. |
| Production DB Routing | **PASS** | `DATABASE_URL` targets `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech`. |
| Staging Isolation | **PASS** | Staging DB `ep-aged-morning-abr2278f` remains completely isolated. |
| Live Data Integrity | **PASS** | `Sydenham After School Club LTD` live data is 100% present and intact (160 parents, 187 children, 74 bookings, 42 registrations, 3 invoices). |
| Tenant Isolation | **PASS** | All API queries strictly filter by `session.user.organisationId`. No cross-tenant data leakage occurred. |
| Application Defect | **NONE** | System operated 100% as designed. |
| Security Breach | **NONE** | Multi-tenant authentication boundaries strictly enforced. |
| Data Corruption / Loss | **NONE** | Zero data loss or corruption. |

---

## 3. Cancellation of Previous Remediation Proposal

All preliminary remediation proposals from the initial audit draft are **OFFICIALLY CANCELLED & NOT AUTHORIZED**:
- `org_memberships` insert for `kwadwoaddo@googlemail.com`: **CANCELLED**
- `users.organisationId` update for `kwadwoaddo@googlemail.com`: **CANCELLED**
- Removal of `Bright Star Academy` membership: **CANCELLED**
- Database mutations: **NONE (0 writes)**
- Application redeployment: **NONE (0 deploys)**
- Application code edits: **NONE (0 edits)**

The presence of legacy synthetic data (`Bright Star Academy`) in the production database is logged as non-blocking technical debt (`P7-10`) for read-only review in Phase 7.

---

## 4. Phase-6 Release Validity & Go-Live Status

- **Phase-6 Go-Live Status**: **PASS WITH NON-BLOCKING POST-LAUNCH DEBT — CMS APPROVED FOR LIVE OPERATIONAL USE**
- **Release Tag `cms-modernisation-v1.0`**: **REMAINS 100% VALID & FROZEN at `64e59d5`**
- **Next Step**: Phase 6 is complete. Await orchestrator review for Phase 7 authorization.
