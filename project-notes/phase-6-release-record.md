# Phase 6 — Production Release Record

**Project**: After-School-Club-CMS / CMS Modernisation
**Release Name**: CMS Modernisation Production Release v1.0
**Canonical Production URL**: `https://app.sprintscaleit.co.uk`
**Deployment Date**: 2026-08-25

---

## Release Identity & Integrity

| Property | Value |
|---|---|
| Approved Application Baseline | `6c205ed` |
| Deployed Production Code SHA | `d6ea2a8` |
| Phase-6 Documentation Tip SHA | `3a2738a` |
| Vercel Deployment ID | `dpl_5sQpg8PtHwcV2wha4Z8UXWkRnyKq` |
| Vercel Project | `after-school-club-live` (`kwadwo-addos-projects`) |
| Production DB Host | `ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech` |
| DB Migrations Applied | 23 / 23 (0 pending) |

---

## Quality & Verification Summary

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **PASS** |
| ESLint (`--max-warnings=0`) | **PASS** |
| Vitest | **554 / 554 PASS** (57 test files) |
| Production Build (`next build`) | **PASS** |
| Live Public Smoke | **PASS** (9/9 public routes 200/307 OK) |
| Staff Authentication | **PASS** (Google OAuth & session persistence live verified) |
| Transactional Email | **PASS** (Resend live delivery from `@sprintscaleit.co.uk` verified) |
| Reversible Mutation | **PASS** (Settings edit & full rollback verified) |
| Production Defects | **0** |
| Net Data Deltas | **0** |
| Security Matrix | 17 Live Runtime Safe, 13 Safely Blocked (No safe production personas) |
| Application Rollback Target | `dpl_7GgRdHsVtzSKQtmDpqcXEztU2dci` (Ready) |
| DB Recovery Branch | `pre-6c-dev-20260825-2140` (Preserved) |

---

## Executive Approval

**PASS WITH NON-BLOCKING POST-LAUNCH DEBT — CMS APPROVED FOR LIVE OPERATIONAL USE**
**PHASE 6 COMPLETE**
