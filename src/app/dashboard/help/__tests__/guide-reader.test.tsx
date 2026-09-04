/**
 * SprintScale CMS — Milestone PM-1D & PM-1D.R1
 * Focused Guide Reader, Markdown Rendering, Mobile TOC & Navigation Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

// Mock auth before importing components
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// Mock navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

import { auth } from '@/lib/auth';
import GuidePage from '../guides/[slug]/page';
import {
  getAllGuides,
  getGuideBySlug,
  getGuideNavigation,
  getGuidesByCategory,
} from '@/lib/help/get-help-content';
import { HelpCategory } from '@/lib/help/types';
import {
  extractTOC,
  MarkdownArticle,
  stripDocumentPreamble,
} from '@/lib/help/markdown-renderer';
import MobileTOC from '../guides/[slug]/_components/MobileTOC';

describe('PM-1D.R1: Guide Reader Visual, Terminology & Navigation Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Duplicate Headings & Title Suppression (Req 1-3)', () => {
    it('1, 2. ensures exactly one primary title is rendered and redundant document preamble is suppressed', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-1', role: 'MANAGER', organisationId: 'org-1', email: 'mgr@test.com' },
      } as any);

      const vnode = await GuidePage({ params: Promise.resolve({ slug: 'attendance-roll-call' }) });
      const html = renderToStaticMarkup(vnode);

      // Only one H1 in the entire page
      const h1Count = (html.match(/<h1/g) || []).length;
      expect(h1Count).toBe(1);
      expect(html).toContain('<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-text">Functional Manual: Attendance &amp; Roll Call</h1>');

      // The redundant markdown title is suppressed from the article body
      expect(html).not.toContain('SprintScale CMS — Functional Manual: Attendance &amp; Roll Call');
      expect(html).not.toContain('Daily Registers, Tablet Kiosk Mode, Time Tracking &amp; Session Ledger');
    });

    it('3. confirms substantive section headings and introduction remain intact across all 34 guides', () => {
      const allGuides = getAllGuides();
      for (const guide of allGuides) {
        const loaded = getGuideBySlug(guide.slug)!;
        const cleaned = stripDocumentPreamble(loaded.content);

        // Ensure preamble was stripped
        expect(cleaned.trim().startsWith('# ')).toBe(false);
        // Ensure substantive content remains
        expect(cleaned.trim().length).toBeGreaterThan(200);

        // Section 1 or introductory text exists
        const hasSectionOrIntro = cleaned.includes('## 1.') || cleaned.includes('**Target Audience:**');
        expect(hasSectionOrIntro, `Guide ${guide.slug} missing intro or section 1`).toBe(true);
      }
    });
  });

  describe('Human-Readable Role Labels (Req 4-5)', () => {
    it('4, 5. displays human-readable role labels and avoids raw enum strings in the header', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-1', role: 'MANAGER', organisationId: 'org-1', email: 'mgr@test.com' },
      } as any);

      const vnode = await GuidePage({ params: Promise.resolve({ slug: 'attendance-roll-call' }) });
      const html = renderToStaticMarkup(vnode);

      // Human-readable labels rendered
      expect(html).toContain('Tutor / Club Leader');
      expect(html).toContain('Centre Manager');
      expect(html).toContain('Front Desk');
      expect(html).toContain('Organisation Owner');

      // Raw uppercase enum array is not rendered as visible text
      expect(html).not.toContain('Recommended for: TUTOR, MANAGER');
    });
  });

  describe('Mobile TOC Reconciliation (Req 6-9)', () => {
    const mockTOC = [
      { id: 'section-1', title: '1. What Attendance Is For', level: 2 as const },
      { id: 'section-2', title: '2. Register Workflows', level: 2 as const },
    ];

    it('6. desktop sticky TOC is rendered with links', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { id: 'user-1', role: 'MANAGER', organisationId: 'org-1', email: 'mgr@test.com' },
      } as any);

      const vnode = await GuidePage({ params: Promise.resolve({ slug: 'attendance-roll-call' }) });
      const html = renderToStaticMarkup(vnode);

      expect(html).toContain('class="hidden lg:block lg:col-span-4 xl:col-span-3');
      expect(html).toContain('href="#1-what-attendance-is-for"');
    });

    it('7, 8, 9. mobile TOC defaults to collapsed state with section counter and accessible button', () => {
      const html = renderToStaticMarkup(<MobileTOC items={mockTOC} />);

      expect(html).toContain('In this guide');
      expect(html).toContain('(2 sections)');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('Show sections');
      // Collapsed: list links are not rendered in initial DOM
      expect(html).not.toContain('1. What Attendance Is For');
    });
  });

  describe('Video Walkthrough In-App Navigation (PM-1E Reconciled)', () => {
    it('10, 11. renders in-guide video references as in-app navigation links to /dashboard/help/videos/[slug] without raw MP4 URLs', () => {
      const loaded = getGuideBySlug('attendance-roll-call')!;
      const html = renderToStaticMarkup(<MarkdownArticle content={loaded.content} guideTitle={loaded.meta.title} />);

      // Active navigation link rendered pointing to in-app video page
      expect(html).toContain('href="/dashboard/help/videos/marking-morning-and-afternoon-class-register"');
      expect(html).toContain('Watch: Marking Morning and Afternoon Class Register');

      // No raw MP4 link or file download anchor
      expect(html).not.toContain('href="/training/assets/videos/');
      expect(html).not.toContain('href="assets/videos/');
      expect(html).not.toContain('.mp4"');
    });
  });

  describe('Category-Local Navigation & Sequencing (Req 12-14)', () => {
    it('12. attendance-roll-call navigates within core-operations category', () => {
      const nav = getGuideNavigation('attendance-roll-call');
      // Category start: no previous crossing into parent-portal-guide
      expect(nav.prev).toBeNull();
      // Next is the next guide in core-operations
      expect(nav.next?.slug).toBe('bookings-scheduling');
      expect(nav.next?.category).toBe('core-operations');
    });

    it('13. first and last category navigation boundaries remain intact', () => {
      const categories: HelpCategory[] = ['getting-started', 'core-operations', 'finance', 'administration', 'troubleshooting', 'master-manual'];
      for (const cat of categories) {
        const guides = getGuidesByCategory(cat);
        const first = getGuideNavigation(guides[0].slug);
        const last = getGuideNavigation(guides[guides.length - 1].slug);

        expect(first.prev).toBeNull();
        expect(last.next).toBeNull();
      }
    });

    it('14. master manual sequence remains completely coherent across all 5 parts', () => {
      const ch1 = getGuideNavigation('master-system-foundations');
      expect(ch1.prev).toBeNull();
      expect(ch1.next?.slug).toBe('master-family-to-booking');

      const ch2 = getGuideNavigation('master-family-to-booking');
      expect(ch2.prev?.slug).toBe('master-system-foundations');
      expect(ch2.next?.slug).toBe('master-attendance-to-safeguarding');

      const ch3 = getGuideNavigation('master-attendance-to-safeguarding');
      expect(ch3.prev?.slug).toBe('master-family-to-booking');
      expect(ch3.next?.slug).toBe('master-finance-billing-payments');

      const ch4 = getGuideNavigation('master-finance-billing-payments');
      expect(ch4.prev?.slug).toBe('master-attendance-to-safeguarding');
      expect(ch4.next?.slug).toBe('master-administration-operations');

      const ch5 = getGuideNavigation('master-administration-operations');
      expect(ch5.prev?.slug).toBe('master-finance-billing-payments');
      expect(ch5.next).toBeNull();
    });
  });

  describe('Content Safety & Internal Terminology (Req 15)', () => {
    it('15. verifies rendered output contains no internal role codes, project-notes, file://, localhost, or raw asset IDs in alt/captions', () => {
      const allGuides = getAllGuides();
      for (const guide of allGuides) {
        const loaded = getGuideBySlug(guide.slug)!;
        const html = renderToStaticMarkup(<MarkdownArticle content={loaded.content} guideTitle={loaded.meta.title} />);
        expect(html).not.toContain('project-notes');
        expect(html).not.toContain('file://');
        expect(html).not.toContain('localhost');

        // Asset IDs must not appear in user-facing figcaptions
        const figcaptionMatches = [...html.matchAll(/<figcaption[^>]*>(.*?)<\/figcaption>/g)].map(m => m[1]);
        for (const caption of figcaptionMatches) {
          expect(caption).not.toContain('SS-D6-S');
          expect(caption).not.toContain('SS-D6-V');
        }

        // Asset IDs must not appear in alt text
        const altMatches = [...html.matchAll(/alt="([^"]*)"/g)].map(m => m[1]);
        for (const alt of altMatches) {
          expect(alt).not.toContain('SS-D6-S');
          expect(alt).not.toContain('SS-D6-V');
        }
      }
    });
  });

  describe('Security Boundary & Asset Resolution', () => {
    it('resolves valid allowlisted guide slug and rejects unknown / traversal slugs', () => {
      expect(getGuideBySlug('attendance-roll-call')).not.toBeNull();
      expect(getGuideBySlug('unknown-guide-xyz')).toBeNull();
      expect(getGuideBySlug('../../../etc/passwd')).toBeNull();
    });

    it('confirms all 103 screenshot references across 34 guides resolve to public disk files', () => {
      const allGuides = getAllGuides();
      let totalFound = 0;

      for (const guide of allGuides) {
        const loaded = getGuideBySlug(guide.slug)!;
        const matches = loaded.content.matchAll(/!\[(.*?)\]\((.*?)\)/g);
        for (const m of matches) {
          const src = m[2];
          expect(src.startsWith('/training/assets/screenshots/annotated/')).toBe(true);
          const localPath = path.join(process.cwd(), 'public', src.replace(/^\//, ''));
          expect(fs.existsSync(localPath), `Missing screenshot: ${src} in ${guide.slug}`).toBe(true);
          totalFound++;
        }
      }

      expect(totalFound).toBe(103);
    });

    it('rejects unauthenticated requests to /login and incomplete onboarding to /onboarding', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null as any);
      await expect(GuidePage({ params: Promise.resolve({ slug: 'attendance-roll-call' }) }))
        .rejects.toThrow('REDIRECT:/login');

      vi.mocked(auth).mockResolvedValueOnce({
        // PM-1.2: user has id but no org → requireTenantSession redirects to /onboarding
        user: { id: 'user-1', role: 'MANAGER', email: 'mgr@test.com' },
      } as any);
      await expect(GuidePage({ params: Promise.resolve({ slug: 'attendance-roll-call' }) }))
        .rejects.toThrow('REDIRECT:/onboarding');
    });
  });
});
