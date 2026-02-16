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

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Back Button */}
            <Link
                href="/dashboard/staff"
                className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Team
            </Link>

            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                    Manage Centre Access
                </h1>
                <p className="text-slate-600 font-medium mt-1">
                    Assign <span className="font-bold">{staffMember.name || staffMember.email}</span> to
                    specific centres
                </p>
            </div>

            {/* Role Badge */}
            <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 font-medium">Current Role:</span>
                <span className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-semibold">
                    {staffMember.role.replace('_', ' ')}
                </span>
            </div>

            {/* Info Card */}
            {staffMember.role === 'ORG_OWNER' ? (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-6">
                    <h3 className="font-bold text-purple-900 mb-2">Organization Owner Access</h3>
                    <p className="text-sm text-purple-700">
                        ORG_OWNER users automatically have full access to all centres. Centre assignments are
                        not needed.
                    </p>
                </div>
            ) : (
                <>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                        <h3 className="font-bold text-blue-900 mb-2">Centre-Level Access Control</h3>
                        <p className="text-sm text-blue-700 leading-relaxed">
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
