import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import BookingForm from '@/features/bookings/components/BookingForm';
import Link from 'next/link';
import { MapPin, ArrowLeft, ChevronRight, ArrowRight } from 'lucide-react';

export default async function NewBookingPage(props: {
    searchParams: Promise<{ centre?: string }>;
}) {
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/onboarding');
    }

    const searchParams = await props.searchParams;

    // Fetch all org centres
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId),
        orderBy: (c, { asc }) => [asc(c.name)],
    });

    if (orgCentres.length === 0) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="glassmorphic-card p-12 rounded-[40px] text-center max-w-md">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
                        <MapPin className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-black text-foreground mb-4">No Centres Found</h2>
                    <p className="text-muted-foreground font-medium mb-8">
                        You need to create a centre before you can book sessions.
                    </p>
                    <Link
                        href="/dashboard/centres"
                        className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all inline-block glow-btn"
                    >
                        Go to Centres
                    </Link>
                </div>
            </div>
        );
    }

    // If only one centre, skip selection
    if (orgCentres.length === 1) {
        const centre = orgCentres[0];
        return <BookingPageContent centre={centre} />;
    }

    // Multiple centres — check if one is selected via URL param
    const selectedCentre = searchParams.centre
        ? orgCentres.find(c => c.id === searchParams.centre)
        : null;

    if (selectedCentre) {
        return <BookingPageContent centre={selectedCentre} />;
    }

    // Show centre picker
    return (
        <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                {/* Back link */}
                <Link
                    href="/dashboard/bookings"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold mb-10 group"
                >
                    <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    Back to Bookings
                </Link>

                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">
                        New Session Booking
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        Select the centre for this booking
                    </p>
                </div>

                <div className="space-y-3">
                    {orgCentres.map(centre => (
                        <Link
                            key={centre.id}
                            href={`/dashboard/bookings/new?centre=${centre.id}`}
                            className="group flex items-center justify-between bg-card border border-border hover:border-primary/40 hover:bg-secondary/40 p-6 rounded-2xl transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                                    <MapPin className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="font-black text-foreground text-lg leading-tight">
                                        {centre.name}
                                    </p>
                                    {centre.address && (
                                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                                            {centre.address}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <ArrowRight className="w-5 h-5 text-primary opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Booking form wrapper ─────────────────────────────────────────────────────

function BookingPageContent({ centre }: { centre: { id: string; name: string; operatingHours?: string | null; address?: string | null } }) {
    return (
        <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Back link */}
                <div className="mb-10">
                    <Link
                        href="/dashboard/bookings"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-all">
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                        Back to Bookings
                    </Link>
                </div>

                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">
                        New Session Booking
                    </h1>
                    <div className="inline-flex items-center gap-1.5 text-muted-foreground font-bold uppercase tracking-widest text-xs">
                        <MapPin className="w-3.5 h-3.5" />
                        {centre.name}
                    </div>
                </div>

                <div className="glassmorphic-card p-8 md:p-12 rounded-[48px]">
                    <BookingForm
                        centreId={centre.id}
                        centreName={centre.name}
                        operatingHours={centre.operatingHours}
                        backToCentresUrl="/dashboard/bookings"
                    />
                </div>
            </div>
        </div>
    );
}
