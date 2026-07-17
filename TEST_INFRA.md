# E2E Test Infrastructure Documentation

This directory contains the comprehensive end-to-end (E2E) test suite for the After-School Club CMS, designed using a robust 4-tier approach with Playwright.

---

## 1. 4-Tier Test Hierarchy

The tests are organized into four sequential tiers to guarantee feature correctness, boundary safety, cross-feature integration, and real-world scenario validation:

### Tier 1: Feature Coverage (`tests/tier1.spec.ts`)
- **Focus**: Key user-facing functionality across core product areas.
- **Coverage**: >=5 tests per core feature:
  - **Dashboard**: KPI visibility, Organization naming, Sidebar layout/collapsing, Active Centre combined view dropdown, Profile info card.
  - **Students**: Student directory listing, Search functionality, Child profile details page, Add student form, Student import page.
  - **Finance**: Invoice ledger page, Receipt generator subpage, Financial summaries/ledger, Invoice status filters, Receipts search.
  - **Settings**: Configuration page loading, GDPR data export button, Prefilled profile fields, Brand color picker, General section headers.

### Tier 2: Boundary & Corner Cases (`tests/tier2.spec.ts`)
- **Focus**: Error handling, boundary values, invalid inputs, and fallback states.
- **Coverage**: >=5 tests per core feature:
  - **Dashboard**: Unauthenticated redirection, Non-existent route 404, Sidebar responsive mobile states, Invalid/random centre UUID handling, Combined view empty query parameters.
  - **Students**: Directory special characters searching, Non-existent child UUID 404, Form validation on empty submit, Form validation on invalid email format, Student import page upload constraints.
  - **Finance**: Invoice filtering with far-future dates, Non-existent invoice search empty state, Non-existent receipt UUID 404, Invalid JWT/token access blocking for PDF invoices, Finance dashboard empty state fallback.
  - **Settings**: Empty organization name saving failure, Invalid contact email validation, Brand color picker constraints, Empty-change save operations, GDPR data export download triggers.

### Tier 3: Cross-Feature Combinations (`tests/tier3.spec.ts`)
- **Focus**: Pairwise feature interactions and data propagation across sub-systems.
- **Coverage**: 6 integration tests:
  - **CF1**: Settings to Dashboard update propagation (Inline name change updates dashboard headers).
  - **CF2**: Students to Dashboard KPI metrics linkage (Seeded/searched students display in dashboard KPI counts).
  - **CF3**: Bookings management updating Attendance view (Appointments propagate to student details).
  - **CF4**: Settings brand color affecting global dashboard elements (Visual branding theme sync).
  - **CF5**: Student detail navigation to Parent details linkage (Bi-directional relational routing).
  - **CF6**: Finance Invoice details referencing Student Profile (Relational invoice billing checks).

### Tier 4: Real-World Application Scenarios (`tests/tier4.spec.ts`)
- **Focus**: Complex multi-step user journeys simulating production flows.
- **Coverage**: 5 user scenarios:
  - **Scenario 1**: Complete Public Booking Flow for New Student (filling details, selecting custom Dagenham subjects: Science & Tech / Homework Help, choosing appointments, checking consent, confirming booking).
  - **Scenario 2**: Admin Dashboard Inspection & KPI Verification (login, validating metrics, navigating to Booking management, returning to dashboard).
  - **Scenario 3**: Add New Student and Verify in Students List (adding a child via admin panel, searching and validating they appear in directories).
  - **Scenario 4**: View Student Profile & Details Audit (inspecting student profiles, auditing medical notes, verifying parent contact associations).
  - **Scenario 5**: Complete Finance Billing Review Flow (viewing invoice listings, checking filter states, verifying receipts ledger).

---

## 2. Running E2E Tests

Tests run against a Next.js server configured by Playwright.

### Commands

- **Run all E2E tests**:
  ```bash
  npx playwright test
  ```

- **Run a specific Tier**:
  ```bash
  npx playwright test tests/tier1.spec.ts
  ```

- **Run a single test by name**:
  ```bash
  npx playwright test -g "Student search functionality works"
  ```

- **Run tests in interactive UI mode**:
  ```bash
  npx playwright test --ui
  ```

- **Run tests in debug mode**:
  ```bash
  npx playwright test --debug
  ```

---

## 3. Database Seeding & Environment Setup

The test suite requires a consistent database state to pass reliably. 

### Seeding
Before executing the tests, seed the database with mock records (Organisations, Users, Centres, Bookings, Parents, Children):
```bash
npm run db:seed
```

### Configuration
The test runner is configured to spin up Next.js on port `3005` in `playwright.config.ts`.
- **Note**: Ensure that no other Next.js dev server is running concurrently in the workspace directory (e.g. on port `3001`), as Next.js locks dev build files, causing conflicts. If a port conflict arises, identify and terminate the old process:
  ```bash
  # Check for process on port 3001
  lsof -i :3001
  # Kill process using the PID found
  kill <PID>
  ```
