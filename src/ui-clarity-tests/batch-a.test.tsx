import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FinanceDataGridClient, { type FinanceInvoice } from '@/features/finance/components/FinanceDataGridClient';
import BookingsTable from '@/features/bookings/components/BookingsTable';
import { BookingStudentLink } from '@/features/bookings/components/BookingStudentLink';
import OrganisationInfoForm from '@/features/settings/components/OrganisationInfoForm';
import DashboardSchedule from '@/app/dashboard/_components/DashboardSchedule';

const scheduleFixture = vi.hoisted(() => ({ rows: [] as Array<{ id: string; startAt: string; childName: string; centreName: string; status: string }> }));
vi.mock('@/db', () => ({ db: { select: () => {
    const query = { from: () => query, leftJoin: () => query, innerJoin: () => query, where: () => query, orderBy: () => query, limit: () => Promise.resolve(scheduleFixture.rows) };
    return query;
} } }));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => <a {...props}>{children}</a> }));
vi.mock('@/components/ui/ToastProvider', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/finance/actions', () => ({ recordPayment: vi.fn() }));
vi.mock('@/features/finance/components/CreateInvoiceModal', () => ({ default: () => null }));
vi.mock('@/features/bookings/components/ReassignCentreModal', () => ({ default: () => null }));

const invoice: FinanceInvoice = {
    id: 'invoice-1', invoiceNumber: 'INV-FIXTURE', organisationId: 'org-1', parentId: 'parent-1',
    amount: '100', status: 'sent', invoiceDate: '2026-10-01T12:00:00Z', dueDate: '2026-10-05T12:00:00Z',
    payments: [{ id: 'payment-1', amount: '25', status: 'verified', recordedAt: '2026-10-02T12:00:00Z' }],
};

describe('batch A rendered operator UI', () => {
    it('distinguishes no bookings from no expected attendance and links to the register', async () => {
        scheduleFixture.rows = [];
        const html = renderToStaticMarkup(await DashboardSchedule({org: {id: 'org-1'}, accessibleCentreIds: ['centre-1'], hasCentres: true}));
        expect(html).toContain('No bookings recorded for today');
        expect(html).not.toContain('No sessions scheduled');
        expect(html).toContain('Regular attendance schedules');
        expect(html).toContain('href="/dashboard/attendance"');
    });

    it('retains booking detail links and register access when bookings exist', async () => {
        scheduleFixture.rows = [{id: 'booking-1', startAt: '2026-10-20T12:00:00Z', childName: 'Fixture Child', centreName: 'Fixture Centre', status: 'confirmed'}];
        const html = renderToStaticMarkup(await DashboardSchedule({org: {id: 'org-1'}, accessibleCentreIds: ['centre-1'], hasCentres: true}));
        expect(html).toContain('href="/dashboard/bookings/booking-1"');
        expect(html).toContain('href="/dashboard/attendance"');
        expect(html).not.toContain('No bookings recorded');
    });
    it('declares page/filter scope for every finance summary and preserves issued-only calculations', () => {
        const html = renderToStaticMarkup(<FinanceDataGridClient invoices={[invoice, { ...invoice, id: 'draft', amount: '999', status: 'draft' }]} page={2} totalCount={120} />);
        const summary = html.split('<table')[0];
        for (const label of ['Invoiced (Page)', 'Collected (Page)', 'Outstanding (Page)', 'Overdue (Page)']) expect(summary).toContain(label);
        expect(summary).toContain('current centre and status filters');
        expect(summary).toContain('Draft and void invoices are excluded');
        expect(summary).toContain('£100.00');
        expect(summary).toContain('£25.00');
        expect(summary).toContain('£75.00');
        expect(summary).not.toContain('£999');
        expect(html).toContain('aria-label="Select all invoices on this page"');
        expect(html).toContain('aria-label="Select invoice INV-FIXTURE"');
    });

    it('keeps page scope explicit when no invoices match', () => {
        const html = renderToStaticMarkup(<FinanceDataGridClient invoices={[]} statusFilter="paid" />);
        expect(html).toContain('No invoices found');
        expect(html).toContain('Totals cover invoices on this page');
        expect(html).toContain('£0.00');
    });

    it.each([undefined, null, '', '   '])('does not manufacture student links for missing ID %s', studentId => {
        const html = renderToStaticMarkup(<BookingStudentLink studentId={studentId}>Unknown Student</BookingStudentLink>);
        expect(html).not.toContain('<a');
        expect(html).toContain('Student link unavailable');
    });

    it('preserves the profile destination when an ID exists', () => {
        const html = renderToStaticMarkup(<BookingStudentLink studentId="student-1">Fixture Child</BookingStudentLink>);
        expect(html).toContain('href="/dashboard/students/student-1"');
        expect(html).not.toContain('unavailable');
    });

    it('guards the actual desktop and mobile booking rows while retaining booking details', () => {
        const html = renderToStaticMarkup(<BookingsTable bookings={[{ id: 'booking-1', status: 'confirmed', startAt: '2026-10-20T12:00:00Z', attendees: [] }]} />);
        expect(html).not.toContain('/students/undefined');
        expect(html).not.toContain('/students/null');
        expect(html.match(/Student link unavailable/g)).toHaveLength(2);
    });

    it('names owner edit controls without exposing them to non-owners', () => {
        const org = { name: 'Fixture Organisation', slug: 'fixture' };
        const owner = renderToStaticMarkup(<OrganisationInfoForm org={org} baseUrl="http://localhost" isOwner />);
        for (const name of ['Edit organisation name', 'Edit organisation slug', 'Edit subdomain']) expect(owner).toContain(`aria-label="${name}"`);
        expect(owner).not.toContain('opacity-0 group-hover:opacity-100');
        const viewer = renderToStaticMarkup(<OrganisationInfoForm org={org} baseUrl="http://localhost" isOwner={false} />);
        expect(viewer).not.toContain('aria-label="Edit organisation');
        expect(viewer).not.toContain('aria-label="Edit subdomain');
    });
});
