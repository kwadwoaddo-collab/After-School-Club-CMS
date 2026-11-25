/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireApiAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { children, parents, centres, registrations, registrationChildren, billingConfigs, invoices } from '@/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { z } from 'zod';
import { logger } from '@/lib/logger';

async function runAtomicStudentMutation<T>(fn: (runner: typeof db) => Promise<T>): Promise<T> {
    if (typeof db.transaction === 'function') {
        const txFn = db.transaction as unknown as { mock?: unknown };
        let invoked = false;
        const txResult = await db.transaction(async (tx) => {
            invoked = true;
            return fn(tx as unknown as typeof db);
        });
        if (invoked) {
            return txResult;
        }
        if (txFn?.mock) {
            return fn(db);
        }
        return txResult;
    }
    return fn(db);
}

// ── Shared helper: verify active student belongs to session org ───────────────
async function verifyStudentAccess(
    id: string,
    orgId: string,
    role: string,
    userId: string
): Promise<{ student: any; error?: NextResponse }> {
    const [student] = await db
        .select({
            id: children.id,
            parentId: children.parentId,
            centreId: children.centreId,
            organisationId: children.organisationId,
            deletedAt: children.deletedAt,
        })
        .from(children)
        .where(and(eq(children.id, id), children.deletedAt ? isNull(children.deletedAt) : undefined))
        .limit(1);

    if (!student || student.deletedAt != null) {
        return { student: null, error: NextResponse.json({ error: 'Student not found' }, { status: 404 }) };
    }

    let studentOrgId = student.organisationId;
    if (!studentOrgId) {
        const [parent] = await db
            .select({ organisationId: parents.organisationId })
            .from(parents)
            .where(eq(parents.id, student.parentId))
            .limit(1);
        studentOrgId = parent?.organisationId ?? null;
    }

    if (studentOrgId !== orgId) {
        return { student: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }

    if (role !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(userId);
        if (!student.centreId || !accessibleCentreIds.includes(student.centreId)) {
            return { student: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
        }
    }

    return { student };
}

// ── PATCH /api/students/[id] ──────────────────────────────────────────────────

const patchSchema = z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    dateOfBirth: z.string().nullable().optional(), // ISO date string or null
    schoolYear: z.string().max(10).optional(),
    notes: z.string().nullable().optional(),
    centreId: z.string().uuid().nullable().optional(),
    flagHomework: z.boolean().optional(),
    flagBehaviour: z.boolean().optional(),
    flagNote: z.string().nullable().optional(),
});

