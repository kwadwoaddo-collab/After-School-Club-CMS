import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const RESERVED = new Set(['app', 'www', 'api', 'mail', 'admin', 'dashboard', 'dev', 'staging', 'preview']);

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Milestone 3D: this route previously had no role check beyond org
    // membership, so any authenticated user of any role — including
    // TUTOR — could change or clear a centre's public subdomain. Fixed to
    // match the Centres List/Settings page gate, since the subdomain is
    // an operational/identity setting reachable from that surface, not a
    // billing field — see project-notes/milestone-3d-centres-audit.md §5.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: centreId } = await params;
    const body = await request.json();
    const { subdomain } = body;

    // Verify the centre belongs to this org
    const centre = await db.query.centres.findFirst({
        where: and(eq(centres.id, centreId), eq(centres.organisationId, session.user.organisationId)),
        columns: { id: true },
    });

    if (!centre) {
        return NextResponse.json({ error: 'Centre not found' }, { status: 404 });
    }

    if (subdomain === '' || subdomain === null || subdomain === undefined) {
        await db.update(centres).set({ subdomain: null }).where(eq(centres.id, centreId));
        return NextResponse.json({ success: true, subdomain: null });
    }

    const cleanSubdomain = String(subdomain).toLowerCase().trim();

    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(cleanSubdomain)) {
        return NextResponse.json({ error: 'Subdomain must be 3–63 lowercase letters, numbers, or hyphens' }, { status: 400 });
    }
    if (RESERVED.has(cleanSubdomain)) {
        return NextResponse.json({ error: `"${cleanSubdomain}" is a reserved subdomain` }, { status: 400 });
    }

    // Uniqueness check across orgs and centres
    const existingOrg = await db.query.organisations.findFirst({
        where: (o, { eq: eqFn }) => eqFn(o.subdomain, cleanSubdomain),
    });
    if (existingOrg) return NextResponse.json({ error: 'This subdomain is already taken' }, { status: 409 });

    const existingCentre = await db.query.centres.findFirst({
        where: (c, { and: andFn, eq: eqFn, not: notFn }) =>
            andFn(eqFn(c.subdomain, cleanSubdomain), notFn(eqFn(c.id, centreId))),
    });
    if (existingCentre) return NextResponse.json({ error: 'This subdomain is already in use' }, { status: 409 });

    await db.update(centres).set({ subdomain: cleanSubdomain }).where(eq(centres.id, centreId));
    return NextResponse.json({ success: true, subdomain: cleanSubdomain });
}
