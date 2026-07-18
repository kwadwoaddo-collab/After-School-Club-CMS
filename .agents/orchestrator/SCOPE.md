# Scope: Dashboard Homepage Audit & Upgrade

## Architecture
- **DashboardHero (`src/components/dashboard/DashboardHero.tsx`)**: Renders the welcome banner at the top of the dashboard.
- **KpiGrid (`src/components/dashboard/KpiGrid.tsx`)**: Renders key metric cards (Students, Bookings, Registrations, Pending Approval) and their sparklines.
- **StatCard (`src/components/dashboard/StatCard.tsx`)**: Generic KPI/metric card wrapper component.
- **TodaysSnapshot (`src/components/dashboard/TodaysSnapshot.tsx`)**: Displays daily attendance list, check-ins, and class counts.
- **DashboardSkeletons (`src/components/dashboard/DashboardSkeletons.tsx`)**: Renders loading placeholders.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Decompose & Explore | Analyze existing component code, define plan, run baseline tests | None | DONE |
| 2 | Upgrade Hero & KPI | Implement R1 (DashboardHero), R2 (KpiGrid), R3 (StatCard) | M1 | DONE (Conv ID: 23d67fda-566f-4448-a6be-856fcd1a5599) |
| 3 | Upgrade Snapshot & Skeletons | Implement R4 (TodaysSnapshot), R5 (DashboardSkeletons) | M2 | DONE (Conv ID: 23d67fda-566f-4448-a6be-856fcd1a5599) |
| 4 | E2E & Hardening (Verification) | Run all tests (133 tests), Challenger validation, Forensic Auditor checks | M3 | DONE (Conv IDs: aaf90749-fb10-4d58-8864-054896487ae9, 7347468b-b3f2-40cd-ac44-d288c755eb6d, 29a12cdb-9952-4312-a53a-ff601faf23cf) |

## Interface Contracts
### Dashboard Components ↔ Data Types
- `DashboardHeroProps` must accept `firstName`, `lastName`, `orgName`, and sticky state selectors without breaking server/client boundary.
- `KpiStat` interface in `KpiGrid` should incorporate `glowClass: string` and remove the dynamic string lookup.
- CSS variable classes must support theme toggle (`dark` mode) correctly.
