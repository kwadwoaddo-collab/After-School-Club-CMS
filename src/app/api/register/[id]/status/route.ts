import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { registrations, registrationParents, registrationChildren, organisations, centres } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { emailService } from '@/lib/services/email';

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
    const reg = await db.query.registrations.findFirst({
        where: and(
            eq(registrations.id, id),
            eq(registrations.organisationId, session.user.organisationId)
        ),
        with: {
            registrationParents: true,
            registrationChildren: true,
        },
    });

    if (!reg) {
        return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // ── 4. Centre-level access check for non-ORG_OWNER users ───────────────
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

    // ── 6. Fire status change email (non-blocking) ──────────────────────────
    // Only send if status actually changed
    if (status !== reg.status) {
        (async () => {
            try {
                const primaryParent = reg.registrationParents.find(p => p.isPrimary) ?? reg.registrationParents[0];
                if (!primaryParent?.submittedEmail) return;

                const [org, centre] = await Promise.all([
                    db.query.organisations.findFirst({
                        where: eq(organisations.id, session.user!.organisationId!),
                        columns: { name: true },
                    }),
                    reg.centreId ? db.query.centres.findFirst({
                        where: eq(centres.id, reg.centreId),
                        columns: { name: true },
                    }) : Promise.resolve(null),
                ]);

                const childNames = reg.registrationChildren.map(
                    c => `${c.submittedFirstName} ${c.submittedLastName}`
                );

                await emailService.sendRegistrationStatusUpdate({
                    orgName: org?.name || 'After School Club',
                    centreName: centre?.name ?? null,
                    parentFirstName: primaryParent.submittedFirstName,
                    parentEmail: primaryParent.submittedEmail,
                    childNames,
                    newStatus: status as RegistrationStatus,
                });
            } catch (err) {
                console.error('[Status Email] Failed to send status update email:', err);
            }
        })();
    }

    return NextResponse.json({ success: true });
}
