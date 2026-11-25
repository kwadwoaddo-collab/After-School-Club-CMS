/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/db';
import { users, centres, orgMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ChevronLeft, Mail, MapPin, Calendar } from 'lucide-react';
import Link from 'next/link';
import StaffProfileForm from '@/features/staff/components/StaffProfileForm';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ROLE_LABELS, ROLE_AVATAR_COLORS } from '@/lib/staff-constants';

interface PageProps {
    params: Promise<{ userId: string }>;
}

export default async function EditStaffPage({ params }: PageProps) {
    // Auth MUST run before inspecting userId so unauthorized requests always redirect first
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });
    const { userId } = await params;

    if (!userId) {
        return notFound();
    }

    const userRole = (session.user as any)?.role;
    const isOwner = userRole === 'ORG_OWNER';
    const orgId = session.user.organisationId;

    const [
        staffMember,
        targetMembership,
        accessibleCentres,
        orgCentresForFilter,
        ownerRows,
    ] = await Promise.all([
        db.query.users.findFirst({
            where: eq(users.id, userId),
            with: { memberships: { with: { centre: true } } },
        }),
        db.query?.orgMemberships?.findFirst
            ? db.query.orgMemberships.findFirst({
                where: and(
                    eq(orgMemberships.userId, userId),
                    eq(orgMemberships.organisationId, orgId)
                ),
            })
            : Promise.resolve(null),
        isOwner
            ? db.query.centres.findMany({
                where: eq(centres.organisationId, orgId),
                orderBy: (centres, { asc }) => [asc(centres.name)],
            })
            : getUserAccessibleCentres(session.user.id),
        isOwner
            ? Promise.resolve([])
            : db.query.centres.findMany({
                where: eq(centres.organisationId, orgId),
                columns: { id: true },
            }),
        (db.query as any)?.orgMemberships?.findMany
            ? (db.query as any).orgMemberships.findMany({
                where: and(
                    eq(orgMemberships.organisationId, orgId),
                    eq(orgMemberships.role, 'ORG_OWNER')
                ),
            })
            : db
                .select({ id: users.id })
                .from(users)
                .where(and(eq(users.organisationId, orgId), eq(users.role, 'ORG_OWNER'))),
    ]);

    const belongsToOrg = Boolean(targetMembership) || staffMember?.organisationId === orgId;
    if (!staffMember || !belongsToOrg) {
        return redirect('/dashboard/staff');
    }

    const effectiveRole = targetMembership?.role ?? staffMember.role;

    if (!isOwner && effectiveRole === 'ORG_OWNER') {
        return redirect('/dashboard/staff');
    }

    const accessibleCentreIds = new Set((accessibleCentres ?? []).map((c: any) => c.id));
    const orgCentreIdSet = new Set(
        (isOwner ? accessibleCentres : orgCentresForFilter ?? []).map((c: any) => c.id)
    );

    const orgScopedMemberships = (staffMember.memberships ?? []).filter((m: any) => {
        if (m.centre?.organisationId) {
            return m.centre.organisationId === orgId;
        }
        return orgCentreIdSet.size > 0 ? orgCentreIdSet.has(m.centreId) : true;
    });

    // Non-owners may view themselves or staff assigned to at least one shared accessible centre
    if (!isOwner && staffMember.id !== session.user.id) {
        const hasSharedCentre = orgScopedMemberships.some((m: any) => accessibleCentreIds.has(m.centreId));
        if (!hasSharedCentre) {
            return redirect('/dashboard/staff');
        }
    }

    const allCentres = accessibleCentres;
    const ownerCount = Math.max(1, (ownerRows ?? []).length);
    const currentAssignments = orgScopedMemberships.map((m: any) => m.centreId);

    const initials = (() => {
        if (staffMember.firstName && staffMember.lastName) {
            return (staffMember.firstName[0] + staffMember.lastName[0]).toUpperCase();
        }
        if (staffMember.name) {
            const parts = staffMember.name.trim().split(' ').filter(Boolean);
            const raw = parts.map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            return raw.length === 1 ? raw + raw : raw;
        }
        return (staffMember.email || 'S').charAt(0).toUpperCase().repeat(2);
    })();

    const displayName = staffMember.firstName && staffMember.lastName
        ? `${staffMember.firstName} ${staffMember.lastName}`
        : staffMember.name || staffMember.email;

    return (
        <div className="max-w-4xl mx-auto space-y-5">
            <Link
                href="/dashboard/staff"
                className="group min-h-11 inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
            >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Back to staff
            </Link>

            <Card>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${ROLE_AVATAR_COLORS[effectiveRole] ?? 'bg-page text-text border border-border'}`}>
                        <span className="text-page-title select-none">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-page-title text-text truncate">{displayName}</h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <Badge>{ROLE_LABELS[effectiveRole] ?? effectiveRole}</Badge>
                            <span className="text-metadata flex items-center gap-1">
                                <Mail className="w-3 h-3" aria-hidden="true" />
                                {staffMember.email}
                            </span>
                        </div>
                    </div>

                    <div className="flex sm:flex-col gap-2 sm:min-w-[170px]">
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Centres
                            </span>
                            <span className="text-small-body font-semibold text-text">
                                {effectiveRole === 'ORG_OWNER' ? 'All' : orgScopedMemberships.length}
                            </span>
                        </div>
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Joined
                            </span>
                            <span className="text-small-body font-semibold text-text">
                                {format(new Date(staffMember.createdAt), 'd MMM yyyy')}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            <StaffProfileForm
                userId={userId}
                staffName={displayName}
                currentRole={effectiveRole as any}
                ownerCount={ownerCount}
                allCentres={allCentres}
                currentAssignments={currentAssignments}
                isOwner={isOwner}
            />
        </div>
    );
}
