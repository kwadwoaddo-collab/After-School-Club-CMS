import { describe, it, expect } from 'vitest';
import { ReceiptTemplate } from '../components/ReceiptTemplate';

function text(el: any): string {
    const walk = (e: any): string => {
        if (!e) return '';
        if (Array.isArray(e)) return e.map(walk).join(' ');
        if (typeof e === 'string' || typeof e === 'number') return String(e);
        return e.props?.children ? walk(e.props.children) : '';
    };
    return walk(el).replace(/\s+/g, ' ').trim();
}

const base = {
    invoiceNumber: 'INV-1',
    amount: '180.00',
    status: 'paid',
    billingPeriodStart: new Date('2026-12-01'),
    billingPeriodEnd: new Date('2026-12-31'),
    centre: { id: 'c', name: 'Centre', address: '1 High St', ofstedId: 'EY123' },
    parent: { firstName: 'A', lastName: 'B' },
};

const pay = (id: string, amount: string, date: string) => ({
    id,
    amount,
    method: 'card',
    recordedAt: new Date(date),
    status: 'verified',
});

describe('receipt key details panel', () => {
    it('shows the four key facts with their labels', () => {
        const out = text(
            ReceiptTemplate({
                invoice: { ...base, serviceType: 'childcare', payments: [pay('p1', '180.00', '2026-11-20')] },
            }),
        );
        expect(out).toContain('Key Details');
        expect(out).toContain('Type of Service: Childcare');
        expect(out).toContain('Service Period: 01/12/2026 – 31/12/2026');
        expect(out).toContain('Assessment period covered by this payment');
        expect(out).toContain('Ofsted Registration No: EY123');
        expect(out).toContain('Date of Payment: 20 November 2026');
    });

    it('hides the Ofsted number for tuition', () => {
        const out = text(
            ReceiptTemplate({
                invoice: { ...base, serviceType: 'tuition', payments: [pay('p1', '180.00', '2026-11-20')] },
            }),
        );
        expect(out).toContain('Type of Service: Tuition');
        expect(out).not.toMatch(/Ofsted|EY123/);
    });

    it('uses the latest payment date and notes multiple payments', () => {
        const out = text(
            ReceiptTemplate({
                invoice: {
                    ...base,
                    serviceType: 'childcare',
                    payments: [pay('p1', '100.00', '2026-11-20'), pay('p2', '80.00', '2026-11-25')],
                },
            }),
        );
        expect(out).toContain('Date of Payment: 25 November 2026');
        expect(out).toContain('Latest of 2 payments');
    });

    it('shows a dash when there is no verified payment', () => {
        const out = text(ReceiptTemplate({ invoice: { ...base, serviceType: 'childcare', payments: [] } }));
        expect(out).toContain('Date of Payment: —');
    });
});
