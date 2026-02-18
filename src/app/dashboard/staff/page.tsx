import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, centres, staffInvites } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { UserPlus, Users, Shield, Mail, MapPin, Send } from 'lucide-react';
import Link from 'next/link';
import InvitationsList from '@/components/dashboard/InvitationsList';

export default async function StaffPage() {
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

    // Fetch all centres for the organisation
    const allCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, org.id),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    // Fetch all invitations for this organisation, most recent first
    const invitations = await db
        .select()
        .from(staffInvites)
        .where(eq(staffInvites.organisationId, org.id))
        .orderBy(desc(staffInvites.createdAt));

    // Helper to get role badge color
    const getRoleBadge = (role: string) => {
        const styles = {
            ORG_OWNER: 'bg-purple-100 text-purple-700 border-purple-200',
            MANAGER: 'bg-blue-100 text-blue-700 border-blue-200',
            FRONT_DESK: 'bg-green-100 text-green-700 border-green-200',
            TUTOR: 'bg-amber-100 text-amber-700 border-amber-200',
        };
        return styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-700 border-gray-200';
    };

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Team Management</h1>
                    <p className="text-slate-600 font-medium mt-1">
                        Manage your staff and their centre access
                    </p>
                </div>
                <Link
                    href="/dashboard/staff/invite"
                    className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30"
                >
                    <UserPlus className="w-4 h-4" />
                    Invite Staff Member
                </Link>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <div className="flex gap-4">
                    <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                        <h3 className="font-bold text-blue-900 mb-1">Centre-Level Access Control</h3>
                        <p className="text-sm text-blue-700 leading-relaxed">
                            Staff members (Manager, Front Desk, Tutor) only see data from centres they're assigned to.
                            As an ORG_OWNER, you have full access to all centres.
                        </p>
                    </div>
                </div>
            </div>

            {/* Staff List */}
            <div className="glass-card rounded-[32px] overflow-hidden border border-slate-200">
                <div className="px-8 py-6 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-bold text-slate-900">Team Members ({staffMembers.length})</h2>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {staffMembers.length === 0 ? (
                        <div className="px-8 py-12 text-center">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">No team members yet</h3>
                            <p className="text-slate-600 mb-4">Invite your first staff member to get started.</p>
                            <Link
                                href="/dashboard/staff/invite"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                <UserPlus className="w-4 h-4" />
                                Invite Staff Member
                            </Link>
                        </div>
                    ) : (
                        staffMembers.map((member) => (
                            <div key={member.id} className="px-8 py-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-bold text-slate-900">
                                                {member.name || member.email}
                                            </h3>
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadge(member.role)}`}
                                            >
                                                {member.role.replace('_', ' ')}
                                            </span>
                                            {member.id === session.user.id && (
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                                            <Mail className="w-4 h-4" />
                                            {member.email}
                                        </div>
                                        {member.role !== 'ORG_OWNER' && (
                                            <div className="flex items-start gap-2 text-sm">
                                                <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                                                <div>
                                                    <span className="font-medium text-slate-700">Assigned Centres:</span>
                                                    {member.memberships.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {member.memberships.map((membership) => (
                                                                <span
                                                                    key={membership.id}
                                                                    className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium"
                                                                >
                                                                    {membership.centre.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-amber-600 ml-2">No centres assigned</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {member.role === 'ORG_OWNER' && (
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <MapPin className="w-4 h-4" />
                                                <span className="font-medium">Access: All centres ({allCentres.length})</span>
                                            </div>
                                        )}
                                    </div>
                                    {member.id !== session.user.id && (
                                        <Link
                                            href={`/dashboard/staff/${member.id}`}
                                            className="px-4 py-2 text-sm font-semibold text-primary hover:bg-blue-50 rounded-lg transition-colors"
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

            {/* Invitations List */}
            <InvitationsList invitations={invitations} />

            {/* Centres Overview */}
            {allCentres.length > 0 && (
                <div className="glass-card rounded-[32px] overflow-hidden border border-slate-200">
                    <div className="px-8 py-6 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-900">Your Centres</h2>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {allCentres.map((centre) => (
                                <div
                                    key={centre.id}
                                    className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                                >
                                    <h3 className="font-bold text-slate-900 mb-1">{centre.name}</h3>
                                    <p className="text-sm text-slate-600">{centre.slug}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
