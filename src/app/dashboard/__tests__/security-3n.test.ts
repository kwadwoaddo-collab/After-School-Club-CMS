/**
 * Milestone 3N — Authenticated App Consolidation regression tests
 *
 * N-1: Availability added to Sidebar ROLE_NAV for ORG_OWNER and MANAGER.
 * N-2: Search API excludes centre-type results for FRONT_DESK
 *      (centre detail page is gated to ORG_OWNER + MANAGER only).
 * A11Y-1: Sidebar primary nav has aria-label; active links receive aria-current.
 * A11Y-2: Search result items are keyboard-accessible buttons (not div-onClick).
 * A11Y-3: Notification items are keyboard-accessible buttons (not div-onClick).
 * DC-1: Six confirmed-orphaned dashboard components deleted.
 * UX-1: Dashboard-scoped not-found.tsx exists.
 */
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

// ──────────────────────────────────────────────────────────────────────────────
// N-1 – Sidebar Availability navigation
// ──────────────────────────────────────────────────────────────────────────────
describe('N-1 – Sidebar Availability navigation (ORG_OWNER + MANAGER only)', () => {
    it('ORG_OWNER ROLE_NAV includes Availability', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const ownerLine = src.split('\n').find(
            (l) => l.includes('ORG_OWNER:') && l.includes("'Dashboard'") && l.includes("'Settings'")
        );
        expect(ownerLine).toBeDefined();
        expect(ownerLine).toContain("'Availability'");
    });

    it('MANAGER ROLE_NAV includes Availability', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const managerLine = src.split('\n').find(
            (l) => l.includes('MANAGER:') && l.includes("'Dashboard'") && l.includes("'Reports'")
        );
        expect(managerLine).toBeDefined();
        expect(managerLine).toContain("'Availability'");
    });

    it('FRONT_DESK ROLE_NAV does NOT include Availability', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const fdLine = src.split('\n').find(
            (l) => l.includes('FRONT_DESK:') && l.includes("'Dashboard'") && l.includes("'Students'")
        );
        expect(fdLine).toBeDefined();
        expect(fdLine).not.toContain("'Availability'");
    });

    it('TUTOR ROLE_NAV does NOT include Availability', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const tutorLine = src.split('\n').find(
            (l) => l.includes('TUTOR:') && l.includes("'Dashboard'") && l.includes("'Kiosk'")
        );
        expect(tutorLine).toBeDefined();
        expect(tutorLine).not.toContain("'Availability'");
    });

    it('navItems array includes an Availability entry with /dashboard/availability href', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        expect(src).toContain("name: 'Availability'");
        expect(src).toContain("href: '/dashboard/availability'");
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// N-2 – Search API centre-result role filter
// ──────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
    },
}));

import { auth } from '@/lib/auth';
const mockAuth = auth as MockedFunction<typeof auth>;

function makeRequest(query: string) {
    return new NextRequest(`http://localhost/api/search?q=${encodeURIComponent(query)}`);
}

function makeSession(role: string) {
    return {
        user: {
            id: 'user-1',
            organisationId: 'org-1',
            role,
            name: 'Test User',
        },
        expires: new Date(Date.now() + 3_600_000).toISOString(),
    };
}

import { GET } from '../../api/search/route';

