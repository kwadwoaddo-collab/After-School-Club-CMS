import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Header from './Header';

// Mock next/navigation hooks
vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard',
    useRouter: () => ({
        push: vi.fn(),
        refresh: vi.fn(),
    }),
}));

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
    signOut: vi.fn(),
}));

// Mock SidebarContext hook
const mockCollapsed = vi.hoisted(() => ({ value: false }));
vi.mock('./SidebarContext', () => ({
    useSidebar: () => ({
        collapsed: mockCollapsed.value,
        setCollapsed: vi.fn(),
    }),
}));

function renderHeader(props = {}) {
    const defaultProps = {
        userName: 'Admin User',
        userInitial: 'A',
        userRole: 'ADMIN',
    };
    return renderToStaticMarkup(
        React.createElement(Header, { ...defaultProps, ...props })
    );
}

describe('Header Polish (R3) Enhancements', () => {
    it('renders the header border styling with semi-transparent border-border/60', () => {
        const html = renderHeader();
        expect(html).toContain('border-border/60');
    });

    it('renders a focusable search field with the InvoiceFlow-aligned flat input treatment', () => {
        const html = renderHeader();
        expect(html).toContain('h-10');
        expect(html).toContain('rounded-md');
        expect(html).toContain('focus-within:outline-accent');
        expect(html).toContain('Search students, bookings');
    });

    it('renders the theme toggle button reflecting the initial (pre-hydration) theme state', () => {
        const html = renderHeader();
        // Header's `theme` state initialises to 'dark' (matching the anti-flash
        // inline script's own 'dark' fallback in src/app/layout.tsx) and only
        // reconciles with localStorage after mount — a static server render
        // (as here) always reflects that initial value, not 'system'. This
        // was a pre-existing stale assertion (documented in
        // project-notes/milestone-1-final-closure.md's test baseline),
        // fixed while this file was already being touched for Milestone 2.
        expect(html).toContain('aria-label="Toggle theme (currently dark)"');
    });

    it('renders the user avatar / initials button on the new accent token', () => {
        const html = renderHeader({ userInitial: 'U' });
        expect(html).toContain('ring-2');
        expect(html).toContain('ring-border');
        expect(html).toContain('group-hover:ring-accent/40');
        expect(html).toContain('bg-accent-soft');
        expect(html).toContain('text-accent');
        expect(html).toContain('font-semibold');
        expect(html).toContain('text-sm');
        expect(html).toContain('U');
    });
});
