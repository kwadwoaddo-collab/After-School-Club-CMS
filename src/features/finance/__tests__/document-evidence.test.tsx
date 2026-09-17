import { describe, it, expect } from 'vitest';
import * as React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceTemplate } from '../components/InvoiceTemplate';
import { ReceiptTemplate } from '../components/ReceiptTemplate';

/**
 * SPRINTSCALE CMS — Document Evidence Improvement Regression Tests
 * INVOICE & RECEIPT — Universal Credit / Childcare Evidence
 *
 * Verifies:
 * 1. Multi-child receipt & invoice contains ALL children
 * 2. Service period inherited directly from invoice
 * 3. Type of Service: Childcare displayed
 * 4. Original invoice reference and amount
 * 5. Authoritative payment records (date, method, amount)
 * 6. Dynamic provider & centre manager attribution
 * 7. Absence of hardcoded centre/provider values
 * 8. Tenant isolation between centres
 * 9. PDF generation succeeds across all scenarios
 */

const REPO_ROOT = path.resolve(__dirname, '../../../../');

function readSrc(relPath: string): string {
    return fs.readFileSync(path.resolve(REPO_ROOT, relPath), 'utf-8');
}

// Helper to recursively collect and normalize all text content from a React-PDF element tree
function extractTextFromTree(element: any): string {
    function recurse(el: any): string {
        if (!el) return '';
        if (Array.isArray(el)) {
            return el.map(recurse).join(' ');
        }
        if (typeof el === 'string' || typeof el === 'number') {
            return String(el);
        }
        if (el.props && el.props.children) {
            return recurse(el.props.children);
        }
        return '';
    }
    return recurse(element).replace(/\s+/g, ' ').trim();
}

