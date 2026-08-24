/**
 * Milestone 3M — Dashboard security and navigation regression tests
 *
 * D1: RevenueWidget dead link /dashboard/finances → /dashboard/finance
 * D2: DashboardSchedule now requires centre-scope props (accessibleCentreIds, hasCentres)
 * D3/S-5: RevenueWidget gated to ORG_OWNER (isOwner flag in page.tsx)
 * D9: Header ROLE_LABELS FRONT_DESK key added
 * A-1: Parents added to FRONT_DESK ROLE_NAV in Sidebar
 * N-1: Registrations added to FRONT_DESK ROLE_NAV in MobileBottomNav
 * U-1: OverviewTab.tsx deleted (orphaned component)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('D9 – Header ROLE_LABELS contains FRONT_DESK', () => {
    it('FRONT_DESK key must produce human-readable label, not raw enum', () => {
        const src = read('src/components/dashboard/Header.tsx');
        expect(src).toContain("FRONT_DESK: 'Front Desk'");
    });
});

describe('A-1 – Sidebar FRONT_DESK ROLE_NAV includes Parents', () => {
    it('Parents must appear in the FRONT_DESK entry of ROLE_NAV', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const fdLine = src.split('\n').find((l) =>
            l.includes('FRONT_DESK:') && l.includes("'Dashboard'") && l.includes("'Students'")
        );
        expect(fdLine).toBeDefined();
        expect(fdLine).toContain("'Parents'");
    });
});

describe('N-1 – MobileBottomNav FRONT_DESK ROLE_NAV includes Registrations', () => {
    it('Registrations must appear in the FRONT_DESK entry of mobile ROLE_NAV', () => {
        const src = read('src/components/dashboard/MobileBottomNav.tsx');
        const fdLine = src.split('\n').find((l) =>
            l.includes('FRONT_DESK:') && l.includes("'Dashboard'") && l.includes("'Students'")
        );
        expect(fdLine).toBeDefined();
        expect(fdLine).toContain("'Registrations'");
    });
});

describe('D3 – RevenueWidget gated to ORG_OWNER in page.tsx', () => {
    it('RevenueWidget render is wrapped in isOwner condition', () => {
        const src = read('src/app/dashboard/page.tsx');
        expect(src).toContain('{isOwner && (');
        expect(src).toContain('<RevenueWidget');
        const ownerIdx = src.indexOf('isOwner &&');
        const widgetIdx = src.indexOf('<RevenueWidget');
        expect(ownerIdx).toBeGreaterThanOrEqual(0);
        expect(widgetIdx).toBeGreaterThanOrEqual(0);
        expect(ownerIdx).toBeLessThan(widgetIdx);
    });
});

describe('D1 – RevenueWidget dead link corrected', () => {
    it('must link to /dashboard/finance, not /dashboard/finances', () => {
        const src = read('src/components/dashboard/RevenueWidget.tsx');
        expect(src).not.toContain(`href="/dashboard/finances`);
        expect(src).toContain('/dashboard/finance');
    });
});

describe('D2 – DashboardSchedule requires centre-scope props', () => {
    it('component uses accessibleCentreIds, hasCentres, and centreScopeCondition', () => {
        const src = read('src/app/dashboard/_components/DashboardSchedule.tsx');
        expect(src).toContain('accessibleCentreIds');
        expect(src).toContain('hasCentres');
        expect(src).toContain('centreScopeCondition');
    });
});

describe('U-1 – OverviewTab.tsx deleted (orphaned component)', () => {
    it('OverviewTab.tsx must not exist on disk', () => {
        const exists = fs.existsSync(
            path.join(ROOT, 'src/app/dashboard/_components/OverviewTab.tsx')
        );
        expect(exists).toBe(false);
    });
});
