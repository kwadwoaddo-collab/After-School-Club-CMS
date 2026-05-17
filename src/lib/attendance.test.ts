import { describe, it, expect } from 'vitest';
import {
  resolveAttendanceStatus,
  getAttendanceLabel,
  getAttendanceColorClass,
  countAttendance,
} from './attendance';

describe('resolveAttendanceStatus', () => {
  // ── Priority 1: Explicit per-child attendance_status ─────────────
  it('uses explicit attendance_status when present', () => {
    const result = resolveAttendanceStatus('present', 'completed');
    expect(result.status).toBe('present');
    expect(result.source).toBe('explicit');
    expect(result.label).toBe('Present');
  });

  it('uses explicit "absent" even if booking is completed', () => {
    const result = resolveAttendanceStatus('absent', 'completed');
    expect(result.status).toBe('absent');
    expect(result.source).toBe('explicit');
    expect(result.label).toBe('Absent');
  });

  it('uses explicit "late" regardless of booking status', () => {
    const result = resolveAttendanceStatus('late', 'confirmed');
    expect(result.status).toBe('late');
    expect(result.source).toBe('explicit');
    expect(result.label).toBe('Late');
  });

  it('uses explicit "no_show"', () => {
    const result = resolveAttendanceStatus('no_show', 'completed');
    expect(result.status).toBe('no_show');
    expect(result.source).toBe('explicit');
    expect(result.label).toBe('No Show');
  });

  it('uses explicit "excused"', () => {
    const result = resolveAttendanceStatus('excused', 'completed');
    expect(result.status).toBe('excused');
    expect(result.source).toBe('explicit');
    expect(result.label).toBe('Excused');
  });

  // ── Priority 2: Inferred from booking status (fallback) ──────────
  it('infers "present" from booking.status = completed when attendance_status is null', () => {
    const result = resolveAttendanceStatus(null, 'completed');
    expect(result.status).toBe('present');
    expect(result.source).toBe('inferred');
    expect(result.label).toBe('Attended');
  });

  it('infers "cancelled" from booking.status = cancelled when attendance_status is null', () => {
    const result = resolveAttendanceStatus(null, 'cancelled');
    expect(result.status).toBe('cancelled');
    expect(result.source).toBe('inferred');
    expect(result.label).toBe('Cancelled');
  });

  it('infers "rescheduled" from booking.status = rescheduled', () => {
    const result = resolveAttendanceStatus(null, 'rescheduled');
    expect(result.status).toBe('rescheduled');
    expect(result.source).toBe('inferred');
    expect(result.label).toBe('Rescheduled');
  });

  it('infers "pending" from booking.status = confirmed', () => {
    const result = resolveAttendanceStatus(null, 'confirmed');
    expect(result.status).toBe('pending');
    expect(result.source).toBe('inferred');
    expect(result.label).toBe('Upcoming');
  });

  it('infers "pending" from booking.status = pending', () => {
    const result = resolveAttendanceStatus(null, 'pending');
    expect(result.status).toBe('pending');
    expect(result.source).toBe('inferred');
  });

  it('infers "pending" from booking.status = signed_up', () => {
    const result = resolveAttendanceStatus(null, 'signed_up');
    expect(result.status).toBe('pending');
    expect(result.source).toBe('inferred');
  });

  it('handles undefined attendance_status the same as null', () => {
    const result = resolveAttendanceStatus(undefined, 'completed');
    expect(result.status).toBe('present');
    expect(result.source).toBe('inferred');
  });

  it('handles unknown booking status as pending', () => {
    const result = resolveAttendanceStatus(null, 'some_future_status');
    expect(result.status).toBe('pending');
    expect(result.source).toBe('inferred');
  });
});

describe('getAttendanceLabel', () => {
  it('maps all known statuses to human-readable labels', () => {
    expect(getAttendanceLabel('present')).toBe('Present');
    expect(getAttendanceLabel('absent')).toBe('Absent');
    expect(getAttendanceLabel('late')).toBe('Late');
    expect(getAttendanceLabel('no_show')).toBe('No Show');
    expect(getAttendanceLabel('excused')).toBe('Excused');
  });
});

describe('getAttendanceColorClass', () => {
  it('returns emerald classes for present', () => {
    expect(getAttendanceColorClass('present')).toContain('emerald');
  });

  it('returns amber classes for late', () => {
    expect(getAttendanceColorClass('late')).toContain('amber');
  });

  it('returns error classes for absent', () => {
    expect(getAttendanceColorClass('absent')).toContain('error');
  });

  it('returns error classes for no_show', () => {
    expect(getAttendanceColorClass('no_show')).toContain('error');
  });

  it('returns primary classes for excused', () => {
    expect(getAttendanceColorClass('excused')).toContain('primary');
  });

  it('returns primary classes for pending', () => {
    expect(getAttendanceColorClass('pending')).toContain('primary');
  });
});

describe('countAttendance', () => {
  it('counts all categories correctly with mixed data', () => {
    const items = [
      { attendanceStatus: 'present' as const, bookingStatus: 'completed' },
      { attendanceStatus: 'absent' as const, bookingStatus: 'completed' },
      { attendanceStatus: 'late' as const, bookingStatus: 'completed' },
      { attendanceStatus: 'no_show' as const, bookingStatus: 'completed' },
      { attendanceStatus: 'excused' as const, bookingStatus: 'completed' },
      { attendanceStatus: null, bookingStatus: 'completed' },       // inferred → attended
      { attendanceStatus: null, bookingStatus: 'confirmed' },       // inferred → pending
      { attendanceStatus: null, bookingStatus: 'cancelled' },       // inferred → pending (cancelled)
    ];

    const result = countAttendance(items);
    expect(result.total).toBe(8);
    expect(result.attended).toBe(2);  // 1 explicit present + 1 inferred from completed
    expect(result.absent).toBe(1);
    expect(result.late).toBe(1);
    expect(result.noShow).toBe(1);
    expect(result.excused).toBe(1);
    expect(result.pending).toBe(2);   // 1 confirmed + 1 cancelled (both → pending bucket)
  });

  it('handles empty array', () => {
    const result = countAttendance([]);
    expect(result.total).toBe(0);
    expect(result.attended).toBe(0);
  });

  it('handles all-null attendance_status (pure legacy mode)', () => {
    const items = [
      { attendanceStatus: null, bookingStatus: 'completed' },
      { attendanceStatus: null, bookingStatus: 'completed' },
      { attendanceStatus: null, bookingStatus: 'confirmed' },
    ];

    const result = countAttendance(items);
    expect(result.total).toBe(3);
    expect(result.attended).toBe(2);
    expect(result.pending).toBe(1);
  });
});
