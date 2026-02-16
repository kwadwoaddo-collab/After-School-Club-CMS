import BookingForm from '@/features/bookings/components/BookingForm';
import { db } from '@/db';
import { centres, organisations, bookings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { type Metadata } from 'next';

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
    title: `Book Assessment at ${org.centres[0].name} - ${org.name}`,
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
  const { rescheduleId } = (await searchParams) as any; // Allow for different param names if needed

  // Fetch organisation
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Organisation Not Found</h1>
          <p className="text-gray-600 mb-6">We couldn&apos;t find the organisation you&apos;re looking for.</p>
        </div>
      </div>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Centre Not Found</h1>
          <p className="text-gray-600 mb-6">We couldn&apos;t find the centre you&apos;re looking for.</p>
          <a href={`/book/${orgSlug}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
            View all centres
          </a>
        </div>
      </div>
    );
  }

  // Fetch rescheduling data if needed
  let bookingToReschedule = null;
  const rId = (await searchParams).reschedule;
  if (rId) {
    // For now, skip the complex nested query - can be added back if needed
    // This simplification helps avoid connection pool issues
  }

  if (!org || !centre) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Centre Not Found</h1>
          <p className="text-gray-600 mb-6">We couldn&apos;t find the centre you&apos;re looking for.</p>
          <a href={`/book/${orgSlug}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
            View all centres
          </a>
        </div>
      </div>
    );
  }

  const brandColor = org.brandColor || '#4F46E5';

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4" style={{ backgroundColor: `${brandColor}10` }}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border-t-4" style={{ borderColor: brandColor }}>
          <div className="mb-8">
            <div className="flex items-center gap-4">
              {org.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoUrl} alt="Logo" className="h-12 w-auto object-contain" />
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Book an Assessment
                </h1>
                <p className="text-lg text-gray-600">
                  {centre.name}
                </p>
              </div>
            </div>
          </div>

          <BookingForm
            centreId={centre.id}
            centreName={centre.name}
            brandColor={brandColor}
            backToCentresUrl={orgCentres.length > 1 ? `/book/${orgSlug}` : undefined}
            rescheduleData={bookingToReschedule}
          />
        </div>
      </div>
    </div>
  );
}
