import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, centres, staffInvites } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { UserPlus, Users, Shield, Mail, MapPin, DollarSign, Calendar } from 'lucide-react';
import Link from 'next/link';
import InvitationsList from '@/components/dashboard/InvitationsList';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';

export default async function StaffPage(props: {
    searchParams: Promise<{
        centre?: string;
    }>;
}) {
    const searchParams = await props.searchParams;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    if ((session.user as any).role !== 'ORG_OWNER') return redirect('/dashboard');

    // Fetch organisation
    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    // Fetch accessible centre IDs and active centre ID
    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    const activeCentreId = await resolveActiveCentreId(searchParams.centre, accessibleCentreIds);

    // Fetch all staff members
    const staffMembers = await db.query.users.findMany({
        where: eq(users.organisationId, org.id),
        with: {
            memberships: {
                with: {
                    centre: true,
                },
            },
        },
    });

    // Filter staff members based on active centre
    const filteredStaffMembers = staffMembers.filter(member => {
        if (activeCentreId === 'all') return true;
        if (member.role === 'ORG_OWNER') return true; // Owners have implicit access to all centres
        return member.memberships.some(m => m.centreId === activeCentreId);
    });

    // Fetch all centres for the organisation
    const allCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, org.id),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    // Fetch all invitations
    const invitations = await db
        .select()
        .from(staffInvites)
        .where(eq(staffInvites.organisationId, org.id))
        .orderBy(desc(staffInvites.createdAt));

    // Filter invitations based on active centre
    const filteredInvitations = invitations.filter(invite => {
        if (activeCentreId === 'all') return true;
        const member = staffMembers.find(m => m.email.toLowerCase() === invite.email.toLowerCase());
        if (!member) return false;
        if (member.role === 'ORG_OWNER') return true;
        return member.memberships.some(m => m.centreId === activeCentreId);
    });

    // Helper to get role badge style
    const getRoleStyle = (role: string) => {
        const styles = {
            ORG_OWNER: 'bg-[#d0bcff]/10 text-[#d0bcff] border-[#d0bcff]/20',
            MANAGER: 'bg-[#adc6ff]/10 text-[#adc6ff] border-[#adc6ff]/20',
            FRONT_DESK: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            TUTOR: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
        return styles[role as keyof typeof styles] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-[#e5e2e1] tracking-tight">Team Management</h1>
                    <p className="text-[#8c909f] font-medium mt-1">
                        Manage your staff, scheduling, and payroll
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-4 py-3 bg-[#2a2a2a] rounded-2xl text-sm font-bold text-[#adc6ff] hover:bg-[#353535] transition-all border border-[#424754]/15"
                    >
                        Back to Dashboard
                    </Link>
                    <Link
                        href="/dashboard/staff/invite"
                        className="flex items-center gap-2 px-6 py-3 bg-[#2a2a2a] rounded-2xl text-sm font-bold text-[#e5e2e1] hover:bg-[#353535] transition-all border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
                    >
                        <UserPlus className="w-4 h-4 text-[#adc6ff]" />
                        Invite Staff
                    </Link>
                </div>
            </div>

            {/* Top Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1a1d23] rounded-2xl p-6 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2a2a2a] text-[#adc6ff] flex-shrink-0">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#e5e2e1] tracking-tight">{filteredStaffMembers.length}</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Active Staff</p>
                        </div>
                    </div>
                </div>
                <div className="bg-[#1a1d23] rounded-2xl p-6 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2a2a2a] text-[#d0bcff] flex-shrink-0">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#e5e2e1] tracking-tight">12</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Upcoming Shifts</p>
                        </div>
                    </div>
                </div>
                <div className="bg-[#1a1d23] rounded-2xl p-6 border border-[#424754]/15 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#2a2a2a] text-[#ffb599] flex-shrink-0">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-[#e5e2e1] tracking-tight">£1,450</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Pending Payroll</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-[24px] p-6 flex items-start sm:items-center gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
                <div className="w-10 h-10 rounded-xl bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-[#adc6ff]" />
                </div>
                <div>
                    <h3 className="font-bold text-[#e5e2e1]">Centre-Level Access Control</h3>
                    <p className="text-sm text-[#8c909f] mt-1 leading-relaxed max-w-4xl">
                        Staff members (Manager, Front Desk, Tutor) only see data from centres they're assigned to.
                        As an Organisation Owner, you have full access to all centres and system settings.
                    </p>
                </div>
            </div>

            {/* Staff List */}
            <div className="bg-[#1a1d23] rounded-[32px] overflow-hidden border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="px-8 py-6 border-b border-[#424754]/15">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-[#e5e2e1]">Team Members</h2>
                    </div>
                </div>

                <div className="divide-y divide-[#424754]/15">
                    {filteredStaffMembers.length === 0 ? (
                        <div className="px-8 py-12 text-center">
                            <div className="w-16 h-16 bg-[#2a2a2a] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#424754]/15">
                                <Users className="w-8 h-8 text-[#8c909f] opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold text-[#e5e2e1] mb-2">No team members yet</h3>
                            <p className="text-sm text-[#8c909f] mb-6">Invite your first staff member to get started.</p>
                            <Link
                                href="/dashboard/staff/invite"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2a2a2a] text-[#adc6ff] font-bold rounded-2xl hover:bg-[#353535] transition-colors border border-[#424754]/15"
                            >
                                <UserPlus className="w-4 h-4" />
                                Invite Staff Member
                            </Link>
                        </div>
                    ) : (
                        filteredStaffMembers.map((member) => (
                            <div key={member.id} className="p-4 sm:px-8 sm:py-6 hover:bg-[#202228] transition-colors group">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-[#2a2a2a] border border-[#424754]/50 flex items-center justify-center text-[#adc6ff] font-bold text-lg flex-shrink-0">
                                            {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-start gap-3 mb-1.5 flex-wrap">
                                                <h3 className="font-bold text-[#e5e2e1] text-base">
                                                    {member.name || 'Unnamed User'}
                                                </h3>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleStyle(member.role)}`}>
                                                    {member.role.replace('_', ' ')}
                                                </span>
                                                {member.id === session.user.id && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#2a2a2a] text-[#8c909f] border border-[#424754]/30">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-medium text-[#8c909f] flex-wrap">
                                                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {member.email}</span>
                                                {member.role === 'ORG_OWNER' ? (
                                                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> All Centres</span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {member.memberships.length} Centre(s)</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {member.id !== session.user.id && (
                                        <Link
                                            href={`/dashboard/staff/${member.id}`}
                                            className="px-4 py-2 sm:py-2.5 text-xs font-bold text-[#adc6ff] bg-[#2a2a2a] hover:bg-[#353535] border border-[#424754]/15 rounded-xl transition-colors whitespace-nowrap self-start sm:self-auto"
                                        >
                                            Edit Access
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Invitations & Overview Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="h-full">
                    <InvitationsList invitations={filteredInvitations} />
                </div>

                {allCentres.length > 0 && (
                    <div className="bg-[#1a1d23] rounded-[32px] overflow-hidden border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)] h-full flex flex-col">
                        <div className="px-8 py-6 border-b border-[#424754]/15 flex items-center gap-3">
                            <h2 className="text-lg font-bold text-[#e5e2e1]">Your Centres</h2>
                        </div>
                        <div className="p-6 flex-1">
                            <div className="flex flex-col gap-3">
                                {allCentres.map((centre) => {
                                    const isActive = centre.id === activeCentreId;
                                    return (
                                        <div
                                            key={centre.id}
                                            className={`p-5 bg-[#2a2a2a] rounded-2xl border transition-colors flex items-center justify-between group ${
                                                isActive
                                                    ? 'border-primary'
                                                    : 'border-[#424754]/15 hover:border-[#adc6ff]/30'
                                            }`}
                                        >
                                            <div>
                                                <h3 className={`font-bold text-sm transition-colors ${
                                                    isActive ? 'text-primary' : 'text-[#e5e2e1] group-hover:text-[#adc6ff]'
                                                }`}>{centre.name}</h3>
                                                <p className="text-xs text-[#8c909f] mt-1 pr-4">{centre.slug}</p>
                                            </div>
                                            <div className="w-8 h-8 rounded-lg bg-[#353535] flex items-center justify-center">
                                                <MapPin className={`w-4 h-4 transition-colors ${
                                                    isActive ? 'text-primary' : 'text-[#8c909f] group-hover:text-[#adc6ff]'
                                                }`} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
