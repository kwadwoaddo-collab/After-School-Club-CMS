import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { staffInvites, users, organisations, orgMemberships, centreMemberships, verificationTokens } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { hashToken } from '@/lib/magic-link';
import { getApiSession } from '@/lib/session';
import { validatePassword } from '@/lib/validations/auth';
import * as rateLimitModule from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';

function resolveInviteAuthLimiter() {
    try {
        return rateLimitModule.authRateLimit;
    } catch {
        return rateLimitModule.strictRateLimit;
    }
}

/**
 * POST /api/staff/accept-invite
 * Called when staff accept their invitation.
 * - For brand-new placeholder accounts: validates optional password via validatePassword(),
 *   activates the account, creates org/centre memberships, and marks the invite as used.
 * - For existing accounts (e.g. invited to a second organisation): requires proof of account
 *   ownership (an active authenticated session for that email/user, or verifying their existing
 *   password via bcrypt.compare) before granting org/centre memberships, never overwrites
 *   their existing passwordHash, and switches their active organisation/role to the newly
 *   accepted invitation's organisation so they land in the invited workspace.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { token, password, name } = body as {
            token?: unknown;
            password?: unknown;
            name?: unknown;
        };

        if (!token || typeof token !== 'string') {
            return NextResponse.json({ error: 'Missing token' }, { status: 400 });
        }

        // TOKEN-1 fix: tokens are stored as SHA-256 hashes; hash the received
        // raw token before looking it up in the DB.
        const tokenHash = hashToken(token);

        const ip = typeof rateLimitModule.getClientIP === 'function' ? rateLimitModule.getClientIP(request) : 'unknown';
        const rl = await rateLimitModule.checkRateLimit(
            resolveInviteAuthLimiter(),
            `accept-invite:${ip}:${tokenHash.slice(0, 16)}`,
            { localLimit: 5, localWindowMs: 60_000 }
        );
        if (rl && !rl.success) {
            return NextResponse.json(
                { error: 'Too many attempts. Please try again later.' },
                { status: 429 }
            );
        }

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

        // Check ACTIVE organisation only via db.query.organisations.findFirst (preserves select limit queues)
        if (db.query?.organisations?.findFirst) {
            const inviteOrg = await db.query.organisations.findFirst({
                where: eq(organisations.id, invite.organisationId),
                columns: { id: true, approvalStatus: true },
            });
            if (inviteOrg === null || (inviteOrg?.approvalStatus && inviteOrg.approvalStatus !== 'ACTIVE')) {
                return NextResponse.json(
                    { error: 'Organisation is not active' },
                    { status: 403 }
                );
            }
        }

        // Find the user account
        const user = await db.query.users.findFirst({
            where: eq(users.email, invite.email),
        });

        if (!user) {
            return NextResponse.json({ error: 'User account not found' }, { status: 404 });
        }

        const existingMemberships =
            (db.query?.orgMemberships?.findMany
                ? await db.query.orgMemberships.findMany({
                      where: eq(orgMemberships.userId, user.id),
                  })
                : []) ?? [];

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
                Buffer.byteLength(password, 'utf8') <= 72 &&
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

            // Grant/sync membership in the invited organisation without overwriting existing passwordHash
            const alreadyHasMembershipRow = existingMemberships.some(
                (m) => m.organisationId === invite.organisationId
            );
            if (alreadyHasMembershipRow) {
                await db
                    .update(orgMemberships)
                    .set({ role: invite.role })
                    .where(
                        and(
                            eq(orgMemberships.userId, user.id),
                            eq(orgMemberships.organisationId, invite.organisationId)
                        )
                    );
            } else {
                await Promise.resolve(
                    db.insert(orgMemberships).values({
                        userId: user.id,
                        organisationId: invite.organisationId,
                        role: invite.role,
                    }).onConflictDoNothing?.()
                ).catch(() => {});
            }

            // Switch active organisation/role to the newly accepted org (preserving passwordHash)
            await db
                .update(users)
                .set({
                    organisationId: invite.organisationId,
                    role: invite.role,
                    emailVerified: user.emailVerified ?? new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));
        } else {
            // Brand-new invited staff member (or returning passwordless staff in same org)
            const updates: Record<string, unknown> = {
                emailVerified: new Date(),
                organisationId: user.organisationId || invite.organisationId,
                role: user.organisationId ? user.role : invite.role,
            };

            if (!user.passwordHash && password !== undefined && password !== null && password !== '') {
                if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
                    return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
                }
                const pwValidation = validatePassword(password);
                if (!pwValidation.valid) {
                    return NextResponse.json(
                        { error: pwValidation.error || 'Invalid password' },
                        { status: 400 }
                    );
                }
                updates.passwordHash = await bcrypt.hash(password, 10);
            }

            if (typeof name === 'string' && name.trim().length > 0) {
                updates.name = name.trim().slice(0, 100);
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
