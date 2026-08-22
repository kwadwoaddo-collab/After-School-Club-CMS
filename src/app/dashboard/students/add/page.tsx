/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireAuth } from '@/lib/require-auth';
import StudentForm from '@/features/students/components/StudentForm';
import { Card } from '@/components/ui/Card';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export default async function AddStudentPage() {
    // Same role rule as the rest of the Students module — see
    // project-notes/milestone-3-people-audit.md §2. Previously this page
    // only checked for an organisationId, so any authenticated staff member
    // (including TUTOR, who cannot even see the Students list) could add a
    // student directly via this URL.
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });

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
        <div className="max-w-2xl mx-auto space-y-5">
            <div>
                <Link
                    href="/dashboard/students"
                    className="inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors mb-3"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to students
                </Link>
                <h1 className="text-page-title text-text">Add student</h1>
                <p className="text-small-body text-text-secondary mt-1">Register a new student to your centre</p>
            </div>
            <Card>
                <div className="p-5 sm:p-6">
                    <StudentForm accessibleCentres={accessibleCentres} />
                </div>
            </Card>
        </div>
    );
}
