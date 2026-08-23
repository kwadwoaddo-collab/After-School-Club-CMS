import { requireAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import BookingForm from '@/features/bookings/components/BookingForm';
import Link from 'next/link';
import { MapPin, ChevronLeft, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function NewBookingPage(props: {
    searchParams: Promise<{ centreId?: string }>;
}) {
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });

    const searchParams = await props.searchParams;

    // Fetch all org centres
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId),
        orderBy: (c, { asc }) => [asc(c.name)],
    });

    if (orgCentres.length === 0) {
        return (
            <div className="max-w-2xl mx-auto">
                <EmptyState
                    icon={<MapPin className="w-8 h-8" />}
                    title="No centres found"
                    description="You need to create a centre before you can book sessions."
                    action={
                        <Button asChild>
                            <Link href="/dashboard/centres">Go to Centres</Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    // If only one centre, skip selection
    if (orgCentres.length === 1) {
        const centre = orgCentres[0];
        return <BookingPageContent centre={centre} />;
    }

    // Multiple centres — check if one is selected via URL param
    const selectedCentre = searchParams.centreId
        ? orgCentres.find(c => c.id === searchParams.centreId)
        : null;

    if (selectedCentre) {
        return <BookingPageContent centre={selectedCentre} />;
    }

    // Show centre picker
    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div>
                <Link
                    href="/dashboard/bookings"
                    className="inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors mb-3"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Bookings
                </Link>
                <h1 className="text-page-title text-text">New Session Booking</h1>
                <p className="text-small-body text-text-secondary mt-1">Select the centre for this booking</p>
            </div>

            <div className="space-y-2">
                {orgCentres.map(centre => (
                    <Link
                        key={centre.id}
                        href={`/dashboard/bookings/new?centreId=${centre.id}`}
                        className="group flex items-center justify-between bg-surface border border-border hover:border-accent/40 hover:bg-page p-4 rounded-md transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft">
                                <MapPin className="w-5 h-5 text-accent" />
                            </div>
                            <div>
                                <p className="font-semibold text-text text-small-body leading-tight">
                                    {centre.name}
                                </p>
                                {centre.address && (
                                    <p className="text-xs text-text-muted mt-0.5">
                                        {centre.address}
                                    </p>
                                )}
                            </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                ))}
            </div>
        </div>
    );
}

// ─── Booking form wrapper ─────────────────────────────────────────────────────

function BookingPageContent({ centre }: { centre: { id: string; name: string; operatingHours?: string | null; address?: string | null } }) {
    return (
        <div className="max-w-4xl mx-auto space-y-5">
            <div>
                <Link
                    href="/dashboard/bookings"
                    className="inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors mb-3"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to Bookings
                </Link>
                <h1 className="text-page-title text-text">New Session Booking</h1>
                <div className="inline-flex items-center gap-1.5 text-text-muted text-xs font-medium mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {centre.name}
                </div>
            </div>

            <Card>
                <div className="p-5 sm:p-8">
                    <BookingForm
                        centreId={centre.id}
                        centreName={centre.name}
                        operatingHours={centre.operatingHours}
                        backToCentresUrl="/dashboard/bookings"
                    />
                </div>
            </Card>
        </div>
    );
}
