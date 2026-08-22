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
    it('renders the organization logo chip with InvoiceFlow\'s flat solid-accent treatment (no gradient/ring/glow)', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();

        // Assert org name is visible
        expect(html).toContain('Acme Academy');

        // Milestone 2 Correction Pass: OrgSwitcher's badge was rebuilt to match
        // InvoiceFlow's business-switcher.tsx chip exactly — a flat rounded-md
        // bg-accent chip, not the old gradient/ring/shadow-glow treatment.
        expect(html).not.toContain('bg-gradient-to-br');
        expect(html).not.toContain('ring-primary/20');
        expect(html).not.toContain('shadow-primary/10');
        expect(html).toContain('bg-accent');
        expect(html).toContain('rounded-md');
    });

    it('applies InvoiceFlow\'s solid-fill accent style (no left indicator bar) to the active nav item', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();

        // Since pathname is mocked to '/dashboard', the Dashboard link is active.
        // Milestone 2 Correction Pass: InvoiceFlow's sidebar-nav.tsx uses a plain
        // solid bg-accent-soft fill with no left-rule/pseudo-element decoration —
        // the earlier `before:` accent bar has been removed to match exactly.
        expect(html).not.toContain('before:absolute');
        expect(html).not.toContain('before:bg-accent');
        expect(html).toContain('bg-accent-soft');
        expect(html).toContain('text-accent');
    });

    it('renders nav items with InvoiceFlow-aligned tight vertical rhythm', () => {
        mockCollapsed.value = false;
        const html = renderSidebar();

        expect(html).toContain('space-y-0.5');
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
