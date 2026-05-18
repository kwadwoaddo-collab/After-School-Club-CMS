import { normalizeEnum } from './src/lib/search-params';
const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

function getConds(rawStatus: any) {
    const searchParams = {
        status: Array.isArray(rawStatus) ? rawStatus[0] : rawStatus
    };
    const conds: any[] = ['op.inArray'];
    if (searchParams.status && searchParams.status !== 'all') {
        const statusParam = normalizeEnum(searchParams.status, VALID_BOOKING_STATUSES, 'all');
        if (statusParam !== 'all') {
            conds.push(`op.eq(b.status, ${statusParam})`);
        }
    }
    return conds.length === 1 ? conds[0] : `op.and(${conds.join(', ')})`;
}

console.log("undefined:", getConds(undefined));
console.log("'all':", getConds('all'));
console.log("'pending':", getConds('pending'));
console.log("['pending']:", getConds(['pending']));
console.log("'invalid':", getConds('invalid'));
