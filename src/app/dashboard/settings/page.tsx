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

    const orgId = session.user.organisationId;
    const userRole = (session.user as any)?.role;
    const isOwner = userRole === 'ORG_OWNER';

    const [[org], result, orgCentres] = await Promise.all([
        db
            .select()
            .from(organisations)
            .where(eq(organisations.id, orgId))
            .limit(1),
        db.execute(
            sql`SELECT discount_rules FROM organisations WHERE id = ${orgId} LIMIT 1`
        ),
        isOwner
            ? db.query.centres.findMany({
                where: eq(centres.organisationId, orgId),
                orderBy: (centres, { asc }) => [asc(centres.name)],
            })
            : getUserAccessibleCentres(session.user.id),
    ]);

    if (!org) return redirect('/onboarding');

    const row = (result as any)[0] ?? (result as any).rows?.[0];
    const discountRules = row?.discount_rules ?? [];
    const baseUrl = getTrustedApplicationUrl();

    const orgWithDiscounts = {
        ...org,
        discountRules,
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
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
