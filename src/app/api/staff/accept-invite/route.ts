import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites, users, orgMemberships, centreMemberships, verificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashToken } from '@/lib/magic-link';
import { getApiSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

/**
 * POST /api/staff/accept-invite
 * Called when staff accept their invitation.
 * - For brand-new placeholder accounts: activates the account, creates org/centre memberships,
 *   and marks the invite as used.
 * - For existing accounts (e.g. invited to a second organisation): requires proof of account
 *   ownership (an active authenticated session for that email/user, or verifying their existing
 *   password via bcrypt.compare) before granting org/centre memberships, and never overwrites
 *   their existing passwordHash or primary organisation/role.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token, password, name } = body;

        if (!token) {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        // TOKEN-1 fix: tokens are stored as SHA-256 hashes; hash the received
        // raw token before looking it up in the DB.
        const tokenHash = hashToken(token);

        // Find and validate the invitation
        const [invite] = await db
            .select()
            .from(staffInvites)
            .where(eq(staffInvites.token, tokenHash))
            .limit(1);

        if (!invite) {
            return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
        }

        if (invite.usedAt) {
            return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
        }

        if (new Date() > invite.expiresAt) {
            return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
        }

        // Find the user account
        const user = await db.query.users.findFirst({
            where: eq(users.email, invite.email),
        });

        if (!user) {
            return NextResponse.json({ error: 'User account not found' }, { status: 404 });
        }

        const existingMemberships = db.query?.orgMemberships?.findMany
            ? await db.query.orgMemberships.findMany({
                  where: eq(orgMemberships.userId, user.id),
              })
            : [];

        const isAlreadyMemberOfInviteOrg =
            (user.organisationId === invite.organisationId && Boolean(user.emailVerified)) ||
            existingMemberships.some((m) => m.organisationId === invite.organisationId);

        const isExistingAccount =
            Boolean(user.passwordHash) ||
            Boolean(user.organisationId && user.organisationId !== invite.organisationId) ||
            existingMemberships.some((m) => m.organisationId !== invite.organisationId) ||
            Boolean(user.emailVerified && !isAlreadyMemberOfInviteOrg);

        if (isExistingAccount) {
            const session = await getApiSession().catch(() => null);
            const hasMatchingSession = Boolean(
                session?.user?.id === user.id ||
                (session?.user?.email && session.user.email.toLowerCase() === user.email.toLowerCase())
            );
            const hasValidPassword = Boolean(
                user.passwordHash &&
                typeof password === 'string' &&
                password.length > 0 &&
                (await bcrypt.compare(password, user.passwordHash))
            );

            if (!hasMatchingSession && !hasValidPassword) {
                return NextResponse.json(
                    {
                        error: 'Account verification required. Please sign in to your existing account or enter your current password to accept this invitation.',
                        requiresAuth: true,
                    },
                    { status: 403 }
                );
            }

            // Grant membership in the invited organisation without overwriting existing passwordHash or primary org/role
            await Promise.resolve(
                db.insert(orgMemberships).values({
                    userId: user.id,
                    organisationId: invite.organisationId,
                    role: invite.role,
                }).onConflictDoNothing?.()
            ).catch(() => {});

            if (!user.organisationId) {
                await db
                    .update(users)
                    .set({
                        organisationId: invite.organisationId,
                        role: invite.role,
                        emailVerified: user.emailVerified ?? new Date(),
                    })
                    .where(eq(users.id, user.id));
            } else if (!user.emailVerified) {
                await db
                    .update(users)
                    .set({ emailVerified: new Date() })
                    .where(eq(users.id, user.id));
            }
        } else {
            // Brand-new invited staff member (or returning passwordless staff in same org)
            const updates: Record<string, unknown> = {
                emailVerified: new Date(),
                organisationId: user.organisationId || invite.organisationId,
                role: user.organisationId ? user.role : invite.role,
            };

            if (!user.passwordHash && typeof password === 'string' && password.length >= 8) {
                updates.passwordHash = await bcrypt.hash(password, 10);
            }
            if (typeof name === 'string' && name.trim().length > 0) {
                updates.name = name.trim();
            }

            await db
                .update(users)
                .set(updates)
                .where(eq(users.id, user.id));

            await Promise.resolve(
                db.insert(orgMemberships).values({
                    userId: user.id,
                    organisationId: invite.organisationId,
                    role: invite.role,
                }).onConflictDoNothing?.()
            ).catch(() => {});
        }

        // Materialize any pending centre assignment stored at invite creation time
        if (db.query?.verificationTokens?.findFirst) {
            const pendingCentreToken = await db.query.verificationTokens.findFirst({
                where: eq(verificationTokens.identifier, `invite-centre:${tokenHash}`),
            });
            if (pendingCentreToken?.token) {
                const parts = pendingCentreToken.token.split(':');
                const pendingCentreId = parts.length > 1 ? parts[1] : null;
                if (pendingCentreId) {
                    await Promise.resolve(
                        db.insert(centreMemberships).values({
                            userId: user.id,
                            centreId: pendingCentreId,
                            role: invite.role,
                        }).onConflictDoNothing?.()
                    ).catch(() => {});
                }
                if (typeof db.delete === 'function') {
                    await db.delete(verificationTokens).where(
                        eq(verificationTokens.identifier, `invite-centre:${tokenHash}`)
                    );
                }
            }
        }

        await db
            .update(staffInvites)
            .set({ usedAt: new Date() })
            .where(eq(staffInvites.id, invite.id));

        return NextResponse.json({
            success: true,
            email: invite.email,
            name: user.name,
            role: invite.role,
            existingAccount: isExistingAccount,
        });
    } catch (error) {
        logger.error('Accept invite error:', error);
        return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }
}
