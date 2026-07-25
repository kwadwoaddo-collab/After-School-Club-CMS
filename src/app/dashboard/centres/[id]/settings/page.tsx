/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import CentreSettingsClient from './CentreSettingsClient';

export default async function CentreSettingsPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    const userRole = (session.user as any).role;
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) return redirect('/dashboard');

    const resolvedParams = await params;
    
    const [centre] = await db
        .select()
        .from(centres)
        .where(
            and(
                eq(centres.id, resolvedParams.id),
                eq(centres.organisationId, session.user.organisationId)
            )
        )
        .limit(1);

    if (!centre) {
        return redirect('/dashboard/centres');
    }

    return <CentreSettingsClient centre={centre} />;
}
