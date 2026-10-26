// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
vi.stubGlobal('React', React);
const mocks = vi.hoisted(() => ({ push: vi.fn(), params: 'status=follow-ups&followUp=overdue&search=Dummy&page=3&centre=centre-1' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams(mocks.params) }));
vi.mock('@/components/dashboard/CentreFilterContext', () => ({ useCentreFilter: () => ({ selectedCentreId: 'centre-1', setSelectedCentreId: vi.fn() }) }));
import StudentsFilters from './StudentsFilters';
import BookingsFilters from '@/features/bookings/components/BookingsFilters';
afterEach(() => { cleanup(); mocks.push.mockClear(); });
describe('operational queue controls', () => {
    it('switches call due date without losing centre/search and starts at page one', () => {
        render(<StudentsFilters centres={[{ id: 'centre-1', name: 'Dummy centre' }]} />);
        fireEvent.change(screen.getByLabelText('Filter follow-up calls'), { target: { value: 'today' } });
        const url = mocks.push.mock.calls[0][0] as string;
        expect(url).toContain('followUp=today'); expect(url).toContain('status=follow-ups'); expect(url).toContain('centre=centre-1'); expect(url).toContain('search=Dummy'); expect(url).not.toContain('page=');
    });
    it('opens outcome queue with centre/search retained and conflicting date/status cleared', () => {
        mocks.params = 'status=completed&from=2026-10-25&today=true&search=Dummy&centre=centre-1';
        render(<BookingsFilters centres={[{ id: 'centre-1', name: 'Dummy centre' }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Outcomes to record' }));
        const url = mocks.push.mock.calls[0][0] as string;
        expect(url).toContain('outcome=required'); expect(url).toContain('centre=centre-1'); expect(url).toContain('search=Dummy'); expect(url).not.toContain('status='); expect(url).not.toContain('today='); expect(url).not.toContain('from=');
    });
    it('shows the call queue when a daily-work link updates an existing Students screen', () => {
        mocks.params = 'status=all&centre=centre-1';
        const view = render(<StudentsFilters centres={[{ id: 'centre-1', name: 'Dummy centre' }]} />);
        expect(screen.queryByLabelText('Filter follow-up calls')).toBeNull();
        mocks.params = 'status=follow-ups&followUp=overdue&centre=centre-1';
        view.rerender(<StudentsFilters centres={[{ id: 'centre-1', name: 'Dummy centre' }]} />);
        expect((screen.getByLabelText('Filter follow-up calls') as HTMLSelectElement).value).toBe('overdue');
    });

});
