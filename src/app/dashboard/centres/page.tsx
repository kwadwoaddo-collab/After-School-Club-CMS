import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { Plus, MapPin, Users, Calendar, ArrowRight } from 'lucide-react';

export default async function CentresPage() {
    const session = await auth();

    if (!session?.user) return redirect('/login');
    if (!session.user.organisationId) return redirect('/onboarding');
    const userRole = (session.user as any).role;
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) return redirect('/dashboard');

    const [org] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, session.user.organisationId))
        .limit(1);

    if (!org) return redirect('/onboarding');

    // Fetch all centres for this organisation
    const centresList = await db
        .select()
        .from(centres)
        .where(eq(centres.organisationId, org.id));

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Page Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Centres</h1>
                    <p className="text-on-surface-variant font-medium mt-1">
                        Manage your assessment centres and locations
                    </p>
                </div>
                <Link
                    href="/dashboard/centres/add"
                    className="flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn"
                >
                    <Plus className="w-4 h-4" /> Add Centre
                </Link>
            </div>

            {/* Centres Grid */}
            {centresList.length === 0 ? (
                <div className="bg-surface-container-high border border-outline-variant/10 rounded-[32px] p-12 text-center shadow-xl">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No centres yet</h3>
                    <p className="text-on-surface-variant mb-6">
                        Get started by adding your first assessment centre
                    </p>
                    <Link
                        href="/dashboard/centres/add"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg glow-btn shadow-primary/30"
                    >
                        <Plus className="w-4 h-4" /> Add Your First Centre
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {centresList.map((centre) => (
                        <div
                            key={centre.id}
                            className="bg-surface-container-high border border-outline-variant/10 rounded-3xl p-6 hover:border-primary/30 shadow-xl transition-all group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-primary" />
                                </div>
                                <span className="px-3 py-1 bg-tertiary-container/10 text-tertiary border border-tertiary/20 text-xs font-bold rounded-full uppercase tracking-wider">
                                    Active
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2">{centre.name}</h3>

                            {centre.address && (
                                <p className="text-sm text-on-surface-variant opacity-80 mb-4 flex items-start gap-2">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{centre.address}</span>
                                </p>
                            )}

                            <div className="pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Bookings</span>
                                    </div>
                                </div>
                                <Link
                                    href={`/dashboard/bookings?centre=${centre.id}`}
                                    className="px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 flex items-center gap-2 transition-all"
                                >
                                    Manage <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
