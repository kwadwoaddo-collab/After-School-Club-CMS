import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { centres, centreAvailabilityRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ChevronDown, Clock, MapPin } from '@/components/ui/Icons';
import Link from 'next/link';

export default async function AvailabilityPage() {
    const session = await auth();

    if (!session?.user?.organisationId) {
        redirect('/login');
    }

    const orgId = session.user.organisationId;

    // Fetch centres and their rules
    const centresList = await db.query.centres.findMany({
        where: eq(centres.organisationId, orgId),
        with: {
            availabilityRules: true
        }
    });

    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Availability Settings</h1>
                        <p className="text-gray-500">Manage opening hours for your centres</p>
                    </div>
                    <Link
                        href="/dashboard"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                    >
                        ← Back to Dashboard
                    </Link>
                </header>

                <div className="space-y-6">
                    {centresList.map(centre => (
                        <div key={centre.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">{centre.name}</h2>
                                        <p className="text-sm text-gray-500">{centre.timezone}</p>
                                    </div>
                                </div>
                                <Link
                                    href={`/dashboard/availability/${centre.id}`}
                                    className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                >
                                    Edit Hours
                                </Link>
                            </div>

                            <div className="p-6">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Weekly Schedule</h3>
                                <div className="grid gap-4">
                                    {DAYS.map((day, index) => {
                                        const rule = centre.availabilityRules.find(r => r.dayOfWeek === index);
                                        const isClosed = !rule;

                                        return (
                                            <div key={day} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 px-2 rounded transition-colors">
                                                <span className="font-medium text-gray-700 w-32">{day}</span>

                                                <div className="flex items-center gap-3 flex-1 justify-end">
                                                    {isClosed ? (
                                                        <span className="text-sm text-gray-400 italic">Closed</span>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-sm text-gray-900 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                                            <Clock className="w-4 h-4 text-green-600" />
                                                            <span>{rule.startTime} - {rule.endTime}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {centresList.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                            <p className="text-gray-500">No centres found. Please create a centre first.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
