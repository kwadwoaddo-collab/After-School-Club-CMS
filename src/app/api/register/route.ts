import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
    organisations, parents, children, centres,
    registrations, registrationChildren, registrationParents,
    studentNotes,
} from '@/db/schema';
import { eq, and, ilike, inArray } from 'drizzle-orm';
import { emailService } from '@/lib/services/email';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { resolveOrCreateParent, resolveOrCreateChild } from '@/lib/services/crm';
import { z } from 'zod';
import { apiRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

// Helper: treat empty strings as null so optional/nullable fields don't fail
const emptyToNull = (v: unknown) => (v === '' ? null : v);

// Validation schema for the public registration form
const registerSchema = z.object({
    orgSlug: z.string().min(1).max(100),
    // Allow null (no centre selected) as well as undefined
    centreId: z.preprocess(emptyToNull, z.string().uuid().optional().nullable()),
    startDate: z.preprocess(
        (v) => {
            if (!v || v === '') return null;
            // date picker gives YYYY-MM-DD — convert to full ISO datetime
            if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                return v + 'T00:00:00.000Z';
            }
            return v;
        },
        z.string().datetime({ offset: true }).optional().nullable()
    ),
    termsAgreed: z.literal(true, { message: 'You must agree to the terms' }),
    parentSignature: z.preprocess(emptyToNull, z.string().optional().nullable()),
    children: z.array(z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        dateOfBirth: z.preprocess(emptyToNull, z.string().optional().nullable()),
        schoolYear: z.preprocess(emptyToNull, z.string().max(10).optional().nullable()),
        sessions: z.array(z.string()).optional(),
    })).min(1),
    parents: z.array(z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        // Email: empty string -> null (avoids .email() failing on "")
        email: z.preprocess(emptyToNull, z.string().email().max(255).optional().nullable()),
        // Phone max bumped to 30 to accommodate country codes like +44
        phone: z.preprocess(emptyToNull, z.string().max(30).optional().nullable()),
        relationship: z.preprocess(emptyToNull, z.string().max(50).optional().nullable()),
        addressLine1: z.preprocess(emptyToNull, z.string().max(255).optional().nullable()),
        addressLine2: z.preprocess(emptyToNull, z.string().max(255).optional().nullable()),
        city: z.preprocess(emptyToNull, z.string().max(100).optional().nullable()),
        postcode: z.preprocess(emptyToNull, z.string().max(20).optional().nullable()),
    })).min(1),
    emergencyContact: z.object({
        name: z.preprocess(emptyToNull, z.string().max(255).optional().nullable()),
        phone: z.preprocess(emptyToNull, z.string().max(30).optional().nullable()),
        relationship: z.preprocess(emptyToNull, z.string().max(50).optional().nullable()),
    }).optional(),
    funding: z.object({
        types: z.array(z.string()).optional(),
        other: z.preprocess(emptyToNull, z.string().max(500).optional().nullable()),
    }).optional(),
    specialNeeds: z.object({
        has: z.boolean(),
        details: z.preprocess(emptyToNull, z.string().max(5000).optional().nullable()),
    }).optional(),
});

