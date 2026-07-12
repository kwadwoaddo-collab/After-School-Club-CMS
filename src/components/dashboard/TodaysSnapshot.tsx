import { db } from '@/db';
import { bookings, bookingAttendees } from '@/db/schema';
import { eq, gte, lt, and, inArray, sql } from 'drizzle-orm';
import { startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/components/ui/utils';
import { CalendarCheck, Clock, UserCheck, UserX } from 'lucide-react';

interface TodaysSnapshotProps {
  activeCentreId: string;
  accessibleCentreIds: string[];
}

export async function TodaysSnapshot({
  activeCentreId,
  accessibleCentreIds,
}: TodaysSnapshotProps) {
  const hasCentres = accessibleCentreIds.length > 0;
  if (!hasCentres) return null;

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const centreCondition =
    activeCentreId !== 'all'
      ? eq(bookings.centreId, activeCentreId)
      : inArray(bookings.centreId, accessibleCentreIds);

  let snapshot = {
    total: 0,
    confirmed: 0,
    pending: 0,
    checkedIn: 0,
    notArrived: 0,
  };

  try {
    const [bookingStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        confirmed: sql<number>`count(*) filter (where ${bookings.status} = 'confirmed')::int`,
        pending: sql<number>`count(*) filter (where ${bookings.status} = 'pending')::int`,
      })
      .from(bookings)
      .where(
        and(
          centreCondition,
          gte(bookings.startAt, todayStart),
          lt(bookings.startAt, todayEnd)
        )
      );

    // Count check-ins and unresolved attendees from bookingAttendees
    const [attendeeStats] = await db
      .select({
        checkedIn: sql<number>`count(*) filter (where ${bookingAttendees.attendanceStatus} = 'present')::int`,
        // Not arrived = booked today but attendance not yet recorded (null or 'pending')
        notArrived: sql<number>`count(*) filter (where ${bookingAttendees.attendanceStatus} is null or ${bookingAttendees.attendanceStatus} = 'pending')::int`,
      })
      .from(bookingAttendees)
      .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
      .where(
        and(
          centreCondition,
          gte(bookings.startAt, todayStart),
          lt(bookings.startAt, todayEnd),
          eq(bookings.status, 'confirmed')
        )
      );

    snapshot = {
      total: Number(bookingStats?.total ?? 0),
      confirmed: Number(bookingStats?.confirmed ?? 0),
      pending: Number(bookingStats?.pending ?? 0),
      checkedIn: Number(attendeeStats?.checkedIn ?? 0),
      notArrived: Number(attendeeStats?.notArrived ?? 0),
    };
  } catch {
    // silently degrade
  }

  // Attendance rate: how many confirmed attendees have actually shown up today
  const attendanceRate = snapshot.confirmed > 0
    ? Math.round((snapshot.checkedIn / snapshot.confirmed) * 100)
    : null;

  const items = [
    {
      label: "Today's Bookings",
      value: snapshot.total,
      icon: CalendarCheck,
      color: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      label: 'Confirmed',
      value: snapshot.confirmed,
      icon: CalendarCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    },
    {
      label: 'Pending',
      value: snapshot.pending,
      icon: Clock,
      color: 'text-amber-700 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    },
    {
      label: 'Checked In',
      value: snapshot.checkedIn,
      icon: UserCheck,
      color: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    },
    {
      label: 'Not Arrived',
      value: snapshot.notArrived,
      icon: UserX,
      // Highlight in amber if there are unresolved confirmed bookings
      color: snapshot.notArrived > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
      iconBg: snapshot.notArrived > 0 ? 'bg-amber-500/10 dark:bg-amber-500/15' : 'bg-secondary',
    },
  ];

  return (
    <div className="glassmorphic-card rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
            Today&apos;s Snapshot
          </span>
        </div>
        {/* Attendance rate — far more meaningful than capacity % */}
        <div className="flex items-center gap-2">
          {attendanceRate !== null ? (
            <>
              <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    attendanceRate >= 80 ? 'bg-emerald-500' : attendanceRate >= 50 ? 'bg-amber-400' : 'bg-red-500'
                  )}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/80">
                {attendanceRate}% attended
              </span>
            </>
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground/60">No sessions yet</span>
          )}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-1 py-4 px-3 text-center bg-card border border-border hover:bg-secondary/40 transition-[background-color] duration-150 cursor-default">
            <div className={cn('p-2 rounded-lg mb-1', item.iconBg)}>
              <item.icon className={cn('w-4 h-4', item.color)} />
            </div>
            <span className={cn('text-2xl font-black tabular-nums', item.color)}>
              {item.value}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider leading-tight text-center">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
