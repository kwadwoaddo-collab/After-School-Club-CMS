import BookingForm from '@/features/bookings/components/BookingForm';
import { db } from '@/db';
import { centres, organisations, bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { type Metadata } from 'next';
import { normalizeString } from '@/lib/search-params';
import { MapPin } from 'lucide-react';

// Shared error card component — V-2 fix: uses CMS tokens, not legacy shadcn
function PublicErrorCard({ title, description, backHref, backLabel }: {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="bg-card border border-outline-variant/20 rounded-3xl shadow-xl p-8 text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-7 h-7 text-error" />
        </div>
        <h1 className="text-2xl font-bold text-on-surface mb-2">{title}</h1>
        <p className="text-on-surface-variant mb-6 text-sm leading-relaxed">{description}</p>
        {backHref && backLabel && (
          <a
            href={backHref}
            className="inline-block text-sm font-semibold px-6 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface hover:bg-surface-dim transition-colors"
          >
            {backLabel}
          </a>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string; centreSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug, centreSlug } = await params;

  const org = await db.query.organisations.findFirst({
    where: eq(organisations.slug, orgSlug),
    with: {
      centres: {
        where: eq(centres.slug, centreSlug),
        limit: 1,
      },
    },
  });

  if (!org || org.centres.length === 0) {
    return { title: 'Centre Not Found' };
  }

  return {
    title: `Book Session at ${org.centres[0].name} - ${org.name}`,
  };
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; centreSlug: string }>;
  searchParams: Promise<{ reschedule?: string }>;
}) {
  const { orgSlug, centreSlug } = await params;
  const rawSearchParams = await searchParams;

  // Fetch organisation
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return (
      <PublicErrorCard
        title="Organisation Not Found"
        description="We couldn't find the organisation you're looking for."
      />
    );
  }

  // Fetch all centres for this organisation
  const orgCentres = await db
    .select()
    .from(centres)
    .where(eq(centres.organisationId, org.id));

  const centre = orgCentres.find(c => c.slug === centreSlug);

  if (!centre) {
    return (
      <PublicErrorCard
        title="Centre Not Found"
        description="We couldn't find the centre you're looking for."
        backHref={`/book/${orgSlug}`}
        backLabel="View all centres"
      />
    );
  }

  // Rescheduling data placeholder (complex nested query deferred for connection-pool safety)
  const bookingToReschedule = null;
  const rId = normalizeString(rawSearchParams.reschedule);
  if (rId) {
    // Intentionally deferred: rescheduling prefill via the staff-dashboard route
  }

  const brandColor = org.brandColor || '#4F46E5';

  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{ backgroundColor: `${brandColor}08` }}
    >
      <div className="max-w-2xl mx-auto">
        {/* V-2 fix: replaced legacy bg-card/text-foreground/border-border with CMS tokens.
            The card uses a welcoming public presentation, not the internal dashboard layout. */}
        <div
          className="bg-card text-on-surface rounded-3xl shadow-xl border border-outline-variant/20 overflow-hidden"
          style={{ borderTopColor: brandColor, borderTopWidth: '4px' }}
        >
          <div className="px-8 pt-8 pb-4">
            <div className="flex items-center gap-4 mb-1">
              {org.logoUrl && (
                <img src={org.logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-on-surface">Book a Session</h1>
                <p className="text-sm text-on-surface-variant">{centre.name}</p>
              </div>
            </div>
          </div>

          <div className="px-8 pb-8">
            <BookingForm
              centreId={centre.id}
              centreName={centre.name}
              operatingHours={centre.operatingHours}
              brandColor={brandColor}
              backToCentresUrl={orgCentres.length > 1 ? `/book/${orgSlug}` : undefined}
              rescheduleData={bookingToReschedule}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
