import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { orgMemberships, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await db
        .select({
            id: organisations.id,
            name: organisations.name,
            slug: organisations.slug,
            logoUrl: organisations.logoUrl,
            role: orgMemberships.role,
        })
        .from(orgMemberships)
        .innerJoin(organisations, eq(orgMemberships.organisationId, organisations.id))
        .where(eq(orgMemberships.userId, session.user.id));

    return NextResponse.json({ memberships });
}
