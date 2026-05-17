# Comprehensive Manual QA Checklist

This checklist ensures all critical pathways, security features, and operational workflows are fully functional before a production deployment. 

**Pre-requisite:** Ensure tests are run in the **Staging Environment** using non-production dummy data, test Stripe keys, and a sandbox email/SMS configuration to avoid affecting real users.

| Feature | Test steps | Expected result | Severity if broken |
| :--- | :--- | :--- | :--- |
| **Login (Staff)** | 1. Navigate to `/login`.<br>2. Enter valid staff credentials.<br>3. Attempt login with invalid credentials.<br>4. Test "Forgot Password" flow. | 1. Successful redirect to staff dashboard.<br>2. Clear error message shown; no access granted.<br>3. Password reset email received with working link. | Critical |
| **Parent Registration** | 1. Navigate to the parent registration flow.<br>2. Fill out details (name, contact).<br>3. Submit the form. | Parent account is created in the database. Welcome email (if configured) is dispatched. | High |
| **Student Registration** | 1. As a parent, add a student profile.<br>2. Fill in required fields (DOB, school year, subjects).<br>3. Submit. | Student profile linked to parent. Details accurately reflect on the admin dashboard. | High |
| **Booking** | 1. Select a centre and time slot.<br>2. Complete the booking process for a student.<br>3. Verify calendar sync. | Booking is confirmed. Confirmation screen shown. Google Calendar event created. Email/SMS sent to parent. | Critical |
| **Cancellation** | 1. Parent cancels via their portal.<br>2. Admin cancels via the dashboard. | Booking status updates to "cancelled". Calendar event is removed. Cancellation notification is sent. | High |
| **Magic Links** | 1. Request magic link as a parent.<br>2. Click the link in the email.<br>3. Click the same link a second time. | 1. Email received.<br>2. Successfully logged into Parent Portal (using secure hash verification).<br>3. Link fails/expires on second use. | Critical |
| **Parent Portal** | 1. Log in via magic link.<br>2. View upcoming bookings.<br>3. View past bookings. | Portal loads quickly. Shows correct upcoming/past bookings belonging *only* to that parent. | High |
| **Invoices** | 1. Admin generates an invoice for a parent.<br>2. Parent views invoice in portal.<br>3. Process a test Stripe payment. | Invoice appears correctly with accurate calculations. Stripe test payment marks invoice as "paid". | Critical |
| **Receipts/PDFs** | 1. Generate PDF receipt for a paid invoice.<br>2. Download PDF. | PDF generates successfully without layout breaking. Contains accurate centre/org details and amounts. | Medium |
| **Attendance** | 1. Admin navigates to today's bookings.<br>2. Mark student as "Attended" / "No Show". | Status updates immediately. Any associated attendance notes are saved correctly. | High |
| **Centre Filtering** | 1. Admin with multi-centre access views dashboard.<br>2. Toggle between different centres. | Data (bookings, students, staff) accurately filters to show *only* data for the selected centre. | High |
| **Emails** | 1. Trigger booking confirmation, cancellation, and magic link emails. | Emails arrive in the staging inbox. Formatting is correct. Links work. | High |
| **Roles/Permissions** | 1. Log in as ORG_OWNER.<br>2. Log in as FRONT_DESK.<br>3. Log in as TUTOR. | Owners see everything. Front desk can manage bookings but not settings. Tutors only see their own assigned bookings/students. | Critical |
| **Dashboard Loading** | 1. Load the main dashboard.<br>2. Navigate between "Bookings", "Students", "Settings". | Pages load within acceptable time limits (< 2s). Skeletons/spinners show during data fetch. | Medium |
| **Mobile Responsiveness** | 1. View Parent Portal on a mobile device/emulator.<br>2. View Staff Dashboard on a tablet size. | UI scales correctly. No horizontal scrolling. Menus collapse into hamburgers. Buttons are tappable. | Medium |
| **Error Handling** | 1. Disconnect network and try to submit a form.<br>2. Navigate to a non-existent URL. | 1. Graceful error toast/message shown (no app crash).<br>2. Custom 404 page is displayed. | Medium |
| **Rate Limiting** | 1. Attempt to log in 10 times rapidly from the same IP.<br>2. Request 10 magic links rapidly. | IP is temporarily blocked with a "Too Many Requests" (429) error. | High |
| **Feature Flags** | 1. Toggle a feature flag in the database/env.<br>2. Refresh the UI. | Feature hides/shows accordingly without breaking the surrounding layout or crashing the app. | Low |
| **Legacy Data Compatibility** | 1. Log in using an old parent account with a raw UUID session cookie/token. | Parent successfully logs in without being logged out abruptly. Backwards compatibility fallback works. | High |
| **Staging/Production Safety** | 1. Verify `NEXT_PUBLIC_BASE_URL` points to staging domain.<br>2. Verify Stripe keys are `pk_test_...` and `sk_test_...`. | No production databases are mutated. No real parents receive test emails. No real money is charged. | Critical |
