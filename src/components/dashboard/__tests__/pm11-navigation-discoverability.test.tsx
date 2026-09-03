import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Sidebar from '../Sidebar';
import MobileBottomNav from '../MobileBottomNav';

// Track current pathname for testing active state
let currentPathname = '/dashboard';

// Mock next/navigation hooks
vi.mock('next/navigation', () => ({
    usePathname: () => currentPathname,
    useRouter: () => ({
        push: vi.fn(),
        refresh: vi.fn(),
    }),
}));

// Mock SidebarContext hook
const mockCollapsed = vi.hoisted(() => ({ value: false }));
vi.mock('../SidebarContext', () => ({
    useSidebar: () => ({
        collapsed: mockCollapsed.value,
        setCollapsed: vi.fn(),
    }),
}));

// Mock CentreFilterContext hook
vi.mock('@/components/dashboard/CentreFilterContext', () => ({
    useCentreFilter: () => ({
        selectedCentreId: 'all',
        setSelectedCentreId: vi.fn(),
        centres: [
            { id: '1', name: 'Centre A' },
            { id: '2', name: 'Centre B' },
        ],
    }),
}));

function renderSidebar(props: Record<string, any> = {}) {
    const defaultProps = {
        userName: 'Test User',
        userRole: 'ORG_OWNER',
        orgName: 'Oakridge Club',
        centres: [
            { id: '1', name: 'Centre A' },
            { id: '2', name: 'Centre B' },
        ],
    };
    return renderToStaticMarkup(
        React.createElement(Sidebar, { ...defaultProps, ...props })
    );
}

function renderMobileBottomNav(props: Record<string, any> = {}) {
    return renderToStaticMarkup(
        React.createElement(MobileBottomNav, props)
    );
}

describe('PM-1.1 — Help & Training Navigation Discoverability', () => {
    // 1. Help & Training exists in authenticated staff navigation
    it('1. Help & Training exists in authenticated staff navigation', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'ORG_OWNER' });
        expect(html).toContain('Help &amp; Training');
    });

    // 2. Points to /dashboard/help
    it('2. Help & Training link points to /dashboard/help', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'ORG_OWNER' });
        expect(html).toContain('href="/dashboard/help"');
    });

    // 3. Appears immediately after Dashboard in primary navigation ordering
    it('3. Help & Training appears immediately after Dashboard in primary navigation ordering', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'ORG_OWNER' });
        const dashboardIdx = html.indexOf('href="/dashboard"');
        const helpIdx = html.indexOf('href="/dashboard/help"');
        const centresIdx = html.indexOf('href="/dashboard/centres"');

        expect(dashboardIdx).toBeGreaterThan(-1);
        expect(helpIdx).toBeGreaterThan(-1);
        expect(centresIdx).toBeGreaterThan(-1);

        // Dashboard must come before Help & Training
        expect(dashboardIdx).toBeLessThan(helpIdx);
        // Help & Training must come before Centres (operational nav)
        expect(helpIdx).toBeLessThan(centresIdx);
    });

    // 4. Available for ORG_OWNER
    it('4. Help & Training is available in sidebar for ORG_OWNER', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'ORG_OWNER' });
        expect(html).toContain('href="/dashboard/help"');
        expect(html).toContain('Help &amp; Training');
    });

    // 5. Available for MANAGER
    it('5. Help & Training is available in sidebar for MANAGER', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'MANAGER' });
        expect(html).toContain('href="/dashboard/help"');
        expect(html).toContain('Help &amp; Training');
    });

    // 6. Available for FRONT_DESK
    it('6. Help & Training is available in sidebar for FRONT_DESK', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'FRONT_DESK' });
        expect(html).toContain('href="/dashboard/help"');
        expect(html).toContain('Help &amp; Training');
    });

    // 7. Available for TUTOR
    it('7. Help & Training is available in sidebar for TUTOR', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'TUTOR' });
        expect(html).toContain('href="/dashboard/help"');
        expect(html).toContain('Help &amp; Training');
    });

    // 8. Existing primary mobile bottom-nav destinations are unchanged
    it('8. Existing primary mobile bottom-nav destinations are unchanged', () => {
        mockCollapsed.value = true;
        const ownerNav = renderMobileBottomNav({ userRole: 'ORG_OWNER' });
        expect(ownerNav).toContain('Dashboard');
        expect(ownerNav).toContain('Students');
        expect(ownerNav).toContain('Registrations');
        expect(ownerNav).toContain('Settings');
        // Help & Training must NOT be in the persistent bottom nav
        expect(ownerNav).not.toContain('/dashboard/help');

        const managerNav = renderMobileBottomNav({ userRole: 'MANAGER' });
        expect(managerNav).toContain('Dashboard');
        expect(managerNav).toContain('Students');
        expect(managerNav).toContain('Registrations');
        expect(managerNav).not.toContain('/dashboard/help');

        const frontDeskNav = renderMobileBottomNav({ userRole: 'FRONT_DESK' });
        expect(frontDeskNav).toContain('Dashboard');
        expect(frontDeskNav).toContain('Students');
        expect(frontDeskNav).toContain('Registrations');
        expect(frontDeskNav).not.toContain('/dashboard/help');

        const tutorNav = renderMobileBottomNav({ userRole: 'TUTOR' });
        expect(tutorNav).toContain('Dashboard');
        expect(tutorNav).not.toContain('/dashboard/help');
    });

    // 9. No duplicate Help & Training sidebar entry exists
    it('9. No duplicate Help & Training sidebar entry exists', () => {
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'ORG_OWNER' });
        const occurrences = (html.match(/href="\/dashboard\/help"/g) || []).length;
        expect(occurrences).toBe(1);
    });

    // 10. Existing active-route behaviour remains valid
    it('10. Existing active-route behaviour remains valid on /dashboard/help', () => {
        currentPathname = '/dashboard/help';
        mockCollapsed.value = false;
        const html = renderSidebar({ userRole: 'ORG_OWNER' });

        // Help & Training link should have aria-current="page" and active styling
        expect(html).toContain('aria-current="page"');
        expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*href="\/dashboard\/help"/);
        // Dashboard should NOT have aria-current="page"
        expect(html).not.toMatch(/<a[^>]*aria-current="page"[^>]*href="\/dashboard"/);

        // Reset pathname
        currentPathname = '/dashboard';
    });

    it('11. In collapsed state, Help & Training provides title attribute tooltip and centered icon', () => {
        mockCollapsed.value = true;
        const html = renderSidebar({ userRole: 'ORG_OWNER' });
        expect(html).toContain('title="Help &amp; Training"');
        expect(html).toContain('justify-center');
    });
});
