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