export async function POST(req: NextRequest) {
    try {
        // Rate limit: protect against bulk spam registrations
        const ip = getClientIP(req);
        const { success: allowed } = await checkRateLimit(apiRateLimit, `register:${ip}`);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again later.' },
                { status: 429 }
            );
        }

        let rawBody: unknown;
        try {
            rawBody = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const parsed = registerSchema.safeParse(rawBody);
        if (!parsed.success) {
            const fieldErrors = parsed.error.flatten().fieldErrors;
            console.error('[Registration] Validation errors:', JSON.stringify(fieldErrors, null, 2));
            return NextResponse.json(
                { error: 'Validation failed', details: fieldErrors },
                { status: 400 }
            );
        }

        const body = parsed.data;
        const {
            orgSlug,
            centreId,
            startDate,
            children: submittedChildren,
            parents: submittedParents,
            emergencyContact,
            funding,
            specialNeeds,
            termsAgreed,
            parentSignature,
        } = body;

        // ── 1. Resolve organisation ──────────────────────────────────────
        const org = await db.query.organisations.findFirst({
            where: eq(organisations.slug, orgSlug),
        });
        if (!org) {
            return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
        }

        // ── 2. Validate centreId belongs to the resolved org (if supplied) ──
        // This prevents cross-org data poisoning where a malicious caller
        // could POST orgSlug=org-a with centreId=<uuid-from-org-b>.
        let validatedCentreId: string | null = null;
        let centreName: string | null = null;
        if (centreId) {
            const centre = await db.query.centres.findFirst({
                where: and(
                    eq(centres.id, centreId),
                    eq(centres.organisationId, org.id)
                ),
                columns: { id: true, name: true },
            });
            if (!centre) {
                return NextResponse.json(
                    { error: 'Invalid centre: does not belong to this organisation' },
                    { status: 400 }
                );
            }
            validatedCentreId = centre.id;
            centreName = centre.name;
        }

        // ── 3. Duplicate detection ───────────────────────────────────────────
        // Check if the primary parent's email already has a registration for any
        // of the same child first names within this org. Returns a soft warning.
        const primarySubmittedParent = submittedParents?.[0];
        if (primarySubmittedParent?.email) {
            // Find existing registration parent records matching this email
            const existingRegParents = await db.select({
                registrationId: registrationParents.registrationId,
            })
                .from(registrationParents)
                .innerJoin(registrations, and(
                    eq(registrations.id, registrationParents.registrationId),
                    eq(registrations.organisationId, org.id)
                ))
                .where(ilike(registrationParents.submittedEmail, primarySubmittedParent.email.trim()))
                .limit(10);

            if (existingRegParents.length > 0) {
                const regIds = existingRegParents.map(r => r.registrationId);
                const existingRegChildren = await db.select({
                    firstName: registrationChildren.submittedFirstName,
                })
                    .from(registrationChildren)
                    .where(inArray(registrationChildren.registrationId, regIds));

                const submittedNames = (submittedChildren ?? []).map((c: any) =>
                    c.firstName?.toLowerCase().trim()
                );
                const existingNames = existingRegChildren.map(c =>
                    c.firstName.toLowerCase().trim()
                );
                const overlap = submittedNames.some((n: string) => existingNames.includes(n));
                if (overlap) {
                    return NextResponse.json(
                        {
                            duplicate: true,
                            error: 'A registration for this child already exists. Please contact the centre if you need to make changes.',
                        },
                        { status: 409 }
                    );
                }
            }
        }

        // ── 4. Create the top-level registration record ──────────────────
        let registration: any;
        const resolvedParents: { parentId: string; wasMatched: boolean; data: any }[] = [];
 
        await db.transaction(async (tx) => {
            const [reg] = await tx.insert(registrations).values({
                organisationId: org.id,
                centreId: validatedCentreId,
                status: 'awaiting_confirmation',
                startDate: startDate ? new Date(startDate) : null,
                fundingTypes: funding?.types ?? [],
                fundingOther: funding?.other ?? null,
                hasSpecialNeeds: specialNeeds?.has ?? false,
                specialNeedsDetails: specialNeeds?.details ?? null,
                emergencyContactName: emergencyContact?.name ?? null,
                emergencyContactPhone: emergencyContact?.phone ?? null,
                emergencyContactRelationship: emergencyContact?.relationship ?? null,
                termsAgreed: termsAgreed ?? false,
                parentSignature: parentSignature ?? null,
            }).returning();
            
            registration = reg;
 
            // ── 3. Process each parent — match or create ─────────────────────
            for (const p of submittedParents) {
                let matched = false;
                let parentId: string;
 
                if (p.email) {
                    const existingBefore = await tx.query.parents.findFirst({
                        where: and(
                            ilike(parents.email, p.email.trim()),
                            eq(parents.organisationId, org.id)
                        ),
                        columns: { id: true }
                    });
                    matched = !!existingBefore;

                    const resolvedParent = await resolveOrCreateParent(tx, {
                        firstName: p.firstName,
                        lastName: p.lastName,
                        email: p.email,
                        phone: p.phone,
                        relationship: p.relationship,
                        addressLine1: p.addressLine1,
                        addressLine2: p.addressLine2,
                        city: p.city,
                        postcode: p.postcode,
                    }, org.id);
                    parentId = resolvedParent.id;
                } else {
                    const [newParent] = await tx.insert(parents).values({
                        firstName: p.firstName,
                        lastName: p.lastName,
                        email: null,
                        phone: p.phone,
                        organisationId: org.id,
                        preferredContact: 'phone',
                        relationship: (p.relationship ?? null) as any,
                    }).returning();
                    parentId = newParent.id;
                }
 
                resolvedParents.push({ parentId, wasMatched: matched, data: p });
 
                await tx.insert(registrationParents).values({
                    registrationId: reg.id,
                    parentId,
                    isPrimary: resolvedParents.length === 1,
                    submittedFirstName: p.firstName,
                    submittedLastName: p.lastName,
                    submittedEmail: p.email ?? null,
                    submittedPhone: p.phone ?? null,
                    submittedRelationship: p.relationship ?? null,
                    wasMatched: matched,
                });
            }
 
            // ── 4. Process each child — match or create ──────────────────────
            const primaryParentId = resolvedParents[0]?.parentId;
 
            for (const c of submittedChildren) {
                let childMatched = false;
                let childId: string | null = null;
 
                if (c.firstName && c.lastName && primaryParentId) {
                    const existing = await tx.query.children.findFirst({
                        where: and(
                            ilike(children.firstName, c.firstName.trim()),
                            ilike(children.lastName, c.lastName.trim()),
                            eq(children.parentId, primaryParentId)
                        ),
                        columns: { id: true }
                    });
                    childMatched = !!existing;

                    const child = await resolveOrCreateChild(tx, {
                        firstName: c.firstName,
                        lastName: c.lastName,
                        parentId: primaryParentId,
                        organisationId: org.id,
                        centreId: validatedCentreId,
                        dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
                        schoolYear: c.schoolYear || 'Unknown',
                        notes: specialNeeds?.details || null,
                        sessions: (c.sessions?.length ?? 0) > 0 ? c.sessions : null,
                        systemNoteContent: specialNeeds?.details ? `Special Needs (from Registration): ${specialNeeds.details}` : null,
                    });
                    childId = child.id;
                }
 
                await tx.insert(registrationChildren).values({
                    registrationId: reg.id,
                    childId,
                    submittedFirstName: c.firstName,
                    submittedLastName: c.lastName,
                    submittedDateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
                    submittedSchoolYear: c.schoolYear ?? null,
                    submittedSessions: (c.sessions?.length ?? 0) > 0 ? c.sessions : null,
                    wasMatched: childMatched,
                });
            }
        });

        // ── 5. Send confirmation email to primary parent ─────────────────
        const primaryParent = submittedParents[0];
        if (primaryParent?.email) {
            await emailService.sendRegistrationConfirmation({
                orgName: org.name,
                centreName,
                startDate: startDate ? new Date(startDate) : null,
                parents: submittedParents.map((p: any) => ({
                    firstName: p.firstName,
                    lastName: p.lastName,
                    relationship: p.relationship ?? 'Parent',
                    phone: p.phone,
                    email: p.email ?? undefined,
                    addressLine1: p.addressLine1 ?? undefined,
                    addressLine2: p.addressLine2 ?? undefined,
                    city: p.city ?? undefined,
                    postcode: p.postcode ?? undefined,
                })),
                children: submittedChildren.map((c: any) => ({
                    firstName: c.firstName,
                    lastName: c.lastName,
                    dateOfBirth: c.dateOfBirth,
                    schoolYear: c.schoolYear,
                    sessions: c.sessions ?? [],
                })),
                emergencyContact: {
                    name: emergencyContact?.name ?? 'Not specified',
                    relationship: emergencyContact?.relationship ?? 'Not specified',
                    phone: emergencyContact?.phone ?? 'Not specified',
                },
                funding: {
                    type: funding?.types?.[0] ?? 'self_funded',
                    other: funding?.other ?? undefined,
                },
                specialNeeds: {
                    has: specialNeeds?.has ?? false,
                    details: specialNeeds?.details ?? undefined,
                },
                parentSignature: parentSignature ?? null,
            });
        }

        return NextResponse.json({ success: true, registrationId: registration.id }, { status: 201 });
    } catch (err) {
        console.error('[Registration] Error:', err);
        return NextResponse.json({ error: 'Failed to submit registration' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    // ── 1. Authentication — stop trusting the orgId query param ────────────
    // Previously any caller who knew an orgId could enumerate all registrations.
    // Now we derive the org from the authenticated session exclusively.
    const session = await auth();
    if (!session?.user?.organisationId) {
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const orgId = session.user.organisationId;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // ── 2. Centre-level restriction for non-ORG_OWNER users ─────────────────
    // ORG_OWNER sees all registrations for their org.
    // MANAGER / FRONT_DESK / TUTOR see only registrations for their centres.
    const userRole = (session.user as any).role as string | undefined;

    let results;
    if (userRole === 'ORG_OWNER') {
        results = await db.query.registrations.findMany({
            where: status
                ? and(eq(registrations.organisationId, orgId), eq(registrations.status, status as any))
                : eq(registrations.organisationId, orgId),
            with: {
                registrationChildren: true,
                registrationParents: true,
            },
            orderBy: (r, { desc }) => [desc(r.createdAt)],
        });
    } else {
        // Non-owners: restrict to registrations whose centreId is in their
        // accessible set. Registrations with centreId = null are excluded
        // because no centre membership can cover them.
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (accessibleCentreIds.length === 0) {
            return NextResponse.json([]);
        }
        const centreCondition = inArray(registrations.centreId, accessibleCentreIds);
        results = await db.query.registrations.findMany({
            where: status
                ? and(
                    eq(registrations.organisationId, orgId),
                    centreCondition,
                    eq(registrations.status, status as any)
                  )
                : and(
                    eq(registrations.organisationId, orgId),
                    centreCondition
                  ),
            with: {
                registrationChildren: true,
                registrationParents: true,
            },
            orderBy: (r, { desc }) => [desc(r.createdAt)],
        });
    }

    return NextResponse.json(results);
}
