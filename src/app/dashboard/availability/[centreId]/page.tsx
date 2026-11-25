/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTenantSession } from '@/lib/session';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { centres, centreAvailabilityRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DayRule } from './actions';
import AvailabilityForm from './AvailabilityForm';
import { canUserAccessCentre } from '@/lib/permissions';

export default async function EditAvailabilityPage({ params }: { params: Promise<{ centreId: string }> }) {
    const { centreId } = await params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(centreId)) {
        notFound();
    }

    const session = await requireTenantSession();
    if (!session?.user?.id) {
        redirect('/login');
    }

    if (!session.user.organisationId) {
        redirect('/onboarding');
    }

    const userRole = (session.user as any).role || 'TUTOR';
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) {
        redirect('/dashboard');
    }

    const [hasAccess, [centre], existingRules] = await Promise.all([
        canUserAccessCentre(session.user.id, centreId),
        db
            .select()
            .from(centres)
            .where(eq(centres.id, centreId))
            .limit(1),
        db
            .select()
            .from(centreAvailabilityRules)
            .where(eq(centreAvailabilityRules.centreId, centreId)),
    ]);

    if (!hasAccess) {
        redirect('/dashboard');
    }

    if (!centre || centre.organisationId !== session.user.organisationId) {
        notFound();
    }

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
        <div className="min-h-screen bg-secondary/40">
            <AvailabilityForm
                centreId={centreId}
                centreName={centre.name}
                initialRules={initialRules}
            />
        </div>
    );
}
