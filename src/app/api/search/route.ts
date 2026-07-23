import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { children, parents, bookings, centres, bookingAttendees } from '@/db/schema';
import { ilike, or, eq, sql, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id || !session?.user?.organisationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organisationId = (session.user as any).organisationId as string;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchPattern = `%${query.trim()}%`;

    // 1. Search Students (Children) — scoped to the user's organisation
    const students = await db
      .select({
        id: children.id,
        firstName: children.firstName,
        lastName: children.lastName,
      })
      .from(children)
      .where(
        and(
          eq(children.organisationId, organisationId),
          or(
            ilike(children.firstName, searchPattern),
            ilike(children.lastName, searchPattern),
            ilike(sql`concat(${children.firstName}, ' ', ${children.lastName})`, searchPattern)
          )
        )
      )
      .limit(5);

    // 2. Search Parents — scoped to the user's organisation
    const parentResults = await db
      .select({
        id: parents.id,
        firstName: parents.firstName,
        lastName: parents.lastName,
        email: parents.email,
      })
      .from(parents)
      .where(
        and(
          eq(parents.organisationId, organisationId),
          or(
            ilike(parents.firstName, searchPattern),
            ilike(parents.lastName, searchPattern),
            ilike(parents.email, searchPattern),
            ilike(sql`concat(${parents.firstName}, ' ', ${parents.lastName})`, searchPattern)
          )
        )
      )
      .limit(5);

    // 3. Search Centres — scoped to the user's organisation
    const centreResults = await db
      .select({
        id: centres.id,
        name: centres.name,
      })
      .from(centres)
      .where(
        and(
          eq(centres.organisationId, organisationId),
          ilike(centres.name, searchPattern)
        )
      )
      .limit(3);

    // 4. Search Bookings (by parent or child name)
    const bookingResults = await db
      .select({
        id: bookings.id,
        startAt: bookings.startAt,
        parentFirstName: parents.firstName,
        parentLastName: parents.lastName,
        childFirstName: children.firstName,
        childLastName: children.lastName,
      })
      .from(bookings)
      .leftJoin(parents, eq(bookings.parentId, parents.id))
      .leftJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
      .leftJoin(children, eq(bookingAttendees.childId, children.id))
      .where(
        or(
          ilike(parents.firstName, searchPattern),
          ilike(parents.lastName, searchPattern),
          ilike(children.firstName, searchPattern),
          ilike(children.lastName, searchPattern),
          ilike(sql`concat(${parents.firstName}, ' ', ${parents.lastName})`, searchPattern),
          ilike(sql`concat(${children.firstName}, ' ', ${children.lastName})`, searchPattern)
        )
      )
      .limit(5);

    // Format results to a consistent shape for the frontend dropdown
    const formattedResults = [
      ...students.map(s => ({
        id: s.id,
        type: 'student',
        title: `${s.firstName} ${s.lastName}`,
        subtitle: 'Student',
        url: `/dashboard/students/${s.id}`
      })),
      ...parentResults.map(p => ({
        id: p.id,
        type: 'parent',
        title: `${p.firstName} ${p.lastName}`,
        subtitle: p.email || 'Parent',
        url: `/dashboard/parents/${p.id}`
      })),
      ...bookingResults.map(b => {
        const date = new Date(b.startAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const time = new Date(b.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const childName = b.childFirstName ? `${b.childFirstName} ${b.childLastName}` : 'Unknown Child';
        
        return {
          id: b.id,
          type: 'booking',
          title: `Booking: ${childName}`,
          subtitle: `${date} at ${time}`,
          url: `/dashboard/bookings/${b.id}`
        };
      }),
      ...centreResults.map(c => ({
        id: c.id,
        type: 'centre',
        title: c.name,
        subtitle: 'Centre',
        url: `/dashboard/centres/${c.id}` // Assuming centres route
      }))
    ];

    return NextResponse.json({ results: formattedResults });

  } catch (error) {
    logger.error('Search API error:', error);
    return NextResponse.json({ error: 'Failed to perform search' }, { status: 500 });
  }
}
