import { db } from '@/db';
import { bookings, centres } from '@/db/schema';
import { eq, gte, lt, and, inArray, sql } from 'drizzle-orm';
import { subDays, startOfDay, format, eachDayOfInterval } from 'date-fns';
import { cn } from '@/components/ui/utils';

interface AttendanceHeatmapProps {
  activeCentreId: string;
  accessibleCentreIds: string[];
  className?: string;
}

export async function AttendanceHeatmap({
  activeCentreId,
  accessibleCentreIds,
  className,
}: AttendanceHeatmapProps) {
  const hasCentres = accessibleCentreIds.length > 0;
  if (!hasCentres) return null;

  const now = new Date();
  const fourWeeksAgo = subDays(startOfDay(now), 27); // 28 days total

  const centreCondition =
    activeCentreId !== 'all'
      ? eq(bookings.centreId, activeCentreId)
      : inArray(bookings.centreId, accessibleCentreIds);

  let dailyCounts: { day: string; count: number }[] = [];
  try {
    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${bookings.startAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(
        and(
          centreCondition,
          gte(bookings.startAt, fourWeeksAgo),
          lt(bookings.startAt, now)
        )
      )
      .groupBy(sql`date_trunc('day', ${bookings.startAt})::date`);
    dailyCounts = rows.map(r => ({ day: r.day, count: Number(r.count) }));
  } catch {
    return null;
  }

  // Build the 28-day grid
  const days = eachDayOfInterval({ start: fourWeeksAgo, end: subDays(now, 1) });
  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1);

  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-secondary/40 border-outline-variant/10';
    const pct = count / maxCount;
    if (pct >= 0.75) return 'bg-destructive/70 border-destructive/30';
    if (pct >= 0.5) return 'bg-warning/70 border-warning/30';
    if (pct >= 0.25) return 'bg-success/50 border-success/20';
    return 'bg-success/20 border-success/10';
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.15em]">
          Attendance Heatmap · Last 4 Weeks
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-on-surface-variant/50 font-medium">None</span>
          {['bg-success/20', 'bg-success/50', 'bg-warning/70', 'bg-destructive/70'].map((c, i) => (
            <div key={i} className={cn('w-3 h-3 rounded-sm border border-outline-variant/10', c)} />
          ))}
          <span className="text-[10px] text-on-surface-variant/50 font-medium">High</span>
        </div>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-[auto_repeat(28,minmax(0,1fr))] gap-1 items-center">
        {/* Empty corner */}
        <div />
        {days.map((day, i) => (
          <div
            key={i}
            className="text-center text-[8px] font-bold text-on-surface-variant/40 uppercase"
          >
            {i % 7 === 0 ? format(day, 'd') : ''}
          </div>
        ))}
      </div>

      {/* 7 rows × 4 cols heatmap (weekday × week) */}
      <div className="grid grid-cols-[32px_repeat(4,minmax(0,1fr))] gap-1">
        {dayLabels.map((label, dow) => (
          <>
            <div key={`label-${dow}`} className="flex items-center justify-end pr-2">
              <span className="text-[9px] font-bold text-on-surface-variant/50 uppercase">{label}</span>
            </div>
            {Array.from({ length: 4 }, (_, week) => {
              // dow: 0=Mon, 6=Sun. days array starts from Monday (fourWeeksAgo)
              const adjustedDow = dow; // Mon=0 in our array since we start Monday
              const dayIndex = week * 7 + adjustedDow;
              const day = days[dayIndex];
              if (!day) {
                return (
                  <div key={`empty-${dow}-${week}`} className="h-8 rounded-md bg-secondary/40/30" />
                );
              }
              const dateStr = format(day, 'yyyy-MM-dd');
              const match = dailyCounts.find(d => d.day === dateStr);
              const count = match?.count ?? 0;

              return (
                <div
                  key={`cell-${dow}-${week}`}
                  title={`${format(day, 'EEE d MMM')}: ${count} booking${count !== 1 ? 's' : ''}`}
                  className={cn(
                    'h-8 rounded-md border transition-all cursor-default hover:scale-105 hover:shadow-md',
                    getCellColor(count)
                  )}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
