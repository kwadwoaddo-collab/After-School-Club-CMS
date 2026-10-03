import { createHash } from 'crypto';

/**
 * Permitted staff payment methods for manual offline recording.
 */
export const PERMITTED_STAFF_PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'voucher',
  'other',
  'tax_free_childcare',
] as const;

export type PermittedStaffPaymentMethod = (typeof PERMITTED_STAFF_PAYMENT_METHODS)[number];

export const FORBIDDEN_STAFF_PAYMENT_METHODS = ['stripe', 'gocardless'] as const;

export function isPermittedStaffPaymentMethod(method: string): method is PermittedStaffPaymentMethod {
  return (PERMITTED_STAFF_PAYMENT_METHODS as readonly string[]).includes(method);
}

/**
 * Normal UI payment affordance check.
 * Hides record payment on draft, void, and fully paid invoices, or when remaining balance <= 0.
 * Checks role-based centre access when role is provided.
 */
export function canOfferRecordPayment(params: {
  status: string;
  remainingBalancePence: number;
  userRole?: string;
  hasCentreAccess?: boolean;
}): boolean {
  const { status, remainingBalancePence, userRole, hasCentreAccess } = params;

  if (status === 'draft' || status === 'void' || status === 'paid') {
    return false;
  }

  if (remainingBalancePence <= 0) {
    return false;
  }

  if (userRole) {
    if (userRole === 'ORG_OWNER') {
      return true;
    }
    if ((userRole === 'MANAGER' || userRole === 'FRONT_DESK') && hasCentreAccess) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Authoritative server-side domain lifecycle check for staff payments.
 * Strictly rejects draft and void invoices.
 * Accepts sent, partially_paid, and paid (preserving legacy overpayment / late-cash recording with audit warning).
 */
export function canAcceptStaffPayment(status: string): {
  accepted: boolean;
  reason?: string;
  code?: 'DRAFT_INVOICE' | 'VOID_INVOICE' | 'INVALID_INVOICE_STATUS';
} {
  if (status === 'draft') {
    return {
      accepted: false,
      reason: 'Cannot record payment against a draft invoice. Issue the invoice first.',
      code: 'DRAFT_INVOICE',
    };
  }

  if (status === 'void') {
    return {
      accepted: false,
      reason: 'Cannot record payment against a voided invoice.',
      code: 'VOID_INVOICE',
    };
  }

  if (status === 'sent' || status === 'partially_paid' || status === 'paid') {
    return { accepted: true };
  }

  return {
    accepted: false,
    reason: `Cannot record payment against invoice with status '${status}'.`,
    code: 'INVALID_INVOICE_STATUS',
  };
}

/**
 * Strict decimal-to-pence parser for untrusted user/client input.
 * Rejects:
 * - malformed strings or non-strings
 * - scientific notation / exponents (e.g. '1e2')
 * - NaN / Infinity
 * - negative values
 * - more than 2 decimal places
 * Returns integer pence.
 */
export function parseStrictDecimalToPence(input: unknown): number {
  if (typeof input !== 'string') {
    throw new Error('Amount must be provided as a string');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Amount cannot be empty');
  }

  // Reject scientific notation
  if (/[eE]/.test(trimmed)) {
    throw new Error('Scientific notation is not permitted for amounts');
  }

  // Strict regex: optional leading whitespace (already trimmed), digits, optional dot with 1 or 2 digits
  // Disallow leading negative sign or arbitrary characters
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error('Invalid amount format: must be a positive decimal number with up to 2 decimal places');
  }

  const integerPartStr = match[1];
  const fractionalPartStr = match[2] || '';

  if (fractionalPartStr.length > 2) {
    throw new Error('Amount cannot have more than 2 decimal places');
  }

  const pounds = parseInt(integerPartStr, 10);
  if (!Number.isSafeInteger(pounds)) {
    throw new Error('Amount exceeds maximum safe value');
  }

  const paddedFraction = fractionalPartStr.padEnd(2, '0');
  const penceFromFraction = parseInt(paddedFraction, 10);

  const totalPence = pounds * 100 + penceFromFraction;
  if (!Number.isSafeInteger(totalPence) || totalPence < 0) {
    throw new Error('Calculated pence exceeds safe range');
  }

  return totalPence;
}

/**
 * Safe conversion for stored database numeric(10,2) or numeric values.
 * Unlike untrusted client inputs, this accepts signed values (negative credit notes or balances)
 * and safely converts to integer pence without throwing uncontrolled exceptions.
 */
export function parseStoredDecimalToPence(storedValue: string | number | null | undefined): number {
  if (storedValue === null || storedValue === undefined) {
    return 0;
  }

  const str = String(storedValue).trim();
  if (!str) return 0;

  // Handle potential negative sign
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const match = cleanStr.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    // Fallback safe float parse if format has anomaly
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
  }

  const pounds = parseInt(match[1], 10);
  const fractionStr = (match[2] || '').slice(0, 2).padEnd(2, '0');
  const pence = parseInt(fractionStr, 10);

  const total = pounds * 100 + pence;
  return isNegative ? -total : total;
}

export function formatPenceToDecimal(pence: number): string {
  const isNegative = pence < 0;
  const absPence = Math.abs(pence);
  const pounds = Math.floor(absPence / 100);
  const remainder = absPence % 100;
  const formatted = `${pounds}.${remainder.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats a Date or date string to Europe/London business date string (YYYY-MM-DD).
 */
export function toEuropeLondonBusinessDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date for business date calculation');
  }

  // Format explicitly in Europe/London timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d); // returns YYYY-MM-DD in en-CA locale
}

export interface PaymentRequestCanonicalPayload {
  operationMode: 'MANUAL_AMOUNT' | 'SETTLE_OUTSTANDING';
  method: string;
  recordedAt: string; // Europe/London business date (YYYY-MM-DD)
  transactionReference: string | null;
  amountPence: number | null; // integer pence for MANUAL_AMOUNT, null for SETTLE_OUTSTANDING
}

/**
 * Computes deterministic SHA-256 request fingerprint:
 * 'v1:' + sha256(canonicalPayloadJson)
 */
export function computePaymentRequestFingerprint(payload: PaymentRequestCanonicalPayload): string {
  const normalized: PaymentRequestCanonicalPayload = {
    operationMode: payload.operationMode,
    method: payload.method.trim().toLowerCase(),
    recordedAt: payload.recordedAt.trim(),
    transactionReference: payload.transactionReference?.trim() || null,
    amountPence: payload.amountPence,
  };

  const canonicalJson = JSON.stringify(normalized, Object.keys(normalized).sort());
  const hash = createHash('sha256').update(canonicalJson).digest('hex');
  return `v1:${hash}`;
}
