import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import SettingsTabs from '@/components/settings/SettingsTabs';

export const metadata: Metadata = {
    title: 'Workspace Settings',
    description: 'Manage your organization profile, opening hours, branding, pricing, and form options.',
};

export default async function SettingsPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    if ((session.user as any).role !== 'ORG_OWNER') return redirect('/dashboard');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    // Fetch all organization centres
    const orgCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, org.id),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://after-school-club-live.vercel.app';

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Workspace Settings</h1>
                <p className="text-sm text-[#8c909f] mt-1">
                    Manage your club configuration, billing details, custom branding, and schedules.
                </p>
            </div>

            <SettingsTabs 
                org={org} 
                centres={orgCentres} 
                baseUrl={baseUrl} 
            />
        </div>
    );
}
