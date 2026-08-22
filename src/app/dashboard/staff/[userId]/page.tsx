/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAuth } from '@/lib/require-auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, centres } from '@/db/schema';
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
    const { userId } = await params;
    // Milestone 3C: normalised from a raw auth() + manual role check to the
    // established requireAuth helper, matching /dashboard/staff and every
    // other gated page. Behaviour is unchanged — this page was already
    // correctly ORG_OWNER-only; see project-notes/milestone-3c-staff-audit.md §5.
    const { session } = await requireAuth({ roles: ['ORG_OWNER'] });

    const staffMember = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: { memberships: { with: { centre: true } } },
    });

    if (!staffMember || staffMember.organisationId !== session.user.organisationId) return redirect('/dashboard/staff');

    const allCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    const allOrgOwners = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.organisationId, session.user.organisationId), eq(users.role, 'ORG_OWNER')));

    const ownerCount = allOrgOwners.length;

    const currentAssignments = staffMember.memberships.map((m) => m.centreId);

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
            {/* Navigation bar */}
            <Link
                href="/dashboard/staff"
                className="group inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to staff
            </Link>

            {/* Header card */}
            <Card>
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${ROLE_AVATAR_COLORS[staffMember.role] ?? 'bg-page text-text border border-border'}`}>
                        <span className="text-page-title select-none">{initials}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-page-title text-text truncate">{displayName}</h1>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <Badge>{ROLE_LABELS[staffMember.role] ?? staffMember.role}</Badge>
                            <span className="text-metadata flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {staffMember.email}
                            </span>
                        </div>
                    </div>

                    {/* Key metrics */}
                    <div className="flex sm:flex-col gap-2 sm:min-w-[170px]">
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5" /> Centres
                            </span>
                            <span className="text-small-body font-semibold text-text">
                                {staffMember.role === 'ORG_OWNER' ? 'All' : staffMember.memberships.length}
                            </span>
                        </div>
                        <div className="flex-1 sm:flex-none flex items-center justify-between gap-3 px-3 py-2 rounded-sm border border-border-subtle bg-page">
                            <span className="text-metadata flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" /> Joined
                            </span>
                            <span className="text-small-body font-semibold text-text">
                                {format(new Date(staffMember.createdAt), 'd MMM yyyy')}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Role, centres, and remove-from-org form */}
            <StaffProfileForm
                userId={userId}
                staffName={displayName}
                currentRole={staffMember.role as any}
                ownerCount={ownerCount}
                allCentres={allCentres}
                currentAssignments={currentAssignments}
            />
        </div>
    );
}
