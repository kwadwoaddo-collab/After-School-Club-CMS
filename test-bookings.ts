import { normalizeEnum } from './src/lib/search-params';

const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

const searchParams = { status: 'confirmed' };

const conds: any[] = [];
const op = { eq: (field: string, val: string) => `eq(${field}, ${val})` };
const b = { status: 'b.status' };

if (searchParams.status && searchParams.status !== 'all') {
    const statusParam = normalizeEnum(searchParams.status, VALID_BOOKING_STATUSES, 'all');
    if (statusParam !== 'all') {
        conds.push(op.eq(b.status, statusParam));
    }
}

console.log(conds);
