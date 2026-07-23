/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, centres, centreMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ArrowLeft, Crown, Briefcase, MonitorSmartphone, GraduationCap, Mail, MapPin, Calendar, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import StaffCentreAssignment from '@/features/staff/components/StaffCentreAssignment';
import StaffRoleSelector from '@/features/staff/components/StaffRoleSelector';
import { format } from 'date-fns';
import { ROLE_COLORS, ROLE_AVATAR_COLORS } from '@/lib/staff-constants';

interface PageProps {
    params: Promise<{ userId: string }>;
}

export default async function EditStaffPage({ params }: PageProps) {
    const { userId } = await params;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
    if (!currentUser || currentUser.role !== 'ORG_OWNER') return redirect('/dashboard/staff');

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

    const getRoleIcon = (role: string, className?: string) => {
        if (role === 'ORG_OWNER') return <Crown className={className} />;
        if (role === 'MANAGER') return <Briefcase className={className} />;
        if (role === 'FRONT_DESK') return <MonitorSmartphone className={className} />;
        return <GraduationCap className={className} />;
    };

    const getRolePermissions = (role: string): string[] => {
        if (role === 'ORG_OWNER') return ['Full system access', 'Manage all centres', 'Manage staff & invites', 'View all reports', 'Manage billing'];
        if (role === 'MANAGER') return ['Manage bookings', 'Manage students', 'View assigned centres', 'View reports'];
        if (role === 'FRONT_DESK') return ['View & manage bookings', 'Check-in students', 'View assigned centre data'];
        return ['View assigned sessions', 'Add session feedback', 'Mark attendance'];
    };


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

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard/staff" className="group inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all active:scale-95 duration-100">
                    <div className="w-8 h-8 rounded-full bg-secondary/60 border border-border flex items-center justify-center group-hover:bg-secondary transition-all">
                        <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                    </div>
                    Back to Team
                </Link>
            </div>

            {/* Profile Header */}
            <div className="bg-card rounded-[32px] p-8 border border-border shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0 ${ROLE_AVATAR_COLORS[staffMember.role] ?? 'bg-secondary text-foreground border border-border'}`}>
                        {initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-3xl font-black text-foreground tracking-tight mb-2">
                            {staffMember.firstName && staffMember.lastName
                                ? `${staffMember.firstName} ${staffMember.lastName}`
                                : staffMember.name
                                    ? staffMember.name
                                    : <span className="text-muted-foreground italic">{staffMember.email}</span>
                            }
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${ROLE_COLORS[staffMember.role] ?? 'bg-secondary/40 text-foreground border-border'}`}>
                                {getRoleIcon(staffMember.role, "w-3.5 h-3.5")}
                                {staffMember.role.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-semibold">
                            <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-muted-foreground" /> {staffMember.email}</span>
                            {staffMember.role === 'ORG_OWNER' ? (
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground" /> All Centres</span>
                            ) : (
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-muted-foreground" /> {staffMember.memberships.length} Centre{staffMember.memberships.length !== 1 ? 's' : ''} Assigned</span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                Joined {format(new Date(staffMember.createdAt), 'MMMM d, yyyy')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Role Selector */}
            <StaffRoleSelector
                userId={userId}
                currentRole={staffMember.role as any}
                staffName={staffMember.name || staffMember.email}
                ownerCount={ownerCount}
            />

            {/* Centre Assignment */}
            {staffMember.role === 'ORG_OWNER' ? (
                <div className="bg-card border border-border shadow-sm rounded-2xl p-6 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                        <Crown className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-sm">Organization Owner — Full Access</h3>
                        <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-1">
                            ORG_OWNER users automatically have full access to all centres. Centre assignments are not applicable.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-card border border-border shadow-sm rounded-2xl p-6 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-info/10 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-5 h-5 text-info" />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground text-sm">Centre-Level Access Control</h3>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-1">
                                This staff member will only see bookings, students, and data from the centres you assign below.
                            </p>
                        </div>
                    </div>
                    <StaffCentreAssignment
                        userId={userId}
                        staffName={staffMember.name || staffMember.email}
                        staffRole={staffMember.role}
                        allCentres={allCentres}
                        currentAssignments={currentAssignments}
                    />
                </>
            )}
        </div>
    );
}
