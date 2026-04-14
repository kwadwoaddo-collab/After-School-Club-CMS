import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
    organisations, parents, children,
    registrations, registrationChildren, registrationParents,
    studentNotes,
} from '@/db/schema';
import { eq, and, ilike } from 'drizzle-orm';
import { emailService } from '@/lib/services/email';

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

        // ── 2. Create the top-level registration record ──────────────────
        const [registration] = await db.insert(registrations).values({
            organisationId: org.id,
            centreId: centreId ?? null,
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
                parentName: primaryParent.firstName,
                parentEmail: primaryParent.email,
                orgName: org.name,
                children: submittedChildren.map((c: any) => ({
                    firstName: c.firstName,
                    lastName: c.lastName,
                    schoolYear: c.schoolYear,
                })),
                startDate: startDate ? new Date(startDate) : null,
                fundingTypes: funding?.types ?? [],
            });
        }

        return NextResponse.json({ success: true, registrationId: registration.id }, { status: 201 });
    } catch (err) {
        console.error('[Registration] Error:', err);
        return NextResponse.json({ error: 'Failed to submit registration' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const status = searchParams.get('status');

    if (!orgId) {
        return NextResponse.json({ error: 'orgId required' }, { status: 400 });
    }

    const results = await db.query.registrations.findMany({
        where: status
            ? and(eq(registrations.organisationId, orgId), eq(registrations.status, status as any))
            : eq(registrations.organisationId, orgId),
        with: {
            registrationChildren: true,
            registrationParents: true,
        },
        orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    return NextResponse.json(results);
}
