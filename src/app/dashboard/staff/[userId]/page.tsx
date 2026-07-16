import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, centres, centreMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ArrowLeft, Crown, Briefcase, MonitorSmartphone, GraduationCap, Mail, MapPin, Calendar, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import StaffCentreAssignment from '@/components/staff/StaffCentreAssignment';
import StaffRoleSelector from '@/components/staff/StaffRoleSelector';
import { format } from 'date-fns';

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

    const currentAssignments = staffMember.memberships.map((m) => m.centreId);

    // Role badge style: Gold=Owner, Purple=Manager, Blue=FrontDesk, Green=Tutor
    const getRoleStyle = (role: string) => {
        const styles: Record<string, string> = {
            ORG_OWNER:  'bg-amber-50  text-amber-700  border-amber-200',
            MANAGER:    'bg-violet-50 text-violet-700 border-violet-200',
            FRONT_DESK: 'bg-blue-50   text-blue-700   border-blue-200',
            TUTOR:      'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
        return styles[role] || 'bg-gray-50 text-gray-700 border-gray-200';
    };

    const getRoleAvatarStyle = (role: string) => {
        const styles: Record<string, string> = {
            ORG_OWNER:  'from-amber-100 to-amber-50 text-amber-700 border border-amber-200',
            MANAGER:    'from-violet-100 to-violet-50 text-violet-700 border border-violet-200',
            FRONT_DESK: 'from-blue-100 to-blue-50 text-blue-700 border border-blue-200',
            TUTOR:      'from-emerald-100 to-emerald-50 text-emerald-700 border border-emerald-200',
        };
        return styles[role] || 'from-gray-100 to-gray-50 text-gray-700 border border-gray-200';
    };

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


    const initials = staffMember.name
        ? staffMember.name.split(' ').map((n: string) => n ? n[0] : '').filter(Boolean).join('').toUpperCase().slice(0, 2)
        : (staffMember.email || 'S').charAt(0).toUpperCase();

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Back Button */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard/staff" className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center group-hover:bg-gray-200 transition-all">
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </div>
                    Back to Team
                </Link>
            </div>

            {/* Profile Header */}
            <div className="bg-white rounded-[32px] p-8 border border-gray-200 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl font-black flex-shrink-0 ${getRoleAvatarStyle(staffMember.role)}`}>
                        {initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                            {staffMember.name || 'Unnamed User'}
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${getRoleStyle(staffMember.role)}`}>
                                {getRoleIcon(staffMember.role, "w-3.5 h-3.5")}
                                {staffMember.role.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 font-semibold">
                            <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-gray-400" /> {staffMember.email}</span>
                            {staffMember.role === 'ORG_OWNER' ? (
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> All Centres</span>
                            ) : (
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> {staffMember.memberships.length} Centre{staffMember.memberships.length !== 1 ? 's' : ''} Assigned</span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-gray-400" />
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
            />

            {/* Centre Assignment */}
            {staffMember.role === 'ORG_OWNER' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
                    <Crown className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-amber-800 text-sm">Organization Owner — Full Access</h3>
                        <p className="text-xs text-amber-700 font-medium leading-relaxed mt-1">
                            ORG_OWNER users automatically have full access to all centres. Centre assignments are not applicable.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-bold text-blue-800 text-sm">Centre-Level Access Control</h3>
                            <p className="text-xs text-blue-600 font-medium leading-relaxed mt-1">
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
