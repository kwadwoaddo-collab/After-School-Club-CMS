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

