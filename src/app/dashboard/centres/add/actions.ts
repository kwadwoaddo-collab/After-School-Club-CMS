'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { redirect } from 'next/navigation';

export async function createCentre(prevState: any, formData: FormData) {
    const session = await auth();
    if (!session?.user?.organisationId) {
        return { message: 'Unauthorized' };
    }
 
    const userRole = (session.user as any).role;
    if (!['ORG_OWNER', 'MANAGER'].includes(userRole)) {
        return { message: 'Forbidden: Insufficient privileges.' };
    }

    const name = formData.get('name') as string;
    const address = formData.get('address') as string;

    if (!name || name.length < 3) {
        return { message: 'Name must be at least 3 characters long.' };
    }

    // Generate a slug based on name + random string to ensure uniqueness
    const randomString = Math.random().toString(36).substring(2, 7);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomString}`;

    try {
        await db.insert(centres).values({
            organisationId: session.user.organisationId,
            name,
            address: address || null,
            slug,
            timezone: 'Europe/London', // Default for now
        });
    } catch (e) {
        console.error('Failed to create centre:', e);
        return { message: 'Failed to create centre. Please try again.' };
    }

    redirect('/dashboard');
}
