import { db } from '@/db';
import { bookings, bookingAttendees, clubSessions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function getOccupancyStats(centreId: string, startDate: Date, endDate: Date) {
  // Simple approximation: total bookings vs total capacity for the period.
  // We join clubSessions to get capacity.
  
  const query = sql`
    SELECT 
      s.id as session_id,
      s.type,
      s.capacity,
      COUNT(b.id) as total_bookings
    FROM \${clubSessions} s
    LEFT JOIN \${bookings} b ON b.session_id = s.id AND b.date >= \${startDate.toISOString()} AND b.date <= \${endDate.toISOString()} AND b.status = 'confirmed'
    WHERE s.centre_id = \${centreId}
    GROUP BY s.id, s.type, s.capacity
  `;

  const results = await db.execute(query);
  
  return results.map((r: any) => ({
    sessionId: r.session_id,
    type: r.type,
    capacity: r.capacity,
    totalBookings: Number(r.total_bookings),
    occupancyPercent: r.capacity > 0 ? (Number(r.total_bookings) / r.capacity) * 100 : 0
  }));
}

export async function getAttendanceStats(centreId: string, startDate: Date, endDate: Date) {
  const query = sql`
    SELECT 
      COUNT(ba.id) as total_attendees,
      SUM(CASE WHEN ba.attendance_status = 'present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN ba.attendance_status = 'absent' THEN 1 ELSE 0 END) as absent_count
    FROM \${bookingAttendees} ba
    JOIN \${bookings} b ON ba.booking_id = b.id
    WHERE b.centre_id = \${centreId} AND b.date >= \${startDate.toISOString()} AND b.date <= \${endDate.toISOString()}
  `;

  const results = await db.execute(query);
  const row = results[0] as any || { total_attendees: 0, present_count: 0, absent_count: 0 };
  
  const total = Number(row.total_attendees);
  const present = Number(row.present_count);
  const absent = Number(row.absent_count);

  return {
    total,
    present,
    absent,
    attendanceRate: total > 0 ? (present / total) * 100 : 0,
    noShowRate: total > 0 ? (absent / total) * 100 : 0,
  };
}
