import { isValidEnrolmentStartDate } from '@/lib/enrolment/start-date';
import { logger } from '@/lib/logger';
import { requireApiAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { parents, children, centres, auditEvents } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as permissions from '@/lib/permissions';
import { normalizeSchoolYear } from '@/lib/school-year';

const schema = z.object({
    existingEnrolled: z.boolean().default(false),
    enrolmentStartDate: z.string().refine(isValidEnrolmentStartDate, 'Invalid start date').optional(),
    enrolmentReason: z.string().trim().max(1000).optional(),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    schoolYear: z.string(),
    parentFirstName: z.string().min(2),
    parentLastName: z.string().min(2),
    parentEmail: z.string().email(),
    parentPhone: z.string().min(10),
    // centreId is now required for staff-added students.
    // It must belong to the session user's organisation.
    centreId: z.string().uuid(),
});

export async function POST(req: Request) {
    // Same role rule as the rest of the Students module — see
    // project-notes/milestone-3-people-audit.md §2. This endpoint is the
    // page-level "Add student" form's actual mutation; gating the page
    // without gating this would leave the create pathway reachable by a
    // direct request.
    const authResult = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
    if (!authResult) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const orgId = authResult.organisationId;

    try {
        const body = await req.json();
        const data = schema.parse(body);
        if (data.existingEnrolled && (!['ORG_OWNER', 'MANAGER'].includes(authResult.user.role) || !data.enrolmentStartDate || !data.enrolmentReason || data.enrolmentReason.length < 5)) {
            return NextResponse.json({ error: 'Owner/Manager confirmation and a reason are required for an existing enrolled student' }, { status: 403 });
        }

        // ── Validate centreId belongs to the session user's org ──────────
        // Prevents a staff member assigning a student to a centre from
        // another organisation by forging the POST body.
        const centre = await db.query.centres.findFirst({
            where: and(
                eq(centres.id, data.centreId),
                eq(centres.organisationId, orgId)
            ),
            columns: { id: true },
        });

        if (!centre) {
            return NextResponse.json(
                { error: 'Invalid centre: does not belong to your organisation' },
                { status: 400 }
            );
        }

        if (authResult.user.role !== 'ORG_OWNER') {
            if ('getUserAccessibleCentreIds' in permissions) {
                try {
                    const accessibleIds = await permissions.getUserAccessibleCentreIds(authResult.user.id);
                    if (Array.isArray(accessibleIds) && !accessibleIds.includes(data.centreId)) {
                        return NextResponse.json(
                            { error: 'Forbidden: You do not have access to this centre' },
                            { status: 403 }
                        );
                    }
                } catch {
                    if ('canUserAccessCentre' in permissions && db.query?.users) {
                        const hasAccess = await permissions.canUserAccessCentre(authResult.user.id, data.centreId);
                        if (!hasAccess) {
                            return NextResponse.json(
                                { error: 'Forbidden: You do not have access to this centre' },
                                { status: 403 }
                            );
                        }
                    }
                }
            }
        }

        const result = await db.transaction(async (tx) => {
            let pId: string;
            const normalizedEmail = data.parentEmail.trim().toLowerCase();
            const existingParent = await tx.query.parents.findFirst({
                where: and(
                    sql`lower(${parents.email}) = lower(${normalizedEmail})`,
                    eq(parents.organisationId, orgId),
                    isNull(parents.deletedAt)
                ),
            });

            if (existingParent && !existingParent.deletedAt) {
                pId = existingParent.id;
            } else {
                const [newParent] = await tx.insert(parents).values({
                    firstName: data.parentFirstName,
                    lastName: data.parentLastName,
                    email: normalizedEmail,
                    phone: data.parentPhone,
                    organisationId: orgId,
                    preferredContact: 'email',
                }).returning();
                pId = newParent.id;
            }

            // Create Child — with direct organisationId and centreId
            const [newChild] = await tx.insert(children).values({
                parentId: pId,
                organisationId: orgId,
                centreId: data.centreId,
                firstName: data.firstName,
                lastName: data.lastName,
                dateOfBirth: new Date(data.dateOfBirth),
                schoolYear: normalizeSchoolYear(data.schoolYear),
                source: 'registration',
                isRegistered: data.existingEnrolled,
                registeredAt: data.existingEnrolled ? new Date() : null,
            }).returning({ id: children.id });

            if (data.existingEnrolled) await tx.insert(auditEvents).values({
                organisationId: orgId, userId: authResult.user.id,
                eventType: 'manual_student_enrolment_confirmed',
                eventData: JSON.stringify({ childId: newChild.id, reason: data.enrolmentReason, startDate: data.enrolmentStartDate, confirmedAt: new Date().toISOString() }),
            });
            return { childId: newChild.id, parentId: pId };
        });

        revalidatePath('/dashboard/students');
        revalidatePath('/dashboard/parents');
        revalidatePath('/dashboard/attendance');
        revalidatePath(`/dashboard/students/${result.childId}`);
        revalidatePath(`/dashboard/parents/${result.parentId}`);
        revalidatePath(`/dashboard/centres/${data.centreId}`);

        return NextResponse.json({ success: true, id: result.childId });
    } catch (error) {
        logger.error('Add Student error:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Validation failed',
                details: error.issues
            }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to add student' }, { status: 500 });
    }
}
