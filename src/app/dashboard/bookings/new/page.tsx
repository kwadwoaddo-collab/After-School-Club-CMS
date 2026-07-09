import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import BookingForm from '@/features/bookings/components/BookingForm';

export default async function NewBookingPage() {
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/onboarding');
    }

    // Fetch centres for the current organisation
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, session.user.organisationId),
    });

    if (orgCentres.length === 0) {
        return (
            <div className="min-h-screen bg-surface-container flex items-center justify-center p-4">
                <div className="bg-surface-container-high border border-outline-variant/10 shadow-xl p-12 rounded-[40px] text-center max-w-md">
                    <h2 className="text-2xl font-black text-white mb-4">No Centres Found</h2>
                    <p className="text-on-surface-variant font-medium mb-8">You need to create a centre before you can book sessions.</p>
                    <a href="/dashboard/centres" className="px-8 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all inline-block glow-btn">
                        Go to Centres
                    </a>
                </div>
            </div>
        );
    }

    // For now, if there's only one centre, use it. 
    // If there are multiple, in a full app we'd show a selector.
    // In this MVP, we'll default to the first one but show its name.
    const centre = orgCentres[0];

    return (
        <div className="min-h-screen bg-surface-container py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-black text-white tracking-tight mb-2">New Session Booking</h1>
                    <p className="text-on-surface-variant font-bold uppercase tracking-widest text-xs">
                        Location: {centre.name}
                    </p>
                </div>

                <div className="bg-surface-container-high p-8 md:p-12 rounded-[48px] shadow-2xl border border-outline-variant/10">
                    <BookingForm
                        centreId={centre.id}
                        centreName={centre.name}
                        operatingHours={centre.operatingHours}
                        backToCentresUrl="/dashboard"
                    />
                </div>
            </div>
        </div>
    );
}
