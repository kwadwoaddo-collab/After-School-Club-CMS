'use client';

import { useState, useEffect, useCallback } from 'react';

export interface PaymentIdempotencyState {
  idempotencyKey: string;
  originalRecordedAt: string; // ISO string
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getStorageKey(invoiceId: string): string {
  return `payment_idempotency_${invoiceId}`;
}

export function usePaymentIdempotency(invoiceId: string) {
  const [state, setState] = useState<PaymentIdempotencyState>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem(getStorageKey(invoiceId));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.idempotencyKey === 'string' && typeof parsed.originalRecordedAt === 'string') {
            return parsed;
          }
        }
      } catch {
        // Ignore JSON/storage errors
      }
    }

    const initialKey = generateUuid();
    const initialRecordedAt = new Date().toISOString();
    return {
      idempotencyKey: initialKey,
      originalRecordedAt: initialRecordedAt,
    };
  });

  // Sync to sessionStorage on mount and when state changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.setItem(getStorageKey(invoiceId), JSON.stringify(state));
    } catch {
      // Storage quota or privacy mode error handling
    }
  }, [invoiceId, state]);

  const rotateIdempotencyKey = useCallback(() => {
    const newState: PaymentIdempotencyState = {
      idempotencyKey: generateUuid(),
      originalRecordedAt: new Date().toISOString(),
    };
    setState(newState);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(getStorageKey(invoiceId), JSON.stringify(newState));
      } catch {
        // Ignore
      }
    }
    return newState;
  }, [invoiceId]);

  const clearIdempotencyKey = useCallback(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(getStorageKey(invoiceId));
      } catch {
        // Ignore
      }
    }
    const newState: PaymentIdempotencyState = {
      idempotencyKey: generateUuid(),
      originalRecordedAt: new Date().toISOString(),
    };
    setState(newState);
    return newState;
  }, [invoiceId]);

  return {
    idempotencyKey: state.idempotencyKey,
    originalRecordedAt: state.originalRecordedAt,
    rotateIdempotencyKey,
    clearIdempotencyKey,
  };
}
