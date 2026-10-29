import { z } from 'zod';
export const PaymentCorrectionSchema = z.object({ paymentId: z.uuid(), correctionId: z.uuid(), paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reference: z.string().trim().max(255).nullable(), reason: z.string().trim().min(3).max(500), expectedRecordedAt: z.iso.datetime({ offset: true }), expectedReference: z.string().max(255).nullable() }).strict();
export type PaymentCorrectionInput = z.infer<typeof PaymentCorrectionSchema>;
export const correctableMethods = ['cash', 'bank_transfer', 'voucher', 'tax_free_childcare', 'other'];
export function correctionDate(value: string, today: string) {
    const result = new Date(value + 'T12:00:00.000Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value || value > today || value < '1900-01-01')
        throw Error('Enter a valid payment date that is not in the future.');
    return result;
}
export function receiptIdentityPayment<T extends {
    id?: string;
    status?: string;
    recordedAt?: Date | string | null;
    receiptIdentityDate?: Date | string | null;
}>(payments: T[]): T | undefined {
    return payments.filter(p => p.status === 'verified').sort((a, b) => new Date(b.receiptIdentityDate ?? b.recordedAt ?? 0).getTime() - new Date(a.receiptIdentityDate ?? a.recordedAt ?? 0).getTime() || String(b.id ?? '').localeCompare(String(a.id ?? '')))[0];
}
