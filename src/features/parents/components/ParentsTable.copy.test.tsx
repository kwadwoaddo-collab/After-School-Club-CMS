import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ParentsTable, { ParentRow } from './ParentsTable';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/app/dashboard/parents/bin.actions', () => ({
    softDeleteParent: vi.fn(),
}));

const row = (over: Partial<ParentRow>): ParentRow => ({
    id: 'p1',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.test',
    phone: '07700900123',
    childCount: 1,
    childrenList: [{ id: 'c1', first_name: 'Kid', last_name: 'Smith' }],
    outstanding: 0,
    ...over,
});

describe('ParentsTable WhatsApp copy actions (server-rendered, serialisable props only)', () => {
    it('renders Copy message + Copy number before the unchanged wa.me link in table and card layouts', () => {
        const html = renderToStaticMarkup(<ParentsTable parents={[row({})]} />);
        expect(html).toContain('aria-label="Copy message for Jane Smith"');
        expect(html).toContain('aria-label="Copy number for Jane Smith"');
        expect(html).toContain('data-copy-kind="message"');
        expect(html).toContain('data-copy-kind="number"');
        expect(html).toContain('href="https://wa.me/447700900123?text=Hi%20Jane%2C"');
        expect(html.indexOf('Copy message for Jane Smith')).toBeLessThan(html.indexOf('https://wa.me/447700900123'));
        // Table view (icon) and mobile card view (text) both render the pair.
        expect(html).toContain('Copy message</span>');
    });

    it('never puts child names or medical data into copied text and omits the pair when there is no valid phone', () => {
        const withPhone = renderToStaticMarkup(<ParentsTable parents={[row({})]} />);
        expect(withPhone).not.toMatch(/Hi Jane,[^"<]*Kid/);
        const noPhone = renderToStaticMarkup(<ParentsTable parents={[row({ phone: null })]} />);
        expect(noPhone).not.toContain('Copy message');
        expect(noPhone).not.toContain('Copy number');
        const badPhone = renderToStaticMarkup(<ParentsTable parents={[row({ phone: 'n/a' })]} />);
        expect(badPhone).not.toContain('data-copy-kind');
    });
});
