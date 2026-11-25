import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getTrustedApplicationUrl } from '@/lib/base-url';
import { CalendarDays, ClipboardList, MapPin, Clock, ArrowRight, Phone, Mail } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
    params: Promise<{ subdomain: string }>;
}

async function resolvePortalBySubdomain(subdomain: string) {
    const centre = await db.query.centres.findFirst({
        where: eq(centres.subdomain, subdomain),
        columns: {
            id: true, name: true, address: true, operatingHours: true,
            organisationId: true, slug: true, billingPhone: true, billingEmail: true,
        },
    });

    if (centre) {
        const org = await db.query.organisations.findFirst({
            where: eq(organisations.id, centre.organisationId),
            columns: { id: true, name: true, logoUrl: true, brandColor: true, slug: true, approvalStatus: true },
        });
        if (org && org.approvalStatus === 'ACTIVE') {
            return { kind: 'centre' as const, centre, org };
        }
    }

    const org = await db.query.organisations.findFirst({
        where: eq(organisations.subdomain, subdomain),
        columns: {
            id: true, name: true, logoUrl: true, brandColor: true, slug: true,
            address: true, contactPhone: true, contactEmail: true, approvalStatus: true,
        },
        with: {
            centres: {
                columns: { id: true, name: true, slug: true, address: true },
            },
        },
    });

    if (!org || org.approvalStatus !== 'ACTIVE') {
        return null;
    }

    return { kind: 'org' as const, org, centres: org.centres };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const data = await resolvePortalBySubdomain(subdomain);
    if (!data) return { title: { absolute: 'Centre Not Found' } };
    const displayName = data.kind === 'centre' ? data.centre.name : data.org.name;
    return {
        title: { absolute: `${displayName} — Book or Register` },
        description: `Book a session or register your child at ${displayName}, powered by SprintScale.`,
    };
}

export default async function CentrePortalLanding({ params }: Props) {
    const { subdomain } = await params;
    const data = await resolvePortalBySubdomain(subdomain);

    if (!data) notFound();

    const { org } = data;
    const brandColor = org.brandColor || '#0D9488';
    const appUrl = getTrustedApplicationUrl();

    const displayName = data.kind === 'centre' ? data.centre.name : data.org.name;
    const address = data.kind === 'centre' ? data.centre.address : data.org.address;
    const phone = data.kind === 'centre' ? data.centre.billingPhone : data.org.contactPhone;
    const email = data.kind === 'centre' ? data.centre.billingEmail : data.org.contactEmail;
    const operatingHours = data.kind === 'centre' ? data.centre.operatingHours : null;

    const bookHref = data.kind === 'centre' ? '/book' : `${appUrl}/book/${org.slug}`;
    const registerHref =
        data.kind === 'centre'
            ? `${appUrl}/register/${org.slug}/${data.centre.slug}`
            : `${appUrl}/register/${org.slug}`;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
            {/* Logo + org name */}
            <div className="flex flex-col items-center gap-4 mb-12 text-center">
                {org.logoUrl ? (
                    <img
                        src={org.logoUrl}
                        alt={displayName}
                        className="h-16 w-auto object-contain rounded-2xl"
                    />
                ) : (
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg"
                        style={{ backgroundColor: brandColor }}
                    >
                        {displayName[0] || org.name[0]}
                    </div>
                )}
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">{displayName}</h1>
                    {org.name !== displayName && (
                        <p className="text-white/70 text-xs mt-1">{org.name}</p>
                    )}
                </div>

                {/* Centre / Org info pills */}
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {address && (
                        <span className="flex items-center gap-1.5 text-xs text-white/75 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                            <MapPin className="w-3 h-3" />
                            {address}
                        </span>
                    )}
                    {phone && (
                        <a href={`tel:${phone}`} className="min-h-11 inline-flex items-center gap-1.5 text-xs text-white/75 hover:text-white bg-white/5 border border-white/10 rounded-full px-3.5 py-2 transition-colors break-all sm:break-normal">
                            <Phone className="w-3 h-3" />
                            {phone}
                        </a>
                    )}
                    {email && (
                        <a href={`mailto:${email}`} className="min-h-11 inline-flex items-center gap-1.5 text-xs text-white/75 hover:text-white bg-white/5 border border-white/10 rounded-full px-3.5 py-2 transition-colors break-all sm:break-normal">
                            <Mail className="w-3 h-3" />
                            {email}
                        </a>
                    )}
                    {operatingHours && (
                        <span className="flex items-center gap-1.5 text-xs text-white/75 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
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
                    href={bookHref}
                    id="portal-book-btn"
                    className="group flex items-center gap-4 sm:gap-5 w-full p-4 sm:p-6 rounded-[24px] bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.99]"
                >
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110"
                        style={{ backgroundColor: `${brandColor}25`, border: `1px solid ${brandColor}40` }}
                    >
                        <CalendarDays className="w-7 h-7" style={{ color: brandColor }} />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-white font-bold text-lg leading-tight">Book a Session</p>
                        <p className="text-white/75 text-sm mt-0.5">Reserve your child&apos;s place in a session</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/70 group-hover:text-white/75 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                </Link>

                {/* Register My Child */}
                <Link
                    href={registerHref}
                    id="portal-register-btn"
                    className="group flex items-center gap-4 sm:gap-5 w-full p-4 sm:p-6 rounded-[24px] bg-white/5 border border-white/10 backdrop-blur-xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.99]"
                >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 shadow-lg transition-transform duration-300 group-hover:scale-110">
                        <ClipboardList className="w-7 h-7 text-white/70" />
                    </div>
                    <div className="flex-1 text-left">
                        <p className="text-white font-bold text-lg leading-tight">Register My Child</p>
                        <p className="text-white/75 text-sm mt-0.5">Complete the registration form for a new student</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/70 group-hover:text-white/75 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                </Link>
            </div>

            {/* Staff login link */}
            <div className="mt-12 text-center">
                <Link
                    href="/staff-login"
                    className="min-h-11 inline-flex items-center px-3 text-xs text-white/70 hover:text-white transition-colors"
                >
                    Staff login →
                </Link>
            </div>

            {/* Footer */}
            <p className="mt-8 text-xs text-white/70">
                Powered by <span className="text-white/70 font-semibold">SprintScale</span>
            </p>
        </div>
    );
}