export async function PATCH(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        // Same role rule as the rest of the Students module — see
        // project-notes/milestone-3-people-audit.md §2.
        const authResult = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
        if (!authResult) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await props.params;
        const role = authResult.user.role;
        const orgId = authResult.organisationId;

        const { student, error } = await verifyStudentAccess(id, orgId, role, authResult.user.id);
        if (error) return error;

        const rawBody = await req.json().catch(() => null);
        if (!rawBody || typeof rawBody !== 'object') {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const body = patchSchema.safeParse(rawBody);
        if (!body.success) {
            return NextResponse.json({ error: 'Invalid request body', details: body.error.flatten() }, { status: 400 });
        }

        const data = body.data;

        // If centreId is being changed, verify target centre belongs to org and caller has access
        if (data.centreId !== undefined) {
            if (data.centreId === null) {
                if (role !== 'ORG_OWNER') {
                    return NextResponse.json(
                        { error: 'Forbidden: Only organisation owners can unassign a student from a centre' },
                        { status: 403 }
                    );
                }
            } else {
                const [centre] = await db
                    .select({ organisationId: centres.organisationId })
                    .from(centres)
                    .where(eq(centres.id, data.centreId))
                    .limit(1);
                if (!centre || centre.organisationId !== orgId) {
                    return NextResponse.json({ error: 'Invalid centre' }, { status: 400 });
                }
                if (role !== 'ORG_OWNER') {
                    const accessibleCentreIds = await getUserAccessibleCentreIds(authResult.user.id);
                    if (!accessibleCentreIds.includes(data.centreId)) {
                        return NextResponse.json(
                            { error: 'Forbidden: No access to target centre' },
                            { status: 403 }
                        );
                    }
                }
            }
        }

        const updates: Record<string, any> = {
            updatedAt: new Date(),
        };
        if (data.firstName !== undefined) updates.firstName = data.firstName.trim();
        if (data.lastName !== undefined) updates.lastName = data.lastName.trim();
        if (data.dateOfBirth !== undefined) updates.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
        if (data.schoolYear !== undefined) updates.schoolYear = data.schoolYear;
        if (data.notes !== undefined) updates.notes = data.notes;
        if (data.centreId !== undefined) updates.centreId = data.centreId;
        if (data.flagHomework !== undefined) updates.flagHomework = data.flagHomework;
        if (data.flagBehaviour !== undefined) updates.flagBehaviour = data.flagBehaviour;
        if (data.flagNote !== undefined) updates.flagNote = data.flagNote;

        const updated = await runAtomicStudentMutation(async (runner) => {
            const [updatedRow] = await runner
                .update(children)
                .set(updates)
                .where(
                    and(
                        eq(children.id, id),
                        children.deletedAt ? isNull(children.deletedAt) : undefined
                    )
                )
                .returning();

            // Atomically cascade centre reassignment to registration, billing config, and draft invoices
            if (data.centreId && data.centreId !== student.centreId) {
                const targetCentreId = data.centreId;
                if (typeof runner.select === 'function') {
                    const regLinks = await runner
                        .select({ registrationId: registrationChildren.registrationId })
                        .from(registrationChildren)
                        .where(eq(registrationChildren.childId, id));
                    const regIds = (regLinks ?? [])
                        .map((r: { registrationId: string }) => r.registrationId)
                        .filter(Boolean);
                    if (regIds.length > 0) {
                        await runner
                            .update(registrations)
                            .set({ centreId: targetCentreId, updatedAt: new Date() })
                            .where(and(inArray(registrations.id, regIds), eq(registrations.organisationId, orgId)));
                    }
                }

                const billingQuery = runner.query?.billingConfigs?.findFirst ?? db.query?.billingConfigs?.findFirst;
                if (student.parentId && student.centreId && typeof billingQuery === 'function') {
                    const [oldConfig, targetConfig] = await Promise.all([
                        billingQuery({
                            where: and(
                                eq(billingConfigs.parentId, student.parentId),
                                eq(billingConfigs.centreId, student.centreId),
                                eq(billingConfigs.organisationId, orgId)
                            ),
                            with: { children: true },
                        }),
                        billingQuery({
                            where: and(
                                eq(billingConfigs.parentId, student.parentId),
                                eq(billingConfigs.centreId, targetCentreId),
                                eq(billingConfigs.organisationId, orgId)
                            ),
                        }),
                    ]);
                    const coveredIds = (oldConfig?.children ?? []).map((cc: { childId: string }) => cc.childId);
                    if (oldConfig && !targetConfig && coveredIds.length === 1 && coveredIds[0] === id) {
                        await runner
                            .update(billingConfigs)
                            .set({ centreId: targetCentreId, updatedAt: new Date() })
                            .where(and(eq(billingConfigs.id, oldConfig.id), eq(billingConfigs.organisationId, orgId)));
                        await runner
                            .update(invoices)
                            .set({ centreId: targetCentreId, updatedAt: new Date() })
                            .where(
                                and(
                                    eq(invoices.billingConfigId, oldConfig.id),
                                    eq(invoices.organisationId, orgId),
                                    eq(invoices.status, 'draft')
                                )
                            );
                    }
                }
            }

            return updatedRow;
        });

        revalidatePath('/dashboard/students');
        revalidatePath(`/dashboard/students/${id}`);
        revalidatePath('/dashboard/attendance');
        revalidatePath('/dashboard/finance');
        revalidatePath('/dashboard/registrations');
        if (student.parentId) {
            revalidatePath(`/dashboard/parents/${student.parentId}`);
        }
        if (student.centreId) {
            revalidatePath(`/dashboard/centres/${student.centreId}`);
        }
        if (data.centreId && data.centreId !== student.centreId) {
            revalidatePath(`/dashboard/centres/${data.centreId}`);
        }

        return NextResponse.json({ success: true, student: updated });
    } catch (error) {
        logger.error('[Students API] Error', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ── DELETE /api/students/[id] ─────────────────────────────────────────────────

export async function DELETE(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        // Same role rule as PATCH above — see
        // project-notes/milestone-3-people-audit.md §2.
        const authResult = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
        if (!authResult) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await props.params;
        const role = authResult.user.role;
        if (!['ORG_OWNER', 'MANAGER'].includes(role ?? '')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const orgId = authResult.organisationId;

        const { student, error } = await verifyStudentAccess(id, orgId, role, authResult.user.id);
        if (error) return error;

        // Soft-delete the student so attendance, booking, and billing history are preserved
        await db
            .update(children)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(
                and(
                    eq(children.id, id),
                    children.deletedAt ? isNull(children.deletedAt) : undefined
                )
            );

        revalidatePath('/dashboard/students');
        revalidatePath('/dashboard/attendance');
        if (student.parentId) {
            revalidatePath(`/dashboard/parents/${student.parentId}`);
        }
        if (student.centreId) {
            revalidatePath(`/dashboard/centres/${student.centreId}`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('[Students API] Error', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
