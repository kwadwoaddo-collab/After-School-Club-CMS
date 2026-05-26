import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { ilike, eq, and } from 'drizzle-orm';

/**
 * One-time seed endpoint to populate centre billing data.
 * Only accessible by ORG_OWNER. Call once from the browser, then this file can be deleted.
 * GET /api/admin/seed-centre-billing
 */
export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session.user as any).role !== 'ORG_OWNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.user.organisationId) return NextResponse.json({ error: 'No org' }, { status: 400 });

    const orgId = session.user.organisationId;

    const results: any[] = [];

    // --- Sydenham ---
    const sydenhamRows = await db
        .select({ id: centres.id, name: centres.name })
        .from(centres)
        .where(and(
            eq(centres.organisationId, orgId),
            ilike(centres.name, '%sydenham%')
        ));

    for (const c of sydenhamRows) {
        await db.update(centres).set({
            ofstedId: '2854827',
            billingPhone: '07931 173699',
            bankName: 'SYDENHAM AFTER SCHOOL CLUB LTD',
            sortCode: '09-01-29',
            accountNo: '32638392',
            updatedAt: new Date(),
        }).where(eq(centres.id, c.id));
        results.push({ centre: c.name, updated: 'ofstedId, billingPhone, bankName, sortCode, accountNo' });
    }

    // --- Heathway / Dagenham ---
    const heathwayRows = await db
        .select({ id: centres.id, name: centres.name })
        .from(centres)
        .where(and(
            eq(centres.organisationId, orgId),
            ilike(centres.name, '%heathway%')
        ));

    for (const c of heathwayRows) {
        await db.update(centres).set({
            ofstedId: '2854826',
            billingPhone: '07456 480797',
            bankName: 'SYDENHAM AFTER SCHOOL CLUB LTD trading as Heathway After School Club',
            sortCode: '04-00-03',
            accountNo: '06114414',
            updatedAt: new Date(),
        }).where(eq(centres.id, c.id));
        results.push({ centre: c.name, updated: 'ofstedId, billingPhone, bankName, sortCode, accountNo' });
    }

    if (results.length === 0) {
        // List all centres so we can debug name matching
        const all = await db
            .select({ id: centres.id, name: centres.name })
            .from(centres)
            .where(eq(centres.organisationId, orgId));
        return NextResponse.json({ 
            warning: 'No centres matched. Check names below and adjust the ILIKE patterns.',
            allCentres: all
        });
    }

    return NextResponse.json({ success: true, updated: results });
}
