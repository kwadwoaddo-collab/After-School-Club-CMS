import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bookings, bookingAttendees, children, parents, centres } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getUserAccessibleCentres } from '@/lib/permissions';

/**
 * GET /api/export/register?date=YYYY-MM-DD&centre=centreId
 *
 * Returns a CSV of all bookings for the given day and centre,
 * including booking time, student name, year group, parent name,
 * parent phone, and attendance status.
 *
 * Auth: session required (any authenticated staff role).
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date');
        const centreParam = searchParams.get('centre');

        // Resolve target date (default to today)
        const targetDate = dateParam ? new Date(dateParam) : new Date();
        if (isNaN(targetDate.getTime())) {
            return new NextResponse('Invalid date parameter', { status: 400 });
        }

        // Build day boundary in local midnight (UTC stored, so use full day range)
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Resolve accessible centres for this user
        const orgCentres = await getUserAccessibleCentres(session.user.id);
        const accessibleCentreIds = orgCentres.map(c => c.id);

        if (accessibleCentreIds.length === 0) {
            return new NextResponse('No accessible centres', { status: 403 });
        }

        // Build centre filter
        let centreFilter;
        if (centreParam && centreParam !== 'all') {
            // Validate the requested centre is accessible
            if (!accessibleCentreIds.includes(centreParam)) {
                return new NextResponse('Forbidden: no access to this centre', { status: 403 });
            }
            centreFilter = eq(bookings.centreId, centreParam);
        } else {
            centreFilter = inArray(bookings.centreId, accessibleCentreIds);
        }

        // Query bookings for the day
        const dayBookings = await db
            .select({
                bookingId: bookings.id,
                startAt: bookings.startAt,
                status: bookings.status,
                centreName: centres.name,
                childFirstName: children.firstName,
                childLastName: children.lastName,
                schoolYear: children.schoolYear,
                parentFirstName: parents.firstName,
                parentLastName: parents.lastName,
                parentPhone: parents.phone,
                attendanceStatus: bookingAttendees.attendanceStatus,
            })
            .from(bookings)
            .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
            .innerJoin(children, eq(bookingAttendees.childId, children.id))
            .innerJoin(parents, eq(bookings.parentId, parents.id))
            .innerJoin(centres, eq(bookings.centreId, centres.id))
            .where(
                and(
                    centreFilter,
                    gte(bookings.startAt, dayStart),
                    lte(bookings.startAt, dayEnd)
                )
            )
            .orderBy(bookings.startAt);

        // Helper: wrap a value in double-quotes, escaping inner quotes
        const esc = (val: string | null | undefined) =>
            `"${String(val ?? '').replace(/"/g, '""')}"`;

        // Build CSV
        const headers = [
            'Booking Time',
            'Student Name',
            'Year Group',
            'Parent Name',
            'Parent Phone',
            'Attendance Status',
            'Centre',
        ];

        const rows = dayBookings.map(row => [
            esc(new Date(row.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })),
            esc(`${row.childFirstName} ${row.childLastName}`),
            esc(row.schoolYear),
            esc(`${row.parentFirstName} ${row.parentLastName}`),
            esc(row.parentPhone),
            esc(row.attendanceStatus ?? 'not marked'),
            esc(row.centreName),
        ]);

        const csvContent = [headers.map(esc).join(','), ...rows.map(r => r.join(','))].join('\n');

        const dateStr = targetDate.toISOString().split('T')[0];

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="register-${dateStr}.csv"`,
            },
        });
    } catch (error) {
        logger.error('[GET /api/export/register]', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
