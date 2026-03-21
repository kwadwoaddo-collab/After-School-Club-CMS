improvements.md
This file tracks UI/UX and logic improvements for the After School Club CMS.

[x] Task 1: Make "Preferred Contact Method" Optional
Status: COMPLETE
Description: Removed * and required from contact method radio buttons in BookingForm.tsx. Field is optional.

[x] Task 2: Analyze & Fix Weekend Slot Availability
Status: COMPLETE
Location: AvailabilityService, availability/route.ts
Fix Applied:
  1. Timezone bug: route.ts now constructs Date from year/month/day parts (not new Date(string)) so getDay() always returns the correct local day.
  2. Auth bug: removed session auth check from /api/availability so unauthenticated parents on /book can fetch slots.

[x] Task 3: Disable "Online" Session Type
Status: COMPLETE
Description: BookingForm.tsx marks online as disabled: true with "Coming Soon" label and pointer-events-none styling.

[x] Task 4: Make "Select Date" Mandatory
Status: COMPLETE
Description: Continue button on Step 3 is disabled via disabled={!selectedDate || !watch('appointment.startAt')}. Label updated with *.

[x] Task 5: Fix "Mark as Attended" Functionality
Status: COMPLETE
Description: MarkAttendedButton.tsx sends PATCH /api/bookings/[id]/status with {status: 'completed'}. Optimistic UI update shows "✓ Attended" badge immediately. Wired to the booking detail page.

[x] Task 6: Implement "Delete Booking" Functionality
Status: COMPLETE
Location: Bookings List Page (/bookings) - Actions Menu (three dots)
Implemented:
  - UI: "Delete Booking" option in actions dropdown with red text in BookingsTable.tsx.
  - Safety: Branded confirmation dialog (not browser alert) — matches design language.
  - Backend: DELETE /api/bookings/[id] removes record (booking_attendees cascade deleted).
  - Frontend: Optimistic removal from table state without page refresh.
  - Bonus: Cancel Booking also uses branded modal now instead of browser.confirm().
  - Bonus: Errors shown via global Toast system (success/error/info) instead of browser alert().

[x] Task 7: Fix "Sign in with Google" Responsiveness (Popup not appearing)
Status: COMPLETE
Location: Login Page / src/app/login/page.tsx
Fix Applied:
  - mounted state gates the button until React hydration is complete.
  - Loading spinner shown until mounted.
  - googleLoading state disables the button while popup is opening.
  - googleError state renders inline error message if popup is blocked.
  - Goal achieved: Google popup appears on first click, no race condition.

## [x] Task 8: Make Email Optional (Frontend & Backend)
- **Status:** COMPLETE
- **Location:** Parent Details Step
- **Description:** 
    - Remove `required` attribute from the Email input.
    - Remove the `*` (asterisk) from the "Email" label.
    - **Backend:** Update the Pydantic/FastAPI models to allow `email` to be `null` or an empty string.

