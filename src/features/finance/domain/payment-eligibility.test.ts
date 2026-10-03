import { describe, it, expect } from 'vitest';
import {
  canOfferRecordPayment,
  canAcceptStaffPayment,
  parseStrictDecimalToPence,
  parseStoredDecimalToPence,
  formatPenceToDecimal,
  toEuropeLondonBusinessDate,
  computePaymentRequestFingerprint,
  isPermittedStaffPaymentMethod,
  PERMITTED_STAFF_PAYMENT_METHODS,
  FORBIDDEN_STAFF_PAYMENT_METHODS,
} from './payment-eligibility';

describe('payment-eligibility domain', () => {
  describe('canOfferRecordPayment (UI affordance)', () => {
    it('hides payment action for draft, void, and paid invoices', () => {
      expect(canOfferRecordPayment({ status: 'draft', remainingBalancePence: 5000 })).toBe(false);
      expect(canOfferRecordPayment({ status: 'void', remainingBalancePence: 5000 })).toBe(false);
      expect(canOfferRecordPayment({ status: 'paid', remainingBalancePence: 5000 })).toBe(false);
    });

    it('hides payment action when remaining balance is zero or negative', () => {
      expect(canOfferRecordPayment({ status: 'sent', remainingBalancePence: 0 })).toBe(false);
      expect(canOfferRecordPayment({ status: 'partially_paid', remainingBalancePence: -100 })).toBe(false);
    });

    it('permits ORG_OWNER tenant-wide for sent or partially_paid with balance > 0', () => {
      expect(canOfferRecordPayment({
        status: 'sent',
        remainingBalancePence: 1000,
        userRole: 'ORG_OWNER'
      })).toBe(true);

      expect(canOfferRecordPayment({
        status: 'partially_paid',
        remainingBalancePence: 500,
        userRole: 'ORG_OWNER'
      })).toBe(true);
    });

    it('permits MANAGER and FRONT_DESK only when hasCentreAccess is true', () => {
      expect(canOfferRecordPayment({
        status: 'sent',
        remainingBalancePence: 1000,
        userRole: 'MANAGER',
        hasCentreAccess: true
      })).toBe(true);

      expect(canOfferRecordPayment({
        status: 'sent',
        remainingBalancePence: 1000,
        userRole: 'MANAGER',
        hasCentreAccess: false
      })).toBe(false);

      expect(canOfferRecordPayment({
        status: 'sent',
        remainingBalancePence: 1000,
        userRole: 'FRONT_DESK',
        hasCentreAccess: true
      })).toBe(true);

      expect(canOfferRecordPayment({
        status: 'sent',
        remainingBalancePence: 1000,
        userRole: 'FRONT_DESK',
        hasCentreAccess: false
      })).toBe(false);
    });

    it('strictly forbids TUTOR and PARENT', () => {
      expect(canOfferRecordPayment({
        status: 'sent',
        remainingBalancePence: 1000,
        userRole: 'TUTOR',
        hasCentreAccess: true
      })).toBe(false);

      expect(canOfferRecordPayment({
        status: 'sent',
        remainingBalancePence: 1000,
        userRole: 'PARENT',
        hasCentreAccess: true
      })).toBe(false);
    });
  });

  describe('canAcceptStaffPayment (Server lifecycle acceptance)', () => {
    it('strictly rejects draft invoices', () => {
      const res = canAcceptStaffPayment('draft');
      expect(res.accepted).toBe(false);
      expect(res.code).toBe('DRAFT_INVOICE');
      expect(res.reason).toMatch(/draft invoice/i);
    });

    it('strictly rejects void invoices', () => {
      const res = canAcceptStaffPayment('void');
      expect(res.accepted).toBe(false);
      expect(res.code).toBe('VOID_INVOICE');
      expect(res.reason).toMatch(/voided invoice/i);
    });

    it('accepts sent, partially_paid, and paid invoices (preserving legacy overpayment)', () => {
      expect(canAcceptStaffPayment('sent').accepted).toBe(true);
      expect(canAcceptStaffPayment('partially_paid').accepted).toBe(true);
      expect(canAcceptStaffPayment('paid').accepted).toBe(true);
    });

    it('rejects unknown status', () => {
      const res = canAcceptStaffPayment('cancelled');
      expect(res.accepted).toBe(false);
      expect(res.code).toBe('INVALID_INVOICE_STATUS');
    });
  });

  describe('parseStrictDecimalToPence (Untrusted user input)', () => {
    it('correctly parses valid standard inputs', () => {
      expect(parseStrictDecimalToPence('10.50')).toBe(1050);
      expect(parseStrictDecimalToPence('0.01')).toBe(1);
      expect(parseStrictDecimalToPence('100')).toBe(10000);
      expect(parseStrictDecimalToPence('0.5')).toBe(50);
      expect(parseStrictDecimalToPence('0')).toBe(0);
      expect(parseStrictDecimalToPence('12345.67')).toBe(1234567);
    });

    it('rejects malformed inputs and non-strings', () => {
      expect(() => parseStrictDecimalToPence('')).toThrow(/cannot be empty/i);
      expect(() => parseStrictDecimalToPence('   ')).toThrow(/cannot be empty/i);
      expect(() => parseStrictDecimalToPence(10.5 as any)).toThrow(/must be provided as a string/i);
      expect(() => parseStrictDecimalToPence(null as any)).toThrow(/must be provided as a string/i);
      expect(() => parseStrictDecimalToPence('abc')).toThrow(/invalid amount format/i);
      expect(() => parseStrictDecimalToPence('10.5.5')).toThrow(/invalid amount format/i);
    });

    it('rejects scientific notation', () => {
      expect(() => parseStrictDecimalToPence('1e2')).toThrow(/scientific notation is not permitted/i);
      expect(() => parseStrictDecimalToPence('1E2')).toThrow(/scientific notation is not permitted/i);
      expect(() => parseStrictDecimalToPence('1.5e-2')).toThrow(/scientific notation is not permitted/i);
    });

    it('rejects negative values', () => {
      expect(() => parseStrictDecimalToPence('-10.00')).toThrow(/invalid amount format/i);
      expect(() => parseStrictDecimalToPence('-0.01')).toThrow(/invalid amount format/i);
    });

    it('rejects more than 2 decimal places', () => {
      expect(() => parseStrictDecimalToPence('10.555')).toThrow(/cannot have more than 2 decimal places/i);
      expect(() => parseStrictDecimalToPence('0.001')).toThrow(/cannot have more than 2 decimal places/i);
    });
  });

  describe('parseStoredDecimalToPence (Stored DB values)', () => {
    it('parses positive numeric strings and numbers', () => {
      expect(parseStoredDecimalToPence('10.50')).toBe(1050);
      expect(parseStoredDecimalToPence(10.5)).toBe(1050);
      expect(parseStoredDecimalToPence('100.00')).toBe(10000);
    });

    it('safely parses negative values without throwing', () => {
      expect(parseStoredDecimalToPence('-15.00')).toBe(-1500);
      expect(parseStoredDecimalToPence(-15)).toBe(-1500);
    });

    it('handles null, undefined, empty safely', () => {
      expect(parseStoredDecimalToPence(null)).toBe(0);
      expect(parseStoredDecimalToPence(undefined)).toBe(0);
      expect(parseStoredDecimalToPence('')).toBe(0);
    });
  });

  describe('Integer pence arithmetic & floating residue test', () => {
    it('verifies £0.70 + 3x £0.10 against £1.00 equals exact 100 pence without residue', () => {
      const initial = parseStrictDecimalToPence('0.70');
      const p1 = parseStrictDecimalToPence('0.10');
      const p2 = parseStrictDecimalToPence('0.10');
      const p3 = parseStrictDecimalToPence('0.10');

      const totalPence = initial + p1 + p2 + p3;
      const targetPence = parseStrictDecimalToPence('1.00');

      expect(totalPence).toBe(100);
      expect(targetPence).toBe(100);
      expect(totalPence).toBe(targetPence);
      expect(formatPenceToDecimal(totalPence)).toBe('1.00');
    });
  });

  describe('Payment methods validation', () => {
    it('permits approved manual staff payment methods', () => {
      for (const m of PERMITTED_STAFF_PAYMENT_METHODS) {
        expect(isPermittedStaffPaymentMethod(m)).toBe(true);
      }
      expect(PERMITTED_STAFF_PAYMENT_METHODS).toEqual([
        'cash',
        'bank_transfer',
        'voucher',
        'other',
        'tax_free_childcare',
      ]);
    });

    it('rejects provider methods stripe and gocardless', () => {
      for (const m of FORBIDDEN_STAFF_PAYMENT_METHODS) {
        expect(isPermittedStaffPaymentMethod(m)).toBe(false);
      }
      expect(isPermittedStaffPaymentMethod('stripe')).toBe(false);
      expect(isPermittedStaffPaymentMethod('gocardless')).toBe(false);
    });
  });

  describe('computePaymentRequestFingerprint', () => {
    it('generates a versioned v1: sha256 fingerprint', () => {
      const fp = computePaymentRequestFingerprint({
        operationMode: 'MANUAL_AMOUNT',
        method: 'cash',
        recordedAt: '2026-10-03',
        transactionReference: 'REF123',
        amountPence: 1000,
      });

      expect(fp).toMatch(/^v1:[a-f0-9]{64}$/);
    });

    it('produces identical fingerprints for identically normalized inputs', () => {
      const fp1 = computePaymentRequestFingerprint({
        operationMode: 'MANUAL_AMOUNT',
        method: ' CASH ',
        recordedAt: '2026-10-03',
        transactionReference: '  REF123  ',
        amountPence: 1000,
      });

      const fp2 = computePaymentRequestFingerprint({
        operationMode: 'MANUAL_AMOUNT',
        method: 'cash',
        recordedAt: '2026-10-03',
        transactionReference: 'REF123',
        amountPence: 1000,
      });

      expect(fp1).toBe(fp2);
    });

    it('produces different fingerprints when reference, amount, or date differs', () => {
      const base = {
        operationMode: 'MANUAL_AMOUNT' as const,
        method: 'cash',
        recordedAt: '2026-10-03',
        transactionReference: 'REF123',
        amountPence: 1000,
      };

      const fpBase = computePaymentRequestFingerprint(base);

      const fpDiffAmount = computePaymentRequestFingerprint({
        ...base,
        amountPence: 2000,
      });

      const fpDiffDate = computePaymentRequestFingerprint({
        ...base,
        recordedAt: '2026-10-04',
      });

      const fpDiffRef = computePaymentRequestFingerprint({
        ...base,
        transactionReference: 'DIFFERENT_REF',
      });

      const fpDiffMode = computePaymentRequestFingerprint({
        ...base,
        operationMode: 'SETTLE_OUTSTANDING',
        amountPence: null,
      });

      expect(fpBase).not.toBe(fpDiffAmount);
      expect(fpBase).not.toBe(fpDiffDate);
      expect(fpBase).not.toBe(fpDiffRef);
      expect(fpBase).not.toBe(fpDiffMode);
    });
  });

  describe('toEuropeLondonBusinessDate', () => {
    it('formats a date to YYYY-MM-DD Europe/London date', () => {
      const d = new Date('2026-10-03T12:00:00Z');
      expect(toEuropeLondonBusinessDate(d)).toBe('2026-10-03');
    });

    it('handles BST summer time crossing correctly', () => {
      // 2026-07-15 23:30 UTC is 2026-07-16 00:30 BST
      const d = new Date('2026-07-15T23:30:00Z');
      expect(toEuropeLondonBusinessDate(d)).toBe('2026-07-16');
    });
  });
});
