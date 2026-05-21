import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { users, organisations, centres, centreMemberships } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import StaffCentreAssignment from '@/components/staff/StaffCentreAssignment';

interface PageProps {
    params: Promise<{ userId: string }>;
}

export default async function EditStaffPage({ params }: PageProps) {
    const { userId } = await params;
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    // Check if current user is ORG_OWNER
    const [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

    if (!currentUser || currentUser.role !== 'ORG_OWNER') {
        return redirect('/dashboard/staff');
    }

    // Fetch the staff member
    const staffMember = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: {
            memberships: {
                with: {
                    centre: true,
                },
            },
        },
    });

    if (!staffMember || staffMember.organisationId !== session.user.organisationId) {
        return redirect('/dashboard/staff');
    }

    // Fetch all centres in the organisation
    const allCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    // Get current centre assignments
    const currentAssignments = staffMember.memberships.map((m) => m.centreId);

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
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Back Button */}
            <Link
                href="/dashboard/staff"
                className="inline-flex items-center gap-2 text-[#8c909f] hover:text-white font-medium transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Team
            </Link>

            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-[#e5e2e1] tracking-tight">
                    Manage Centre Access
                </h1>
                <p className="text-[#8c909f] font-medium mt-1">
                    Assign <span className="font-bold text-white">{staffMember.name || staffMember.email}</span> to
                    specific centres
                </p>
            </div>

            {/* Role Badge */}
            <div className="flex items-center gap-3">
                <span className="text-sm text-[#8c909f] font-medium">Current Role:</span>
                <span className={`px-4 py-2 border rounded-xl font-bold uppercase tracking-wider text-xs ${getRoleStyle(staffMember.role)}`}>
                    {staffMember.role.replace('_', ' ')}
                </span>
            </div>

            {/* Info Card */}
            {staffMember.role === 'ORG_OWNER' ? (
                <div className="bg-[#d0bcff]/10 border border-[#d0bcff]/20 rounded-2xl p-6">
                    <h3 className="font-bold text-[#d0bcff] mb-2">Organization Owner Access</h3>
                    <p className="text-sm text-[#d0bcff]/80 leading-relaxed">
                        ORG_OWNER users automatically have full access to all centres. Centre assignments are
                        not needed.
                    </p>
                </div>
            ) : (
                <>
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6">
                        <h3 className="font-bold text-primary mb-2">Centre-Level Access Control</h3>
                        <p className="text-sm text-primary/80 leading-relaxed">
                            This staff member will only see bookings, students, and data from the centres you
                            assign below. Select all centres they should have access to.
                        </p>
                    </div>

                    {/* Centre Assignment Component */}
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
