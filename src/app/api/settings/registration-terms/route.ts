import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = (session.user as any).organisationId;
    if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 400 });

    const org = await db.query.organisations.findFirst({
        where: eq(organisations.id, orgId),
        columns: { registrationTerms: true, slug: true },
    });

    return NextResponse.json(org ?? {});
}

export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const orgId = (session.user as any).organisationId;
    if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 400 });

    const { registrationTerms } = await req.json();

    await db.update(organisations)
        .set({ registrationTerms, updatedAt: new Date() })
        .where(eq(organisations.id, orgId));

    return NextResponse.json({ success: true });
}
