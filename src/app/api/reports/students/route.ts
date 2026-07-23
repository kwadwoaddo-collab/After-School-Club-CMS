import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { children, parents, organisations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { format } from 'date-fns';

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
      .where(eq(parents.organisationId, session.user.organisationId));

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
      `"${(val ?? '').toString().replace(/"/g, '""')}"`;

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
