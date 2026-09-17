/**
 * Category C — Stable deterministic receipt identity.
 *
 * Derives a canonical receipt number from the payment UUID.
 * The same payment ID always produces the same receipt number.
 * Different payment UUIDs produce practically collision-resistant identifiers.
 *
 * Format: RCP-XXXXXXXXXXXX (12 characters from SHA-256 of the payment UUID)
 * This is stronger than 6 hex chars and practically collision-free for
 * any realistic number of payments.
 *
 * Usage:
 *   const rcp = stableReceiptNumber(payment.id);
 *   // → 'RCP-A3F8B2C91D04'
 */
import crypto from 'crypto';

export function stableReceiptNumber(paymentId: string): string {
    const hash = crypto.createHash('sha256').update(paymentId).digest('hex');
    // Take first 12 hex characters, uppercase
    const suffix = hash.slice(0, 12).toUpperCase();
    return `RCP-${suffix}`;
}
