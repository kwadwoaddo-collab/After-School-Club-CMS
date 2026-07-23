/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq, ilike, or, and } from 'drizzle-orm';

/**
 * One-time seed endpoint to populate centre billing data.
 * Only accessible by ORG_OWNER. Visit once, then this file can be deleted.
 * GET /api/admin/seed-centre-billing
 */
export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session.user as any).role !== 'ORG_OWNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!session.user.organisationId) return NextResponse.json({ error: 'No org' }, { status: 400 });

    const orgId = session.user.organisationId;

    // First: list ALL centres so we can see what's there
    const all = await db
        .select({ id: centres.id, name: centres.name, address: centres.address, ofstedId: centres.ofstedId })
        .from(centres)
        .where(eq(centres.organisationId, orgId));

    const results: unknown[] = [];

    for (const c of all) {
        const addr = (c.address || '').toLowerCase();
        const name = (c.name || '').toLowerCase();

        // Sydenham: matches SE26 in address OR 'sydenham' in name
        if (addr.includes('se26') || name.includes('sydenham')) {
            await db.update(centres).set({
                ofstedId: '2854827',
                billingPhone: '07931 173699',
                bankName: 'SYDENHAM AFTER SCHOOL CLUB LTD',
                sortCode: '09-01-29',
                accountNo: '32638392',
                updatedAt: new Date(),
            }).where(eq(centres.id, c.id));
            results.push({ centre: c.name, matched: 'Sydenham', fields: 'ofstedId=2854827, phone=07931 173699, bank set' });
        }

        // Heathway/Dagenham: matches RM10 in address OR 'heathway'/'dagenham' in name
        else if (addr.includes('rm10') || name.includes('heathway') || name.includes('dagenham')) {
            await db.update(centres).set({
                ofstedId: '2854826',
                billingPhone: '07456 480797',
                bankName: 'SYDENHAM AFTER SCHOOL CLUB LTD trading as Heathway After School Club',
                sortCode: '04-00-03',
                accountNo: '06114414',
                address: '11 The Mall\nHeathway\nDagenham\nRM10 8RE',
                updatedAt: new Date(),
            }).where(eq(centres.id, c.id));
            results.push({ centre: c.name, matched: 'Heathway/Dagenham', fields: 'ofstedId=2854826, phone=07456 480797, bank set, address fixed' });
        }
    }

    return NextResponse.json({
        success: results.length > 0,
        allCentresFound: all.map(c => ({ name: c.name, address: c.address?.slice(0, 60), currentOfstedId: c.ofstedId })),
        updated: results,
        message: results.length === 0
            ? 'NO CENTRES MATCHED — check allCentresFound above and report the centre names'
            : `Updated ${results.length} centre(s) successfully. Regenerate an invoice to see the changes.`,
    });
}
