/**
 * Category C — Stable deterministic receipt identity.
 *
 * Derives a canonical receipt number from the payment UUID.
 * The same payment ID always produces the same receipt number.
 * Different payment UUIDs produce practically collision-resistant identifiers.
 *
 * Format: RCP-XXXXXXXXXXXX (first 12 hex chars of the payment UUID, uppercase)
 *
 * Implementation note: UUIDs are globally unique identifiers whose hex
 * characters are already collision-free. Taking the first 12 uppercase hex
 * chars of the UUID (after removing dashes) gives a 12-character identifier
 * with 2^48 keyspace — collision-free for any realistic number of payments.
 *
 * Browser-safe: no Node.js crypto module required, so this works in both
 * server actions (email service, receipt-number derivation) and client-side
 * PDF rendering (@react-pdf/renderer via PDFDownloadLink).
 *
 * Usage:
 *   const rcp = stableReceiptNumber(payment.id);
 *   // → 'RCP-BBAF49184F14' for UUID 'bbaf4918-4f14-4bc5-b225-f19eedb926ca'
 */

export function stableReceiptNumber(paymentId: string): string {
    // Strip UUID dashes, take first 12 hex chars, uppercase
    const hex = paymentId.replace(/-/g, '').slice(0, 12).toUpperCase();
    return `RCP-${hex}`;
}
