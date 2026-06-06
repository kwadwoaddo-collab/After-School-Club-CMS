import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, staffInvites, organisations, centres, centreMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/services/email';
import { z } from 'zod';
import { strictRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

const inviteSchema = z.object({
    email: z.string().email().max(255),
    role: z.enum(['MANAGER', 'FRONT_DESK', 'TUTOR']),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    centreId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit: 5 invites per minute per IP to prevent invite spam
        const ip = getClientIP(request);
        const { success: allowed } = await checkRateLimit(strictRateLimit, `staff-invite:${ip}`);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many invite requests. Please try again later.' },
                { status: 429 }
            );
        }

        // Check if user is ORG_OWNER
        const [currentUser] = await db
            .select()
            .from(users)
            .where(eq(users.id, session.user.id))
            .limit(1);

        if (!currentUser || currentUser.role !== 'ORG_OWNER') {
            return NextResponse.json(
                { error: 'Only organization owners can invite staff' },
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
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { email, role, firstName, lastName, centreId } = parsed.data;


        // Check if user already exists
        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'A user with this email already exists' },
                { status: 409 }
            );
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

        // Create the user account immediately (no password - magic link only)
        const fullName = `${firstName} ${lastName}`.trim();
        const [newUser] = await db.insert(users).values({
            email,
            firstName,
            lastName,
            name: fullName,
            role,
            organisationId: session.user.organisationId,
            emailVerified: null,
        }).returning({ id: users.id });

        // If a centre was selected, assign the user to it immediately
        if (centreId && newUser?.id) {
            await db.insert(centreMemberships).values({
                centreId,
                userId: newUser.id,
                role,
            });
        }

        // Generate invite token (magic link)
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        // Create invite record
        await db.insert(staffInvites).values({
            organisationId: session.user.organisationId,
            email,
            role,
            token,
            expiresAt,
        });

        // Get base URL from request
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;
        const inviteLink = `${baseUrl}/accept-invite?token=${token}`;

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
                console.error('[Staff Invite] Email failed:', result.error);
            }
        } catch (emailError) {
            console.error('[Staff Invite] Email exception:', emailError);
        }

        return NextResponse.json({
            message: 'Invitation sent successfully',
            inviteLink,
            emailSent,
        });
    } catch (error) {
        console.error('Staff invite error:', error);
        return NextResponse.json(
            { error: 'Failed to send invitation' },
            { status: 500 }
        );
    }
}
