/* eslint-disable @typescript-eslint/no-explicit-any */
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/require-auth';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { getTrustedApplicationUrl } from '@/lib/base-url';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import SettingsTabs from '@/features/settings/components/SettingsTabs';

export const metadata: Metadata = {
    title: 'Workspace Settings',
    description: 'Manage your organisation profile, opening hours, branding, pricing, and form options.',
};

export default async function SettingsPage() {
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    const userRole = (session.user as any)?.role;
    const isOwner = userRole === 'ORG_OWNER';

    // Fetch discount_rules using raw sql since it's not in the Drizzle schema
    const result = await db.execute(
        sql`SELECT discount_rules FROM organisations WHERE id = ${session.user.organisationId} LIMIT 1`
    );
    const row = (result as any)[0] ?? (result as any).rows?.[0];
    const discountRules = row?.discount_rules ?? [];

    // Fetch organization centres: all for owners, scoped to accessible centres for managers
    const orgCentres = isOwner
        ? await db.query.centres.findMany({
            where: eq(centres.organisationId, org.id),
            orderBy: (centres, { asc }) => [asc(centres.name)],
        })
        : await getUserAccessibleCentres(session.user.id);

    const baseUrl = getTrustedApplicationUrl();

    // Augment org with discountRules
    const orgWithDiscounts = {
        ...org,
        discountRules,
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div>
                <h1 className="text-page-title text-text">Workspace Settings</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage your club configuration, billing details, custom branding, and schedules.
                </p>
            </div>

            <SettingsTabs 
                org={orgWithDiscounts} 
                centres={orgCentres} 
                baseUrl={baseUrl} 
                isOwner={isOwner}
            />
        </div>
    );
}
