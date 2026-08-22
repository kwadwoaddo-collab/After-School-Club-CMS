/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { users, centreMemberships, centres, staffInvites } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
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
    // Only ORG_OWNER can manage staff — see project-notes/milestone-3c-staff-audit.md §5.
    const { session } = await requireAuth({ roles: ['ORG_OWNER'] });

    const orgId = session.user.organisationId;

    let hasError = false;
    let staffList: any[] = [];
    let memberships: any[] = [];
    let orgCentres: any[] = [];
    let pendingInvites: any[] = [];
    let enrichedStaff: any[] = [];

    try {
        // Fetch all staff in the org
        staffList = await db
            .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                name: users.name,
                email: users.email,
                role: users.role,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.organisationId, orgId))
            .orderBy(desc(users.createdAt));

        // Fetch centre memberships for all staff
        memberships = await db
            .select({
                userId: centreMemberships.userId,
                centreId: centreMemberships.centreId,
                centreName: centres.name,
            })
            .from(centreMemberships)
            .innerJoin(centres, eq(centreMemberships.centreId, centres.id))
            .where(eq(centres.organisationId, orgId));

        // Fetch all org centres (for reassignment UI)
        orgCentres = await db
            .select({ id: centres.id, name: centres.name })
            .from(centres)
            .where(eq(centres.organisationId, orgId))
            .orderBy(centres.name);

        // Fetch pending invites (unused only)
        pendingInvites = await db
            .select({
                id: staffInvites.id,
                email: staffInvites.email,
                role: staffInvites.role,
                expiresAt: staffInvites.expiresAt,
                usedAt: staffInvites.usedAt,
                createdAt: staffInvites.createdAt,
            })
            .from(staffInvites)
            .where(eq(staffInvites.organisationId, orgId))
            .orderBy(desc(staffInvites.createdAt));

        // Group memberships by userId
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

            {/* Role-count stat cards */}
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