## [x] Task 9: Fix UI Contrast & Styling in Booking Flow
- **Status:** COMPLETE
- **Location:** Parent Details -> Preferred Contact
- **Issue:** The blue background on "Email" and "Phone" labels makes text unreadable.
- **Fix:** Remove the background colors. Use a clean, professional font color (e.g., dark slate #1e293b) that matches the rest of the form. Ensure all labels are consistently styled.

## [x] Task 10: FIX SUNDAY SLOTS LOGIC (High Priority)
- **Status:** COMPLETE
- **Location:** `AvailabilityService` / Backend logic
- **Issue:** Selecting Sunday still shows "No slots available."
- **Technical Fix:** Check for a mismatch between JS `getDay()` (Sunday=0) and Python `weekday()` (Sunday=6). Ensure the backend queries the `SessionSlots` table correctly for "Sunday" entries.

## [x] Task 11: Implement Professional Notification System
- **Status:** COMPLETE
- **Description:** Replace standard browser `alert()` popups with professional "Toast" notifications (e.g., using a library or custom Tailwind component). 
- **Goal:** Show a green "Success" toast when a booking is confirmed and a red "Error" toast if something fails.

## [x] Task 12: Add "Empty State" Designs
- **Status:** COMPLETE
- **Description:** If a user visits the "Bookings" or "Students" page and there is no data, show a professional "Empty State" graphic and a "Add New" button instead of just a blank table.

## [x] Task 13: Full Professional UI Audit & Polish
- **Status:** COMPLETE
- **Goal:** Self-improvement. The agent must review every page for:
    - **Consistency:** Padding, margins, and button sizes must be identical across the app.
    - **Loading States:** Every button should show a "Loading..." spinner while waiting for the backend.
    - **Mobile View:** Ensure the booking flow is 100% responsive and looks great on a phone.

    [x] Task 14: Remove All Assessment Capacity Limits
Status: COMPLETE
Location: Backend (AvailabilityService / crud.py / main.py)
Issue: The system is preventing bookings with the error "This time slot is no longer available."
Logic Change:
Remove Capacity Check: Locate the logic that counts existing bookings for a specific date and time_slot. Delete or disable the validation that blocks a booking if a "limit" is reached.
Unlimited Bookings: Ensure that even if multiple parents choose the same 11:00 AM slot, the database accepts all of them.
Validation: Remove the frontend and backend error message: "This time slot is no longer available."
Goal: Ensure the "Confirm Booking" step always succeeds regardless of how many other students are booked at that time.

[x] Task 15: Redesign the "Booking Confirmed" Success Screen
Status: COMPLETE
Location: Success/Confirmation Screen (Post-form submission)
Description:
Remove the Code: Hide or remove the long alphanumeric confirmation code from the UI. It feels unnecessary for parents.
Add a Summary: Instead of a code, show a clear summary of what they just booked so they can screenshot it:
Child Name
Date & Time
Centre Location
Clear Call to Action: Keep the "Done" button, but make the email message more prominent.
Goal: Make the screen feel welcoming and provide the parent with the immediate info they need (the "When" and "Where") rather than a technical ID.

[x] Task 16: Refine Dashboard "Recent Bookings" Layout
Status: COMPLETE
Location: Dashboard -> Assessments & Bookings Card
Description:
Remove Dead Space: Tighten the layout so the "View All Assessments" button sits directly below the last list item.
Increase Density: Instead of showing only 3 bookings, increase the count to 5 or 6 items (enough to fill the card height without excessive empty "real estate").
Goal: Make the card look full and active while reducing unnecessary scrolling/gap.
[x] Task 17: Update Sorting Logic for Dashboard List
Status: COMPLETE
Location: Dashboard API / Frontend Sorting
Description:
Sorting order: Display bookings by Nearest Date First (Chronological order).
Logic: Sort by date (Ascending) and then time_slot (Ascending).
Filter: Ideally, this list should only show Upcoming or Today's bookings, hiding past ones.
Goal: Ensure the most immediate appointments are at the very top of the list so the user knows who is arriving next.

[x] Task 18: Add Consistent "Back" Navigation to Registration Flow
Status: COMPLETE
Location: Registration Funnel (Fees Page, Centre Selection, Step 1)
Description:
Fees & Payment Page: Add a "Back" button at the bottom left. Since this is the entry point, it should link back to the main landing page or the previous site.
Select a Centre Page: Add a "Back" button at the bottom left to return to the "Fees & Payment" page.
Step 1 (Children's Details): Add a "Back" button at the bottom left to return to the "Select a Centre" page.
UI/UX: The buttons must match the styling of the "Back" button seen in Step 2 (Image 4)—using the same outline style, positioning, and hover effects.
Goal: Ensure every step of the registration process allows the user to return to the previous screen easily.

## [x] Task 19: Visual Realignment to the "SprintScale" Design
- **Status:** COMPLETE
- **Location:** Global Dashboard (`layout.tsx`, `page.tsx`, `Header.tsx`, `Sidebar.tsx`)
- **Issue:** The current UI (Image 2) uses large gradient buttons and a basic layout that does not match the professional "SprintScale" reference (Image 1).
- **Fix Applied:**
    - **Header:** Cleaned the top navigation header by removing the action buttons (New Assessment, Export, Booking Link).
    - **Sidebar:** Refactored the sidebar to `#1a1d23` matching the dark theme, removed inline Quick Links, and added a sticky "New Booking" button above Quick Support at the bottom.
    - **Cards:** Refactored `page.tsx` into a precise 3-column layout (`lg:grid-cols-3`): Left (Assessments), Middle (Registrations with Public Link box), Right (Staff Management).
    - **Theme:** Switched global dashboard layout to the deep-dark professional theme (`#0f1115` background) and updated all cards to `#1a1d23`.
    - **Student Ecosystem:** Added the "Student Ecosystem" footer bar featuring overlapping student avatars alongside the view action.

    ## [x] Task 20: Integrate "Export" Feature into Professional UI
- **Status:** COMPLETE
- **Location:** Dashboard Header or Sidebar
- **Description:** 
    - **UI Change:** Remove the large "Export Report" button from the main dashboard area to match the "SprintScale" design.
    - **New Placement:** Add a "Reports" item to the Sidebar (below Settings) OR add a subtle "Export" icon (a tray with an arrow) in the top right header next to the notification bell.
    - **Functionality:** Clicking this should trigger the existing export logic (CSV/PDF generation).
    - **Goal:** Keep the powerful reporting features available but maintain the high-end, uncluttered design of the new dashboard.

## [x] Task 21: Implement Functional Global Search (Cmd + K)
- **Status:** COMPLETE
- **Location:** Header / Search Bar
- **Issue:** The search bar is currently just a visual placeholder and does not return results.
- **Requirements:**
    - **Backend:** Create a search API endpoint (e.g., `/api/search?q=...`) that performs a partial match (ILIKE) across Students (name/email), Bookings (parent/child name), and Centres.
    - **Frontend:** Implement a live-search dropdown. As the user types, show the top 5-10 results categorized by type (e.g., "Students", "Bookings").
    - **Keyboard Shortcut:** Add a listener for Cmd + K (Mac) and Ctrl + K (Windows) to automatically focus the search bar.
    - **Navigation:** Clicking a search result must take the user directly to that record's detail page (e.g., clicking a booking result opens the "Booking Details" page).
- **Goal:** Allow the admin to find any student or booking instantly from any page in the app.

[x] Task 22: Fix Contrast for "Bookings" Header
Status: COMPLETE
Location: Bookings Page Header
Issue: The word "Bookings" has low visibility against the dark background.
Fix: Update the text color to a higher contrast shade (e.g., pure white #FFFFFF or a very light gray #F8FAFC). Ensure it meets WCAG AA standards (at least 4.5:1 contrast ratio).[1][2][3]

[x] Task 23: Implement Clickable Table Rows
Status: COMPLETE
Location: Bookings Table (/bookings)
Description:
Logic: Make the entire <tr> (table row) clickable. Clicking anywhere on the row should navigate the user to the "Booking Details" page for that specific record.
Interactive Elements: Ensure that clicking the Three Dots (Actions Menu) or any specific buttons within the row still triggers their specific menus/actions and does not trigger the row navigation (use e.stopPropagation() in JavaScript).
UX: Add a hover:bg-slate-800 (or similar) effect to the row so the user knows it is interactive.

[x] Task 24: Persistent Internal Notes System
Status: COMPLETE
Description: Refactor "Assessment & Feedback" into a unified "Internal Notes" system.
Database Logic:
Move the notes storage from the Booking model to the Student (or Child) model.
If a student doesn't exist yet when a booking is made, the system should create a "Lead/Student" record immediately to hold these notes.
Requirements:
Rename: Change "Assessment & Feedback" header to "Internal Notes".
Persistence: These notes must stay with the student profile forever.
Visibility: Add a "Notes" tab/section to the Student Details page (Registration view).
Access: Ensure an admin can add/edit/delete notes from either the Booking Details page OR the Student Registration page.
Goal: Create a single "Source of Truth" for a child's history that is never shared with parents.

[x] Task 25: Implement Multi-Note Audit Trail (Author & Timestamp)
Status: COMPLETE
Location: Internal Notes Section (Booking Details & Student Profile)
Description:
Database Change: Instead of a single "Notes" text field, create a StudentNote model/table.
Relationships: Each note must be linked to a student_id and a user_id (the staff member who wrote it).
Fields:
content (Text)
created_at (Timestamp - Auto-generated)
author_name (String - The name of the logged-in user)
UI/UX:
Input: A clean text area to "Add a New Note."
Display: Below the input, show a vertical list of previous notes.
Style: Each note should look like a "Message Bubble" or a clean list item saying: "Observation by [Author Name] • [Date] at [Time]".
Permission: Allow the Author or an Admin to edit/delete their own notes, but keep the history visible.
Goal: Enable multiple staff members to contribute to a child's internal record over time.

[x] Task 26: Implement "Pinned Notes" (High-Priority Alerts)
Status: COMPLETE
Location: Internal Notes Section (Booking Details & Student Profile)
Description:
Database: Added pinned_at timestamp to the StudentNote model to track pins.
Logic: Any note marked as "Pinned" is pulled out of the chronological timeline and displayed in a dedicated "Important Alerts" section at the very top of the notes area.
UI/UX:
Visuals: Pinned notes have a distinct "Sticky Note" style (a light yellow/amber background with a thumbtack icon watermark) to ensure they are the first thing a tutor sees.
Interaction: Added a "Pin" icon (`lucide-react`) to each note in the audit trail. Clicking it toggles the pinned state.
Goal: Ensure critical information (medical, safeguarding, or urgent needs) is impossible to miss.

[x] Task 27: Implement "Medical/Allergy Alert" Badges in Tables
Status: COMPLETE
Location: Bookings Table, Dashboard "Recent Bookings," and Students Table.
Description:
Logic: Create a way to "Flag" a note specifically as Medical/Allergy.
Database: Add a category field to the StudentNote model (e.g., "General", "Medical", "Safeguarding").
UI (The Badge): If a student has an active note in the "Medical" or "Allergy" category, display a small Red Medical Icon (e.g., a cross or alert triangle) or a "Medical" pill badge directly next to their name in all table views.
Hover Tooltip: When a staff member hovers over the badge, show a tooltip with the content of that pinned medical note (e.g., "Severe Nut Allergy").
Goal: Instant visual safety awareness for staff without needing to open the full student profile.

[x] Task 28: Implement "Safeguarding Alert" Badges (Blue Shield)
Status: COMPLETE
Location: Bookings Table, Students Table, and Dashboard List.
Description:
Logic: Add a 'Safeguarding' category to the StudentNote model (alongside 'General' and 'Medical').
UI (The Badge): If a student has an active note categorized as 'Safeguarding', display a small Blue Shield Icon next to their name in all table views.
Tooltip: On hover, display the safeguarding note content (e.g., "Court order: Father restricted from collection").
Privacy Note: Ensure these notes are strictly internal and clearly labeled as "Highly Confidential" in the UI.
Goal: Protect children by making collection restrictions and legal alerts visible to staff at a glance during checkout.

[x] Task 29: Align "Registrations" Card UI with "Bookings" Card
Status: COMPLETE
Location: Dashboard -> Registrations Card (Middle)
Description:
Visual Mirroring: Refactor the Registrations card to match the "Assessments & Bookings" card layout exactly.
List Content: Display the 5 most recently registered students (those who completed the full registration form).
Sorting: Use Latest First (Descending by registration date) so the newest sign-ups are always at the top.
Public Link Placement: Move the "Public Registration Link" box to a more subtle position—either as a small, secondary section at the very bottom of the card or as a "Copy Link" icon/button in the card header.
Footer: Ensure the "View All Registrations" button is positioned at the bottom, matching the "View All Assessments" button on the left.
Goal: Create a consistent, data-rich dashboard where the admin can see both new leads (Assessments) and new members (Registrations) at a glance.

[x] Task 30: Implement Status Pills on Dashboard Lists
Status: COMPLETE
Location: Dashboard -> Both "Bookings" and "Registrations" cards.
Description:
Registration Status: Next to each name in the Registrations card, add a small "Status Pill" (e.g., "Pending Review" in yellow or "Approved" in green). This should pull from the status field in your Registration database.
Booking Status: Ensure the Bookings card also shows a status pill (e.g., "Confirmed", "Attended", or "Cancelled").
UI Alignment: Position the pills on the right side of each list item, vertically centered. Use a soft background with dark text for a professional, high-end "SaaS" look.
Goal: Allow the admin to see which new sign-ups or assessments require immediate action without leaving the dashboard.

[x] Task 31: Fix "Unauthorized" Error on Booking Submission
Status: COMPLETE
Location: Backend POST /bookings endpoint / src/app/api/bookings/route.ts & src/lib/services/booking.ts
Issue: Parents are getting an "Unauthorized" error when trying to confirm a booking.
Cause: Recent changes to the "Internal Notes" system (Task 25) likely made the booking endpoint require an authenticated Admin/Staff user.
Fix:
Public Access: Ensured the POST /api/bookings endpoint is publicly accessible and does not require a Bearer token or Login session.
Note Attribution: If the parent provides notes during booking, the system creates an initial internal note with the author set to "System".
CORS/Session: Verified unauthenticated POST requests are allowed.
Goal: Restore the ability for parents to book assessments without being logged in.
