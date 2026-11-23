import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { getTrustedApplicationUrl } from '@/lib/base-url';

interface Props {
    params: Promise<{ subdomain: string }>;
}

/**
 * Centre / organisation portal registration route.
 *
 * IMPORTANT (DC-01): Must redirect to the canonical application origin
 * (`getTrustedApplicationUrl()`), NOT a relative `/register/...` path!
 * A relative redirect stays on `<subdomain>.sprintscaleit.co.uk/register/...`,
 * which `proxy.ts` rewrites right back here in an infinite 307 loop.
 */
export default async function CentrePortalRegister({ params }: Props) {
    const { subdomain } = await params;
    const appUrl = getTrustedApplicationUrl();

    const centre = await db.query.centres.findFirst({
        where: eq(centres.subdomain, subdomain),
        columns: { id: true, slug: true, organisationId: true },
    });

    if (centre) {
        const org = await db.query.organisations.findFirst({
            where: eq(organisations.id, centre.organisationId),
            columns: { slug: true, approvalStatus: true },
        });

        if (org && org.approvalStatus === 'ACTIVE') {
            redirect(`${appUrl}/register/${org.slug}/${centre.slug}`);
        }
    }

    // JC-04: Fall back to organisation-level subdomain when no active centre matched
    const org = await db.query.organisations.findFirst({
        where: eq(organisations.subdomain, subdomain),
        columns: { slug: true, approvalStatus: true },
    });

    if (!org || org.approvalStatus !== 'ACTIVE') {
        notFound();
    }

    redirect(`${appUrl}/register/${org.slug}`);
}
