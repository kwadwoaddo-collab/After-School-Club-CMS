# Attendance System Roadmap

> **Status:** Planning · **Priority:** High · **Risk:** Low (additive changes only)

## Current State

Attendance is **inferred from `bookings.status = 'completed'`**, which has several limitations:

| Limitation | Impact |
|-----------|--------|
| Status is per-booking, not per-child | Multi-child bookings can't track individual attendance |
| No distinction between cancelled and no-show | Impossible to differentiate planned vs unplanned absences |
| No late/partial attendance | All-or-nothing: "completed" or not |
| No audit trail | Who marked it and when is not recorded |
| No attendance notes | Can't record context ("parent called ahead") |

## Target State

Move attendance to `booking_attendees` table with per-child granularity:

```
booking_attendees
├── attendance_status  ENUM('present','absent','late','no_show','excused')  -- nullable, NULL = not yet marked
├── attendance_note    TEXT                                                 -- optional context
├── marked_at          TIMESTAMP                                           -- when staff recorded it
└── marked_by          UUID FK → users                                     -- who recorded it
```

## Implementation Phases

### Phase A: Schema Addition
- Add columns to `booking_attendees` (nullable, no existing data affected)
- **Risk:** Zero — additive only

### Phase B: Data Backfill
- Set `attendance_status = 'present'` where `bookings.status = 'completed'`
- **Risk:** Zero — fills data, doesn't change queries

### Phase C: Read Path Migration
- Update attendance rate queries to prefer `attendance_status` with fallback
- **Risk:** Low — fallback ensures old data still works

### Phase D: Write Path (Feature-flagged)
- Add per-child attendance marking UI in booking detail
- New server action `markAttendance()`
- Auto-complete booking when all children are marked
- **Risk:** Medium — behind feature flag

### Phase E: Reporting & Portal
- Parent portal attendance history
- Attendance summary in reports/export
- Dashboard attendance trend widget
- **Risk:** Low — read-only additions

## Files Affected

### Schema
- `src/db/schema.ts` — new columns on `bookingAttendees` (see TODO block)

### Server Actions
- `src/features/bookings/actions.ts` — new `markAttendance()` action
- New: `src/features/attendance/actions.ts`

### UI Components
- `src/features/bookings/components/AppointmentScorecard.tsx` — embed per-child marker
- `src/components/bookings/BookingsTable.tsx` — updated quick action
- `src/components/students/StudentProfile.tsx` — updated stats
- `src/components/ui/AttendanceRadial.tsx` — no changes needed (presentation only)

### Pages
- `src/app/dashboard/page.tsx` — updated dashboard stats query
- `src/app/dashboard/students/page.tsx` — updated attendance rate
- `src/app/dashboard/students/[id]/page.tsx` — updated stats query
- `src/app/portal/page.tsx` — new attendance history section

### API Routes
- `src/app/api/bookings/[bookingId]/status/route.ts` — unchanged
- `src/app/api/bookings/bulk-update/route.ts` — optional attendee-level support

## Constraints
- **Live system** — zero-downtime, additive-only migrations
- **Backward compatible** — NULL attendance_status falls back to booking status
- **No breaking changes** to existing `bookings.status` enum
