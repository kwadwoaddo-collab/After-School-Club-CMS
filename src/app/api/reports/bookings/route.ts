import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { format } from 'date-fns';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export async function GET() {
  const session = await auth();
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
        },
      });
    }

    const rows = await db
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
      .where(inArray(bookings.centreId, accessibleCentreIds));

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

    const escape = (val: string | null | undefined) =>
      `"${(val ?? '').toString().replace(/"/g, '""')}"`;

    const csvRows = rows.map(r => [
      escape(r.bookingId),
      escape(r.confirmationCode),
      r.startAt ? escape(format(new Date(r.startAt), 'dd/MM/yyyy')) : '""',
      r.startAt ? escape(format(new Date(r.startAt), 'HH:mm')) : '""',
      escape(r.status),
      escape(r.modality),
      escape(`${r.childFirstName} ${r.childLastName}`),
      escape(r.parentEmail),
      escape(r.centreName),
      escape(r.attendanceStatus ?? 'pending'),
      escape(r.feedbackStatus),
      escape(r.feedbackScore),
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const filename = `bookings-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('Bookings CSV export error:', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
