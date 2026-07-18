import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import StudentForm from '@/components/students/StudentForm';
import { db } from '@/db';
import { centres, centreMemberships } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export default async function AddStudentPage() {
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/onboarding');
    }

    // Load the centres the logged-in user can assign students to.
    // ORG_OWNER sees all org centres. Others see only their accessible centres.
    const userRole = (session.user as any).role as string | undefined;

    let accessibleCentres: { id: string; name: string }[];

    if (userRole === 'ORG_OWNER') {
        accessibleCentres = await db
            .select({ id: centres.id, name: centres.name })
            .from(centres)
            .where(eq(centres.organisationId, session.user.organisationId));
    } else {
        const centreIds = await getUserAccessibleCentreIds(session.user.id);
        if (centreIds.length === 0) {
            accessibleCentres = [];
        } else {
            accessibleCentres = await db
                .select({ id: centres.id, name: centres.name })
                .from(centres)
                .where(inArray(centres.id, centreIds));
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="max-w-2xl mx-auto">
                <header className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight headline-lg">Add New Student</h1>
                        <p className="text-on-surface-variant body-md mt-2">Register a new student to your centre</p>
                    </div>
                </header>
                <div className="bg-card rounded-2xl shadow-xl border border-outline-variant/10 p-6">
                    <StudentForm accessibleCentres={accessibleCentres} />
                </div>
            </div>
        </div>
    );
}
