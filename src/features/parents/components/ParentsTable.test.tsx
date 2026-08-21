import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ParentsTable, { ParentRow } from './ParentsTable';

// ParentsTable renders DeleteParentButton, a 'use client' component that
// transitively imports the `softDeleteParent` server action (and, through
// it, @/lib/auth / next-auth's server runtime). None of that is exercised
// by this test — it only needs DeleteParentButton's own module graph to
// resolve under Vitest's node environment — so it's mocked out the same
// way the existing Header.test.tsx / security-p6 tests mock next/navigation
// and other client-only or server-only dependencies.
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/app/dashboard/parents/bin.actions', () => ({
    softDeleteParent: vi.fn(),
}));

/**
 * Regression test for the production /dashboard/parents crash
 * (observed live as a Server Component render failure — error boundary
 * digest 748709114 in Milestone 0A discovery testing).
 *
 * Root cause: ParentsTable is a Server Component (no 'use client'
 * directive), but it rendered a next/link <Link onClick={...}> for each
 * child pill. Passing a function (an event handler) as a prop from a
 * Server Component into a Client Component's props is not allowed —
 * React/Next.js throws "Event handlers cannot be passed to Client
 * Component props" while serializing the RSC payload.
 *
 * This only manifested for parents who actually have children in
 * `childrenList` (the branch that rendered the onClick-bearing <Link>),
 * which is exactly the production scenario ("2 students" per Milestone 0A
 * discovery). It was NOT caught by a plain `renderToStaticMarkup` render
 * with mocked data, because that rendering path does not enforce the
 * server/client serialization boundary that Next.js's real RSC renderer
 * does — a function prop is simply dropped/ignored rather than throwing.
 *
 * The regression test below therefore does not rely on
 * `renderToStaticMarkup` to catch the defect. Instead it walks the raw
 * React element tree returned by ParentsTable and asserts that no element
 * carries a function-typed prop anywhere in the tree — which is exactly
 * the invariant Next.js enforces at the RSC boundary for a Server
 * Component's output, and exactly what the removed `onClick` violated.
 */

function walkForFunctionProps(node: unknown, path: string, offenders: string[]): void {
    if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') {
        return;
    }

    if (Array.isArray(node)) {
        node.forEach((child, i) => walkForFunctionProps(child, `${path}[${i}]`, offenders));
        return;
    }

    if (React.isValidElement(node)) {
        const props = node.props as Record<string, unknown>;
        const typeName =
            typeof node.type === 'string' ? node.type : (node.type as { displayName?: string; name?: string })?.displayName || (node.type as { name?: string })?.name || 'Component';

        for (const [key, value] of Object.entries(props)) {
            if (key === 'children') continue;
            if (typeof value === 'function') {
                offenders.push(`${path} > <${typeName} ${key}={function}>`);
            }
        }

        if (props.children !== undefined) {
            walkForFunctionProps(props.children, `${path} > <${typeName}>.children`, offenders);
        }
        return;
    }
}

function buildParent(overrides: Partial<ParentRow> = {}): ParentRow {
    return {
        id: 'parent-1',
        firstName: 'Mark',
        lastName: 'Brown',
        email: 'mark@example.com',
        phone: '07700900000',
        childCount: 2,
        childrenList: [
            { id: 'child-1', first_name: 'Ava', last_name: 'Brown' },
            { id: 'child-2', first_name: 'Sam', last_name: 'Brown' },
        ],
        outstanding: 200,
        ...overrides,
    };
}

describe('ParentsTable — RSC serialization regression (Workstream 3)', () => {
    it('does not pass any function-typed props anywhere in its rendered element tree when a parent has children', () => {
        const parents = [buildParent()];

        const element = ParentsTable({ parents, error: false });

        const offenders: string[] = [];
        walkForFunctionProps(element, 'ParentsTable()', offenders);

        expect(offenders).toEqual([]);
    });

    it('still renders each child as a link to /dashboard/students/:id after removing the offending handler', () => {
        const parents = [buildParent()];
        const html = renderToStaticMarkup(
            React.createElement(ParentsTable, { parents, error: false })
        );

        expect(html).toContain('/dashboard/students/child-1');
        expect(html).toContain('/dashboard/students/child-2');
        expect(html).toContain('Ava Brown');
        expect(html).toContain('Sam Brown');
    });

    it('has no function-typed props for a parent with zero children either (empty-list branch)', () => {
        const parents = [buildParent({ childCount: 0, childrenList: [] })];

        const element = ParentsTable({ parents, error: false });

        const offenders: string[] = [];
        walkForFunctionProps(element, 'ParentsTable()', offenders);

        expect(offenders).toEqual([]);
    });

    it('renders the error banner without throwing when error=true is passed through from a swallowed query failure', () => {
        const parents = [buildParent()];
        expect(() =>
            renderToStaticMarkup(React.createElement(ParentsTable, { parents, error: true }))
        ).not.toThrow();
    });
});
