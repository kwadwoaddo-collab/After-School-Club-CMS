import { auth } from '@/lib/auth';
import { db } from '@/db';
import { parents } from '@/db/schema';
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

        // Fetch parent details and their children in a single relational query
        const parent = await db.query.parents.findFirst({
            where: and(
                eq(parents.id, id),
                eq(parents.organisationId, session.user.organisationId)
            ),
            with: {
                children: true,
            }
        });

        if (!parent) {
            return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
        }

        const { children: parentChildren, ...parentData } = parent;

        return NextResponse.json({
            parent: parentData,
            children: parentChildren
        });
    } catch (error) {
        console.error('Failed to fetch parent details:', error);
        return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
    }
}
