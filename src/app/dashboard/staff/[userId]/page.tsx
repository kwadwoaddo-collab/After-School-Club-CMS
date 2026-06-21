import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, centres, centreMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ArrowLeft, Crown, Briefcase, MonitorSmartphone, GraduationCap, Mail, MapPin, Calendar, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import StaffCentreAssignment from '@/components/staff/StaffCentreAssignment';
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
            ORG_OWNER:  'bg-amber-500/10  text-amber-400  border-amber-500/20',
            MANAGER:    'bg-[#d0bcff]/10  text-[#d0bcff]  border-[#d0bcff]/20',
            FRONT_DESK: 'bg-[#adc6ff]/10 text-[#adc6ff]  border-[#adc6ff]/20',
            TUTOR:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
        return styles[role] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    };

    const getRoleAvatarStyle = (role: string) => {
        const styles: Record<string, string> = {
            ORG_OWNER:  'from-amber-500/40 to-amber-500/20 text-amber-400',
            MANAGER:    'from-[#d0bcff]/40 to-[#d0bcff]/20 text-[#d0bcff]',
            FRONT_DESK: 'from-[#adc6ff]/40 to-[#adc6ff]/20 text-[#adc6ff]',
            TUTOR:      'from-emerald-500/40 to-emerald-500/20 text-emerald-400',
        };
        return styles[role] || 'from-gray-500/40 to-gray-500/20 text-gray-400';
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
        return ['View assigned sessions', 'Add assessment feedback', 'Mark attendance'];
    };


    const initials = staffMember.name
        ? staffMember.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : staffMember.email.charAt(0).toUpperCase();

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Back Button */}
            <Link href="/dashboard/staff" className="inline-flex items-center gap-2 text-[#8c909f] hover:text-white font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Team
            </Link>

            {/* Profile Header */}
            <div className="bg-[#1a1d23] rounded-[32px] p-8 border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl font-bold flex-shrink-0 ${getRoleAvatarStyle(staffMember.role)}`}>
                        {initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-[#e5e2e1] tracking-tight mb-2">
                            {staffMember.name || 'Unnamed User'}
                        </h1>
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border ${getRoleStyle(staffMember.role)}`}>
                                {getRoleIcon(staffMember.role, "w-3.5 h-3.5")}
                                {staffMember.role.replace(/_/g, ' ')}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-[#8c909f]">
                            <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {staffMember.email}</span>
                            {staffMember.role === 'ORG_OWNER' ? (
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> All Centres</span>
                            ) : (
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {staffMember.memberships.length} Centre{staffMember.memberships.length !== 1 ? 's' : ''} Assigned</span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                Joined {format(new Date(staffMember.createdAt), 'MMMM d, yyyy')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Permissions */}
            <div className="bg-[#1a1d23] rounded-[24px] p-6 border border-[#424754]/15">
                <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="w-5 h-5 text-[#adc6ff]" />
                    <h2 className="font-bold text-[#e5e2e1]">Role Permissions</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    {getRolePermissions(staffMember.role).map(perm => (
                        <span key={perm} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#2a2a2a] text-[#c2c6d6] border border-[#424754]/20">
                            {perm}
                        </span>
                    ))}
                </div>
            </div>

            {/* Centre Assignment */}
            {staffMember.role === 'ORG_OWNER' ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
                    <h3 className="font-bold text-amber-400 mb-2">Organization Owner — Full Access</h3>
                    <p className="text-sm text-amber-400/80 leading-relaxed">
                        ORG_OWNER users automatically have full access to all centres. Centre assignments are not applicable.
                    </p>
                </div>
            ) : (
                <>
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6">
                        <h3 className="font-bold text-primary mb-2">Centre-Level Access Control</h3>
                        <p className="text-sm text-primary/80 leading-relaxed">
                            This staff member will only see bookings, students, and data from the centres you assign below.
                        </p>
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
