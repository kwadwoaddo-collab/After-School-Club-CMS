[x] Task 39: Fix Visibility on Registration Link Page
Status: Complete
Location: /dashboard/registration-link (Image 1)
Issue: The header "Registration Link & Embed Code" and the descriptive text below it are too dark and illegible.
Fix: Update these text elements to High-Contrast White (#FFFFFF) to match the professional dark theme.
[x] Task 40: Re-order Registration Funnel Logic
Status: Complete
Location: Public Registration Flow
Current Flow: Link -> Fees (Image 2) -> Centre Selection (Image 3) -> Step 1 (Image 4).
New Required Flow:
Select a Centre: (The very first screen the parent sees).
Fees & Payment Information: (The parent sees the prices for the centre they just picked).
Registration Form: (Proceed to Step 1).
Goal: Ensure parents know which location they are registering for before they review financial terms.
[x] Task 41: Implement Dynamic Centre Pricing (Settings)
Status: Complete
Location: Backend (Centre Model) & Settings Dashboard (Image 6)
Backend: Add two new fields to the Centre database model: fee_self_finance and fee_assisted_finance.
Settings UI: Add a new card in the Settings area titled "Finance & Pricing".
Functionality: This card should allow the Admin to select a centre and set the specific "Self Finance" and "Tax Credit/Universal Credit" amounts for that location.
[x] Task 42: Display Dynamic Fees in Registration Flow
Status: Complete
Location: Fees & Payment Page (Image 5)
Logic: Replace the hardcoded £20 and £30 values with dynamic variables pulled from the database based on the Centre selected in Step 1.
Display Format:
Self Finance: £{centre.fee_self_finance} per session
Tax Credit / Universal Credit / Student Finance: £{centre.fee_assisted_finance} per session

[x] Task 43: Implement Mobile Hamburger Menu
Status: Complete
Location: Global Navigation / Header
Description:
Mobile View (< 768px): Hide the sidebar by default.
Hamburger Icon: Add a "hamburger" (three-line) menu icon to the top-left of the header on mobile devices.
Overlay Sidebar: When the hamburger icon is clicked, the sidebar should slide in from the left as an overlay.
Close Action: Add a "Close" (X) icon inside the mobile sidebar or allow the user to click outside the menu to close it.
Goal: Provide full navigation access on mobile without taking up permanent screen space.
[x] Task 44: Mobile UI Polish (Tables & Forms)
Status: Complete
Location: All Pages
Description:
Tables: On small screens, switch from a wide table to a "Card" view for Bookings and Registrations so users don't have to scroll horizontally.
Forms: Ensure all input fields (Registration Step 1-6) take up 100% of the screen width on mobile.
Padding: Reduce large desktop paddings so the content fits neatly on a phone screen.
Goal: Ensure the app is 100% functional and beautiful on iPhone and Android devices.
[x] Task 45: The Contrast Fix
Status: Complete

[x] Task 46: Typography & Brand Sync
Status: Complete

[x] Task 49: Add Submission Timestamp to Bookings Table
Status: Complete
Location: /dashboard/bookings (BookingsTable.tsx)
Description: Added the `createdAt` timestamp underneath the appointment time in the 'DATE & TIME' column for both desktop and mobile views. Displayed in 'Booked: DD/MM/YY' format with a subtle gray text (`text-xs text-slate-400`).

[x] Tasks 51 & 52: Dynamic Dashboard Filtering
Status: Complete
Location: /dashboard/page.tsx, /dashboard/DashboardFilter.tsx
Description: Implemented a Weekly/Monthly toggle and date navigation at the top of the dashboard. Both the Assessments and Registrations cards have been expanded to a 50/50 split and now display dynamically calculated 'Total', 'Month', and 'Week' statistics based on the specifically selected active timeframe. Lists correctly filter against the `startAt` (Assessments) and `startDate` (Registrations) columns, and display an intuitive empty state when no activity is configured for the active period.## [ ] Task 50: Separate Staff Management Page
- **Status:** Pending
- **Action:** Remove the "Staff" card from the Dashboard. Move all Staff/Team management (Shifts, Payroll) to the dedicated "Team" page in the sidebar.

## [ ] Task 51: Dynamic Dashboard Stats (Weekly/Monthly)
- **Status:** Pending
- **Bookings Summary:** Show "Total Bookings", "This Month", and "This Week".
- **Registrations Summary:** Show "Total Submitted", "Awaiting Review", "New This Week", and "New This Month".

## [ ] Task 52: Implement Dashboard View Toggle & Date Picker
- **Status:** Pending
- **UI:** Add a toggle switch at the top of the Dashboard to swap between "Weekly" and "Monthly" views.
- **Picker:** Add a navigation element (e.g., "< March 23 - 29 >") to jump between weeks or months. 
- **Logic:** Default to the current week/month on load.

## [ ] Task 53: Weekly Filter for Assessments (Mon-Sun)
- **Status:** Pending
- **Location:** "Recent Bookings" Card
- **Logic:** Filter the list to show only assessments for the selected week (Monday to Sunday).
- **Sorting:** Sort by Assessment Date (Nearest first).

## [ ] Task 54: Weekly Filter for Registrations (Start Date)
- **Status:** Pending
- **Location:** "Recent Registrations" Card
- **Logic:** Filter the list based on the **Child's Requested Start Date** for the selected week.
- **Goal:** See which new students are actually starting their sessions this week.

## [ ] Task 55: Fix UI Real Estate
- **Status:** Pending
- **Action:** Now that Staff is gone, expand the Bookings and Registrations cards to fill the width (50/50 split) for a cleaner, wider look.
[ ] Task 56: Fix Dynamic Centre Hours Display
Status: Pending
Location: Appointment Selection Step (Choose Appointment)
Issue: The text "Centre hours: 10:00 - 19:00" is hardcoded and does not match the actual centre settings.
Requirement:
Logic: When a parent selects a date (e.g., Thursday, 16/04/2026), the app must determine the day of the week.
Data Fetch: It must then retrieve the opening hours for that specific day for the selected centre (e.g., Thursday for Dagenham is 11:00 am – 6:00 pm).
UI Update: Update the label below the time picker to show the correct hours: "Centre hours: [Opening Time] - [Closing Time]".
Validation: Ensure the Time Picker's min and max constraints are also updated to match these hours immediately.
Goal: Prevent parents from seeing incorrect operating hours and ensure they can only pick times when the centre is actually open.

[x] Task 57: Fix Centre Filtering Logic in Bookings Table
Status: Complete
Location: Bookings Table / Backend API
Issue: When a centre is selected from the dropdown, the "Active Filters" badge appears, but the table continues to show bookings from all centres.
Requirement:
Frontend: Ensure the centre_id or centre_name is being passed as a query parameter to the backend API when the filter is applied.
Backend: Update the GET /api/bookings endpoint to include a conditional filter. If a centre is specified, the SQL/SQLAlchemy query must use a .filter() or WHERE clause to only return records matching that specific centre.
UI Refresh: Ensure the table data refreshes immediately when the filter is changed or cleared.
Goal: Ensure the table strictly displays only the bookings belonging to the selected centre.

## [x] Task 58: Implement Sortable Table Headers
- **Description:** Make "Date & Time", "Student", and "Status" headers clickable to sort the list (ASC/DESC). Add subtle arrow icons from Stitch.

## [x] Task 59: Implement Bulk Actions (Checkboxes)
- **Description:** Add a checkbox column to the left. Implement a "Bulk Action Bar" at the top to allow "Mass Delete" or "Mass Mark as Attended."

## [x] Task 60: Professional Empty States
- **Description:** Design and implement a "No Results Found" view for the table when filters or searches return zero data.

## [ ] Task 61: "Quick Contact" Hover Actions
- **Description:** On row hover, show small icons next to the student name to "Email Parent" or "Copy Phone Number" for instant communication.

[x] Task 62: Add Result Counter to Filter Badges
Status: Complete
Location: Bookings Table / Filter Area
Description:
UI: Update the "Active Filters" badge to include the total number of results found for that filter.
Format: Display it as: "Centre: [Centre Name] ([Count] results)" (e.g., "Centre: Dagenham (12 results)").
Logic:
The frontend must listen for the updated booking list length.[1]
Every time the filter changes, the number inside the badge must update dynamically.[1]
Goal: Provide immediate confirmation of how many records match the current view.
[x] Task 63: Add Result Counter to Search Badge
Status: Complete
Location: Bookings Table / Search Area
Description:
UI: When a user performs a search (Global or Table-specific), a badge should appear in the "Active Filters" area.
Format: Display it as: "Search: [Query] ([Count] results)" (e.g., "Search: Smith (3 results)").
Logic:
The counter must update in real-time as the user types in the search bar.
If the search is cleared, the badge must disappear.
Symmetry: This badge should sit next to the "Centre Filter" badge and use the same professional styling from the Stitch design.
Goal: Provide instant feedback on search accuracy and result volume.