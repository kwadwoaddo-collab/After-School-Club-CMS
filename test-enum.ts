import { normalizeString, normalizeEnum, normalizeDate } from './src/lib/search-params';

const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;

console.log(normalizeEnum('pending', VALID_BOOKING_STATUSES, 'all'));
console.log(normalizeEnum('invalid', VALID_BOOKING_STATUSES, 'all'));
console.log(normalizeEnum('all', VALID_BOOKING_STATUSES, 'all'));
console.log(normalizeEnum(undefined, VALID_BOOKING_STATUSES, 'all'));
