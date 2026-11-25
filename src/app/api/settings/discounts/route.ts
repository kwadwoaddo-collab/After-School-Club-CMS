import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import type { DiscountRule } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const discountRuleSchema = z
    .object({
        id: z.string().trim().min(1).max(100),
        type: z.enum(['sibling', 'pupil_premium', 'percentage', 'fixed']),
        label: z.string().trim().min(1).max(120),
        value: z.number().finite().min(0).max(100_000),
        valueType: z.enum(['percent', 'fixed']),
        active: z.boolean(),
    })
    .strict()
    .refine((r) => r.valueType !== 'percent' || r.value <= 100, {
        message: 'Percentage discount cannot exceed 100',
    });

const patchDiscountsSchema = z
    .object({
        discountRules: z.array(discountRuleSchema).max(50),
    })
    .strict();

// GET /api/settings/discounts
export async function GET() {
    try {
        const session = await getApiSession();
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
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userRole = (session.user as any).role;
        if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const parsed = patchDiscountsSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid discount rules payload',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            );
        }

        const discountRules: DiscountRule[] = parsed.data.discountRules;

        await db.execute(
            sql`UPDATE organisations SET discount_rules = ${JSON.stringify(discountRules)}::jsonb, updated_at = NOW() WHERE id = ${session.user.organisationId}`
        );

        return NextResponse.json({ success: true, discountRules });
    } catch (error) {
        logger.error('[Discounts PATCH] error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
