import { auth } from '@/lib/auth';
import { db } from '@/db';
import { parents, children } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await props.params;

        // Fetch parent details scoped to this organisation
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, id),
                eq(parents.organisationId, session.user.organisationId)
            ),
        });

        if (!parent) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
        }

        // Fetch children (students) linked to this parent
        const parentChildren = await db.query.children.findMany({
            where: and(
                eq(children.parentId, id),
                eq(children.organisationId, session.user.organisationId)
            ),
        });

        return NextResponse.json({
            parent,
            children: parentChildren
        });
    } catch (error) {
        console.error('Failed to fetch parent details:', error);
        return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
    }
}
