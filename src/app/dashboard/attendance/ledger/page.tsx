import { requireTenantSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import LedgerClient from './LedgerClient';
import { getSessionLedger } from '@/features/attendance/actions';
import { getAcademicYear } from '@/features/attendance/utils';
import { resolveActiveCentreId } from '@/lib/centre-filter';
import { getUserAccessibleCentres } from '@/lib/permissions';

export default async function AttendanceLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ centre?: string; year?: string }>;
}) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) redirect('/login');

    const params = await searchParams;
    const selectedYear = params.year ?? getAcademicYear();

    // Scope to centres the user is actually assigned to (ORG_OWNER sees all
    // org centres) — matches the pattern used by the register and kiosk
    // pages. Previously this queried every centre in the organisation
    // regardless of the caller's own centre membership, which let
    // `resolveActiveCentreId` accept a `?centre=` value for a centre the
    // caller isn't assigned to.
    const allCentres = await getUserAccessibleCentres(session.user.id);

    const centreIds = allCentres.map(c => c.id);

    // Use the same resolver as every other page — reads ?centre= param first,
    // then falls back to the cookie, then to the first centre.
    const centreId = await resolveActiveCentreId(params.centre, centreIds);

    const ledger = centreId && centreId !== 'all'
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
