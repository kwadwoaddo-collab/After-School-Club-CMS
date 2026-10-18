// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';
import { CentreFilterProvider } from './CentreFilterContext';

const navigation = vi.hoisted(() => ({
    pathname: '/dashboard/finance',
    router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
    searchParams: new URLSearchParams('status=draft&page=2'),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => navigation.pathname,
    useRouter: () => navigation.router,
    useSearchParams: () => navigation.searchParams,
}));
vi.mock('./SidebarContext', () => ({
    useSidebar: () => ({ collapsed: false, setCollapsed: vi.fn() }),
}));

const centres = [{ id: 'centre-a', name: 'Centre A' }, { id: 'centre-b', name: 'Centre B' }];

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.cookie = 'selected_centre_id=; max-age=0; path=/';
});
afterEach(cleanup);

describe('Active centre switching', () => {
    it.each(['/dashboard/finance', '/dashboard/students', '/dashboard/bookings', '/dashboard'])(
        'refreshes %s with the new centre without redirecting', (pathname) => {
            navigation.pathname = pathname;
            render(
                <CentreFilterProvider centres={centres} defaultCentreId="centre-a">
                    <Sidebar userRole="ORG_OWNER" userName="Local Operator" />
                </CentreFilterProvider>
            );

            fireEvent.click(screen.getByRole('button', { name: /Active CentreCentre A/i }));
            fireEvent.click(screen.getByRole('option', { name: 'Centre B' }));

            expect(document.cookie).toContain('selected_centre_id=centre-b');
            expect(localStorage.getItem('dashboard_centre_filter')).toBe('centre-b');
            expect(navigation.router.refresh).toHaveBeenCalledTimes(1);
            expect(navigation.router.push).not.toHaveBeenCalled();
            expect(navigation.router.replace).not.toHaveBeenCalled();
            expect(screen.queryByRole('listbox')).toBeNull();
            expect(screen.getByRole('button', { name: /Active CentreCentre B/i })).toBeTruthy();

            fireEvent.click(screen.getByRole('button', { name: /Active CentreCentre B/i }));
            fireEvent.click(screen.getByRole('option', { name: 'Combined View' }));
            expect(document.cookie).toContain('selected_centre_id=all');
            expect(localStorage.getItem('dashboard_centre_filter')).toBe('all');
            expect(navigation.router.refresh).toHaveBeenCalledTimes(2);
            expect(navigation.router.push).not.toHaveBeenCalled();
            expect(navigation.router.replace).not.toHaveBeenCalled();
        }
    );
});
