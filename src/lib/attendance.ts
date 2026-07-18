import { format } from 'date-fns';

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
      return 'bg-rose-500/20 text-rose-500';
    case 'excused':
      return 'bg-primary/20 text-primary';
    case 'cancelled':
      return 'bg-rose-500/20 text-rose-500';
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

export interface CompiledAttendee {
  id: string;
  childId: string;
  firstName: string;
  lastName: string;
  schoolYear: string;
  notes: string | null;
  parentFirstName: string;
  parentLastName: string;
  parentPhone: string | null;
  parentEmail: string | null;
  attendanceStatus: string | null;
  attendanceNote: string | null;
  lateMinutes: number | null;
  isCatchUp: boolean;
  bookingId: string | null;
}

export interface CompiledSlot {
  time: string;
  timeLabel: string;
  regulars: CompiledAttendee[];
  catchups: CompiledAttendee[];
}

export function compileDailyRegisterSlots(params: {
  targetDate: Date;
  allChildrenAtCentre: any[];
  dayBookings: any[];
}): CompiledSlot[] {
  const { targetDate, allChildrenAtCentre, dayBookings } = params;
  const targetDayName = format(targetDate, 'EEEE'); // e.g. "Monday"

  const regularAttendees = allChildrenAtCentre.filter(child => {
    if (!child.registeredSessions || child.registeredSessions.length === 0) return false;
    return child.registeredSessions.some((session: string) => session.startsWith(targetDayName));
  });

  // Helper to clean and normalize a time string like "3.45pm" to "HH:mm"
  function normalizeTimeToHHMM(timeStr: string): string {
    const clean = timeStr.toLowerCase().replace(/\s/g, '');
    const isPm = clean.includes('pm');
    const digits = clean.replace('am', '').replace('pm', '');
    const [hStr, mStr] = digits.split('.');
    let hours = parseInt(hStr, 10);
    const minutes = mStr ? parseInt(mStr, 10) : 0;
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Initialize standard slots
  const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;
  const standardTimes = isWeekend
    ? ['11:00', '12:15', '13:30', '14:45']
    : ['15:45', '17:00'];

  const slotsMap: Record<string, CompiledSlot> = {};
  for (const time of standardTimes) {
    const [h, m] = time.split(':');
    const dateObj = new Date(targetDate);
    dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
    slotsMap[time] = {
      time,
      timeLabel: format(dateObj, 'h:mm a'),
      regulars: [],
      catchups: [],
    };
  }

  // Step A: Map regulars to their slots
  for (const child of regularAttendees) {
    const matchingSchedules = child.registeredSessions!.filter((s: string) => s.startsWith(targetDayName));
    for (const sched of matchingSchedules) {
      const timePart = sched.substring(targetDayName.length).trim();
      const parsedTime = normalizeTimeToHHMM(timePart);

      if (!slotsMap[parsedTime]) {
        const [h, m] = parsedTime.split(':');
        const dateObj = new Date(targetDate);
        dateObj.setHours(parseInt(h), parseInt(m), 0, 0);
        slotsMap[parsedTime] = {
          time: parsedTime,
          timeLabel: format(dateObj, 'h:mm a'),
          regulars: [],
          catchups: [],
        };
      }

      // Check if there is an actual booking for today at this time containing this child
      const bookingMatch = dayBookings.find(b => {
        const bTime = format(new Date(b.startAt), 'HH:mm');
        const hasChild = b.attendees.some((a: any) => a.childId === child.id);
        return hasChild && bTime === parsedTime;
      });

      if (bookingMatch) {
        const att = bookingMatch.attendees.find((a: any) => a.childId === child.id)!;
        
        const parentInfo =
          allChildrenAtCentre.find((c: any) => c.id === child.id)?.parent ||
          child?.parent ||
          bookingMatch?.parent;

        slotsMap[parsedTime].regulars.push({
          id: att.id,
          childId: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          schoolYear: child.schoolYear,
          notes: child.notes || null,
          parentFirstName: parentInfo?.firstName || '',
          parentLastName: parentInfo?.lastName || '',
          parentPhone: parentInfo?.phone || null,
          parentEmail: parentInfo?.email || null,
          attendanceStatus: att.attendanceStatus,
          attendanceNote: att.attendanceNote,
          lateMinutes: att.lateMinutes,
          isCatchUp: false,
          bookingId: bookingMatch.id,
        });
      } else {
        const parentInfo =
          allChildrenAtCentre.find((c: any) => c.id === child.id)?.parent ||
          child?.parent;

        slotsMap[parsedTime].regulars.push({
          id: `temp-${child.id}-${parsedTime}`,
          childId: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          schoolYear: child.schoolYear,
          notes: child.notes || null,
          parentFirstName: parentInfo?.firstName || '',
          parentLastName: parentInfo?.lastName || '',
          parentPhone: parentInfo?.phone || null,
          parentEmail: parentInfo?.email || null,
          attendanceStatus: null,
          attendanceNote: null,
          lateMinutes: null,
          isCatchUp: false,
          bookingId: null,
        });
      }
    }
  }

  // Step B: Map catchups from actual bookings
  for (const booking of dayBookings) {
    const bookingTime = format(new Date(booking.startAt), 'HH:mm');
    
    if (!slotsMap[bookingTime]) {
      slotsMap[bookingTime] = {
        time: bookingTime,
        timeLabel: format(new Date(booking.startAt), 'h:mm a'),
        regulars: [],
        catchups: [],
      };
    }

    for (const att of booking.attendees) {
      // A child is a catchup if they don't have today's slot in their weekly registeredSessions
      const isRegular = att.child.registeredSessions?.some((s: string) => {
        if (!s.startsWith(targetDayName)) return false;
        const timePart = s.substring(targetDayName.length).trim();
        const parsedTime = normalizeTimeToHHMM(timePart);
        return parsedTime === bookingTime;
      });

      if (!isRegular) {
        const parentInfo =
          allChildrenAtCentre.find((c: any) => c.id === att.childId)?.parent ||
          att.child?.parent ||
          booking?.parent;

        slotsMap[bookingTime].catchups.push({
          id: att.id,
          childId: att.child.id,
          firstName: att.child.firstName,
          lastName: att.child.lastName,
          schoolYear: att.child.schoolYear,
          notes: att.child.notes || null,
          parentFirstName: parentInfo?.firstName || '',
          parentLastName: parentInfo?.lastName || '',
          parentPhone: parentInfo?.phone || null,
          parentEmail: parentInfo?.email || null,
          attendanceStatus: att.attendanceStatus,
          attendanceNote: att.attendanceNote,
          lateMinutes: att.lateMinutes,
          isCatchUp: true,
          bookingId: booking.id,
        });
      }
    }
  }

  // Sort slots by time ascending
  return Object.values(slotsMap).sort((a, b) => a.time.localeCompare(b.time));
}

