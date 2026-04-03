import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { centres, centreAvailabilityRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DayRule } from './actions';
import AvailabilityForm from './AvailabilityForm';

export default async function EditAvailabilityPage({ params }: { params: Promise<{ centreId: string }> }) {
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/onboarding');
    }

    const { centreId } = await params;

    const [centre] = await db
        .select()
        .from(centres)
        .where(eq(centres.id, centreId))
        .limit(1);

    if (!centre) {
        notFound();
    }

    // Verify ownership
    if (centre.organisationId !== session.user.organisationId) {
        // Technically this should be 403, but notFound hides existence
        notFound();
    }

    const existingRules = await db
        .select()
        .from(centreAvailabilityRules)
        .where(eq(centreAvailabilityRules.centreId, centreId));

    // Prepare initial data for the form
    // We want all 7 days represented, whether they have a rule in DB or not.
    // Default open: 09:00 - 18:00
    const initialRules: DayRule[] = Array.from({ length: 7 }).map((_, i) => {
        const found = existingRules.find(r => r.dayOfWeek === i);
        return {
            dayOfWeek: i,
            isOpen: !!found,
            startTime: found?.startTime || '09:00',
            endTime: found?.endTime || '18:00',
        };
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <AvailabilityForm
                centreId={centreId}
                centreName={centre.name}
                initialRules={initialRules}
            />
        </div>
    );
}
