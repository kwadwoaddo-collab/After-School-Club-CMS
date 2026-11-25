/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { requireTenantSession } from '@/lib/session';
import { db } from '@/db';
import { auditEvents, centres } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUserAccessibleCentreIds } from '@/lib/permissions';
import { z } from 'zod';

const sessionSlotSchema = z
    .object({
        id: z.string().max(100).optional(),
        name: z.string().trim().min(1, 'Session slot name is required').max(100),
        startTime: z.string().max(20),
        endTime: z.string().max(20),
        price: z.coerce.number().min(0).max(100000),
        capacity: z.coerce.number().int().min(0).max(10000),
        daysActive: z.array(z.string().max(20)).optional(),
        days: z.array(z.string().max(20)).optional(),
    })
    .passthrough();

const optionalFeeSchema = z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((val, ctx) => {
        if (val === undefined) return undefined;
        if (val === null || val === '' || (typeof val === 'number' && Number.isNaN(val))) {
            return null;
        }
        const parsedNum = typeof val === 'number' ? val : Number(val);
        if (!Number.isFinite(parsedNum) || parsedNum < 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fee must be a non-negative number' });
            return z.NEVER;
        }
        return String(val).trim();
    });

const updateCentreSchema = z.object({
    name: z.string().trim().min(1, 'Centre name is required').max(255).optional(),
    address: z.string().trim().max(500).nullable().optional(),
    ofstedId: z.string().trim().max(50).nullable().optional(),
    managerName: z.string().trim().max(100).nullable().optional(),
    billingPhone: z.string().trim().max(20).nullable().optional(),
    billingEmail: z
        .string()
        .trim()
        .max(255)
        .refine((val) => val === '' || z.string().email().safeParse(val).success, {
            message: 'Invalid billing email format',
        })
        .nullable()
        .optional(),
    sessionSlots: z.array(sessionSlotSchema).max(50).nullable().optional(),
    bankName: z.string().trim().max(100).nullable().optional(),
    sortCode: z
        .string()
        .transform((val) => val.replace(/[-\s]/g, ''))
        .refine((val) => val === '' || /^\d{6}$/.test(val), {
            message: 'Sort code must be exactly 6 digits (e.g. 20-00-00 or 200000)',
        })
        .nullable()
        .optional(),
    accountNo: z
        .string()
        .transform((val) => val.replace(/[-\s]/g, ''))
        .refine((val) => val === '' || /^\d{8}$/.test(val), {
            message: 'Account number must be exactly 8 digits',
        })
        .nullable()
        .optional(),
    feeSelfFinance: optionalFeeSchema,
    feeAssistedFinance: optionalFeeSchema,
});

function hasOwnField(obj: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;
}

export async function updateCentreAction(centreId: string, data: unknown) {
    const session = await requireTenantSession();
    if (!session?.user?.organisationId) throw new Error('Unauthorized');

    const userRole = (session.user as any).role;
    if (userRole !== 'ORG_OWNER' && userRole !== 'MANAGER') {
        throw new Error('Forbidden: Insufficient privileges.');
    }

    if (userRole !== 'ORG_OWNER') {
        const accessibleCentreIds = await getUserAccessibleCentreIds(session.user.id);
        if (!accessibleCentreIds.includes(centreId)) {
            throw new Error('Forbidden: You do not have access to this centre.');
        }
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid centre settings payload');
    }

    const parsed = updateCentreSchema.safeParse(data);
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid centre settings payload');
    }

    const rawObj = data as Record<string, unknown>;
    const valid = parsed.data;
    const updateData: Record<string, any> = {};

    if (hasOwnField(rawObj, 'name')) {
        updateData.name = valid.name;
    }
    if (hasOwnField(rawObj, 'address')) {
        updateData.address = valid.address || null;
    }
    if (hasOwnField(rawObj, 'ofstedId')) {
        updateData.ofstedId = valid.ofstedId || null;
    }
    if (hasOwnField(rawObj, 'managerName')) {
        updateData.managerName = valid.managerName || null;
    }
    if (hasOwnField(rawObj, 'billingPhone')) {
        updateData.billingPhone = valid.billingPhone || null;
    }
    if (hasOwnField(rawObj, 'billingEmail')) {
        updateData.billingEmail = valid.billingEmail || null;
    }
    if (hasOwnField(rawObj, 'sessionSlots')) {
        updateData.sessionSlots = valid.sessionSlots ? JSON.stringify(valid.sessionSlots) : null;
    }
    if (hasOwnField(rawObj, 'bankName')) {
        updateData.bankName = valid.bankName || null;
    }
    if (hasOwnField(rawObj, 'sortCode')) {
        updateData.sortCode = valid.sortCode || null;
    }
    if (hasOwnField(rawObj, 'accountNo')) {
        updateData.accountNo = valid.accountNo || null;
    }
    if (hasOwnField(rawObj, 'feeSelfFinance')) {
        updateData.feeSelfFinance = valid.feeSelfFinance;
    }
    if (hasOwnField(rawObj, 'feeAssistedFinance')) {
        updateData.feeAssistedFinance = valid.feeAssistedFinance;
    }

    if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();
        await db
            .update(centres)
            .set(updateData)
            .where(
                and(
                    eq(centres.id, centreId),
                    eq(centres.organisationId, session.user.organisationId)
                )
            );
    }

    const bankFieldsProvided =
        hasOwnField(rawObj, 'bankName') ||
        hasOwnField(rawObj, 'sortCode') ||
        hasOwnField(rawObj, 'accountNo');
    if (bankFieldsProvided && typeof (db as any).insert === 'function') {
        const insertBuilder = (db as any).insert(auditEvents);
        if (insertBuilder && typeof insertBuilder.values === 'function') {
            await insertBuilder.values({
                organisationId: session.user.organisationId,
                userId: session.user.id,
                eventType: 'centre_bank_details_updated',
                eventData: JSON.stringify({
                    centreId,
                    updatedFields: ['bankName', 'sortCode', 'accountNo'].filter((f) => hasOwnField(rawObj, f)),
                }),
            });
        }
    }

    revalidatePath('/dashboard/centres');
    revalidatePath(`/dashboard/centres/${centreId}`);
    revalidatePath(`/dashboard/centres/${centreId}/settings`);

    return { success: true };
}
