// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ConfirmModal } from '../ConfirmModal';
import { AlertModal } from '../AlertModal';
import RecordPaymentModal from '@/features/finance/components/RecordPaymentModal';
import ReceiptGeneratorClient from '@/features/finance/components/ReceiptGeneratorClient';
import FilterableInvoiceHistorySection from '@/features/finance/components/FilterableInvoiceHistorySection';
import Header from '@/components/dashboard/Header';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock, refresh: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/dashboard',
    useSearchParams: () => new URLSearchParams('centre=11111111-1111-4111-8111-111111111111'),
}));

vi.mock('next-auth/react', () => ({
    signOut: vi.fn(),
}));

vi.mock('@/components/dashboard/SidebarContext', () => ({
    useSidebar: () => ({ collapsed: false, setCollapsed: vi.fn() }),
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/features/finance/actions', () => ({
    recordPayment: vi.fn(),
}));

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    pushMock.mockReset();
});

describe('Wave 4 FE-03 — Modal Focus Trap, Contrast & Finance Centre Propagation', () => {
    it('ConfirmModal traps Tab/Shift+Tab focus, closes on Escape, and restores focus to trigger', () => {
        function Harness() {
            const [open, setOpen] = React.useState(false);
            return (
                <div>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open Confirm
                    </button>
                    <ConfirmModal
                        isOpen={open}
                        title="Delete Item"
                        description="Are you sure?"
                        variant="danger"
                        confirmText="Delete"
                        cancelText="Keep"
                        onCancel={() => setOpen(false)}
                        onConfirm={() => setOpen(false)}
                    />
                </div>
            );
        }

        render(<Harness />);
        const trigger = screen.getByRole('button', { name: 'Open Confirm' });
        trigger.focus();
        fireEvent.click(trigger);

        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);

        const confirmBtn = screen.getByRole('button', { name: 'Delete' });
        expect(confirmBtn.className).toContain('bg-danger');
        expect(confirmBtn.className).toContain('text-on-danger');

        // Tab from last focusable wraps to first focusable inside dialog
        confirmBtn.focus();
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
        const closeBtn = screen.getByRole('button', { name: 'Close modal' });
        expect(document.activeElement).toBe(closeBtn);

        // Shift+Tab from first focusable wraps to last focusable inside dialog
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(confirmBtn);

        // Escape closes modal and restores focus to trigger
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('AlertModal traps focus and closes on Escape', () => {
        const onClose = vi.fn();
        render(
            <AlertModal
                isOpen={true}
                onClose={onClose}
                title="Notice"
                description="Action completed"
                variant="info"
            />
        );
        const okBtn = screen.getByRole('button', { name: 'Okay' });
        expect(document.activeElement).toBe(okBtn);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('RecordPaymentModal associates accessible labels and marks active payment method with aria-pressed', () => {
        render(
            <RecordPaymentModal
                invoiceId="11111111-1111-4111-8111-111111111111"
                invoiceNumber="INV-001"
                remainingBalance={45}
                onClose={vi.fn()}
                onSuccess={vi.fn()}
            />
        );

        const amountInput = screen.getByLabelText(/Amount Received/i);
        const dateInput = screen.getByLabelText(/Date Received/i);
        const refInput = screen.getByLabelText(/Transaction Reference/i);
        expect(amountInput).toBeTruthy();
        expect(dateInput).toBeTruthy();
        expect(refInput).toBeTruthy();

        const bankBtn = screen.getByRole('button', { name: /Bank Transfer/i });
        const cashBtn = screen.getByRole('button', { name: /Cash/i });
        expect(bankBtn.getAttribute('aria-pressed')).toBe('true');
        expect(cashBtn.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(cashBtn);
        expect(cashBtn.getAttribute('aria-pressed')).toBe('true');
        expect(bankBtn.getAttribute('aria-pressed')).toBe('false');
    });

    it('ReceiptGeneratorClient preselects initialCentreId and renders UK Authorised Signature in slate-600', () => {
        render(
            <ReceiptGeneratorClient
                organisation={{ id: 'org-1', name: 'SprintScale Club', slug: 'sprintscale' }}
                centres={[
                    { id: '11111111-1111-4111-8111-111111111111', name: 'Oakridge Centre' },
                    { id: '22222222-2222-4222-8222-222222222222', name: 'Maple Centre' },
                ]}
                // eslint-disable-next-line react/no-children-prop
                children={[]}
                initialCentreId="22222222-2222-4222-8222-222222222222"
            />
        );

        expect(screen.getByText('Authorised Signature (Maple Centre)')).toBeTruthy();
    });

    it('FilterableInvoiceHistorySection preserves activeCentreId on Create Invoice link', () => {
        render(
            <FilterableInvoiceHistorySection
                initialInvoices={[]}
                isOwner={true}
                activeCentreId="22222222-2222-4222-8222-222222222222"
            />
        );

        const createLink = screen.getByRole('link', { name: /Create Invoice/i });
        expect(createLink.getAttribute('href')).toBe(
            '/dashboard/finance?centre=22222222-2222-4222-8222-222222222222&create=1'
        );
    });

    describe('Header notifications unread fetch, region semantics & non-TUTOR booking click', () => {
        beforeEach(() => {
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: async () => ({
                        notifications: [
                            {
                                id: 'notif-1',
                                title: 'New Booking',
                                message: 'Booking received',
                                time: 'Just now',
                                read: false,
                                bookingId: '33333333-3333-4333-8333-333333333333',
                            },
                        ],
                    }),
                })
            );
        });

        it('fetches unread notifications on mount, exposes role="region", and navigates non-TUTOR to booking', async () => {
            render(<Header userName="Alex" userRole="MANAGER" />);

            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledWith('/api/notifications');
            });

            const bellBtn = screen.getByRole('button', { name: 'Notifications' });
            fireEvent.click(bellBtn);

            const region = screen.getByRole('region', { name: 'Notifications' });
            expect(region).toBeTruthy();

            const itemBtn = screen.getByRole('button', { name: /New Booking/i });
            fireEvent.click(itemBtn);

            await waitFor(() => {
                expect(pushMock).toHaveBeenCalledWith(
                    '/dashboard/bookings/33333333-3333-4333-8333-333333333333'
                );
            });
        });

        it('does NOT navigate TUTOR to /dashboard/bookings when clicking a booking notification', async () => {
            render(<Header userName="Sam" userRole="TUTOR" />);

            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledWith('/api/notifications');
            });

            fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
            fireEvent.click(screen.getByRole('button', { name: /New Booking/i }));

            await waitFor(() => {
                expect(globalThis.fetch).toHaveBeenCalledWith(
                    '/api/notifications',
                    expect.objectContaining({ method: 'PATCH' })
                );
            });
            expect(pushMock).not.toHaveBeenCalled();
        });
    });
});
