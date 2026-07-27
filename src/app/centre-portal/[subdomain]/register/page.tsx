import { db } from '@/db';
import { centres, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

interface Props {
    params: Promise<{ subdomain: string }>;
}

/**
 * Centre portal registration route.
 *
 * The existing registration form lives at /register/[orgSlug]/[centreSlug]
 * and is a full client-side form that handles everything (centre selection,
 * fees intro, multi-step wizard, PDF download, etc.).
 *
 * Rather than duplicating all that logic, we resolve the centre from the
 * subdomain and redirect to the existing form URL — keeping the browser URL
 * clean because the redirect happens before the page renders.
 *
 * e.g. dagenham.sprintscaleit.co.uk/register
 *   → /register/sydenham-after-school-club-ltd-xxxx/dagenham-after-school-club-xxxx
 */
export default async function CentrePortalRegister({ params }: Props) {
    const { subdomain } = await params;

    const centre = await db.query.centres.findFirst({
        where: eq(centres.subdomain, subdomain),
        columns: { id: true, slug: true, organisationId: true },
    });

    if (!centre) notFound();

    const org = await db.query.organisations.findFirst({
        where: eq(organisations.id, centre.organisationId),
        columns: { slug: true },
    });

    if (!org) notFound();

    // Hard redirect to the existing registration form URL
    // The form auto-selects the centre because centreSlug is in the URL
    redirect(`/register/${org.slug}/${centre.slug}`);
}