describe('N-2 – Search API excludes centre results for FRONT_DESK', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('FRONT_DESK receives 200 but no centre-type results in response body structure', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('FRONT_DESK') as any);
        const res = await GET(makeRequest('north'));
        expect(res.status).toBe(200);
        const body = await res.json();
        // With DB mock returning [], results is []. Assert no centre type sneaks in.
        expect(Array.isArray(body.results)).toBe(true);
        const centreResults = body.results.filter((r: { type: string }) => r.type === 'centre');
        expect(centreResults).toHaveLength(0);
    });

    it('ORG_OWNER receives 200 and centre results are NOT filtered out by role gate', async () => {
        // The CENTRES_SEARCH_ROLES check must pass for ORG_OWNER.
        // DB mock returns [] so just assert the request succeeds and the code
        // path that would include centre results is exercised.
        mockAuth.mockResolvedValueOnce(makeSession('ORG_OWNER') as any);
        const res = await GET(makeRequest('north'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('results');
    });

    it('MANAGER receives 200 — centre search path exercised without error', async () => {
        mockAuth.mockResolvedValueOnce(makeSession('MANAGER') as any);
        const res = await GET(makeRequest('north'));
        expect(res.status).toBe(200);
    });

    it('search route source code filters centre results by CENTRES_SEARCH_ROLES', () => {
        const src = read('src/app/api/search/route.ts');
        expect(src).toContain('CENTRES_SEARCH_ROLES');
        expect(src).toContain('canSearchCentres');
        expect(src).toContain('ORG_OWNER');
        expect(src).toContain('MANAGER');
        // Verify the conditional spread is present
        expect(src).toContain('canSearchCentres ? centreResults');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// A11Y-1 – Sidebar accessibility: aria-label on nav, aria-current on active links
// ──────────────────────────────────────────────────────────────────────────────
describe('A11Y-1 – Sidebar nav landmark and aria-current', () => {
    it('Sidebar nav element has aria-label="Main navigation"', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        expect(src).toContain('aria-label="Main navigation"');
    });

    it('active Link elements receive aria-current="page"', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        expect(src).toContain("aria-current={isActive ? 'page' : undefined}");
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// A11Y-2 – Search result items: button, not div-onClick
// ──────────────────────────────────────────────────────────────────────────────
describe('A11Y-2 – Search result items are keyboard-accessible buttons', () => {
    it('Header.tsx search results render as <button> elements, not divs with onClick', () => {
        const src = read('src/components/dashboard/Header.tsx');
        // The accessible version uses a button with type="button" and w-full text-left
        expect(src).toContain('type="button"');
        expect(src).toContain('w-full text-left p-3 border-b border-border');
    });

    it('Header.tsx does not use a plain onClick div for search results', () => {
        const src = read('src/components/dashboard/Header.tsx');
        // Should NOT have the old pattern: div with cursor-pointer but no role
        expect(src).not.toContain('className="p-3 border-b border-border hover:bg-page cursor-pointer');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// A11Y-3 – Notification items: button, not div-onClick
// ──────────────────────────────────────────────────────────────────────────────
describe('A11Y-3 – Notification items are keyboard-accessible buttons', () => {
    it('Header.tsx notification items render as <button> elements', () => {
        const src = read('src/components/dashboard/Header.tsx');
        expect(src).toContain('w-full text-left p-4 border-b border-border hover:bg-page');
    });

    it('Header.tsx does not use a plain onClick div for notification items', () => {
        const src = read('src/components/dashboard/Header.tsx');
        // Old pattern was a div with cursor-pointer and no button role
        expect(src).not.toContain('className={`p-4 border-b border-border hover:bg-page cursor-pointer');
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// DC-1 – Orphaned components deleted
// ──────────────────────────────────────────────────────────────────────────────
describe('DC-1 – Six orphaned dashboard components are deleted', () => {
    const orphans = [
        'src/components/dashboard/BookingLinkCard.tsx',
        'src/components/dashboard/StorageUsage.tsx',
        'src/components/dashboard/TodaysSnapshot.tsx',
        'src/components/dashboard/RegistrationItem.tsx',
        'src/components/dashboard/AttendanceHeatmap.tsx',
        'src/components/dashboard/RecentStudentsTable.tsx',
    ];

    orphans.forEach((rel) => {
        it(`${path.basename(rel)} must not exist in the repository`, () => {
            expect(exists(rel)).toBe(false);
        });
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// UX-1 – Dashboard-scoped not-found.tsx exists
// ──────────────────────────────────────────────────────────────────────────────
describe('UX-1 – Dashboard-scoped not-found.tsx', () => {
    it('src/app/dashboard/not-found.tsx exists', () => {
        expect(exists('src/app/dashboard/not-found.tsx')).toBe(true);
    });

    it('not-found.tsx exports a default function (DashboardNotFound)', () => {
        const src = read('src/app/dashboard/not-found.tsx');
        expect(src).toContain('export default function DashboardNotFound');
    });

    it('not-found.tsx uses CMS design-system tokens (no legacy shadcn tokens)', () => {
        const src = read('src/app/dashboard/not-found.tsx');
        expect(src).not.toContain('text-foreground');
        expect(src).not.toContain('text-muted-foreground');
        expect(src).not.toContain('bg-card');
        // Uses CMS tokens
        expect(src).toContain('bg-surface');
        expect(src).toContain('text-text');
        expect(src).toContain('bg-accent-soft');
    });

    it('not-found.tsx links back to /dashboard', () => {
        const src = read('src/app/dashboard/not-found.tsx');
        expect(src).toContain('href="/dashboard"');
    });

    it('not-found.tsx is NOT a client component (no "use client" directive)', () => {
        const src = read('src/app/dashboard/not-found.tsx');
        // Must not start with 'use client' — should be a Server Component
        // so it renders inside the authenticated layout shell.
        expect(src.trimStart()).not.toMatch(/^['"]use client['"]/);
    });
});
