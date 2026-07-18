import { getCurrentParent } from '@/lib/parent-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { BookingFlow } from './BookingFlow';

export default async function PortalBookPage() {
    const parent = await getCurrentParent();
    if (!parent) redirect('/portal/login');

    // Find unique centre IDs from parent's existing booking history
    const bookingCentreIds = Array.from(
        new Set(
            (parent.bookings || [])
                .map((b: any) => b.centreId)
                .filter(Boolean) as string[]
        )
    );

    let parentCentres: {
        id: string;
        name: string;
        address: string | null;
        sessionSlots: string | null;
    }[] = [];

    if (bookingCentreIds.length > 0) {
        // Load centres the parent has previously booked at
        parentCentres = await db
            .select({
                id: centres.id,
                name: centres.name,
                address: centres.address,
                sessionSlots: centres.sessionSlots,
            })
            .from(centres)
            .where(inArray(centres.id, bookingCentreIds));
    } else {
        // Fallback: load all centres in the parent's org
        parentCentres = await db
            .select({
                id: centres.id,
                name: centres.name,
                address: centres.address,
                sessionSlots: centres.sessionSlots,
            })
            .from(centres)
            .where(eq(centres.organisationId, parent.organisationId));
    }

    const childList = (parent.children || []).map((c: any) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        schoolYear: c.schoolYear,
    }));

    return (
        <div className="min-h-screen bg-surface text-on-surface pb-12">
            {/* Header */}
            <header className="bg-card border-b border-outline-variant/10 sticky top-0 z-20">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link
                        href="/portal"
                        className="p-2 -ml-2 rounded-lg hover:bg-card transition-colors text-on-surface-variant"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                            <CalendarPlus className="w-5 h-5 text-primary" />
                            Book a Session
                        </h1>
                        <p className="text-xs text-on-surface-variant">
                            {parent.firstName} · {parentCentres.length === 1 ? parentCentres[0].name : `${parentCentres.length} centres available`}
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-8">
                {parentCentres.length === 0 ? (
                    <div className="bg-card p-10 rounded-2xl border border-dashed border-outline-variant/20 text-center">
                        <p className="text-on-surface-variant mb-2">No centres are associated with your account yet.</p>
                        <p className="text-xs text-on-surface-variant">Please contact your club admin to get set up.</p>
                    </div>
                ) : (
                    <BookingFlow
                        registeredChildren={childList}
                        centres={parentCentres}
                    />
                )}
            </main>
        </div>
    );
}
