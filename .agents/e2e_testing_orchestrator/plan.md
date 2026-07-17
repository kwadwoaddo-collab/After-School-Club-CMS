# E2E Test Suite Execution Plan

## Objectives
1. Configure `webServer` in `playwright.config.ts` to run Next.js on port 3001 automatically.
2. Design and implement 4-Tier E2E test suite:
   - Tier 1: 5 feature coverage tests each for Dashboard, Students, Finance, Settings (20 total).
   - Tier 2: 5 boundary & corner case tests each for Dashboard, Students, Finance, Settings (20 total).
   - Tier 3: Pairwise interactions between features (at least 6 tests).
   - Tier 4: Real-world application scenarios (at least 5 tests).
3. Document tests in `TEST_INFRA.md`.
4. Verify all tests pass and are correct.
5. Publish `TEST_READY.md`.

## Decomposed Milestones
- **Milestone 1**: E2E Setup & WebServer Configuration.
- **Milestone 2**: Implement Tier 1 E2E tests (Dashboard, Students, Finance, Settings).
- **Milestone 3**: Implement Tier 2 E2E tests (Dashboard, Students, Finance, Settings).
- **Milestone 4**: Implement Tier 3 (Cross-Feature) and Tier 4 (Real-World) E2E tests.
- **Milestone 5**: Write `TEST_INFRA.md` & `TEST_READY.md` and perform final E2E verification.

## Team Roster & Workspace Layout
- `worker_e2e_setup` (teamwork_preview_worker): Milestone 1
- `worker_tier_1_2` (teamwork_preview_worker): Milestone 2 & 3
- `worker_tier_3_4` (teamwork_preview_worker): Milestone 4
- `worker_infra_docs` (teamwork_preview_worker): Milestone 5
- `auditor` (teamwork_preview_auditor): Verification check
