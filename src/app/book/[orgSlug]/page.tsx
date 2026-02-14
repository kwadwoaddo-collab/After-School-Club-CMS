import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { type Metadata } from 'next';

// Generate metadata for SEO and social sharing
export async function generateMetadata({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
    const { orgSlug } = await params;

    // Simple fetch for metadata to avoid over-fetching if possible, but for now reuse
    const org = await db.query.organisations.findFirst({
        where: eq(organisations.slug, orgSlug),
    });

    if (!org) {
        return {
            title: 'Organisation Not Found',
        };
    }

    return {
        title: `Book with ${org.name}`,
        description: `Select a centre to book a session with ${org.name}.`,
    };
}

export default async function OrgBookingPage({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}) {
    const { orgSlug } = await params;

    const org = await db.query.organisations.findFirst({
        where: eq(organisations.slug, orgSlug),
        with: {
            centres: true,
        },
    });

    if (!org) {
        notFound();
    }

    // Redirect if only one centre exists
    if (org.centres.length === 1) {
        redirect(`/book/${orgSlug}/${org.centres[0].slug}`);
    }

    const brandColor = org.brandColor || '#4F46E5';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 transform transition-all hover:scale-[1.01] duration-300">
                {org.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={org.logoUrl}
                        alt={org.name}
                        className="h-20 mx-auto mb-6 object-contain"
                    />
                ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                        🏢
                    </div>
                )}

                <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Select a Centre</h1>
                <p className="text-center text-gray-500 mb-8">Choose a location to book your assessment with <strong>{org.name}</strong>.</p>

                <div className="space-y-4">
                    {org.centres.length === 0 ? (
                        <div className="text-center p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
                            No centres available yet.
                        </div>
                    ) : (
                        org.centres.map((centre) => (
                            <Link
                                key={centre.id}
                                href={`/book/${orgSlug}/${centre.slug}`}
                                className="block group relative"
                                style={{ '--brand-color': brandColor } as React.CSSProperties}
                            >
                                <div className="absolute inset-0 bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ backgroundColor: `${brandColor}10` }} />
                                <div className="relative p-4 border border-gray-200 rounded-lg group-hover:border-[var(--brand-color)] transition-all flex justify-between items-center bg-white group-hover:bg-transparent">
                                    <span className="font-medium text-gray-900 group-hover:text-[var(--brand-color)] transition-colors">
                                        {centre.name}
                                    </span>
                                    <span className="text-gray-400 group-hover:text-[var(--brand-color)] transition-colors">→</span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                <div className="mt-8 text-center">
                    <a href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                        ← Back to Home
                    </a>
                </div>
            </div>
        </div>
    );
}
