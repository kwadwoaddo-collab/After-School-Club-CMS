import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar, Plus, Edit2 } from 'lucide-react';

export default async function CentreHoursPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    // Get all centres for this organisation
    const allCentres = await db.query.centres.findMany({
        where: eq(centres.organisationId, org.id),
        orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            href="/dashboard/settings"
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-slate-600" />
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                            Centre Opening Hours
                        </h1>
                    </div>
                    <p className="text-slate-700 font-medium ml-14">
                        Configure operating hours and time slots for each assessment centre
                    </p>
                </div>
            </div>

            {/* Info Card */}
            <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                            How Opening Hours Work
                        </h3>
                        <ul className="text-sm text-slate-700 space-y-1">
                            <li>• Set weekly operating hours for each centre</li>
                            <li>• Define available time slots for assessments</li>
                            <li>• Hours control when bookings can be made</li>
                            <li>• Each centre can have different schedules</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Centres List */}
            {allCentres.length === 0 ? (
                <div className="glass-card rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Centres Yet</h3>
                    <p className="text-slate-600 mb-6">
                        Create an assessment centre first to configure its opening hours
                    </p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30"
                    >
                        <Plus className="w-4 h-4" />
                        Add Your First Centre
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900">
                        Configure Hours by Centre
                    </h2>
                    <div className="grid grid-cols-1 gap-4">
                        {allCentres.map((centre) => (
                            <div
                                key={centre.id}
                                className="glass-card rounded-3xl p-6 hover:shadow-xl transition-all group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-center">
                                                <Clock className="w-5 h-5 text-emerald-700" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900">
                                                    {centre.name}
                                                </h3>
                                                <p className="text-sm text-slate-600">
                                                    {centre.address}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Current Hours Summary */}
                                        <div className="ml-1 mt-4 p-4 bg-slate-50 rounded-2xl">
                                            <p className="text-sm font-semibold text-slate-700 mb-3">
                                                Current Operating Hours
                                            </p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {[
                                                    { day: 'Monday', time: '9:00 AM - 5:00 PM' },
                                                    { day: 'Tuesday', time: '9:00 AM - 5:00 PM' },
                                                    { day: 'Wednesday', time: '9:00 AM - 5:00 PM' },
                                                    { day: 'Thursday', time: '9:00 AM - 5:00 PM' },
                                                    { day: 'Friday', time: '9:00 AM - 5:00 PM' },
                                                    { day: 'Saturday', time: 'Closed' },
                                                    { day: 'Sunday', time: 'Closed' },
                                                ].map((schedule) => (
                                                    <div
                                                        key={schedule.day}
                                                        className="text-xs"
                                                    >
                                                        <p className="font-semibold text-slate-700">
                                                            {schedule.day}
                                                        </p>
                                                        <p className="text-slate-600">
                                                            {schedule.time}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/dashboard/settings/hours/${centre.id}`}
                                        className="ml-4 flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-semibold hover:bg-emerald-100 transition-all group-hover:scale-105"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Edit Hours
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Help Section */}
            <div className="glass-card rounded-3xl p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-6 h-6 text-amber-700" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 mb-2">
                            Need Help Setting Up Hours?
                        </h3>
                        <p className="text-sm text-slate-700 mb-4">
                            Opening hours determine when parents can book assessments at your centres.
                            For best results, ensure hours align with your staff availability and assessment schedules.
                        </p>
                        <ul className="text-sm text-slate-600 space-y-1">
                            <li>• Different centres can have different hours</li>
                            <li>• Time slots are auto-generated from your hours</li>
                            <li>• Parents only see available time slots during open hours</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
