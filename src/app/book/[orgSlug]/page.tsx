import { db } from '@/db';
import { organisations, centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { type Metadata } from 'next';
import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';

// Generate metadata for SEO and social sharing
export async function generateMetadata({
    params,
}: {
    params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
    const { orgSlug } = await params;

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
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4"
            style={{ backgroundColor: `${brandColor}08` }}
        >
            {/* V-1 fix: replaced glass-card and legacy shadcn tokens with a clean
                public-facing card that does not look like the internal dashboard. */}
            <div className="max-w-md w-full bg-card rounded-3xl shadow-2xl border border-border/50 overflow-hidden transform transition-all hover:scale-[1.01] duration-300">
                {/* Brand header */}
                <div
                    className="px-8 pt-8 pb-6 text-center"
                    style={{ borderBottom: `3px solid ${brandColor}` }}
                >
                    {org.logoUrl ? (
                        <img
                            src={org.logoUrl}
                            alt={org.name}
                            className="h-16 mx-auto mb-4 object-contain"
                        />
                    ) : (
                        <div
                            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black text-white shadow-lg"
                            style={{ backgroundColor: brandColor }}
                        >
                            {org.name.charAt(0)}
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-on-surface mb-1">Select a Centre</h1>
                    <p className="text-on-surface-variant text-sm">
                        Choose a location to book with <strong className="text-on-surface">{org.name}</strong>.
                    </p>
                </div>

                {/* Centre list */}
                <div className="px-8 py-6 space-y-3">
                    {org.centres.length === 0 ? (
                        <div className="text-center p-4 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-500/20 text-sm">
                            No centres available yet. Please check back soon.
                        </div>
                    ) : (
                        org.centres.map((centre) => (
                            <Link
                                key={centre.id}
                                href={`/book/${orgSlug}/${centre.slug}`}
                                className="group flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/20 bg-surface-dim hover:border-[var(--brand-color)] hover:shadow-md transition-all duration-200"
                                style={{ '--brand-color': brandColor } as React.CSSProperties}
                            >
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-200"
                                    style={{ backgroundColor: `${brandColor}18` }}
                                >
                                    <MapPin className="w-5 h-5" style={{ color: brandColor }} />
                                </div>
                                <span className="flex-1 font-semibold text-on-surface group-hover:text-[var(--brand-color)] transition-colors">
                                    {centre.name}
                                </span>
                                <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-[var(--brand-color)] group-hover:translate-x-1 transition-all duration-200" />
                            </Link>
                        ))
                    )}
                </div>

                <div className="px-8 pb-6 text-center">
                    <Link href="/" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
