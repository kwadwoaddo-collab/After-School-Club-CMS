import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { registrations } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

const VALID_STATUSES = ['awaiting_confirmation', 'signed_up', 'not_interested'] as const;
type RegistrationStatus = typeof VALID_STATUSES[number];

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // ── 1. Authentication ───────────────────────────────────────────────────
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id } = await params;

    // ── 2. Validate incoming status value ───────────────────────────────────
    let body: { status?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { status } = body;
    if (!status || !VALID_STATUSES.includes(status as RegistrationStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // ── 3. Ownership check — fetch reg scoped to this user's org ───────────
    // This single query prevents cross-org access: if the registration belongs
    // to a different org, findFirst returns null and we return 403.
    const reg = await db.query.registrations.findFirst({
        where: and(
            eq(registrations.id, id),
            eq(registrations.organisationId, session.user.organisationId)
        ),
    });

    if (!reg) {
        // Return 404 rather than 403 to avoid leaking existence of the record
        return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // ── 4. Centre-level access check for non-ORG_OWNER users ───────────────
    // ORG_OWNER has implicit access to all centres; other roles must be
    // explicitly assigned to the registration's centre.
    const userRole = (session.user as any).role as string | undefined;
    if (userRole !== 'ORG_OWNER' && reg.centreId) {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(reg.centreId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    // ── 5. Perform the update ───────────────────────────────────────────────
    await db
        .update(registrations)
        .set({ status: status as RegistrationStatus, updatedAt: new Date() })
        .where(eq(registrations.id, id));

    return NextResponse.json({ success: true });
}
