import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { registrations, registrationParents, registrationChildren, organisations, centres } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';

const bodySchema = z.object({
    registrationIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        // Only org owners and managers can bulk-email
        const userRole = (session.user as any).role;
        if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = bodySchema.safeParse(await req.json());
        if (!body.success) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { registrationIds } = body.data;

        // Fetch org info
        const [org] = await db
            .select({ name: organisations.name })
            .from(organisations)
            .where(eq(organisations.id, session.user.organisationId))
            .limit(1);

        if (!org) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        // Fetch all matching registrations (must belong to this org)
        const regs = await db.query.registrations.findMany({
            where: and(
                inArray(registrations.id, registrationIds),
                eq(registrations.organisationId, session.user.organisationId)
            ),
            with: {
                registrationParents: true,
                registrationChildren: true,
            },
        });

        if (regs.length === 0) {
            return NextResponse.json({ error: 'No matching registrations found' }, { status: 404 });
        }

        // Fetch centre names for any centreIds referenced
        const centreIds = [...new Set(regs.map(r => r.centreId).filter(Boolean))] as string[];
        const centreMap = new Map<string, string>();
        if (centreIds.length > 0) {
            const centreRows = await db
                .select({ id: centres.id, name: centres.name })
                .from(centres)
                .where(inArray(centres.id, centreIds));
            centreRows.forEach(c => centreMap.set(c.id, c.name));
        }

        // Send emails in parallel
        const results = await Promise.allSettled(
            regs.map(async (reg) => {
                const parents = reg.registrationParents as {
                    isPrimary: boolean | null;
                    submittedEmail: string | null;
                    submittedFirstName: string;
                    submittedLastName: string;
                }[];

                // Find primary parent with an email
                const primaryParent = [...parents]
                    .sort((a, b) => (a.isPrimary ? -1 : 1))
                    .find(p => p.submittedEmail);

                if (!primaryParent?.submittedEmail) {
                    return { id: reg.id, skipped: true, reason: 'No email on file' };
                }

                const children = reg.registrationChildren as {
                    submittedFirstName: string;
                    submittedLastName: string;
                }[];

                const childNames = children.map(c => `${c.submittedFirstName} ${c.submittedLastName}`);
                const centreName = reg.centreId ? (centreMap.get(reg.centreId) ?? null) : null;

                const validStatus = ['awaiting_confirmation', 'signed_up', 'not_interested'] as const;
                const status = validStatus.includes(reg.status as any)
                    ? (reg.status as 'awaiting_confirmation' | 'signed_up' | 'not_interested')
                    : 'awaiting_confirmation';

                const result = await emailService.sendRegistrationStatusUpdate({
                    orgName: org.name,
                    centreName,
                    parentFirstName: primaryParent.submittedFirstName,
                    parentEmail: primaryParent.submittedEmail,
                    childNames,
                    newStatus: status,
                });

                return {
                    id: reg.id,
                    email: primaryParent.submittedEmail,
                    success: result.success,
                    error: result.error,
                };
            })
        );

        const sent = results.filter(
            r => r.status === 'fulfilled' && (r.value as any).success
        ).length;
        const skipped = results.filter(
            r => r.status === 'fulfilled' && (r.value as any).skipped
        ).length;
        const failed = results.length - sent - skipped;

        return NextResponse.json({ ok: true, sent, skipped, failed, total: regs.length });

    } catch (err) {
        console.error('[bulk-email] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
