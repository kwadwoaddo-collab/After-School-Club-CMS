import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, centreMemberships, centres, staffInvites } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import StaffDashboardClient from './StaffDashboardClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Staff Management',
    description: 'Manage your team, roles, and centre assignments.',
};

export default async function StaffPage() {
    const session = await auth();
    if (!session?.user?.organisationId) redirect('/onboarding');

    const orgId = session.user.organisationId;
    const userRole = (session.user as any).role as string;

    // Only ORG_OWNER can manage staff
    if (userRole !== 'ORG_OWNER') {
        redirect('/dashboard');
    }

    // Fetch all staff in the org
    const staffList = await db
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
    const memberships = await db
        .select({
            userId: centreMemberships.userId,
            centreId: centreMemberships.centreId,
            centreName: centres.name,
        })
        .from(centreMemberships)
        .innerJoin(centres, eq(centreMemberships.centreId, centres.id))
        .where(eq(centres.organisationId, orgId));

    // Fetch all org centres (for reassignment UI)
    const orgCentres = await db
        .select({ id: centres.id, name: centres.name })
        .from(centres)
        .where(eq(centres.organisationId, orgId))
        .orderBy(centres.name);

    // Fetch pending invites (unused only)
    const pendingInvites = await db
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

    const enrichedStaff = staffList.map(s => ({
        ...s,
        displayName: s.firstName && s.lastName
            ? `${s.firstName} ${s.lastName}`
            : (s.name ?? s.email),
        centres: membershipMap[s.id] ?? [],
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">
                        Staff Management
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium">
                        {enrichedStaff.length} team member{enrichedStaff.length !== 1 ? 's' : ''} · {pendingInvites.filter(i => !i.usedAt).length} pending invite{pendingInvites.filter(i => !i.usedAt).length !== 1 ? 's' : ''}
                    </p>
                </div>
            </header>

            <StaffDashboardClient
                staff={enrichedStaff}
                pendingInvites={pendingInvites.filter(i => !i.usedAt)}
                orgCentres={orgCentres}
                currentUserId={session.user.id}
            />
        </div>
    );
}
