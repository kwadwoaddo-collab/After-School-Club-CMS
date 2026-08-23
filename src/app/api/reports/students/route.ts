import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { children, parents } from '@/db/schema';
import { eq, and, or, inArray, isNull } from 'drizzle-orm';
import { format } from 'date-fns';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { neutralizeCsvFormula } from '@/lib/csv-safety';

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

    // Milestone 3I, O.6/O.7: this route previously filtered only by
    // organisation — unlike its own sibling routes in this directory
    // (attendance/route.ts, bookings/route.ts), which both scope to
    // getUserAccessibleCentreIds, and unlike the frozen Students list page
    // (src/app/dashboard/students/page.tsx), which additionally excludes
    // soft-deleted children/parents. A non-owner caller could previously
    // export every student in the organisation regardless of their
    // assigned centre, and deleted records — invisible everywhere else in
    // the product — would still appear in the export. Fixed to mirror both
    // established precedents exactly.
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (accessibleCentreIds.length === 0) {
      const csv = 'Student ID,First Name,Last Name,Date of Birth,School Year,Parent First Name,Parent Last Name,Parent Email,Parent Phone,Registration Date\n';
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="students-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
        },
      });
    }

  try {
    const rows = await db
      .select({
        studentId: children.id,
        firstName: children.firstName,
        lastName: children.lastName,
        dateOfBirth: children.dateOfBirth,
        schoolYear: children.schoolYear,
        parentFirstName: parents.firstName,
        parentLastName: parents.lastName,
        parentEmail: parents.email,
        parentPhone: parents.phone,
        createdAt: children.createdAt,
      })
      .from(children)
      .innerJoin(parents, eq(children.parentId, parents.id))
      .where(and(
        eq(parents.organisationId, session.user.organisationId),
        or(
          inArray(children.centreId, accessibleCentreIds),
          isNull(children.centreId),
        ),
        isNull(children.deletedAt),
        isNull(parents.deletedAt),
      ));

    const headers = [
      'Student ID',
      'First Name',
      'Last Name',
      'Date of Birth',
      'School Year',
      'Parent First Name',
      'Parent Last Name',
      'Parent Email',
      'Parent Phone',
      'Registration Date',
    ];

    const escape = (val: string | null | undefined) =>
      `"${neutralizeCsvFormula((val ?? '').toString()).replace(/"/g, '""')}"`;

    const csvRows = rows.map(r => [
      escape(r.studentId),
      escape(r.firstName),
      escape(r.lastName),
      r.dateOfBirth ? escape(format(new Date(r.dateOfBirth), 'dd/MM/yyyy')) : '""',
      escape(r.schoolYear),
      escape(r.parentFirstName),
      escape(r.parentLastName),
      escape(r.parentEmail),
      escape(r.parentPhone),
      r.createdAt ? escape(format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm')) : '""',
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const filename = `students-${format(new Date(), 'yyyy-MM-dd')}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    logger.error('Student CSV export error:', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
