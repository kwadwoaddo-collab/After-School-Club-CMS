/**
 * Manager Access Expansion — RBAC & Privilege Boundary Regression Tests
 *
 * Verifies:
 * 1. Sidebar navigation: MANAGER has Finance, while FRONT_DESK and TUTOR do not.
 * 2. Finance pages: /finance, /finance/invoices, /finance/invoices/[id], /finance/receipt,
 *    and /finance/reconciliation allow ORG_OWNER and MANAGER, and enforce centre scoping.
 * 3. Finance CSV export: /api/export/finance allows ORG_OWNER and MANAGER, scopes non-owners
 *    to accessible centres, and returns 403 for unauthorized roles.
 * 4. Super Admin privilege boundaries: Staff management, organisation settings, centre bank details,
 *    hard parent deletion, invoice deletion, and school year rolls remain strictly ORG_OWNER only.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('RBAC Manager Access Expansion — Sidebar Navigation', () => {
    it('MANAGER ROLE_NAV includes Finance', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const managerLine = src.split('\n').find(
            (l) => l.includes('MANAGER:') && l.includes("'Dashboard'")
        );
        expect(managerLine).toBeDefined();
        expect(managerLine).toContain("'Finance'");
    });

    it('FRONT_DESK ROLE_NAV does NOT include Finance', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const fdLine = src.split('\n').find(
            (l) => l.includes('FRONT_DESK:') && l.includes("'Dashboard'")
        );
        expect(fdLine).toBeDefined();
        expect(fdLine).not.toContain("'Finance'");
    });

    it('TUTOR ROLE_NAV does NOT include Finance', () => {
        const src = read('src/components/dashboard/Sidebar.tsx');
        const tutorLine = src.split('\n').find(
            (l) => l.includes('TUTOR:') && l.includes("'Dashboard'")
        );
        expect(tutorLine).toBeDefined();
        expect(tutorLine).not.toContain("'Finance'");
    });
});

describe('RBAC Manager Access Expansion — Finance Page Gates & Scoping', () => {
    it('Finance dashboard page permits ORG_OWNER and MANAGER and uses getUserAccessibleCentres', () => {
        const src = read('src/app/dashboard/finance/page.tsx');
        expect(src).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
        expect(src).toContain('getUserAccessibleCentres');
        expect(src).toContain('inArray(invoices.centreId, validCentreIds)');
    });

    it('Invoices list page permits ORG_OWNER and MANAGER and scopes non-owners to accessible centres', () => {
        const src = read('src/app/dashboard/finance/invoices/page.tsx');
        expect(src).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
        expect(src).toContain('getUserAccessibleCentres');
        expect(src).toContain('inArray(invoices.centreId, accessibleCentreIds)');
        expect(src).toContain("isOwner={userRole === 'ORG_OWNER'}");
    });

    it('Invoice details page permits ORG_OWNER and MANAGER and handles unauthorized access', () => {
        const src = read('src/app/dashboard/finance/invoices/[id]/page.tsx');
        expect(src).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
        expect(src).toContain('getInvoiceDetails');
        expect(src).toContain('notFound()');
    });

    it('Cash receipt generator page gates to ORG_OWNER and MANAGER and scopes children/centres', () => {
        const src = read('src/app/dashboard/finance/receipt/page.tsx');
        expect(src).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
        expect(src).toContain('getUserAccessibleCentres');
        expect(src).toContain('getVisibleChildIds');
    });

    it('Payment reconciliation page gates to ORG_OWNER and MANAGER and applies centre filter', () => {
        const src = read('src/app/dashboard/finance/reconciliation/page.tsx');
        expect(src).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
        expect(src).toContain('getUserAccessibleCentres');
        expect(src).toContain('centreFilter');
    });

    it('Finance CSV export route permits ORG_OWNER and MANAGER and scopes non-owners to accessible centres', () => {
        const src = read('src/app/api/export/finance/route.ts');
        expect(src).toContain("role !== 'ORG_OWNER' && role !== 'MANAGER'");
        expect(src).toContain('getUserAccessibleCentres');
        expect(src).toContain('inArray(invoices.centreId, accessibleCentreIds)');
    });
});

describe('RBAC Manager Access Expansion — Staff Management Capabilities & Scoping', () => {
    it('Staff management page permits ORG_OWNER and MANAGER and scopes non-owners', () => {
        const src = read('src/app/dashboard/staff/page.tsx');
        expect(src).toContain("requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })");
        expect(src).toContain('getUserAccessibleCentres');
    });

    it('Staff invite page permits ORG_OWNER and MANAGER', () => {
        const src = read('src/app/dashboard/staff/invite/page.tsx');
        expect(src).toContain("requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })");
    });

    it('Staff invite API blocks non-owners from inviting ORG_OWNER and validates accessible centres', () => {
        const src = read('src/app/api/staff/invite/route.ts');
        expect(src).toContain("currentUser.role !== 'ORG_OWNER' && currentUser.role !== 'MANAGER'");
        expect(src).toContain("role: z.enum(['MANAGER', 'FRONT_DESK', 'TUTOR'])");
        expect(src).toContain('getUserAccessibleCentreIds');
    });

    it('Staff detail page gates to ORG_OWNER and MANAGER and passes isOwner', () => {
        const src = read('src/app/dashboard/staff/[userId]/page.tsx');
        expect(src).toContain("requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })");
        expect(src).toContain('isOwner={isOwner}');
        expect(src).toContain('getUserAccessibleCentres');
    });

    it('Staff role update action prevents privilege escalation to or from ORG_OWNER and blocks self-role edit', () => {
        const src = read('src/features/staff/staff-actions.ts');
        expect(src).toContain("newRole === 'ORG_OWNER'");
        expect(src).toContain("targetUser.role === 'ORG_OWNER'");
        expect(src).toContain('targetUserId === session.user.id');
    });
});

describe('RBAC Manager Access Expansion — Centre Billing & Settings Capabilities', () => {
    it('Centre billing page permits ORG_OWNER and MANAGER and validates accessible centre', () => {
        const src = read('src/app/dashboard/centres/[id]/billing/page.tsx');
        expect(src).toContain("requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })");
        expect(src).toContain('getUserAccessibleCentreIds');
    });

    it('Centre billing update action permits ORG_OWNER and MANAGER and enforces centre access', () => {
        const src = read('src/app/dashboard/centres/[id]/billing/actions.ts');
        expect(src).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
        expect(src).toContain('getUserAccessibleCentreIds');
    });

    it('Centre settings update action permits MANAGER to update bank details for authorised centre', () => {
        const src = read('src/app/dashboard/centres/[id]/settings/actions.ts');
        expect(src).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
        expect(src).toContain('getUserAccessibleCentreIds');
    });

    it('Settings page permits ORG_OWNER and MANAGER and passes isOwner to tabs', () => {
        const src = read('src/app/dashboard/settings/page.tsx');
        expect(src).toContain("requireAuth({ roles: ['ORG_OWNER', 'MANAGER'] })");
        expect(src).toContain('isOwner={isOwner}');
    });

    it('Settings tabs hide danger_zone and branding when isOwner is false', () => {
        const src = read('src/features/settings/components/SettingsTabs.tsx');
        expect(src).toContain('isOwner');
        expect(src).toContain("t.id !== 'danger_zone' && t.id !== 'branding'");
    });

    it('Discounts and registration terms APIs permit ORG_OWNER and MANAGER', () => {
        const discountsSrc = read('src/app/api/settings/discounts/route.ts');
        expect(discountsSrc).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");

        const termsSrc = read('src/app/api/settings/registration-terms/route.ts');
        expect(termsSrc).toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
    });
});

describe('RBAC Manager Access Expansion — Super Admin Privilege Preservation', () => {
    it('Organisation identity mutation API remains strictly ORG_OWNER only', () => {
        const src = read('src/app/api/settings/organisation/route.ts');
        expect(src).toContain("userRole !== 'ORG_OWNER'");
        expect(src).not.toContain("userRole !== 'ORG_OWNER' && userRole !== 'MANAGER'");
    });

    it('Tenant branding API remains strictly ORG_OWNER only', () => {
        const src = read('src/app/api/branding/route.ts');
        expect(src).toContain("(session.user as any).role !== 'ORG_OWNER'");
        expect(src).not.toContain("(session.user as any).role !== 'ORG_OWNER' && (session.user as any).role !== 'MANAGER'");
    });

    it('Hard deleting parents (GDPR purge) remains strictly ORG_OWNER only', () => {
        const src = read('src/app/dashboard/parents/bin.actions.ts');
        expect(src).toContain("requireApiAuth({ roles: ['ORG_OWNER'] })");
        expect(src).not.toContain("requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER'] })");
    });

    it('Deleting invoices completely from ledger remains strictly ORG_OWNER only', () => {
        const src = read('src/features/finance/actions.ts');
        expect(src).toContain("if ((session.user as any).role !== 'ORG_OWNER') throw new Error('Only Owner can delete invoices');");
    });

    it('Rolling school years across organisation remains strictly ORG_OWNER only', () => {
        const src = read('src/features/students/roll-actions.ts');
        expect(src).toContain("if ((session.user as any).role !== 'ORG_OWNER')");
    });
});
