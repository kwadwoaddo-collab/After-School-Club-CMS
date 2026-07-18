import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, staffInvites } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { UserPlus, Users, Shield, Mail } from 'lucide-react';
import Link from 'next/link';
import InvitationsList from '@/components/dashboard/InvitationsList';
import TeamMembersList from '@/components/staff/TeamMembersList';
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
                    <p className="text-muted-foreground text-sm font-medium mt-1">Manage your staff and centre access</p>
                </div>
                <Link href="/dashboard/staff/invite" className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 glow-btn">
                    <UserPlus className="w-4 h-4" />
                    Invite Staff
                </Link>
            </div>

            {/* Stats Row: real data only */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glassmorphic-card rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/15 text-primary flex-shrink-0"><Users className="w-6 h-6" /></div>
                        <div>
                            <p className="text-3xl font-black text-foreground tracking-tight tabular-nums">{filteredStaffMembers.length}</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-wider">Team Members</p>
                        </div>
                    </div>
                </div>
                <div className="glassmorphic-card rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-500/15 text-violet-600 dark:text-violet-400 flex-shrink-0"><Mail className="w-6 h-6" /></div>
                        <div>
                            <p className="text-3xl font-black text-foreground tracking-tight tabular-nums">{activeInviteCount}</p>
                            <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-wider">Active Invites</p>
                        </div>
                    </div>
                </div>
                <div className="glassmorphic-card rounded-2xl p-6">
                    <p className="text-[10px] text-muted-foreground font-bold mb-3 uppercase tracking-wider">Roles Breakdown</p>
                    <div className="flex flex-wrap gap-2">
                        {roleBreakdown.ORG_OWNER > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">{roleBreakdown.ORG_OWNER} Owner{roleBreakdown.ORG_OWNER > 1 ? 's' : ''}</span>}
                        {roleBreakdown.MANAGER > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">{roleBreakdown.MANAGER} Manager{roleBreakdown.MANAGER > 1 ? 's' : ''}</span>}
                        {roleBreakdown.FRONT_DESK > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">{roleBreakdown.FRONT_DESK} Front Desk</span>}
                        {roleBreakdown.TUTOR > 0 && <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{roleBreakdown.TUTOR} Club Leader{roleBreakdown.TUTOR > 1 ? 's' : ''}</span>}
                        {filteredStaffMembers.length === 0 && <span className="text-muted-foreground text-xs">No staff yet</span>}
                    </div>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-card border border-border rounded-[24px] p-6 flex items-start sm:items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-primary" /></div>
                <div>
                    <h3 className="font-bold text-foreground">Centre-Level Access Control</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-4xl">Staff members (Manager, Front Desk, Club Leader) only see data from centres they&apos;re assigned to. As an Organisation Owner, you have full access to all centres and system settings.</p>
                </div>
            </div>

            {/* Staff List */}
            <TeamMembersList
                members={filteredStaffMembers}
                currentUserId={session.user.id}
            />

            {/* Invitations */}
            <InvitationsList invitations={filteredInvitations} />
        </div>
    );
}
