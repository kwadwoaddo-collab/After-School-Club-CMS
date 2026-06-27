import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import type { DiscountRule } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/settings/discounts
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const org = await db.query.organisations.findFirst({
            where: eq(organisations.id, session.user.organisationId),
            columns: { discountRules: true },
        });

        return NextResponse.json({ discountRules: org?.discountRules ?? [] });
    } catch (error) {
        console.error('[Discounts GET] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/settings/discounts
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if ((session.user as any).role !== 'ORG_OWNER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { discountRules } = body as { discountRules: DiscountRule[] };

        if (!Array.isArray(discountRules)) {
            return NextResponse.json({ error: 'discountRules must be an array' }, { status: 400 });
        }

        // Basic validation of each rule
        for (const rule of discountRules) {
            if (!rule.id || !rule.type || !rule.label || typeof rule.value !== 'number' || !rule.valueType) {
                return NextResponse.json({ error: 'Invalid rule structure' }, { status: 400 });
            }
        }

        await db
            .update(organisations)
            .set({ discountRules, updatedAt: new Date() })
            .where(eq(organisations.id, session.user.organisationId));

        return NextResponse.json({ success: true, discountRules });
    } catch (error) {
        console.error('[Discounts PATCH] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
