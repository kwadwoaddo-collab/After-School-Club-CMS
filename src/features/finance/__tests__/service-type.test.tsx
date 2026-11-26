/* eslint-disable react/no-children-prop */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { InvoiceTemplate } from '../components/InvoiceTemplate';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import ReceiptGeneratorClient from '../components/ReceiptGeneratorClient';
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
    centre: { id: 'c', name: 'Centre', address: '1 High St', ofstedId: 'EY123' },
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
            expect(text(ReceiptTemplate({ invoice: { ...base, serviceType } }))).toContain('Ofsted Registration No: EY123');
            expect(inv).toContain('Ofsted / Ref No: EY123');
            expect(inv).toContain('Registered by Ofsted');
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
        expect(receipt).not.toMatch(/Ofsted|EY123/);
        expect(multi).not.toMatch(/Ofsted|EY123/);
        expect(single).not.toMatch(/Ofsted|EY123/);
    });

    it('quick printable ReceiptGeneratorClient hides Ofsted and shows Tuition when serviceType is tuition', () => {
        const centres = [{ id: 'c-syd', name: 'Sydenham', ofstedId: 'EY123', billingPhone: '020 7946 0000' }];
        const tuitionHtml = renderToStaticMarkup(
            React.createElement(ReceiptGeneratorClient, {
                organisation: { id: 'org-1', name: 'SprintScale Club', slug: 'sprintscale' },
                centres,
                children: [],
                initialCentreId: 'c-syd',
                initialPayment: {
                    id: 'pay-1',
                    amount: '160.00',
                    method: 'bank_transfer',
                    recordedAt: '2026-11-26',
                    receiptNo: 'RCP-ETHAN',
                    parentName: 'Parent Le',
                    studentName: 'Ethan Le',
                    centreId: 'c-syd',
                    centreName: 'Sydenham',
                    invoiceNumber: 'INV-ETHAN',
                    serviceType: 'tuition',
                },
            })
        );
        expect(tuitionHtml).toContain('Type of Service');
        expect(tuitionHtml).toContain('>Tuition<');
        expect(tuitionHtml).not.toMatch(/Ofsted:|EY123/);

        const childcareHtml = renderToStaticMarkup(
            React.createElement(ReceiptGeneratorClient, {
                organisation: { id: 'org-1', name: 'SprintScale Club', slug: 'sprintscale' },
                centres,
                children: [],
                initialCentreId: 'c-syd',
                initialPayment: {
                    id: 'pay-2',
                    amount: '160.00',
                    method: 'bank_transfer',
                    recordedAt: '2026-11-26',
                    receiptNo: 'RCP-CC',
                    parentName: 'Parent A',
                    studentName: 'Child A',
                    centreId: 'c-syd',
                    centreName: 'Sydenham',
                    invoiceNumber: 'INV-CC',
                    serviceType: 'childcare',
                },
            })
        );
        expect(childcareHtml).toContain('Ofsted: EY123');
    });
});
