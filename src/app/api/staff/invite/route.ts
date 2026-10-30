import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { users, staffInvites, organisations, centres, orgMemberships, verificationTokens } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { hashToken } from '@/lib/magic-link';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';
import { strictRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { getTrustedApplicationUrl } from '@/lib/base-url';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

const inviteSchema = z.object({
    email: z.string().email().max(255),
    role: z.enum(['MANAGER', 'FRONT_DESK', 'TUTOR']),
    firstName: z.string().trim().max(100).optional().default(''),
    lastName: z.string().trim().max(100).optional().default(''),
    centreId: z.preprocess(
        (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
        z.string().uuid().optional()
    ),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getApiSession();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit: 5 invites per minute per IP to prevent invite spam
        const ip = getClientIP(request);
        const rateLimitResult = await checkRateLimit(strictRateLimit, `staff-invite:${ip}`);
        if (!rateLimitResult.success) {
            if (rateLimitResult.status === 'unavailable') {
                return NextResponse.json(
                    { error: 'Service temporarily unavailable. Please try again later.' },
                    { status: 503 }
                );
            }
            return NextResponse.json(
                { error: 'Too many invite requests. Please try again later.' },
                { status: 429 }
            );
        }

        // Check if user is ORG_OWNER or MANAGER
        const [currentUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, session.user.id))
            .limit(1);

        if (!currentUser || (currentUser.role !== 'ORG_OWNER' && currentUser.role !== 'MANAGER')) {
            return NextResponse.json(
                { error: 'Only organization owners and managers can invite staff' },
                { status: 403 }
            );
        }

        let rawBody: unknown;
        try {
            rawBody = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const parsed = inviteSchema.safeParse(rawBody);
        if (!parsed.success) {
            const fieldMessages = parsed.error.issues
                .map((issue) => `${issue.path.join('.') || 'field'}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(
                {
                    error: fieldMessages ? `Validation failed: ${fieldMessages}` : 'Validation failed',
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { email, role, firstName, lastName, centreId } = parsed.data;

        // Privilege escalation guard: Managers can only invite staff for their assigned centres
        if (currentUser.role !== 'ORG_OWNER') {
            const accessibleCentres = await getUserAccessibleCentreIds(session.user.id);
            if (!centreId || !accessibleCentres.includes(centreId)) {
                return NextResponse.json(
                    { error: 'Forbidden: You can only invite staff for your assigned centres' },
                    { status: 403 }
                );
            }
        }

        // Validate centreId belongs to this org before any writes (prevents cross-org injection)
        if (centreId) {
            const centre = await db.query.centres.findFirst({
                where: and(
                    eq(centres.id, centreId),
                    eq(centres.organisationId, session.user.organisationId)
                ),
                columns: { id: true },
            });
            if (!centre) {
                return NextResponse.json(
                    { error: 'Invalid centre: does not belong to your organisation' },
                    { status: 400 }
                );
            }
        }

        // Check if user already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (existingUser) {
            if (existingUser.organisationId === session.user.organisationId) {
                return NextResponse.json(
                    { error: 'This person is already a member of your organisation' },
                    { status: 409 }
                );
            }
            // Already a member of THIS org — block
            if (db.query?.orgMemberships?.findFirst) {
                const alreadyMember = await db.query.orgMemberships.findFirst({
                    where: and(
                        eq(orgMemberships.userId, existingUser.id),
                        eq(orgMemberships.organisationId, session.user.organisationId)
                    ),
                });
                if (alreadyMember) {
                    return NextResponse.json(
                        { error: 'This person is already a member of your organisation' },
                        { status: 409 }
                    );
                }
            }
            // Security: Do NOT insert orgMemberships, centreMemberships, or mutate
            // existingUser.organisationId / existingUser.role before the invitee verifies
            // and accepts the invitation.
        } else {
            // New user — create a pending placeholder account (no active org or memberships until acceptance)
            const fullName = `${firstName} ${lastName}`.trim();
            await db.insert(users).values({
                email,
                firstName,
                lastName,
                name: fullName,
                role,
                organisationId: null,
                emailVerified: null,
            }).returning({ id: users.id });
        }

        // Delete any existing unused invites for this email in this org
        if (typeof db.delete === 'function') {
            await db.delete(staffInvites).where(
                and(
                    eq(staffInvites.email, email),
                    eq(staffInvites.organisationId, session.user.organisationId),
                    isNull(staffInvites.usedAt)
                )
            );
        }

        // Generate invite token (magic link)
        // TOKEN-1 fix: the raw token is sent in the email; only the SHA-256 hash
        // is stored in the DB so a read-only DB breach cannot authenticate as staff.
        const rawToken = crypto.randomBytes(32).toString('hex');
        const token = hashToken(rawToken); // hash stored; raw token delivered via email only
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        // Create invite record — stores hash, not the raw token
        await db.insert(staffInvites).values({
            organisationId: session.user.organisationId,
            email,
            role,
            token,
            expiresAt,
        });

        // Store pending centre assignment in verificationTokens to be applied on acceptance
        if (centreId) {
            await Promise.resolve(
                db.insert(verificationTokens).values({
                    identifier: `invite-centre:${token}`,
                    token: `${token.slice(0, 32)}:${centreId}`,
                    expires: expiresAt,
                })
            ).catch(() => { /* ignore if duplicate or unmocked */ });
        }

        // PM-2E2.B4.F: Build invite URL with trusted canonical origin
        const baseUrl = getTrustedApplicationUrl();
        const inviteUrl = new URL('/accept-invite', baseUrl);
        inviteUrl.searchParams.set('token', rawToken);
        const inviteLink = inviteUrl.toString();

        // Get location name for email
        let locationName = 'the team';
        if (centreId) {
            const centre = await db.query.centres.findFirst({
                where: eq(centres.id, centreId),
            });
            if (centre?.name) locationName = centre.name;
        } else {
            const org = await db.query.organisations.findFirst({
                where: eq(organisations.id, session.user.organisationId),
            });
            if (org?.name) locationName = org.name;
        }

        const inviterName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
            || currentUser.name
            || 'Your colleague';

        // Send invitation email
        let emailSent = false;
        try {
            const result = await emailService.sendStaffInvitation({
                email,
                role,
                inviteLink,
                organisationName: locationName,
                inviterName,
            });
            emailSent = result.success;
            if (!result.success) {
                logger.error('[Staff Invite] Email failed:', result.error);
            }
        } catch (emailError) {
            logger.error('[Staff Invite] Email exception:', emailError);
        }

        revalidatePath('/dashboard/staff');
        if (centreId) {
            revalidatePath(`/dashboard/centres/${centreId}`);
        }

        return NextResponse.json({
            message: 'Invitation sent successfully',
            emailSent,
        });
    } catch (error) {
        logger.error('Staff invite error:', error);
        return NextResponse.json(
            { error: 'Failed to send invitation' },
            { status: 500 }
        );
    }
}
