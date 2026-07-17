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

    it('upgrades the search input container form element with h-10, rounded-2xl, and premium focus/hover styles', () => {
        const html = renderHeader();
        expect(html).toContain('h-10');
        expect(html).toContain('rounded-2xl');
        expect(html).toContain('focus-within:border-primary/40');
        expect(html).toContain('hover:border-primary/40');
        expect(html).toContain('hover:ring-primary/10');
    });

    it('renders the tactile theme toggle (Sun/Moon/Cloud) button cycling through system -> light -> dark states', () => {
        const html = renderHeader();
        expect(html).toContain('active:scale-95');
        expect(html).toContain('transition-transform');
        expect(html).toContain('duration-200');
        expect(html).toContain('aria-label="Toggle theme (currently system)"');
    });

    it('upgrades the user avatar / initials button with transition-all duration-200 and ring-2 ring-border group-hover:ring-primary/40', () => {
        const html = renderHeader({ userInitial: 'U' });
        expect(html).toContain('ring-2');
        expect(html).toContain('ring-border');
        expect(html).toContain('group-hover:ring-primary/40');
        expect(html).toContain('font-semibold');
        expect(html).toContain('text-sm');
        expect(html).toContain('tracking-tight');
        expect(html).toContain('U');
    });
});
