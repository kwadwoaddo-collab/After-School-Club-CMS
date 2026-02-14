import RegistrationForm from '@/components/registration/RegistrationForm';
import { notFound } from 'next/navigation';

export const metadata = {
    title: 'Student Registration - After School Club',
    description: 'Register your child for lessons',
};

// TODO: Fetch actual tenant details from database based on slug
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';

const getCentreDetails = async (slug: string) => {
    const centre = await db.query.centres.findFirst({
        where: eq(centres.slug, slug),
        with: {
            organisation: true,
        }
    });

    if (!centre) return null;

    return {
        id: centre.id,
        name: centre.name,
        slug: centre.slug,
        brandColor: centre.organisation?.brandColor,
        logoUrl: centre.organisation?.logoUrl,
    };
};

interface PageProps {
    params: Promise<{
        centreSlug: string;
    }>;
}

export default async function RegistrationPage(props: PageProps) {
    const params = await props.params;
    const centre = await getCentreDetails(params.centreSlug);

    if (!centre) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto mb-12 text-center">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
                    Student Registration
                </h1>
                <p className="text-lg text-gray-600">
                    Join {centre.name} for expert tuition in Maths, English, and Science.
                </p>
            </div>

            <RegistrationForm centreId={centre.id} centreName={centre.name} />

            <div className="mt-12 text-center text-sm text-gray-400">
                <p>Protected by reCAPTCHA and the Google Privacy Policy and Terms of Service apply.</p>
            </div>
        </div>
    );
}
