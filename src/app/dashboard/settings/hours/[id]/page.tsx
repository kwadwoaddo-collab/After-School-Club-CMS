import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft, Edit2 } from 'lucide-react';
import CentreHoursForm from '@/components/settings/CentreHoursForm';

export default async function EditCentreHoursPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const { id } = await params;

    // Verify centre belongs to this org
    const centre = await db.query.centres.findFirst({
        where: and(
            eq(centres.id, id),
            eq(centres.organisationId, session.user.organisationId)
        ),
    });

    if (!centre) {
        return notFound();
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            href="/dashboard/settings/hours"
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Edit Hours
                        </h1>
                    </div>
                    <p className="text-slate-700 font-medium ml-14">
                        Customising schedule for <strong>{centre.name}</strong>
                    </p>
                </div>
            </div>

            <CentreHoursForm centre={centre} />
        </div>
    );
}
