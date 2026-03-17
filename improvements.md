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
