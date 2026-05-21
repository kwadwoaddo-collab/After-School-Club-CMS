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

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
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

        // ── 3. Create the top-level registration record ──────────────────
        const [registration] = await db.insert(registrations).values({
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
        }).returning();

        // ── 3. Process each parent — match or create ─────────────────────
        const resolvedParents: { parentId: string; wasMatched: boolean; data: any }[] = [];

        for (const p of submittedParents) {
            let matched = false;
            let parentId: string;

            if (p.email) {
                const existing = await db.query.parents.findFirst({
                    where: and(
                        ilike(parents.email, p.email.trim()),
                        eq(parents.organisationId, org.id)
                    ),
                });

                if (existing) {
                    matched = true;
                    parentId = existing.id;
                    // Enrich existing record with new address/relationship info if missing
                    await db.update(parents).set({
                        relationship: p.relationship ?? existing.relationship,
                        addressLine1: p.addressLine1 ?? existing.addressLine1,
                        addressLine2: p.addressLine2 ?? existing.addressLine2,
                        city: p.city ?? existing.city,
                        postcode: p.postcode ?? existing.postcode,
                        updatedAt: new Date(),
                    }).where(eq(parents.id, existing.id));
                } else {
                    const [newParent] = await db.insert(parents).values({
                        firstName: p.firstName,
                        lastName: p.lastName,
                        email: p.email,
                        phone: p.phone,
                        organisationId: org.id,
                        preferredContact: 'email',
                        relationship: p.relationship ?? null,
                        addressLine1: p.addressLine1 ?? null,
                        addressLine2: p.addressLine2 ?? null,
                        city: p.city ?? null,
                        postcode: p.postcode ?? null,
                    }).returning();
                    parentId = newParent.id;
                }
            } else {
                const [newParent] = await db.insert(parents).values({
                    firstName: p.firstName,
                    lastName: p.lastName,
                    email: null,
                    phone: p.phone,
                    organisationId: org.id,
                    preferredContact: 'phone',
                    relationship: p.relationship ?? null,
                }).returning();
                parentId = newParent.id;
            }

            resolvedParents.push({ parentId, wasMatched: matched, data: p });

            await db.insert(registrationParents).values({
                registrationId: registration.id,
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
            let matched = false;
            let childId: string | null = null;

            if (c.firstName && c.lastName && primaryParentId) {
                const existing = await db.query.children.findFirst({
                    where: and(
                        ilike(children.firstName, c.firstName.trim()),
                        ilike(children.lastName, c.lastName.trim()),
                        eq(children.parentId, primaryParentId)
                    ),
                });

                if (existing) {
                    matched = true;
                    childId = existing.id;
                    await db.update(children).set({
                        dateOfBirth: existing.dateOfBirth ?? (c.dateOfBirth ? new Date(c.dateOfBirth) : null),
                        schoolYear: c.schoolYear ?? existing.schoolYear,
                        notes: specialNeeds?.details
                            ? (existing.notes ? `${existing.notes}\n${specialNeeds.details}` : specialNeeds.details)
                            : existing.notes,
                        source: 'both',
                        isRegistered: true,
                        registeredAt: new Date(),
                        registeredSessions: c.sessions?.length > 0 ? c.sessions : null,
                        updatedAt: new Date(),
                    }).where(eq(children.id, existing.id));
                } else {
                    const [newChild] = await db.insert(children).values({
                        parentId: primaryParentId,
                        organisationId: org.id,
                        centreId: validatedCentreId,
                        firstName: c.firstName,
                        lastName: c.lastName,
                        dateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
                        schoolYear: c.schoolYear ?? 'Unknown',
                        notes: specialNeeds?.details ?? null,
                        source: 'registration',
                        isRegistered: true,
                        registeredAt: new Date(),
                        registeredSessions: c.sessions?.length > 0 ? c.sessions : null,
                    }).returning();
                    childId = newChild.id;
                }
            }

            await db.insert(registrationChildren).values({
                registrationId: registration.id,
                childId,
                submittedFirstName: c.firstName,
                submittedLastName: c.lastName,
                submittedDateOfBirth: c.dateOfBirth ? new Date(c.dateOfBirth) : null,
                submittedSchoolYear: c.schoolYear ?? null,
                submittedSessions: c.sessions?.length > 0 ? c.sessions : null,
                wasMatched: matched,
            });

            // If special needs were provided, create an initial 'System' internal note for each child
            if (specialNeeds?.details && childId) {
                await db.insert(studentNotes).values({
                    childId,
                    content: `Special Needs (from Registration): ${specialNeeds.details}`,
                    authorName: 'System',
                    category: 'General',
                });
            }
        }

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
