import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, staffInvites } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { UserPlus, Users, Shield, Mail, MapPin, Crown, Briefcase, MonitorSmartphone, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import InvitationsList from '@/components/dashboard/InvitationsList';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { format } from 'date-fns';

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

    const [org] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.id, session.user.organisationId)).limit(1);
    if (!org) return redirect('/onboarding');

    const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
    const activeCentreId = await resolveActiveCentreId(searchParams.centre, accessibleCentreIds);

    const staffMembers = await db.query.users.findMany({
        where: eq(users.organisationId, org.id),
        with: { memberships: { with: { centre: true } } },
    });

    const filteredStaffMembers = staffMembers.filter(member => {
        if (activeCentreId === 'all') return true;
        if (member.role === 'ORG_OWNER') return true;
        return member.memberships.some(m => m.centreId === activeCentreId);
    });

    const invitations = await db.select().from(staffInvites).where(eq(staffInvites.organisationId, org.id)).orderBy(desc(staffInvites.createdAt));

    const filteredInvitations = invitations.filter(invite => {
        // Filter out magic login links (lifespan < 1 hour)
        const lifespan = invite.expiresAt.getTime() - invite.createdAt.getTime();
        if (lifespan < 60 * 60 * 1000) return false;

        if (activeCentreId === 'all') return true;
        const member = staffMembers.find(m => m.email.toLowerCase() === invite.email.toLowerCase());
        if (!member) return false;
        if (member.role === 'ORG_OWNER') return true;
        return member.memberships.some(m => m.centreId === activeCentreId);
    });

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
            ORG_OWNER:  'bg-amber-500/20  text-amber-400',
            MANAGER:    'bg-[#d0bcff]/20  text-[#d0bcff]',
            FRONT_DESK: 'bg-[#adc6ff]/20 text-[#adc6ff]',
            TUTOR:      'bg-emerald-500/20 text-emerald-400',
        };
        return styles[role] || 'bg-gray-500/20 text-gray-400';
    };

    const getRoleIcon = (role: string) => {
        if (role === 'ORG_OWNER') return Crown;
        if (role === 'MANAGER') return Briefcase;
        if (role === 'FRONT_DESK') return MonitorSmartphone;
        return GraduationCap;
    };

    const activeInviteCount = invitations.filter(inv => {
        // Exclude magic login links (lifespan < 1 hour)
        const lifespan = inv.expiresAt.getTime() - inv.createdAt.getTime();
        if (lifespan < 60 * 60 * 1000) return false;
        return !inv.usedAt && new Date(inv.expiresAt) > new Date();
    }).length;

    const roleBreakdown = {
        ORG_OWNER:  filteredStaffMembers.filter(m => m.role === 'ORG_OWNER').length,
        MANAGER:    filteredStaffMembers.filter(m => m.role === 'MANAGER').length,
        FRONT_DESK: filteredStaffMembers.filter(m => m.role === 'FRONT_DESK').length,
        TUTOR:      filteredStaffMembers.filter(m => m.role === 'TUTOR').length,
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Team Management</h1>
                    <p className="text-[#8c909f] text-sm font-medium mt-1">Manage your staff and centre access</p>
                </div>
                <Link href="/dashboard/staff/invite" className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn">
                    <UserPlus className="w-4 h-4" />
                    Invite Staff
                </Link>
            </div>

            {/* Stats Row: real data only */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glassmorphic-card rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-[#adc6ff] flex-shrink-0"><Users className="w-6 h-6" /></div>
                        <div>
                            <p className="text-3xl font-bold text-white tracking-tight">{filteredStaffMembers.length}</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Team Members</p>
                        </div>
                    </div>
                </div>
                <div className="glassmorphic-card rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-[#d0bcff] flex-shrink-0"><Mail className="w-6 h-6" /></div>
                        <div>
                            <p className="text-3xl font-bold text-white tracking-tight">{activeInviteCount}</p>
                            <p className="text-[10px] text-[#c2c6d6] font-bold mt-1 uppercase tracking-wider">Active Invites</p>
                        </div>
                    </div>
                </div>
                <div className="glassmorphic-card rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
                    <p className="text-[10px] text-[#c2c6d6] font-bold mb-3 uppercase tracking-wider">Roles Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                        {roleBreakdown.ORG_OWNER > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">{roleBreakdown.ORG_OWNER} Owner{roleBreakdown.ORG_OWNER > 1 ? 's' : ''}</span>}
                        {roleBreakdown.MANAGER > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#d0bcff]/10 text-[#d0bcff] border border-[#d0bcff]/20">{roleBreakdown.MANAGER} Manager{roleBreakdown.MANAGER > 1 ? 's' : ''}</span>}
                        {roleBreakdown.FRONT_DESK > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#adc6ff]/10 text-[#adc6ff] border border-[#adc6ff]/20">{roleBreakdown.FRONT_DESK} Front Desk</span>}
                        {roleBreakdown.TUTOR > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{roleBreakdown.TUTOR} Club Leader{roleBreakdown.TUTOR > 1 ? 's' : ''}</span>}
                        {filteredStaffMembers.length === 0 && <span className="text-[#8c909f] text-xs">No staff yet</span>}
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-[#1a1d23] border border-[#424754]/15 rounded-[24px] p-6 flex items-start sm:items-center gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.1)]">
                <div className="w-10 h-10 rounded-xl bg-[#2a2a2a] flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-[#adc6ff]" /></div>
                <div>
                    <h3 className="font-bold text-[#e5e2e1]">Centre-Level Access Control</h3>
                    <p className="text-sm text-[#8c909f] mt-1 leading-relaxed max-w-4xl">Staff members (Manager, Front Desk, Club Leader) only see data from centres they&apos;re assigned to. As an Organisation Owner, you have full access to all centres and system settings.</p>
                </div>
            </div>

            {/* Staff List */}
            <div className="bg-[#1a1d23] rounded-[32px] overflow-hidden border border-[#424754]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                <div className="px-8 py-6 border-b border-[#424754]/15">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-[#e5e2e1]">Team Members</h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2a2a2a] text-[#8c909f] border border-[#424754]/20">{filteredStaffMembers.length}</span>
                    </div>
                </div>
                <div className="divide-y divide-[#424754]/15">
                    {filteredStaffMembers.length === 0 ? (
                        <div className="px-8 py-12 text-center">
                            <div className="w-16 h-16 bg-[#2a2a2a] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[#424754]/15"><Users className="w-8 h-8 text-[#8c909f] opacity-50" /></div>
                            <h3 className="text-lg font-bold text-[#e5e2e1] mb-2">No team members yet</h3>
                            <p className="text-sm text-[#8c909f] mb-6">Invite your first staff member to get started.</p>
                            <Link href="/dashboard/staff/invite" className="inline-flex items-center gap-2 px-6 py-3 bg-[#adc6ff] text-[#1a1d23] font-bold rounded-2xl hover:bg-[#c8d9ff] transition-colors">
                                <UserPlus className="w-4 h-4" /> Invite Staff Member
                            </Link>
                        </div>
                    ) : (
                        filteredStaffMembers.map((member) => {
                            const RoleIcon = getRoleIcon(member.role);
                            const initials = member.name
                                ? member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                                : member.email.charAt(0).toUpperCase();
                            return (
                                <div key={member.id} className="p-4 sm:px-8 sm:py-6 hover:bg-[#202228] transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full border border-[#424754]/50 flex items-center justify-center font-bold text-base flex-shrink-0 ${getRoleAvatarStyle(member.role)}`}>
                                                {initials}
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-start gap-3 mb-1.5 flex-wrap">
                                                    <h3 className="font-bold text-[#e5e2e1] text-base">{member.name || 'Unnamed User'}</h3>
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleStyle(member.role)}`}>
                                                        <RoleIcon className="w-3 h-3" />
                                                        {member.role.replace(/_/g, ' ')}
                                                    </span>
                                                    {member.id === session.user.id && <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#2a2a2a] text-[#8c909f] border border-[#424754]/30">You</span>}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs font-medium text-[#8c909f] flex-wrap">
                                                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {member.email}</span>
                                                    {member.role === 'ORG_OWNER' ? (
                                                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> All Centres</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {member.memberships.length} centre{member.memberships.length !== 1 ? 's' : ''}</span>
                                                    )}
                                                    <span className="text-[#8c909f]/60">Joined {format(new Date(member.createdAt), 'MMM yyyy')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {member.id !== session.user.id && (
                                            <Link href={`/dashboard/staff/${member.id}`} className="px-4 py-2 sm:py-2.5 text-xs font-bold text-[#adc6ff] bg-[#2a2a2a] hover:bg-[#353535] border border-[#424754]/15 rounded-xl transition-colors whitespace-nowrap self-start sm:self-auto">
                                                Manage Access
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Invitations */}
            <InvitationsList invitations={filteredInvitations} />
        </div>
    );
}
