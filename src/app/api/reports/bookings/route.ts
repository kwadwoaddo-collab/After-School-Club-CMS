import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq, and, inArray, isNull, desc } from 'drizzle-orm';
import { format } from 'date-fns';
import { formatInTimezone } from '@/lib/datetime';
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
      const csv = 'Booking ID,Date,Status,Student,Parent Email,Centre\n';
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="bookings-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

    let query: any = db
      .select({
        bookingId: bookings.id,
        startAt: bookings.startAt,
        status: bookings.status,
        childFirstName: children.firstName,
        childLastName: children.lastName,
        parentEmail: parents.email,
        centreName: centres.name,
        confirmationCode: bookings.confirmationCode,
        modality: bookings.modality,
        attendanceStatus: bookingAttendees.attendanceStatus,
        feedbackStatus: bookingAttendees.feedbackStatus,
        feedbackScore: bookingAttendees.feedbackScore,
      })
      .from(bookings)
      .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
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
      status: string;
      childFirstName: string;
      childLastName: string;
      parentEmail: string | null;
      centreName: string;
      confirmationCode: string | null;
      modality: string | null;
      attendanceStatus: string | null;
      feedbackStatus: string | null;
      feedbackScore: number | null;
    }> = await query;

    const headers = [
      'Booking ID',
      'Confirmation Code',
      'Date',
      'Time',
      'Status',
      'Modality',
      'Student',
      'Parent Email',
      'Centre',
      'Attendance Status',
      'Feedback Status',
      'Feedback Score',
    ];

    const csvRows = rows.map(r => [
      encodeCsvCell(r.bookingId),
      encodeCsvCell(r.confirmationCode),
      r.startAt ? encodeCsvCell(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(r.startAt))) : '""',
      r.startAt ? encodeCsvCell(formatInTimezone(new Date(r.startAt))) : '""',
      encodeCsvCell(r.status),
      encodeCsvCell(r.modality),
      encodeCsvCell(`${r.childFirstName} ${r.childLastName}`),
      encodeCsvCell(r.parentEmail),
      encodeCsvCell(r.centreName),
      encodeCsvCell(r.attendanceStatus ?? 'pending'),
      encodeCsvCell(r.feedbackStatus),
      encodeCsvCell(r.feedbackScore),
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const filename = `bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    logger.error('Bookings CSV export error:', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
