import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import type { DiscountRule } from '@/db/schema';
import { sql } from 'drizzle-orm';

// GET /api/settings/discounts
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await db.execute(
            sql`SELECT discount_rules FROM organisations WHERE id = ${session.user.organisationId} LIMIT 1`
        );
        const row = (result as any)[0] ?? (result as any).rows?.[0];
        return NextResponse.json({ discountRules: row?.discount_rules ?? [] });
    } catch (error) {
        logger.error('[Discounts GET] error:', error);
        return NextResponse.json({ discountRules: [] });
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

        for (const rule of discountRules) {
            if (!rule.id || !rule.type || !rule.label || typeof rule.value !== 'number' || !rule.valueType) {
                return NextResponse.json({ error: 'Invalid rule structure' }, { status: 400 });
            }
        }

        await db.execute(
            sql`UPDATE organisations SET discount_rules = ${JSON.stringify(discountRules)}::jsonb, updated_at = NOW() WHERE id = ${session.user.organisationId}`
        );

        return NextResponse.json({ success: true, discountRules });
    } catch (error) {
        logger.error('[Discounts PATCH] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
