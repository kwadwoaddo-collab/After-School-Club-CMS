'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { registrations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function assignRegistrationCentre(registrationId: string, centreId: string | null) {
    const session = await auth();
    if (!session?.user) {
        throw new Error('Unauthorized');
    }

    try {
        await db
            .update(registrations)
            .set({ centreId })
            .where(eq(registrations.id, registrationId));

        revalidatePath('/dashboard/registrations');
        return { success: true };
    } catch (error) {
        console.error('Failed to assign centre:', error);
        throw new Error('Failed to assign centre');
    }
}
