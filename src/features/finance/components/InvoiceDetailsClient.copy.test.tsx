// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ issue: vi.fn(), resend: vi.fn(), refresh: vi.fn(), toast: vi.fn(), handoff: vi.fn() }));
vi.mock('../actions', () => ({ issueDraftInvoice: mocks.issue, resendInvoiceEmail: mocks.resend, deleteInvoice: vi.fn(), voidInvoice: vi.fn(), updateInvoiceDate: vi.fn(), updateInvoiceNotes: vi.fn(), updateDraftInvoice: vi.fn(), discardDraftInvoice: vi.fn(), updateInvoiceServiceType: vi.fn(), recordInvoiceWhatsAppHandoff: mocks.handoff }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@react-pdf/renderer', () => ({ PDFDownloadLink: () => null }));
vi.mock('./InvoiceTemplate', () => ({ InvoiceTemplate: () => null }));
vi.mock('./ReceiptTemplate', () => ({ ReceiptTemplate: () => null }));
vi.mock('./PaymentHistoryList', () => ({ default: () => null }));
vi.mock('./PDFPreviewModal', () => ({ default: () => null }));
vi.mock('./ConfirmActionModal', () => ({ default: () => null }));
vi.mock('./RecordPaymentModal', () => ({ default: () => null }));
import InvoiceDetails from './InvoiceDetailsClient';

const invoice = { id: 'inv', invoiceNumber: 'INV-TEST', amount: '1900', status: 'sent', invoiceDate: '2026-10-16', dueDate: '2026-11-06', billingPeriodStart: '2026-11-06', billingPeriodEnd: '2026-12-05', parent: { id: 'family', firstName: 'Demo', lastName: 'Family', email: 'dummy@example.test', phone: '07700900123' }, centre: { name: 'Dummy centre' }, coveredChildrenJson: [{ id: 'child', name: 'Sample Student' }], payments: [] };
const writeText = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function () { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function () { this.removeAttribute('open'); } });
    mocks.handoff.mockResolvedValue({ success: true });
});
afterEach(cleanup);

describe('invoice WhatsApp copy-first actions', () => {
    it('puts Copy message / Copy number before the unchanged wa.me link', () => {
        render(<InvoiceDetails invoice={invoice} organisationName="Dummy" userRole="MANAGER" />);
        const link = screen.getByRole('link', { name: /Send via WhatsApp/i }) as HTMLAnchorElement;
        expect(link.href.startsWith('https://wa.me/447700900123?text=')).toBe(true);
        const copyMessage = screen.getAllByRole('button', { name: 'Copy message' })[0];
        const copyNumber = screen.getAllByRole('button', { name: 'Copy number' })[0];
        expect(copyMessage.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(copyNumber.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('copies exactly the text the link pre-fills; copying the message records the audit handoff, copying the number does not', async () => {
        render(<InvoiceDetails invoice={invoice} organisationName="Dummy" userRole="MANAGER" />);
        const link = screen.getByRole('link', { name: /Send via WhatsApp/i }) as HTMLAnchorElement;
        const prefilled = new URL(link.href).searchParams.get('text');
        expect(prefilled).toContain('INV-TEST');

        fireEvent.click(screen.getAllByRole('button', { name: 'Copy message' })[0]);
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(prefilled));
        await waitFor(() => expect(mocks.handoff).toHaveBeenCalledTimes(1));
        expect(mocks.handoff).toHaveBeenCalledWith('inv');

        fireEvent.click(screen.getAllByRole('button', { name: 'Copy number' })[0]);
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('+44 7700 900123'));
        expect(mocks.handoff).toHaveBeenCalledTimes(1);
    });

    it('does not render copy actions for drafts, voided invoices or soft-deleted parents', () => {
        const { unmount } = render(<InvoiceDetails invoice={{ ...invoice, status: 'draft' }} organisationName="Dummy" userRole="MANAGER" />);
        expect(screen.queryAllByRole('button', { name: 'Copy message' })).toHaveLength(0);
        unmount();
        render(<InvoiceDetails invoice={{ ...invoice, parent: { ...invoice.parent, deletedAt: new Date('2026-11-20T00:00:00Z') } }} organisationName="Dummy" userRole="MANAGER" />);
        expect(screen.queryAllByRole('button', { name: 'Copy message' })).toHaveLength(0);
        expect(screen.queryAllByRole('button', { name: 'Copy number' })).toHaveLength(0);
    });
});
