import { normalizeEnum } from './src/lib/search-params';
const VALID_BOOKING_STATUSES = ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up'] as const;
console.log("null:", normalizeEnum("null", VALID_BOOKING_STATUSES, 'all'));
console.log("empty string:", normalizeEnum("", VALID_BOOKING_STATUSES, 'all'));
console.log("all:", normalizeEnum("all", VALID_BOOKING_STATUSES, 'all'));
console.log("undefined:", normalizeEnum(undefined, VALID_BOOKING_STATUSES, 'all'));
console.log("array:", normalizeEnum(["pending", "confirmed"], VALID_BOOKING_STATUSES, 'all'));
