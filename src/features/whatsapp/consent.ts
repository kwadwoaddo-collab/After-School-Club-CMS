import { desc, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { whatsappConsents } from '@/db/schema';

export type ConsentState = 'opted_in' | 'opted_out' | null;

/** Newest consent row decides; no row = never opted in (sending is blocked). */
export async function getLatestConsent(orgId: string, parentId: string): Promise<ConsentState> {
    const rows = await db
        .select({ status: whatsappConsents.status })
        .from(whatsappConsents)
        .where(and(eq(whatsappConsents.organisationId, orgId), eq(whatsappConsents.parentId, parentId)))
        .orderBy(desc(whatsappConsents.recordedAt))
        .limit(1);
    return rows[0]?.status ?? null;
}