describe('Document Evidence Improvement — Invoice & Receipt Tests', () => {

    const baseCentreA = {
        id: 'centre-alpha',
        name: 'Little Stars Academy Centre',
        address: '10 High Street\nLondon\nSE1 1AA',
        billingPhone: '020 7946 0123',
        billingEmail: 'accounts@littlestars.co.uk',
        ofstedId: 'EY987654',
        managerName: 'Jane Doe',
        bankName: 'Barclays Bank',
        sortCode: '20-00-00',
        accountNo: '12345678',
    };

    const baseCentreB = {
        id: 'centre-beta',
        name: 'Peckham Learning Hub',
        address: '42 Rye Lane\nLondon\nSE15 5BY',
        billingPhone: '020 7946 0888',
        billingEmail: 'info@peckhamhub.co.uk',
        ofstedId: 'EY112233',
        managerName: 'Marcus Rashford',
        bankName: 'Lloyds Bank',
        sortCode: '30-90-89',
        accountNo: '87654321',
    };

    const baseParent = {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 'sarah.jenkins@example.com',
        phone: '07700 900123',
        addressLine1: '14 Orchard Way',
        addressLine2: 'Flat 2',
        city: 'London',
        postcode: 'SE26 4ER',
    };

    // ─── 1. Multi-Child Extraction & Representation ─────────────────────────

    describe('Multi-Child Evidence', () => {
        it('Receipt displays ALL covered children when coveredChildrenJson is provided', () => {
            const multiChildInvoice = {
                invoiceNumber: 'INV-2026-001',
                amount: '350.00',
                status: 'paid',
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                coveredChildrenJson: [
                    { id: 'c1', name: 'Leo Jenkins' },
                    { id: 'c2', name: 'Maya Jenkins' },
                ],
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '350.00', method: 'card', recordedAt: new Date('2026-09-05'), status: 'verified' }
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice: multiChildInvoice, organisationName: 'Star Bright Org' });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Leo Jenkins');
            expect(allText).toContain('Maya Jenkins');
            expect(allText).toContain('Child 1: Leo Jenkins');
            expect(allText).toContain('Child 2: Maya Jenkins');
        });

        it('Invoice displays ALL covered children when coveredChildrenJson is provided', () => {
            const multiChildInvoice = {
                invoiceNumber: 'INV-2026-001',
                amount: '350.00',
                status: 'paid',
                invoiceDate: new Date('2026-09-01'),
                dueDate: new Date('2026-09-15'),
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                coveredChildrenJson: [
                    { id: 'c1', name: 'Leo Jenkins' },
                    { id: 'c2', name: 'Maya Jenkins' },
                ],
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '350.00', method: 'card', recordedAt: new Date('2026-09-05'), status: 'verified' }
                ],
            };

            const invoiceElement = InvoiceTemplate({ invoice: multiChildInvoice, organisationName: 'Star Bright Org' });
            const allText = extractTextFromTree(invoiceElement);

            expect(allText).toContain('Leo Jenkins');
            expect(allText).toContain('Maya Jenkins');
            expect(allText).toContain('Childcare services — Leo Jenkins, Maya Jenkins');
        });

        it('Receipt falls back to single child relation when coveredChildrenJson is absent', () => {
            const singleChildInvoice = {
                invoiceNumber: 'INV-2026-002',
                amount: '180.00',
                status: 'paid',
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                child: { firstName: 'Leo', lastName: 'Jenkins' },
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '180.00', method: 'bank_transfer', recordedAt: new Date('2026-09-02'), status: 'verified' }
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice: singleChildInvoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Child: Leo Jenkins');
            expect(allText).not.toContain('Child 1:');
        });

        it('Receipt falls back to childDisplayName when child record is null', () => {
            const adHocInvoice = {
                invoiceNumber: 'INV-2026-003',
                amount: '120.00',
                status: 'paid',
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                childDisplayName: 'Toby Smith',
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '120.00', method: 'cash', recordedAt: new Date('2026-09-02'), status: 'verified' }
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice: adHocInvoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Child: Toby Smith');
        });
    });

    // ─── 2. Service Period Inheritance ──────────────────────────────────────

    describe('Service Period Inheritance', () => {
        it('Receipt inherits exactly the same billing period start and end as the invoice', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-004',
                amount: '200.00',
                billingPeriodStart: new Date('2026-10-01T00:00:00Z'),
                billingPeriodEnd: new Date('2026-10-31T00:00:00Z'),
                centre: baseCentreA,
                parent: baseParent,
                payments: [],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Service Period: 01/10/2026 – 31/10/2026');
        });

        it('Receipt handles single start date gracefully when end date is missing', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-005',
                amount: '100.00',
                billingPeriodStart: new Date('2026-11-01T00:00:00Z'),
                billingPeriodEnd: null,
                centre: baseCentreA,
                parent: baseParent,
                payments: [],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Service Period: From 01/11/2026');
        });
    });

    // ─── 3. Type of Service: Childcare ──────────────────────────────────────

    describe('Service Type Context', () => {
        it('Receipt displays explicit "Type of Service: Childcare" for childcare claims evidence', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-006',
                amount: '150.00',
                centre: baseCentreA,
                parent: baseParent,
                payments: [],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Type of Service: Childcare');
        });
    });

    // ─── 4. Authoritative Payment & Ledger Reconciliation ───────────────────

    describe('Authoritative Accounting & Payment Reconciliation', () => {
        it('Correctly references original invoice number and total amount', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-789',
                amount: '240.50',
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '240.50', method: 'bank_transfer', recordedAt: new Date('2026-09-10'), status: 'verified' }
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('INVOICE NO: INV-2026-789');
            expect(allText).toContain('Original Invoice: INV-2026-789');
            expect(allText).toContain('Invoice Total: £ 240.50');
            expect(allText).toContain('Total Paid: £ 240.50');
            expect(allText).toContain('Status: FULLY PAID');
            expect(allText).toContain('Total Received £ 240.50');
            expect(allText).toContain('Balance Remaining £ 0.00');
        });

        it('Correctly renders partial payments with outstanding balance', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-PART',
                amount: '300.00',
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '100.00', method: 'cash', recordedAt: new Date('2026-09-02'), status: 'verified' },
                    { id: 'p2', amount: '50.00', method: 'card', recordedAt: new Date('2026-09-08'), status: 'verified' },
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Total Paid: £ 150.00');
            expect(allText).toContain('Status: PARTIALLY PAID');
            expect(allText).toContain('Total Received £ 150.00');
            expect(allText).toContain('Balance Remaining £ 150.00');
            expect(allText).toContain('CASH');
            expect(allText).toContain('CARD');
            expect(allText).toContain('£ 100.00');
            expect(allText).toContain('£ 50.00');
        });

        it('Payment records maintain date order latest first', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-ORDER',
                amount: '200.00',
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '80.00', method: 'bank_transfer', recordedAt: new Date('2026-09-01T10:00:00Z'), status: 'verified' },
                    { id: 'p2', amount: '120.00', method: 'card', recordedAt: new Date('2026-09-15T12:00:00Z'), status: 'verified' },
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            // 15 September should appear before 01 September
            const pos15 = allText.indexOf('15 September 2026');
            const pos01 = allText.indexOf('01 September 2026');
            expect(pos15).toBeGreaterThan(-1);
            expect(pos01).toBeGreaterThan(-1);
            expect(pos15).toBeLessThan(pos01);
        });

        it('Receipt header contains authoritative INVOICE NO and deterministic stable RECEIPT NO', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-AUTH',
                amount: '180.00',
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '180.00', method: 'card', recordedAt: new Date('2026-09-02'), status: 'verified' }
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('INVOICE NO: INV-2026-AUTH');
            // Category C: PDF receipt displays deterministic stable receipt identity derived from verified payment UUID
            expect(allText).toContain('RECEIPT NO:');
            expect(allText).toContain('RCP-');
        });


        it('Only payments with status === "verified" are included in totals and payment table', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-STATUS',
                amount: '300.00',
                status: 'pending',
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '120.00', method: 'card', recordedAt: new Date('2026-09-05'), status: 'verified' },
                    { id: 'p2', amount: '80.00', method: 'bank_transfer', recordedAt: new Date('2026-09-06'), status: 'pending' },
                    { id: 'p3', amount: '100.00', method: 'cash', recordedAt: new Date('2026-09-07'), status: 'failed' },
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            // Only p1 (£120.00) is verified. Pending (£80.00) and Failed (£100.00) must be excluded.
            expect(allText).toContain('Total Paid: £ 120.00');
            expect(allText).toContain('Total Received £ 120.00');
            expect(allText).toContain('Balance Remaining £ 180.00');
            expect(allText).toContain('CARD');
            expect(allText).toContain('£ 120.00');

            // Excluded payment amounts and methods shouldn't appear as confirmed payment line items
            expect(allText).not.toContain('BANK TRANSFER');
            expect(allText).not.toContain('£ 80.00');
        });

        it('Distinguishes Date of Payment (recordedAt) from Receipt Date (generation date)', () => {
            const paymentDate = new Date('2026-08-15T14:30:00Z');
            const invoice = {
                invoiceNumber: 'INV-2026-DATES',
                amount: '150.00',
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '150.00', method: 'card', recordedAt: paymentDate, status: 'verified' }
                ],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            // Date of payment in table is 15 August 2026
            expect(allText).toContain('Date of Payment Payment Method Amount Paid 15 August 2026');
            // Receipt date in header is today
            expect(allText).toContain('RECEIPT DATE:');
        });
    });

    // ─── 5. Dynamic Provider & Manager Attribution ──────────────────────────

    describe('Dynamic Provider & Centre Manager Attribution', () => {
        it('Receipt dynamically displays centre manager name and role without hard-coding', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-MGR1',
                amount: '100.00',
                centre: baseCentreA,
                parent: baseParent,
                payments: [],
            };

            const receiptElement = ReceiptTemplate({ invoice, organisationName: 'Little Stars Ltd' });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Issued by: Jane Doe');
            expect(allText).toContain('Role: Centre Manager');
            expect(allText).toContain('Little Stars Academy Centre');
            expect(allText).toContain('Ofsted Registration No: EY987654');
        });

        it('Receipt falls back to "Centre Manager" when managerName is null', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-MGR2',
                amount: '100.00',
                centre: { ...baseCentreA, managerName: null },
                parent: baseParent,
                payments: [],
            };

            const receiptElement = ReceiptTemplate({ invoice });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Issued by: Centre Manager');
            expect(allText).toContain('Role: Centre Manager');
        });

        it('Invoice dynamically displays centre manager attribution in signature area', () => {
            const invoice = {
                invoiceNumber: 'INV-2026-MGR3',
                amount: '100.00',
                status: 'paid',
                centre: baseCentreA,
                parent: baseParent,
                payments: [],
            };

            const invoiceElement = InvoiceTemplate({ invoice, organisationName: 'Little Stars Ltd' });
            const allText = extractTextFromTree(invoiceElement);

            expect(allText).toContain('Jane Doe');
            expect(allText).toContain('Centre Manager');
            expect(allText).toContain('Authorised signatory');
        });
    });

    // ─── 6. Multi-Tenant Isolation & Anti-Hardcoding Regression ─────────────

    describe('Multi-Tenant Isolation & Anti-Hardcoding Regression', () => {
        it('Receipt for Centre A contains Centre A details and zero Centre B details', () => {
            const invoiceA = {
                invoiceNumber: 'INV-A-001',
                amount: '100.00',
                centre: baseCentreA,
                parent: baseParent,
                payments: [],
            };

            const receiptElement = ReceiptTemplate({ invoice: invoiceA, organisationName: 'Organisation Alpha' });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Little Stars Academy Centre');
            expect(allText).toContain('EY987654');
            expect(allText).toContain('020 7946 0123');
            expect(allText).toContain('Jane Doe');

            expect(allText).not.toContain('Peckham Learning Hub');
            expect(allText).not.toContain('EY112233');
            expect(allText).not.toContain('Marcus Rashford');
        });

        it('Receipt for Centre B contains Centre B details and zero Centre A details', () => {
            const invoiceB = {
                invoiceNumber: 'INV-B-001',
                amount: '100.00',
                centre: baseCentreB,
                parent: baseParent,
                payments: [],
            };

            const receiptElement = ReceiptTemplate({ invoice: invoiceB, organisationName: 'Organisation Beta' });
            const allText = extractTextFromTree(receiptElement);

            expect(allText).toContain('Peckham Learning Hub');
            expect(allText).toContain('EY112233');
            expect(allText).toContain('020 7946 0888');
            expect(allText).toContain('Marcus Rashford');

            expect(allText).not.toContain('Little Stars Academy Centre');
            expect(allText).not.toContain('EY987654');
            expect(allText).not.toContain('Jane Doe');
        });

        it('Template source files contain NO hard-coded centre names or branding', () => {
            const invoiceTemplateSrc = readSrc('src/features/finance/components/InvoiceTemplate.tsx');
            const receiptTemplateSrc = readSrc('src/features/finance/components/ReceiptTemplate.tsx');
            const pageSrc = readSrc('src/app/dashboard/finance/invoices/[id]/page.tsx');
            const stylesSrc = readSrc('src/features/finance/components/billingPdfStyles.ts');

            // No Sydenham
            expect(invoiceTemplateSrc.toLowerCase()).not.toContain('sydenham');
            expect(receiptTemplateSrc.toLowerCase()).not.toContain('sydenham');
            expect(pageSrc.toLowerCase()).not.toContain('sydenham');
            expect(stylesSrc.toLowerCase()).not.toContain('sydenham');

            // No HEATHWAY / HASC
            expect(invoiceTemplateSrc).not.toContain('HEATHWAY');
            expect(receiptTemplateSrc).not.toContain('HEATHWAY');
            expect(invoiceTemplateSrc).not.toContain('HASC Centre');
            expect(invoiceTemplateSrc).not.toContain('HASC CENTRE');
            expect(receiptTemplateSrc).not.toContain('HASC Centre');
            expect(receiptTemplateSrc).not.toContain('HASC CENTRE');
            expect(pageSrc).not.toContain('HASC CENTRE');
            expect(stylesSrc).not.toContain('HASC Blue');
        });
    });

    // ─── 7. Full PDF Rendering Pipeline Validation ─────────────────────────

    describe('Full PDF Rendering Pipeline Validation', () => {
        it('Scenario A: Renders 1 child / fully paid receipt to PDF buffer', async () => {
            const invoice = {
                invoiceNumber: 'INV-SCEN-A',
                amount: '150.00',
                status: 'paid',
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                child: { firstName: 'Oliver', lastName: 'Brown' },
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '150.00', method: 'card', recordedAt: new Date('2026-09-03'), status: 'verified' }
                ],
            };

            const buffer = await renderToBuffer(<ReceiptTemplate invoice={invoice} organisationName="Bright Future Care" />);
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(1000);
        });

        it('Scenario B: Renders 2 children / fully paid receipt to PDF buffer', async () => {
            const invoice = {
                invoiceNumber: 'INV-SCEN-B',
                amount: '280.00',
                status: 'paid',
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                coveredChildrenJson: [
                    { id: 'c1', name: 'Oliver Brown' },
                    { id: 'c2', name: 'Amelia Brown' },
                ],
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '280.00', method: 'bank_transfer', recordedAt: new Date('2026-09-04'), status: 'verified' }
                ],
            };

            const buffer = await renderToBuffer(<ReceiptTemplate invoice={invoice} organisationName="Bright Future Care" />);
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(1000);
        });

        it('Scenario C: Renders partial payment receipt to PDF buffer', async () => {
            const invoice = {
                invoiceNumber: 'INV-SCEN-C',
                amount: '300.00',
                status: 'partially_paid',
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                coveredChildrenJson: [
                    { id: 'c1', name: 'Oliver Brown' },
                    { id: 'c2', name: 'Amelia Brown' },
                ],
                centre: baseCentreA,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '100.00', method: 'cash', recordedAt: new Date('2026-09-05'), status: 'verified' }
                ],
            };

            const buffer = await renderToBuffer(<ReceiptTemplate invoice={invoice} organisationName="Bright Future Care" />);
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(1000);
        });

        it('Scenario D: Renders different centre/provider receipt to PDF buffer', async () => {
            const invoice = {
                invoiceNumber: 'INV-SCEN-D',
                amount: '175.00',
                status: 'paid',
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                child: { firstName: 'Lucas', lastName: 'Taylor' },
                centre: baseCentreB,
                parent: baseParent,
                payments: [
                    { id: 'p1', amount: '175.00', method: 'card', recordedAt: new Date('2026-09-06'), status: 'verified' }
                ],
            };

            const buffer = await renderToBuffer(<ReceiptTemplate invoice={invoice} organisationName="Peckham Childcare Ltd" />);
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(1000);
        });

        it('InvoiceTemplate renders cleanly to PDF buffer with updated clean fallbacks', async () => {
            const invoice = {
                invoiceNumber: 'INV-TEST-CLEAN',
                amount: '200.00',
                status: 'sent',
                invoiceDate: new Date('2026-09-01'),
                dueDate: new Date('2026-09-15'),
                billingPeriodStart: new Date('2026-09-01'),
                billingPeriodEnd: new Date('2026-09-30'),
                coveredChildrenJson: [
                    { id: 'c1', name: 'Lucas Taylor' },
                    { id: 'c2', name: 'Mia Taylor' },
                ],
                centre: baseCentreB,
                parent: baseParent,
                payments: [],
            };

            const buffer = await renderToBuffer(<InvoiceTemplate invoice={invoice} organisationName="Peckham Childcare Ltd" />);
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(1000);
        });
    });
});
