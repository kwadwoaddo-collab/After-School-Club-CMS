import { describe, it, expect } from 'vitest';
import { InvoiceTemplate } from '../components/InvoiceTemplate';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import { normaliseServiceType, serviceTypeLabel, isServiceType } from '../service-type';

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
    invoiceNumber: 'INV-1', amount: '100.00', status: 'paid',
    invoiceDate: new Date('2026-09-01'), dueDate: new Date('2026-09-15'),
    billingPeriodStart: new Date('2026-09-01'), billingPeriodEnd: new Date('2026-09-30'),
    centre: { id: 'c', name: 'Centre', address: '1 High St' },
    parent: { firstName: 'A', lastName: 'B' },
    payments: [{ id: 'p', amount: '100.00', method: 'card', recordedAt: new Date('2026-09-05'), status: 'verified' }],
};
const two = [{ id: '1', name: 'Leo Jenkins' }, { id: '2', name: 'Maya Jenkins' }];

describe('service type (Childcare / Tuition)', () => {
    it('defaults unknown or missing values to childcare', () => {
        expect(normaliseServiceType(undefined)).toBe('childcare');
        expect(normaliseServiceType(null)).toBe('childcare');
        expect(normaliseServiceType('weird')).toBe('childcare');
        expect(normaliseServiceType('tuition')).toBe('tuition');
        expect(isServiceType('childcare')).toBe(true);
        expect(serviceTypeLabel(undefined)).toBe('Childcare');
    });

    it('childcare output is unchanged (explicit and legacy missing)', () => {
        for (const serviceType of ['childcare', undefined]) {
            const inv = text(InvoiceTemplate({ invoice: { ...base, serviceType, coveredChildrenJson: two } }));
            expect(inv).toContain('Childcare services — Leo Jenkins, Maya Jenkins');
            expect(inv).not.toContain('Tuition');
            expect(inv).toContain('Childcare Services');
            expect(text(InvoiceTemplate({ invoice: { ...base, serviceType } }))).toContain('Childcare services');
            expect(text(ReceiptTemplate({ invoice: { ...base, serviceType } }))).toContain('Type of Service: Childcare');
        }
    });

    it('tuition wording on invoice (single and multi child) and receipt', () => {
        const multi = text(InvoiceTemplate({ invoice: { ...base, serviceType: 'tuition', coveredChildrenJson: two } }));
        expect(multi).toContain('Tuition — Leo Jenkins, Maya Jenkins');
        expect(multi).not.toContain('Childcare services');
        expect(multi).toContain('Tuition Services');
        expect(multi).not.toContain('Childcare Services');
        const single = text(InvoiceTemplate({ invoice: { ...base, serviceType: 'tuition' } }));
        expect(single).toContain('Tuition');
        expect(single).not.toContain('Childcare services');
        const receipt = text(ReceiptTemplate({ invoice: { ...base, serviceType: 'tuition' } }));
        expect(receipt).toContain('Type of Service: Tuition');
        expect(receipt).not.toContain('Type of Service: Childcare');
    });
});
