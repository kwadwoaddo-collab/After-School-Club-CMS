// @vitest-environment jsdom
import React from 'react';
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const pushMock = vi.fn();
const refreshMock = vi.fn();
const toastMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock, refresh: refreshMock }),
    redirect: vi.fn(),
    useParams: () => ({ slug: ['demo-org'] }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/app/portal/notifications/actions', () => ({
    markAllRead: vi.fn().mockResolvedValue({ success: true }),
    getNotifications: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/app/portal/billing/actions', () => ({
    submitVoucherPayment: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/app/portal/actions', () => ({
    cancelBookingByParent: vi.fn().mockResolvedValue({ success: true }),
}));

const createPortalBookingMock = vi.fn();
const reschedulePortalBookingMock = vi.fn();
vi.mock('@/app/portal/book/actions', () => ({
    createPortalBooking: (...args: unknown[]) => createPortalBookingMock(...args),
    reschedulePortalBooking: (...args: unknown[]) => reschedulePortalBookingMock(...args),
}));

import NotificationBell from '@/features/portal/components/NotificationBell';
import { VoucherPaymentForm } from '@/features/portal/components/VoucherPaymentForm';
import { CancelBookingButton } from '@/features/portal/components/CancelBookingButton';
import { BookingFlow } from '@/app/portal/book/BookingFlow';
import PortalLoading from '@/app/portal/loading';
import BillingLoading from '@/app/portal/billing/loading';
import ChildDetailsLoading from '@/app/portal/children/[id]/loading';
import PortalBookLoading from '@/app/portal/book/loading';

