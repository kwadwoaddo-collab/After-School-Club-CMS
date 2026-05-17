/**
 * Attendance utilities — Phase B (read-path only)
 *
 * Provides backwards-compatible attendance resolution:
 *   1. If a per-child `attendance_status` exists on the attendee row, use it.
 *   2. Otherwise, infer from the legacy `booking.status` field.
 *
 * No write behaviour is changed by this module.
 */

// Matches the DB enum: attendance_status
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'no_show' | 'excused';

// The legacy booking-level statuses
export type BookingStatus = 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | 'pending' | 'signed_up';

/** A resolved attendance record ready for display */
export interface ResolvedAttendance {
  /** The final attendance status to display */
  status: AttendanceStatus | 'pending' | 'cancelled' | 'rescheduled';
  /** Human-readable label for display */
  label: string;
  /** Whether the status came from the granular per-child field or was inferred */
  source: 'explicit' | 'inferred';
}

/**
 * Resolves the effective attendance status for an attendee.
 *
 * Priority:
 *   1. `attendanceStatus` (explicit, per-child column) — highest priority
 *   2. `bookingStatus` (legacy, booking-level column) — fallback inference
 *
 * @param attendanceStatus - The per-child attendance_status column (nullable)
 * @param bookingStatus    - The booking.status column
 * @returns A fully resolved attendance record
 */
export function resolveAttendanceStatus(
  attendanceStatus: AttendanceStatus | null | undefined,
  bookingStatus: BookingStatus | string,
): ResolvedAttendance {
  // Priority 1: Explicit per-child attendance
  if (attendanceStatus) {
    return {
      status: attendanceStatus,
      label: getAttendanceLabel(attendanceStatus),
      source: 'explicit',
    };
  }

  // Priority 2: Infer from booking status (legacy behaviour)
  switch (bookingStatus) {
    case 'completed':
      return { status: 'present', label: 'Attended', source: 'inferred' };
    case 'cancelled':
      return { status: 'cancelled', label: 'Cancelled', source: 'inferred' };
    case 'rescheduled':
      return { status: 'rescheduled', label: 'Rescheduled', source: 'inferred' };
    case 'confirmed':
    case 'pending':
    case 'signed_up':
    default:
      return { status: 'pending', label: 'Upcoming', source: 'inferred' };
  }
}

/**
 * Returns a human-readable label for a granular attendance status.
 */
export function getAttendanceLabel(status: AttendanceStatus): string {
  const labels: Record<AttendanceStatus, string> = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    no_show: 'No Show',
    excused: 'Excused',
  };
  return labels[status] ?? status;
}

/**
 * Returns a CSS class string for styling the attendance status badge.
 * Uses the existing design-token pattern from the project.
 */
export function getAttendanceColorClass(
  status: AttendanceStatus | 'pending' | 'cancelled' | 'rescheduled',
): string {
  switch (status) {
    case 'present':
      return 'bg-emerald-500/20 text-emerald-400';
    case 'late':
      return 'bg-amber-500/20 text-amber-400';
    case 'absent':
    case 'no_show':
      return 'bg-error/20 text-error';
    case 'excused':
      return 'bg-primary/20 text-primary';
    case 'cancelled':
      return 'bg-error/20 text-error';
    case 'rescheduled':
      return 'bg-amber-500/20 text-amber-400';
    case 'pending':
    default:
      return 'bg-primary/10 text-primary';
  }
}

/**
 * Counts attendance outcomes from a list of resolved attendances.
 * Used for attendance summary stats on dashboard / student profile.
 */
export function countAttendance(
  items: Array<{ attendanceStatus: AttendanceStatus | null | undefined; bookingStatus: string }>,
): { total: number; attended: number; absent: number; late: number; noShow: number; excused: number; pending: number } {
  const result = { total: 0, attended: 0, absent: 0, late: 0, noShow: 0, excused: 0, pending: 0 };

  for (const item of items) {
    result.total++;
    const resolved = resolveAttendanceStatus(item.attendanceStatus, item.bookingStatus);
    switch (resolved.status) {
      case 'present': result.attended++; break;
      case 'absent': result.absent++; break;
      case 'late': result.late++; break;
      case 'no_show': result.noShow++; break;
      case 'excused': result.excused++; break;
      default: result.pending++; break;
    }
  }

  return result;
}
