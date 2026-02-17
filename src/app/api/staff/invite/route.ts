import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, staffInvites, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

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
        const { email, role, firstName, lastName } = body;

        // Validate input
        if (!email || !role) {
            return NextResponse.json(
                { error: 'Email and role are required' },
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

        // Generate invite token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        // Create invite
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

        // Send invitation email
        try {
            const { emailService } = await import('@/lib/services/email');

            // Get organisation name
            const org = await db.query.organisations.findFirst({
                where: eq(organisations.id, session.user.organisationId),
            });

            const result = await emailService.sendStaffInvitation({
                email,
                role,
                inviteLink,
                organisationName: org?.name || 'our organization',
                inviterName: currentUser.firstName || currentUser.name || 'Your colleague',
            });

            if (!result.success) {
                console.warn('[Staff Invite] Email sending failed:', result.error);
                // Don't fail the request - invite is created, email failure is non-critical
            } else {
                console.log(`[Staff Invite] Invitation email sent successfully to ${email}`);
            }
        } catch (emailError) {
            console.error('[Staff Invite] Error sending email:', emailError);
            // Don't fail the request - invite is created, email failure is non-critical
        }

        return NextResponse.json({
            message: 'Invitation sent successfully',
            inviteLink,
        });
    } catch (error) {
        console.error('Staff invite error:', error);
        return NextResponse.json(
            { error: 'Failed to send invitation' },
            { status: 500 }
        );
    }
}