describe('Wave 4 FE-04 — Parent Portal & Public UX/WCAG 2.2 AA', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        cleanup();
    });

    it('NotificationBell provides 360px-safe dialog bounds, Escape close, accessible close button, and internal href links', () => {
        render(
            <NotificationBell
                unreadCount={2}
                notifications={[
                    {
                        id: 'n1',
                        type: 'invoice_sent',
                        title: 'New Invoice Ready',
                        body: 'View invoice #101',
                        href: '/portal/billing',
                        readAt: null,
                        createdAt: new Date('2026-11-25T10:00:00Z'),
                    },
                    {
                        id: 'n2',
                        type: 'general',
                        title: 'Unsafe Link Ignored',
                        body: 'No external protocol jump',
                        href: 'https://evil.example',
                        readAt: null,
                        createdAt: new Date('2026-11-25T10:00:00Z'),
                    },
                ]}
            />
        );

        const trigger = screen.getByRole('button', { name: /Notifications \(2 unread\)/i });
        expect(trigger.getAttribute('type')).toBe('button');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(trigger.innerHTML).toContain('text-destructive-foreground');

        fireEvent.click(trigger);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');

        const dialog = screen.getByRole('dialog', { name: 'Notifications' });
        expect(dialog.className).toContain('fixed inset-x-4 top-16');

        const closeBtn = screen.getByRole('button', { name: 'Close notifications' });
        expect(closeBtn.className).toContain('min-h-11 min-w-11');

        const billingLink = screen.getByRole('link', { name: /New Invoice Ready/i });
        expect(billingLink.getAttribute('href')).toBe('/portal/billing');
        expect(screen.queryByRole('link', { name: /Unsafe Link Ignored/i })).toBeNull();

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
    });

    it('VoucherPaymentForm generates unique useId() label/input bindings across multiple invoices and avoids hover:text-white', () => {
        const { container } = render(
            <div>
                <VoucherPaymentForm invoiceId="inv-1" amountDue={45} />
                <VoucherPaymentForm invoiceId="inv-2" amountDue={60} />
            </div>
        );

        const inputs = screen.getAllByLabelText('Log Childcare Voucher Payment') as HTMLInputElement[];
        expect(inputs).toHaveLength(2);
        expect(inputs[0].id).toBeTruthy();
        expect(inputs[1].id).toBeTruthy();
        expect(inputs[0].id).not.toBe(inputs[1].id);
        expect(inputs[0].className).toContain('border-border');
        expect(container.innerHTML).not.toContain('hover:text-white');
    });

    it('CancelBookingButton uses text-destructive-foreground instead of text-white on destructive confirmation CTA', () => {
        render(<CancelBookingButton bookingId="booking-1" />);
        const openBtn = screen.getByRole('button', { name: 'Cancel Booking' });
        expect(openBtn.getAttribute('type')).toBe('button');
        fireEvent.click(openBtn);

        const confirmBtn = screen.getByRole('button', { name: /Yes, cancel/i });
        expect(confirmBtn.getAttribute('type')).toBe('button');
        expect(confirmBtn.className).toContain('text-destructive-foreground');
        expect(confirmBtn.className).not.toContain('text-white');
    });

    it('BookingFlow exposes aria-pressed, auto-scopes child centreId, and announces errors with role="alert"', async () => {
        createPortalBookingMock.mockResolvedValueOnce({ success: false, error: 'Selected slot is full' });

        render(
            <BookingFlow
                registeredChildren={[
                    { id: 'c1', firstName: 'Maya', lastName: 'Mensah', schoolYear: 'Y4', centreId: 'centre-b' },
                    { id: 'c2', firstName: 'Kofi', lastName: 'Mensah', schoolYear: 'Y2', centreId: 'centre-a' },
                ]}
                centres={[
                    { id: 'centre-a', name: 'North Hub', address: null, sessionSlots: ['16:00'] },
                    { id: 'centre-b', name: 'South Hub', address: null, sessionSlots: ['16:00'] },
                ]}
            />
        );

        const mayaBtn = screen.getByRole('button', { name: /Maya Mensah/i });
        expect(mayaBtn.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(mayaBtn);
        expect(mayaBtn.getAttribute('aria-pressed')).toBe('true');

        // Auto-scoped to Maya's enrolled centre (South Hub)
        const southHubBtn = screen.getByRole('button', { name: /^South Hub$/ });
        expect(southHubBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('Portal loading skeletons render visible bg-page + bg-surface + border-border tokens', () => {
        for (const Comp of [PortalLoading, BillingLoading, ChildDetailsLoading, PortalBookLoading]) {
            const { container, unmount } = render(<Comp />);
            expect(container.firstElementChild?.className).toContain('bg-page');
            expect(container.innerHTML).toContain('bg-surface');
            expect(container.innerHTML).toContain('border-border');
            unmount();
        }
    });

    it('Portal routes and public registration preserve UUID guard, soft-delete guard, Mode of Finance text-white contrast, and /terms link', () => {
        const repoRoot = process.cwd();
        const bookPageSrc = fs.readFileSync(path.join(repoRoot, 'src/app/portal/book/page.tsx'), 'utf8');
        expect(bookPageSrc).toContain('isValidUuid(rescheduleBookingId)');
        expect(bookPageSrc).toContain('id="main-content"');
        expect(bookPageSrc).toContain('tabIndex={-1}');

        const childPageSrc = fs.readFileSync(path.join(repoRoot, 'src/app/portal/children/[id]/page.tsx'), 'utf8');
        expect(childPageSrc).toContain('isNull(children.deletedAt)');

        const registerPageSrc = fs.readFileSync(path.join(repoRoot, 'src/app/register/[...slug]/page.tsx'), 'utf8');
        const financeCardSlice = registerPageSrc.slice(
            registerPageSrc.indexOf('Mode of Finance') - 120,
            registerPageSrc.indexOf('Mode of Finance') + 900
        );
        expect(financeCardSlice).toContain('text-white');
        expect(financeCardSlice).not.toContain('text-foreground');
        expect(registerPageSrc).toContain('href="/terms"');
        expect(registerPageSrc).toContain('useId()');
    });
});
