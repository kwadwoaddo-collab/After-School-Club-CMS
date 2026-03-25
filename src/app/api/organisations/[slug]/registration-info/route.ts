import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** Default pricing — overridden per org via registrationPricing column */
const DEFAULT_PRICING = { selfFinanceRate: 20, taxCreditRate: 30 };

/**
 * GET /api/organisations/[slug]/registration-info
 * Public endpoint — returns org name, logo, T&Cs, session slots, and pricing for the registration form.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;

    const org = await db.query.organisations.findFirst({
        where: eq(organisations.slug, slug),
        with: {
            centres: {
                columns: {
                    id: true,
                    name: true,
                    address: true,
                    slug: true,
                    operatingHours: true,
                    sessionSlots: true,
                    feesSelfFinance: true,
                    feesAssistedFinance: true,
                },
            },
        },
        columns: {
            id: true,
            name: true,
            logoUrl: true,
            brandColor: true,
            registrationTerms: true,
            contactEmail: true,
            sessionSlots: true,
            registrationPricing: true,
        },
    });

    if (!org) {
        return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Parse sessionSlots JSON → string[] | null
    let sessionSlots: string[] | null = null;
    if (org.sessionSlots) {
        try { sessionSlots = JSON.parse(org.sessionSlots); } catch { sessionSlots = null; }
    }

    // Parse registrationPricing JSON → {selfFinanceRate, taxCreditRate} | default
    let pricing = DEFAULT_PRICING;
    if (org.registrationPricing) {
        try {
            const parsed = JSON.parse(org.registrationPricing);
            pricing = { ...DEFAULT_PRICING, ...parsed };
        } catch { /* use defaults */ }
    }

    return NextResponse.json({ ...org, sessionSlots, pricing });
}
