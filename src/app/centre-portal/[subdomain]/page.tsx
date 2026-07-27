import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { CalendarDays, ClipboardList, MapPin, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
    params: Promise<{ subdomain: string }>;
}

async function getCentreBySubdomain(subdomain: string) {
    const centre = await db.query.centres.findFirst({
        where: eq(centres.subdomain, subdomain),
        columns: {
            id: true, name: true, address: true, operatingHours: true,
            organisationId: true, slug: true,
        },
    });
    if (!centre) return null;

    const org = await db.query.organisations.findFirst({
        where: eq(organisations.id, centre.organisationId),
        columns: { id: true, name: true, logoUrl: true, brandColor: true, slug: true },
    });
    return org ? { centre, org } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const data = await getCentreBySubdomain(subdomain);
    if (!data) return { title: 'Centre Not Found' };
    return {
        title: `${data.centre.name} — Book or Register`,
        description: `Book a session or register your child at ${data.centre.name}, powered by SprintScale.`,
    };
}

export default async function CentrePortalLanding({ params }: Props) {
    const { subdomain } = await params;
    const data = await getCentreBySubdomain(subdomain);

    if (!data) notFound();

    const { centre, org } = data;
    const brandColor = org.brandColor || '#4F46E5';

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
            {/* Logo + org name */}
            <div className="flex flex-col items-center gap-4 mb-12 text-center">
                {org.logoUrl ? (
                    <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="h-16 w-auto object-contain rounded-2xl"
                    />
                ) : (
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg"
                        style={{ backgroundColor: brandColor }}
                    >
                        {org.name[0]}
                    </div>
                )}
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{centre.name}</h1>
                    <p className="text-white/50 text-sm mt-1">{org.name}</p>
                </div>

                {/* Centre info pills */}
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {centre.address && (
                        <span className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                            <MapPin className="w-3 h-3" />
                            {centre.address}
                        </span>
                    )}
                    {centre.operatingHours && (
                        <span className="flex items-center gap-1.5 text-xs text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                            <Clock className="w-3 h-3" />
                            Open
                        </span>
                    )}
                </div>
            </div>

            {/* Action cards */}
            <div className="w-full max-w-md space-y-4">
                {/* Book a Session */}
                <Link
                    href="/book"
                    id="portal-book-btn"
                    className="group flex items-center gap-5 w-full p-6 rounded-[24px] bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.99]"
                >
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110"
                        style={{ backgroundColor: `${brandColor}25`, border: `1px solid ${brandColor}40` }}
                    >
                        <CalendarDays className="w-7 h-7" style={{ color: brandColor }} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-white font-bold text-lg leading-tight">Book a Session</p>
                        <p className="text-white/50 text-sm mt-0.5">Reserve your child&apos;s place in a session</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                </Link>

                {/* Register My Child */}
                <Link
                    href="/register"
                    id="portal-register-btn"
                    className="group flex items-center gap-5 w-full p-6 rounded-[24px] bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.99]"
                >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 shadow-lg transition-transform duration-300 group-hover:scale-110">
                        <ClipboardList className="w-7 h-7 text-white/70" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-white font-bold text-lg leading-tight">Register My Child</p>
                        <p className="text-white/50 text-sm mt-0.5">Complete the registration form for a new student</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                </Link>
            </div>

            {/* Staff login link */}
            <div className="mt-12 text-center">
                <Link
                    href="/login"
                    className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                    Staff login →
                </Link>
            </div>

            {/* Footer */}
            <p className="mt-8 text-xs text-white/20">
                Powered by <span className="text-white/30 font-semibold">SprintScale</span>
            </p>
        </div>
    );
}
