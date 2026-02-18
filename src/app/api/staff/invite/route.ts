import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, staffInvites, organisations, centres, centreMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { emailService } from '@/lib/services/email';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        const body = await request.json();
        const { email, role, firstName, lastName, centreId } = body;

        // Validate input
        if (!email || !role || !firstName || !lastName) {
            return NextResponse.json(
                { error: 'Email, role, first name and last name are required' },
                { status: 400 }
            );
        }

        if (!['MANAGER', 'FRONT_DESK', 'TUTOR'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

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
