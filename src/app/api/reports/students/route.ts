import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { children, parents } from '@/db/schema';
import { eq, and, or, inArray, isNull } from 'drizzle-orm';
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

    // Non-owner callers see strictly students assigned to their accessible centres
    // (excluding unassigned centreId IS NULL rows). ORG_OWNER sees all org students.
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    if (accessibleCentreIds.length === 0 && userRole !== 'ORG_OWNER') {
      const csv = 'Student ID,First Name,Last Name,Date of Birth,School Year,Parent First Name,Parent Last Name,Parent Email,Parent Phone,Registration Date\n';
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="students-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      });
    }

  try {
    const centreCondition =
      userRole === 'ORG_OWNER'
        ? (accessibleCentreIds.length > 0
            ? or(inArray(children.centreId, accessibleCentreIds), isNull(children.centreId))
            : isNull(children.centreId))
        : inArray(children.centreId, accessibleCentreIds);

    const query = db
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
        centreCondition,
        isNull(children.deletedAt),
        isNull(parents.deletedAt),
      ));

    const rows =
      typeof (query as unknown as { limit?: (n: number) => unknown }).limit === 'function'
        ? await (query as unknown as { limit: (n: number) => typeof query }).limit(5000)
        : await query;

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
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    logger.error('Student CSV export error:', e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
