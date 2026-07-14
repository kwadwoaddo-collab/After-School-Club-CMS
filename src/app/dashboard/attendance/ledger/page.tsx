import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import LedgerClient from './LedgerClient';
import { getSessionLedger, getAcademicYear } from '@/features/attendance/actions';

export default async function AttendanceLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ centre?: string; year?: string }>;
}) {
    const session = await auth();
    if (!session?.user?.organisationId) redirect('/login');

    const params = await searchParams;
    const selectedYear = params.year ?? getAcademicYear();

    // Get all centres for this org
    const allCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId),
    });

    const centreId = params.centre ?? allCentres[0]?.id ?? '';

    const ledger = centreId
        ? await getSessionLedger(centreId, selectedYear)
        : [];

    // Build list of academic years (current + last 2)
    const currentYear = getAcademicYear();
    const [cy, cy1] = currentYear.split('-').map(Number);
    const academicYears = [
        currentYear,
        `${cy - 1}-${String(cy).slice(2)}`,
        `${cy - 2}-${String(cy1 - 1).slice(2)}`,
    ];

    return (
        <LedgerClient
            ledger={ledger}
            centres={allCentres.map(c => ({ id: c.id, name: c.name }))}
            selectedCentreId={centreId}
            selectedYear={selectedYear}
            academicYears={academicYears}
        />
    );
}
