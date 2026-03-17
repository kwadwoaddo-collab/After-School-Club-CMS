improvements.md
This file tracks UI/UX and logic improvements for the After School Club CMS.
[ ] Task 1: Make "Preferred Contact Method" Optional
Status: Pending
Description: Remove * and required from contact method radio buttons. Update API to allow null.
[ ] Task 2: Analyze & Fix Weekend Slot Availability
Status: HOLD / RESEARCH REQUIRED
Location: AvailabilityService, CentreHours, and SessionSlots logic.
The Problem: Selecting a weekend date shows "No slots available" even if Centre Hours are set.
Action Plan for Agent:
Analyze: Examine how AvailabilityService filters slots. Does it look for a day_of_week match?
Compare: Check the database schema for SessionSlots. Are the slots linked to a specific day (e.g., "Monday")?
Proposal: Before writing code, explain to the user how you plan to map the selected date (e.g., Sunday) to the corresponding session slots.
Fix: Once confirmed, update the filter logic so it correctly pulls Sunday slots for Sunday dates.
[ ] Task 3: Disable "Online" Session Type
Status: Pending
Description: Gray out "Online" and disable selection.
[ ] Task 4: Make "Select Date" Mandatory
Status: Pending
Description: Add required to date picker; disable "Continue" until a slot is chosen.
[ ] Task 5: Fix "Mark as Attended" Functionality
Status: Pending
Description: Implement backend PATCH for booking status and update the UI to show the "Attended" state.
[ ] Task 6: Implement "Delete Booking" Functionality
Status: Pending
Location: Bookings List Page (/bookings) - Actions Menu (three dots)
Description:
UI: Add a "Delete Booking" option to the actions dropdown menu (below "Cancel Booking"). Style it in red text to indicate a destructive action.
Safety: When clicked, show a Confirmation Dialog ("Are you sure you want to permanently delete this booking? This action cannot be undone.").
Backend: Create a DELETE endpoint in the FastAPI backend (e.g., DELETE /api/bookings/{id}) to remove the record from the database.
Frontend: Upon successful deletion, remove the row from the table immediately without requiring a full page refresh.
Goal: Allow admins to clean up test data and accidental entries.
[ ] Task 7: Fix "Sign in with Google" Responsiveness (Popup not appearing)
Status: Pending
Location: Login Page / Google OAuth Integration
Issue: Clicking the "Sign in with Google" button often does nothing on the first attempt (the Google popup fails to trigger).
Diagnosis: Likely a race condition where the Google Identity Services (GSI) library hasn't finished initializing when the user first clicks.
Action Plan for Agent:
Script Loading: Ensure the Google client library (https://accounts.google.com/gsi/client) is loaded with async but handled in a way that the button stays disabled until the script's onload event triggers.
Initialization: Use google.accounts.id.initialize and google.accounts.id.renderButton inside a window.onload or a dedicated initialization function to ensure the DOM is ready.
Fallback Listener: If using a custom button, ensure the click event correctly calls google.accounts.id.prompt() even if the first click happens quickly.
UX Improvement: Add a visual "loading" or "disabled" state to the button until the Google service is confirmed as active.
Goal: The Google popup must appear immediately on the first click.
