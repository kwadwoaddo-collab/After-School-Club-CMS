import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Sidebar from './Sidebar';

// Mock next/navigation hooks
vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard',
    useRouter: () => ({
        push: vi.fn(),
        refresh: vi.fn(),
    }),
}));

// Mock SidebarContext hook
const mockCollapsed = vi.hoisted(() => ({ value: false }));
vi.mock('./SidebarContext', () => ({
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

function renderSidebar(props = {}) {
    const defaultProps = {
        userName: 'John Doe',
        userRole: 'ORG_OWNER',
        orgName: 'Acme Academy',
        centres: [
            { id: '1', name: 'Centre A' },
            { id: '2', name: 'Centre B' },
        ],
    };
    return renderToStaticMarkup(
        React.createElement(Sidebar, { ...defaultProps, ...props })
    );
}

describe('Sidebar Polish (R2) Enhancements', () => {
    it('renders the organization logo badge container with gradient, depth ring, and shadow classes', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();
        
        // Assert org name is visible
        expect(html).toContain('Acme Academy');
        
        // Assert organization logo badge container contains refined style classes
        expect(html).toContain('bg-gradient-to-br');
        expect(html).toContain('from-primary');
        expect(html).toContain('to-primary/80');
        expect(html).toContain('ring-2');
        expect(html).toContain('ring-primary/20');
        expect(html).toContain('shadow-md');
        expect(html).toContain('shadow-primary/10');
    });

    it('applies a distinguishing accent style (left indicator bar + accent token) to the active nav item', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();

        // Since pathname is mocked to '/dashboard', the Dashboard link is active.
        // Milestone 2: flattened from a pill/glow treatment to InvoiceFlow's
        // left-rule + soft accent background — assert on the current tokens
        // rather than the pre-Milestone-2 exact class strings.
        expect(html).toContain('before:absolute');
        expect(html).toContain('before:left-0');
        expect(html).toContain('before:bg-accent');
        expect(html).toContain('bg-accent-soft');
        expect(html).toContain('text-accent');
    });

    it('renders nav items with consistent vertical rhythm', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();

        expect(html).toContain('space-y-1');
        expect(html).toContain('py-2');
    });

    it('renders the collapsible sub-nav (children) items under their parent', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();

        // Parents and Attendance both declare nested `children` in navItems
        expect(html).toContain('Recovery Bin');
        expect(html).toContain('Session Ledger');
    });

    it('renders the user profile footer with initials, name, and role', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();

        // Shows user details when expanded
        expect(html).toContain('John Doe');
        expect(html).toContain('Org Owner'); // Formatted role
        expect(html).toContain('JD'); // Initials

        // Avatar chip uses the accent token, not the old primary/glassmorphism styling
        expect(html).toContain('bg-accent-soft');
        expect(html).toContain('text-accent');
    });

    it('handles collapsed state by hiding text labels, centering items, and showing tooltips', () => {
        mockCollapsed.value = true;
        const html = renderSidebar({ userName: 'John Doe', userRole: 'TUTOR' });
        
        // In collapsed state, names should be hidden inside footer but tooltip exists
        expect(html).toContain('title="John Doe (Tutor)"');
        
        // Nav items should have tooltip (title attribute)
        expect(html).toContain('title="Dashboard"');
        
        // Icons centered using mx-auto
        expect(html).toContain('mx-auto');
    });
});
