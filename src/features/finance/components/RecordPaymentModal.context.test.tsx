import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('../actions',()=>({recordPayment:vi.fn()}));
vi.mock('../hooks/use-payment-idempotency',()=>({usePaymentIdempotency:()=>({idempotencyKey:'test',originalRecordedAt:null,rotateIdempotencyKey:vi.fn(),clearIdempotencyKey:vi.fn()})}));
vi.mock('@/components/ui/ToastProvider',()=>({useToast:()=>({toast:vi.fn()})}));
import RecordPaymentModal from './RecordPaymentModal';
describe('payment allocation context',()=>{
    it('names the selected invoice, family and period before money is recorded',()=>{
        const html=renderToStaticMarkup(<RecordPaymentModal invoiceId="nov" invoiceNumber="INV-NOV" remainingBalance={1900} billingContext={{parentId:'family',familyName:'Demo family',period:'6 Nov – 5 Dec 2026'}} onClose={()=>{}} onSuccess={()=>{}}/>);
        expect(html).toContain('INV-NOV');expect(html).toContain('6 Nov – 5 Dec 2026');expect(html).toContain('href="/dashboard/parents/family"');
        expect(html).toContain('role="dialog"');expect(html).toContain('aria-label="Close payment form"');
    });
});
