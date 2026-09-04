import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { format } from 'date-fns';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { neutralizeCsvFormula } from '@/lib/csv-safety';

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
        },
      });
    }

    const rows = await db
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
      .where(inArray(bookings.centreId, accessibleCentreIds));

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

    const escape = (val: string | null | undefined) =>
      `"${neutralizeCsvFormula((val ?? '').toString()).replace(/"/g, '""')}"`;

    const csvRows = rows.map(r => [
      escape(r.bookingId),
      r.startAt ? escape(format(new Date(r.startAt), 'dd/MM/yyyy')) : '""',
      r.startAt ? escape(format(new Date(r.startAt), 'HH:mm')) : '""',
      escape(`${r.childFirstName} ${r.childLastName}`),
      escape(r.parentEmail),
      escape(r.centreName),
      escape(r.attendanceStatus ?? 'not_recorded'),
      escape(r.attendanceNote),
      r.attendanceMarkedAt ? escape(format(new Date(r.attendanceMarkedAt), 'dd/MM/yyyy HH:mm')) : '""',
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const filename = `attendance-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    logger.error('Attendance CSV export error:', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
