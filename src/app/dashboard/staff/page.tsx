/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { db } from '@/db';
import { users, centreMemberships, centres, staffInvites, orgMemberships, verificationTokens } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { UserPlus, Crown, Briefcase, MonitorSmartphone, GraduationCap } from 'lucide-react';
import type { Metadata } from 'next';
import { logger } from '@/lib/logger';
import HeaderPortal from '@/components/dashboard/HeaderPortal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import StaffDashboardClient from './StaffDashboardClient';
import { ROLE_LABELS, ROLE_AVATAR_COLORS } from '@/lib/staff-constants';

export const metadata: Metadata = {
    title: 'Staff Management',
    description: 'Manage your team, roles, and centre assignments.',
};

const ROLE_ICONS: Record<string, any> = {
    ORG_OWNER: Crown,
    MANAGER: Briefcase,
    FRONT_DESK: MonitorSmartphone,
    TUTOR: GraduationCap,
};

export default async function StaffPage() {
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    const orgId = session.user.organisationId;
    const userRole = (session.user as any)?.role;
    const isOwner = userRole === 'ORG_OWNER';

    let hasError = false;
    let orgCentres: any[] = [];
    let pendingInvites: any[] = [];
    let enrichedStaff: any[] = [];

    try {
        const [
            accessibleCentres,
            orgMemberRows,
            legacyUsers,
            memberships,
            ownerCentres,
            rawInvites,
        ] = await Promise.all([
            isOwner ? Promise.resolve([]) : getUserAccessibleCentres(session.user.id),
            db
                .select({
                    id: users.id,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    name: users.name,
                    email: users.email,
                    role: orgMemberships.role,
                    createdAt: users.createdAt,
                    lastLoginAt: (users as any).lastLoginAt ?? users.updatedAt,
                })
                .from(orgMemberships)
                .innerJoin(users, eq(orgMemberships.userId, users.id))
                .where(eq(orgMemberships.organisationId, orgId)),
            db
                .select({
                    id: users.id,
                    firstName: users.firstName,
                    lastName: users.lastName,
                    name: users.name,
                    email: users.email,
                    role: users.role,
                    createdAt: users.createdAt,
                    lastLoginAt: (users as any).lastLoginAt ?? users.updatedAt,
                })
                .from(users)
                .where(eq(users.organisationId, orgId))
                .orderBy(desc(users.createdAt)),
            db
                .select({
                    userId: centreMemberships.userId,
                    centreId: centreMemberships.centreId,
                    centreName: centres.name,
                })
                .from(centreMemberships)
                .innerJoin(centres, eq(centreMemberships.centreId, centres.id))
                .where(eq(centres.organisationId, orgId)),
            isOwner
                ? db
                    .select({ id: centres.id, name: centres.name })
                    .from(centres)
                    .where(eq(centres.organisationId, orgId))
                    .orderBy(centres.name)
                : Promise.resolve([]),
            db
                .select({
                    id: staffInvites.id,
                    email: staffInvites.email,
                    role: staffInvites.role,
                    token: staffInvites.token,
                    expiresAt: staffInvites.expiresAt,
                    usedAt: staffInvites.usedAt,
                    createdAt: staffInvites.createdAt,
                })
                .from(staffInvites)
                .where(eq(staffInvites.organisationId, orgId))
                .orderBy(desc(staffInvites.createdAt)),
        ]);

        const accessibleCentreIds = new Set(accessibleCentres.map((c: any) => c.id));
        orgCentres = isOwner
            ? ownerCentres
            : accessibleCentres.map((c: any) => ({ id: c.id, name: c.name }));

        // Merge orgMemberships (authoritative role per org) with any legacy single-org user rows
        const staffById = new Map<string, any>();
        for (const row of orgMemberRows) {
            staffById.set(row.id, row);
        }
        for (const row of legacyUsers) {
            if (!staffById.has(row.id)) {
                staffById.set(row.id, row);
            }
        }
        const staffList = Array.from(staffById.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const membershipMap: Record<string, { centreId: string; centreName: string }[]> = {};
        for (const m of memberships) {
            if (!membershipMap[m.userId]) membershipMap[m.userId] = [];
            membershipMap[m.userId].push({ centreId: m.centreId, centreName: m.centreName });
        }

        enrichedStaff = staffList.map(s => ({
            ...s,
            displayName: s.firstName && s.lastName
                ? `${s.firstName} ${s.lastName}`
                : (s.name ?? s.email),
            centres: membershipMap[s.id] ?? [],
        }));

        let scopedInvites = rawInvites;
        if (!isOwner) {
            enrichedStaff = enrichedStaff.filter(s =>
                s.role === 'ORG_OWNER' ||
                s.id === session.user.id ||
                s.centres.some((c: { centreId: string }) => accessibleCentreIds.has(c.centreId))
            );

            const unusedInvites = rawInvites.filter(i => !i.usedAt && i.role !== 'ORG_OWNER' && i.token);
            if (unusedInvites.length > 0 && accessibleCentreIds.size > 0) {
                const identifiers = unusedInvites.map(i => `invite-centre:${i.token}`);
                const tokenRows = await db
                    .select({
                        identifier: verificationTokens.identifier,
                        token: verificationTokens.token,
                    })
                    .from(verificationTokens)
                    .where(inArray(verificationTokens.identifier, identifiers));

                const inviteCentreByIdentifier = new Map<string, string>();
                for (const tr of tokenRows) {
                    const parts = String(tr.token || '').split(':');
                    if (parts[1]) inviteCentreByIdentifier.set(tr.identifier, parts[1]);
                }

                scopedInvites = unusedInvites.filter(i => {
                    const boundCentreId = inviteCentreByIdentifier.get(`invite-centre:${i.token}`);
                    return Boolean(boundCentreId && accessibleCentreIds.has(boundCentreId));
                });
            } else {
                scopedInvites = [];
            }
        }

        // Never serialize token hashes into the client payload
        pendingInvites = scopedInvites.map(({ id, email, role, expiresAt, usedAt, createdAt }) => ({
            id,
            email,
            role,
            expiresAt,
            usedAt,
            createdAt,
        }));
    } catch (e: any) {
        logger.error("Error fetching staff data", e);
        hasError = true;
    }

    const pendingUnused = pendingInvites.filter(i => !i.usedAt);

    return (
        <div className="space-y-6">
            <HeaderPortal targetId="header-left">
                <div className="flex items-center gap-2">
                    <h1 className="text-page-title text-text">Staff</h1>
                    <span className="px-2 py-0.5 rounded-sm bg-page border border-border-subtle text-text-muted text-xs font-medium">
                        {enrichedStaff.length}
                    </span>
                </div>
            </HeaderPortal>

            <HeaderPortal targetId="header-right-actions">
                <Button asChild>
                    <Link href="/dashboard/staff/invite">
                        <UserPlus className="w-3.5 h-3.5" />
                        Invite Staff
                    </Link>
                </Button>
            </HeaderPortal>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR'] as const).map(role => {
                    const count = enrichedStaff.filter(s => s.role === role).length;
                    const Icon = ROLE_ICONS[role];
                    return (
                        <Card key={role}>
                            <div className="p-4 flex items-center gap-3">
                                <span className={`flex size-9 shrink-0 items-center justify-center rounded-md ${ROLE_AVATAR_COLORS[role]}`}>
                                    <Icon className="w-4 h-4" />
                                </span>
                                <div>
                                    <p className="text-financial-total text-text">{count}</p>
                                    <p className="text-metadata">{ROLE_LABELS[role]}</p>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <StaffDashboardClient
                staff={enrichedStaff}
                pendingInvites={pendingUnused}
                orgCentres={orgCentres}
                currentUserId={session.user.id}
                error={hasError}
            />
        </div>
    );
}
