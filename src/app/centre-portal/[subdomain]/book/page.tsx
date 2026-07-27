import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import BookingForm from '@/features/bookings/components/BookingForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

interface Props {
    params: Promise<{ subdomain: string }>;
}

async function getCentreBySubdomain(subdomain: string) {
    const centre = await db.query.centres.findFirst({
        where: eq(centres.subdomain, subdomain),
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
        title: `Book a Session — ${data.centre.name}`,
        description: `Book your child's session at ${data.centre.name}.`,
    };
}

export default async function CentrePortalBook({ params }: Props) {
    const { subdomain } = await params;
    const data = await getCentreBySubdomain(subdomain);

    if (!data) notFound();

    const { centre, org } = data;
    const brandColor = org.brandColor || '#4F46E5';

    return (
        <div className="min-h-screen px-4 py-10">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/"
                        id="portal-book-back"
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                        aria-label="Back to home"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="flex items-center gap-3">
                        {org.logoUrl && (
                            <img src={org.logoUrl} alt={org.name} className="h-8 w-auto object-contain rounded-lg" />
                        )}
                        <div>
                            <h1 className="text-white font-bold text-lg leading-tight">Book a Session</h1>
                            <p className="text-white/50 text-xs">{centre.name}</p>
                        </div>
                    </div>
                </div>

                {/* Booking form card */}
                <div
                    className="bg-white/5 backdrop-blur-xl rounded-[24px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden"
                    style={{ borderTopColor: brandColor, borderTopWidth: '3px' }}
                >
                    <div className="p-6 sm:p-8">
                        <BookingForm
                            centreId={centre.id}
                            centreName={centre.name}
                            operatingHours={centre.operatingHours}
                            brandColor={brandColor}
                        />
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-white/20 mt-8">
                    Powered by <span className="text-white/30 font-semibold">SprintScale</span>
                </p>
            </div>
        </div>
    );
}
