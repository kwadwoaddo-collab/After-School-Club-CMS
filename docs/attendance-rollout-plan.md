# Child Attendance MVP: Rollout & Operational Testing Plan

This document outlines the strategy for safely deploying, testing, and monitoring the new Phase C per-child granular attendance tracking feature. 

## 1. How to Enable the Feature Safely

The granular attendance feature is protected by a feature flag to ensure a risk-free rollout.

*   **Step 1: Staging Environment Verification**
    *   Ensure the `ENABLE_GRANULAR_ATTENDANCE` flag is set to `true` in the staging environment.
    *   Perform full QA sweeps before touching production.
*   **Step 2: Production Pilot Activation**
    *   Deploy the code to production with the feature flag **disabled** globally by default.
    *   Enable the feature flag *only* for specific pilot sites/companies using environment variables (e.g., `ENABLE_GRANULAR_ATTENDANCE=true` for pilot organizations if tenant-level flagging is supported, otherwise deploy to a hidden URL or specific pilot deployment).
*   **Step 3: Global Rollout**
    *   Once the pilot phase is successful (after 1-2 weeks), switch the environment variable to enable the feature globally for all users.

## 2. Recommended Internal Pilot Users

Select a cohort of pilot users to test the feature in a real-world scenario before general availability:

*   **High-Volume Site Managers:** Staff who handle a large number of children during peak drop-off/pick-up times to stress-test the UI responsiveness.
*   **Multi-Child Booking Handlers:** Staff members who frequently process sibling bookings to validate the granular, per-child tracking.
*   **Administrators:** To verify that the audit logs and dashboard overviews provide the necessary visibility.

## 3. Test Scenarios

### Single-Child Bookings
*   **Scenario A: Mark Present**
    *   *Action:* Mark a child as "Present".
    *   *Expected:* UI updates immediately (optimistic UI), DB reflects change, audit log created.
*   **Scenario B: Mark Absent**
    *   *Action:* Mark a child as "Absent".
    *   *Expected:* UI updates, DB reflects change, audit log created.

### Multi-Child Bookings (Siblings)
*   **Scenario C: Mixed Attendance**
    *   *Action:* In a booking with two siblings, mark Sibling A as "Present" and Sibling B as "Absent".
    *   *Expected:* Each child's status is recorded independently. The UI displays distinct statuses for each child.
*   **Scenario D: Batch Updates**
    *   *Action:* Mark all siblings present sequentially.
    *   *Expected:* UI remains responsive; no race conditions or database deadlocks occur.

## 4. Edge Cases

*   **Absent Child + Present Sibling:** Verify that marking one sibling as "Absent" does not accidentally cascade or alter the "Present" status of the other sibling within the same booking container.
*   **Changing Attendance After Save:** Mark a child "Present", wait 5 minutes, then change to "Late" or "Absent". Verify that the database performs an `UPSERT` correctly, avoiding duplicate records, and the audit log records the transition.
*   **Note Edits:** Add a note to an attendance record (e.g., "Arrived late due to traffic"). Edit the note. Delete the note. Verify the database updates correctly without affecting the attendance status.
*   **Permissions:** Attempt to invoke the `markAttendance` server action using a session belonging to a standard "Parent" role. Verify the action is rejected with an authorization error. Ensure only "Staff" and "Admin" roles can mutate attendance data.

## 5. Operational Feedback to Collect from Staff

During the pilot phase, actively solicit the following feedback from staff:

*   **Speed & Efficiency:** Is the dropdown UI fast enough during the chaos of the 3:30 PM school run?
*   **Clarity:** Is it immediately obvious which sibling has been checked in and which hasn't?
*   **Notes Usage:** Are staff actually using the notes feature? Is it helpful, or does it slow them down?
*   **Accidental Clicks:** How easy is it to accidentally click the wrong status, and is it intuitive to fix it?

## 6. Metrics & Logging to Monitor

Monitor these key areas during the rollout:

*   **Error Rates:** Watch Vercel/server logs for any exceptions thrown by the `markAttendance` server action.
*   **Database Performance:** Monitor query execution times for `INSERT ... ON CONFLICT` statements on the `attendance_records` table.
*   **Audit Log Volume:** Ensure `attendance_update` events are flowing into the audit logs as expected without spamming the database.
*   **Adoption Rate:** Track the percentage of active daily bookings that have granular attendance records attached versus those relying on the legacy booking status.

## 7. Deprecation of Legacy Booking Status Inference

The legacy system (inferring child attendance from the overall `booking.status`) should **only** be deprecated when all of the following conditions are met:

1.  **Pilot Completion:** The granular tracking MVP has run in production for at least 2 weeks without critical bugs.
2.  **Dual-Running Verification:** Data reports run using granular tracking match or exceed the accuracy of the legacy booking status reports.
3.  **Financial Decoupling:** Invoicing and financial reporting are confirmed to be safely decoupled from the legacy booking "attended" status (or have been updated to read from the new `attendance_records` table).
4.  **Data Migration (Optional but Recommended):** Historical booking statuses are migrated to granular attendance records to ensure historical reporting continuity.

---

## Output Checklists

### Rollout Checklist
- [ ] Feature flag `ENABLE_GRANULAR_ATTENDANCE` added to codebase.
- [ ] Unit/Integration tests passing in CI/CD pipeline.
- [ ] Staging environment validation completed.
- [ ] Pilot users identified and briefed.
- [ ] Feature flag enabled for pilot environments/users.
- [ ] Application logs and database metrics monitoring dashboards configured.

### Operational QA Checklist
- [ ] **Single Child:** Mark Present/Absent.
- [ ] **Multi-Child:** Mixed Present/Absent states for siblings.
- [ ] **Updates:** Change existing attendance status.
- [ ] **Notes:** Add/Edit/Remove notes.
- [ ] **Permissions:** Parent accounts cannot modify attendance.
- [ ] **Audit:** Verify actions appear in the audit trail.

### Rollback Steps
1.  Set the `ENABLE_GRANULAR_ATTENDANCE` environment variable back to `false` in Vercel.
2.  Trigger a redeployment to ensure the environment variable change takes effect globally.
3.  *(If data corruption occurred)* Run targeted SQL scripts to isolate or prune malformed rows in the `attendance_records` table (Note: Since it's decoupled from legacy tracking, simply turning off the flag restores the legacy UI).
4.  Communicate rollback to pilot staff.

### Success Criteria
- **Zero Downtime:** Deployment and feature activation cause no platform downtime.
- **Accurate Tracking:** Staff can successfully record independent statuses for siblings in >99% of attempts.
- **Performance:** UI state updates optimistically without noticeable lag; server actions complete in < 500ms.
- **No Regressions:** Legacy booking workflows, invoicing, and reporting remain completely unaffected during the dual-running phase.
