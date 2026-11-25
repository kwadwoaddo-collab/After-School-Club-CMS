import { requireAuth } from '@/lib/require-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import WondeSettingsClient from './WondeSettingsClient';

export default async function WondeSettingsPage() {
    const { session } = await requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] });

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    return (
        <div className="space-y-6">
            <div>
                <Link
                    href="/dashboard/settings"
                    className="inline-flex min-h-11 items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    Back to Settings
                </Link>
            </div>

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-page-title text-text">
                        Wonde MIS Integration
                    </h1>
                    <p className="text-small-body text-text-secondary mt-1">
                        Sync students and parent contacts directly from your school&apos;s MIS.
                    </p>
                </div>
            </div>

            {/* Content */}
            <WondeSettingsClient orgName={org.name} lastSync={org.updatedAt} />
        </div>
    );
}
