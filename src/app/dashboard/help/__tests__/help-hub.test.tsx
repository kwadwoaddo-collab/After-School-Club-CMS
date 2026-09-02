/**
 * SprintScale CMS — Milestone PM-1C
 * In-App Help & Training Centre Shell & Hub View Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import HelpPage from '../page';
import HelpHubView from '../_components/HelpHubView';
import { getAllCategories, getAllGuides, getGuidesByCategory, getGuidesByRole } from '@/lib/help/get-help-content';
import { CMS_STAFF_ROLES, HelpStaffRole } from '@/lib/help/types';
import Sidebar from '@/components/dashboard/Sidebar';

// Mock auth and next/navigation
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  usePathname: () => '/dashboard/help',
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/dashboard/SidebarContext', () => ({
  useSidebar: () => ({
    collapsed: false,
    setCollapsed: vi.fn(),
  }),
}));

vi.mock('@/components/dashboard/CentreFilterContext', () => ({
  useCentreFilter: () => ({
    selectedCentreId: 'all',
    setSelectedCentreId: vi.fn(),
    centres: [],
  }),
}));

describe('PM-1C: Help Centre Shell & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization Boundary', () => {
    it('redirects unauthenticated users to /login', async () => {
      (auth as any).mockResolvedValueOnce(null);

      await expect(HelpPage()).rejects.toThrow('REDIRECT:/login');
      expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('redirects users without organisationId to /onboarding', async () => {
      (auth as any).mockResolvedValueOnce({
        user: { id: 'u-1', email: 'test@example.com' },
      });

      await expect(HelpPage()).rejects.toThrow('REDIRECT:/onboarding');
      expect(redirect).toHaveBeenCalledWith('/onboarding');
    });

    it.each(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR'])(
      'allows authenticated staff role %s to access Help',
      async (role) => {
        (auth as any).mockResolvedValueOnce({
          user: { id: 'u-1', email: `${role.toLowerCase()}@example.com`, role, organisationId: 'org-1' },
        });

        const vnode = await HelpPage();
        const html = renderToStaticMarkup(vnode);

        expect(html).toContain('Help &amp; Training');
        expect(html).toContain('Recommended for you');
      }
    );

    it('never treats PARENT as an authenticated CMS staff role in HelpPage', async () => {
      (auth as any).mockResolvedValueOnce({
        user: { id: 'u-parent', email: 'parent@example.com', role: 'PARENT', organisationId: 'org-1' },
      });

      const vnode = await HelpPage();
      const html = renderToStaticMarkup(vnode);

      // Safe fallback: defaults to TUTOR (base staff role) and NEVER prints "Parent" as a staff role
      expect(html).not.toContain('Recommended for you (Parent)');
      expect(html).toContain('Recommended for you');
    });
  });

  describe('Staff Role Human-Readable Labels', () => {
    it('renders human-readable role labels without DSL/DPO confusion', async () => {
      const roleMap: Record<HelpStaffRole, string> = {
        ORG_OWNER: 'Organisation Owner',
        MANAGER: 'Centre Manager',
        FRONT_DESK: 'Front Desk',
        TUTOR: 'Tutor / Club Leader',
      };

      for (const [role, label] of Object.entries(roleMap)) {
        (auth as any).mockResolvedValueOnce({
          user: { id: 'u-1', role, organisationId: 'org-1' },
        });

        const vnode = await HelpPage();
        const html = renderToStaticMarkup(vnode);

        expect(html).toContain(label);
        // Explicit check: Manager is not designated DSL; Owner is not designated DPO
        expect(html).not.toContain('Designated Safeguarding Lead');
        expect(html).not.toContain('Data Protection Officer');
      }
    });
  });

  describe('Navigation Entry Points', () => {
    it('renders Help & Training in desktop Sidebar utility area', () => {
      const html = renderToStaticMarkup(
        React.createElement(Sidebar, {
          userName: 'Staff User',
          userRole: 'TUTOR',
          orgName: 'Oakridge Primary',
          centres: [],
        })
      );

      expect(html).toContain('/dashboard/help');
      expect(html).toContain('Help &amp; Training');
    });
  });

  describe('HelpHubView Component Rendering', () => {
    it('renders 7 categories with dynamic manifest-derived guide counts', () => {
      const allCategories = getAllCategories();
      const categoriesWithGuides = allCategories.map(cat => ({
        ...cat,
        guides: getGuidesByCategory(cat.id),
      }));

      expect(categoriesWithGuides.length).toBe(7);

      const html = renderToStaticMarkup(
        React.createElement(HelpHubView, {
          userRole: 'MANAGER',
          roleLabel: 'Centre Manager',
          categories: categoriesWithGuides,
          recommendedGuides: getGuidesByRole('MANAGER'),
          commonTaskGuides: [],
          totalGuideCount: 34,
        })
      );

      expect(html).toContain('Getting Started');
      expect(html).toContain('Core Operations');
      expect(html).toContain('Safeguarding');
      expect(html).toContain('Finance');
      expect(html).toContain('Administration');
      expect(html).toContain('Troubleshooting');
      expect(html).toContain('Master User Manual');
      expect(html).toContain('34 Training Guides');
      expect(html).toContain('52 Training Videos');

      // Assert absence of outdated / internal terms
      expect(html).not.toContain('Approved Guides');
      expect(html).not.toContain('Micro-Videos');
      expect(html.toLowerCase()).not.toContain('certified for compliance');
      expect(html.toLowerCase()).not.toContain('ofsted compliant');
      expect(html.toLowerCase()).not.toContain('statutory compliant');
    });

    it('renders upcoming feature teasers without internal milestone labels or dead links', () => {
      const html = renderToStaticMarkup(
        React.createElement(HelpHubView, {
          userRole: 'ORG_OWNER',
          roleLabel: 'Organisation Owner',
          categories: [],
          recommendedGuides: [],
          commonTaskGuides: [],
          totalGuideCount: 34,
        })
      );

      expect(html).toContain('Training Video Library');
      expect(html).toContain('Full Continuous User Manual');
      expect(html).toContain('Coming Soon');

      // Strict check: No internal PM milestone terminology visible to users
      expect(html).not.toContain('Milestone PM-1E');
      expect(html).not.toContain('Milestone PM-1D');
      expect(html).not.toContain('PM-1D');
      expect(html).not.toContain('PM-1E');

      // Ensure no dead anchor links are rendered
      expect(html).not.toContain('href="#"');
      expect(html).not.toContain('href="/dashboard/help/videos"');
      expect(html).not.toContain('href="/dashboard/help/manual"');
    });
  });
});
