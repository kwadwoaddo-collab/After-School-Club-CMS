import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import StudentLifecyclePanel from './StudentLifecyclePanel';
const paused = { id: 'pause', status: 'paused' as const, effectiveDate: '2026-10-01', reason: 'Parent requested a break', expectedRestartDate: '2026-10-10', nextContactDate: '2026-10-12', feeReviewConfirmed: false, createdAt: '2026-10-01T12:00:00Z' };
const render = (events = [paused], confirmed = true, canChangeStatus = true) => renderToStaticMarkup(<StudentLifecyclePanel childId="child" events={events} contacts={[]} today="2026-10-21" canChangeStatus={canChangeStatus} confirmed={confirmed} />);
describe('operator lifecycle visibility', () => {
    it('explains a reviewed billing date that is later than operational restart', () => {
        const html = renderToStaticMarkup(<StudentLifecyclePanel childId="child" events={[{ ...paused, status: 'active', feeReviewConfirmed: true, billingReviewedFrom: '2026-11-01' }]} contacts={[]} today="2026-10-21" canChangeStatus confirmed />);
        expect(html).toContain('Active attendance');
        expect(html).toContain('The reviewed billing start is 2026-11-01');
        expect(html).toContain('earlier restart-period invoices remain blocked');
    });
    it('keeps a paused student paused after their expected restart reminder date passes', () => { const html = render(); expect(html).toContain('Paused'); expect(html).toContain('reminder only'); expect(html).toContain('2026-10-12'); expect(html).toContain('Due'); });
    it('shows future status separately rather than applying it early', () => { const html = render([{ ...paused, effectiveDate: '2026-11-01' }]); expect(html).toContain('Active attendance'); expect(html).toContain('Scheduled: paused from 2026-11-01'); });
    it('does not show a prospect as active or expose status controls to front desk', () => { const html = render([], false, false); expect(html).toContain('Joining not yet confirmed'); expect(html).not.toContain('Change enrolment status'); expect(html).toContain('Log contacted / next call'); });
});
