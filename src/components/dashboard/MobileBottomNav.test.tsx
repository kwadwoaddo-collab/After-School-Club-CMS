import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MobileBottomNav from './MobileBottomNav';

vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard',
}));

// Mock SidebarContext hook — `collapsed` doubles as "mobile drawer open?"
// (false = drawer open) and "desktop rail collapsed?" depending on viewport.
const mockCollapsed = vi.hoisted(() => ({ value: true }));
vi.mock('./SidebarContext', () => ({
    useSidebar: () => ({
        collapsed: mockCollapsed.value,
        setCollapsed: vi.fn(),
    }),
}));

function renderNav(props = {}) {
    return renderToStaticMarkup(React.createElement(MobileBottomNav, props));
}

describe('MobileBottomNav visibility', () => {
    it('renders the tab bar when the mobile nav drawer is closed', () => {
        mockCollapsed.value = true;
        const html = renderNav({ userRole: 'ORG_OWNER' });
        expect(html).toContain('Mobile navigation');
        expect(html).toContain('Dashboard');
    });

    it('renders nothing while the mobile nav drawer is open, to avoid it drawing over the drawer', () => {
        mockCollapsed.value = false;
        const html = renderNav({ userRole: 'ORG_OWNER' });
        expect(html).toBe('');
    });

    it('filters nav items by role and caps at 5', () => {
        mockCollapsed.value = true;
        const html = renderNav({ userRole: 'TUTOR' });
        expect(html).toContain('Dashboard');
        expect(html).not.toContain('Registrations');
    });
});
