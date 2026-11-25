import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq, and, inArray, isNull, desc } from 'drizzle-orm';
import { format } from 'date-fns';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { encodeCsvCell } from '@/lib/csv-safety';

const EXPORT_ROW_LIMIT = 10_000;

export async function GET() {
  const session = await getApiSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.user.organisationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  const userRole = (session.user as any).role as string;
  if (userRole === 'TUTOR' || userRole === 'FRONT_DESK') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (accessibleCentreIds.length === 0) {
      const csv = 'Booking ID,Date,Student,Centre,Attendance Status,Attendance Note,Marked At\n';
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    let query: any = db
      .select({
        bookingId: bookings.id,
        startAt: bookings.startAt,
        childFirstName: children.firstName,
        childLastName: children.lastName,
        parentEmail: parents.email,
        centreName: centres.name,
        attendanceStatus: bookingAttendees.attendanceStatus,
        attendanceNote: bookingAttendees.attendanceNote,
        attendanceMarkedAt: bookingAttendees.attendanceMarkedAt,
      })
      .from(bookingAttendees)
      .innerJoin(bookings, eq(bookingAttendees.bookingId, bookings.id))
      .innerJoin(children, eq(bookingAttendees.childId, children.id))
      .innerJoin(parents, eq(bookings.parentId, parents.id))
      .innerJoin(centres, eq(bookings.centreId, centres.id))
      .where(
        and(
          inArray(bookings.centreId, accessibleCentreIds),
          isNull(children.deletedAt),
          isNull(parents.deletedAt),
        ),
      );

    if (typeof query.orderBy === 'function') {
      query = query.orderBy(desc(bookings.startAt));
    }
    if (typeof query.limit === 'function') {
      query = query.limit(EXPORT_ROW_LIMIT);
    }
    const rows: Array<{
      bookingId: string;
      startAt: Date | null;
      childFirstName: string;
      childLastName: string;
      parentEmail: string | null;
      centreName: string;
      attendanceStatus: string | null;
      attendanceNote: string | null;
      attendanceMarkedAt: Date | null;
    }> = await query;

    const headers = [
      'Booking ID',
      'Date',
      'Time',
      'Student',
      'Parent Email',
      'Centre',
      'Attendance Status',
      'Attendance Note',
      'Marked At',
    ];

    const csvRows = rows.map(r => [
      encodeCsvCell(r.bookingId),
      r.startAt ? encodeCsvCell(format(new Date(r.startAt), 'dd/MM/yyyy')) : '""',
      r.startAt ? encodeCsvCell(format(new Date(r.startAt), 'HH:mm')) : '""',
      encodeCsvCell(`${r.childFirstName} ${r.childLastName}`),
      encodeCsvCell(r.parentEmail),
      encodeCsvCell(r.centreName),
      encodeCsvCell(r.attendanceStatus ?? 'not_recorded'),
      encodeCsvCell(r.attendanceNote),
      r.attendanceMarkedAt ? encodeCsvCell(format(new Date(r.attendanceMarkedAt), 'dd/MM/yyyy HH:mm')) : '""',
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const filename = `attendance-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    logger.error('Attendance CSV export error:', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
