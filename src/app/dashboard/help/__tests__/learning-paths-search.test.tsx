/**
 * SprintScale CMS — Post-Modernisation Enhancement PM-1F Automated Test Suite
 * Validates Role Learning Paths, Unified Help Search, and Role Recommendation Safety.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getAllLearningPaths,
  getLearningPathBySlug,
  getLearningPathForRole,
  getLearningPathNavigation,
  getAllGuides,
  getGuideBySlug,
  getAllVideos,
  getVideoBySlug,
  searchHelp,
} from '@/lib/help/get-help-content';
import { HELP_LEARNING_PATHS } from '@/lib/help/help-learning-paths-manifest';
import { HELP_GUIDES } from '@/lib/help/help-manifest';
import { HELP_VIDEOS } from '@/lib/help/help-videos-manifest';
import { CMS_STAFF_ROLES } from '@/lib/help/types';
import LearningPathsListView from '../learning-paths/_components/LearningPathsListView';
import LearningPathDetailView from '../learning-paths/[slug]/_components/LearningPathDetailView';
import HelpHubView from '../_components/HelpHubView';

describe('PM-1F — Role Learning Paths & Help Search Automated Suite', () => {
  // A. Learning-Path Manifest Integrity
  describe('A. Learning-Path Manifest Integrity', () => {
    it('contains exactly 5 canonical learning paths', () => {
      const paths = getAllLearningPaths();
      expect(paths.length).toBe(5);
    });

    it('all learning paths have unique IDs and unique slugs', () => {
      const ids = new Set<string>();
      const slugs = new Set<string>();

      for (const p of HELP_LEARNING_PATHS) {
        expect(ids.has(p.id)).toBe(false);
        expect(slugs.has(p.slug)).toBe(false);
        ids.add(p.id);
        slugs.add(p.slug);
      }
    });

    it('all 5 expected persona slugs are present in order', () => {
      const slugs = HELP_LEARNING_PATHS.map(p => p.slug);
      expect(slugs).toEqual([
        'organisation-owner',
        'centre-manager',
        'front-desk',
        'tutor-club-leader',
        'parent-portal',
      ]);
    });

    it('all guide references resolve to certified guides in HELP_GUIDES', () => {
      const guideSlugs = new Set(HELP_GUIDES.map(g => g.slug));

      for (const path of HELP_LEARNING_PATHS) {
        for (const section of path.sections) {
          for (const item of section.items) {
            if (item.type === 'guide') {
              expect(guideSlugs.has(item.slug)).toBe(true);
              const resolved = getGuideBySlug(item.slug);
              expect(resolved).not.toBeNull();
            }
          }
        }
      }
    });

    it('all video references resolve to certified videos in HELP_VIDEOS', () => {
      const videoSlugs = new Set(HELP_VIDEOS.map(v => v.slug));

      for (const path of HELP_LEARNING_PATHS) {
        for (const section of path.sections) {
          for (const item of section.items) {
            if (item.type === 'video') {
              expect(videoSlugs.has(item.slug)).toBe(true);
              const resolved = getVideoBySlug(item.slug);
              expect(resolved).not.toBeNull();
            }
          }
        }
      }
    });

    it('no item slug references filesystem paths or project-notes', () => {
      for (const path of HELP_LEARNING_PATHS) {
        expect(path.slug).not.toContain('/');
        expect(path.slug).not.toContain('\\');
        expect(path.slug).not.toContain('.md');
        for (const section of path.sections) {
          for (const item of section.items) {
            expect(item.slug).not.toContain('/');
            expect(item.slug).not.toContain('\\');
            expect(item.slug).not.toContain('.md');
            expect(item.slug).not.toContain('project-notes');
          }
        }
      }
    });
  });

  // B. Role Recommendation Mapping
  describe('B. Role Recommendation Mapping', () => {
    it('ORG_OWNER maps to organisation-owner learning path', () => {
      const path = getLearningPathForRole('ORG_OWNER');
      expect(path).not.toBeNull();
      expect(path?.slug).toBe('organisation-owner');
    });

    it('MANAGER maps to centre-manager learning path', () => {
      const path = getLearningPathForRole('MANAGER');
      expect(path).not.toBeNull();
      expect(path?.slug).toBe('centre-manager');
    });

    it('FRONT_DESK maps to front-desk learning path', () => {
      const path = getLearningPathForRole('FRONT_DESK');
      expect(path).not.toBeNull();
      expect(path?.slug).toBe('front-desk');
    });

    it('TUTOR maps to tutor-club-leader learning path', () => {
      const path = getLearningPathForRole('TUTOR');
      expect(path).not.toBeNull();
      expect(path?.slug).toBe('tutor-club-leader');
    });

    it('unrecognised role returns null without throwing', () => {
      expect(getLearningPathForRole('UNKNOWN_ROLE')).toBeNull();
      expect(getLearningPathForRole('')).toBeNull();
    });
  });

  // C. Role Safety & Product Truth
  describe('C. Role Safety & Product Truth', () => {
    it('PARENT is strictly a staff reference persona, NOT in CMS_STAFF_ROLES', () => {
      expect(CMS_STAFF_ROLES).not.toContain('PARENT');
      expect(CMS_STAFF_ROLES.length).toBe(4);
      const parentPath = getLearningPathBySlug('parent-portal');
      expect(parentPath?.isStaffReferenceOnly).toBe(true);
    });

    it('Tutor learning path does NOT contain Owner-only financial or destructive actions', () => {
      const tutorPath = getLearningPathBySlug('tutor-club-leader');
      expect(tutorPath).not.toBeNull();
      const allItemSlugs = tutorPath!.sections.flatMap(s => s.items.map(it => it.slug));

      // Tutor must not have invoice voiding, batch runs, or rollover
      expect(allItemSlugs).not.toContain('voiding-an-incorrect-invoice');
      expect(allItemSlugs).not.toContain('executing-monthly-invoicing-batch-run');
      expect(allItemSlugs).not.toContain('academic-year-data-maintenance');
      expect(allItemSlugs).not.toContain('irreversible-permanent-gdpr-family-purge');
    });

    it('Front Desk learning path does NOT contain Owner-only invoice voiding or GDPR purge', () => {
      const frontDeskPath = getLearningPathBySlug('front-desk');
      expect(frontDeskPath).not.toBeNull();
      const allItemSlugs = frontDeskPath!.sections.flatMap(s => s.items.map(it => it.slug));

      expect(allItemSlugs).not.toContain('voiding-an-incorrect-invoice');
      expect(allItemSlugs).not.toContain('irreversible-permanent-gdpr-family-purge');
    });
  });

  // D. Search Architecture & Safety Boundary
  describe('D. Search Architecture & Safety Boundary', () => {
    it('case-insensitive title search finds guides, videos, and learning paths', () => {
      const results = searchHelp('attendance');
      expect(results.totalCount).toBeGreaterThan(0);
      expect(results.guides.some(g => g.title.toLowerCase().includes('attendance'))).toBe(true);
      expect(results.videos.some(v => v.title.toLowerCase().includes('attendance'))).toBe(true);
    });

    it('keyword search matches registered keywords', () => {
      const results = searchHelp('kiosk');
      expect(results.guides.length + results.videos.length).toBeGreaterThan(0);
    });

    it('discovers learning paths matching query', () => {
      const results = searchHelp('governance');
      expect(results.learningPaths).toBeDefined();
      expect(results.learningPaths!.some(p => p.slug === 'organisation-owner')).toBe(true);
    });

    it('empty or whitespace-only query returns empty results', () => {
      expect(searchHelp('').totalCount).toBe(0);
      expect(searchHelp('   ').totalCount).toBe(0);
      expect(searchHelp('\t\n').totalCount).toBe(0);
    });

    it('non-existent query returns empty results without crashing', () => {
      const results = searchHelp('xyznonexistentquery999');
      expect(results.guides.length).toBe(0);
      expect(results.videos.length).toBe(0);
      expect(results.learningPaths!.length).toBe(0);
      expect(results.totalCount).toBe(0);
    });

    it('strictly default-deny: internal files and project-notes are NEVER searchable', () => {
      // Internal documentation strings that must never be exposed
      const unsafeQueries = [
        'project-notes',
        'schema.ts',
        'database_url',
        'neon.tech',
        'credentials',
        'magic-link-secret',
        'rc4-programme-closure',
      ];

      for (const q of unsafeQueries) {
        const res = searchHelp(q);
        // All returned guides must have contentPath in src/content/help only
        for (const g of res.guides) {
          expect(g.contentPath).not.toContain('project-notes');
        }
        for (const v of res.videos) {
          expect(v.videoUrl).toMatch(/^\/training\/assets\/videos\//);
        }
      }
    });

    it('returns no duplicate entries in search results', () => {
      const results = searchHelp('register');
      const guideIds = results.guides.map(g => g.id);
      const videoIds = results.videos.map(v => v.id);
      const pathIds = results.learningPaths!.map(p => p.id);

      expect(new Set(guideIds).size).toBe(guideIds.length);
      expect(new Set(videoIds).size).toBe(videoIds.length);
      expect(new Set(pathIds).size).toBe(pathIds.length);
    });
  });

  // E. Sequential Navigation
  describe('E. Sequential Navigation', () => {
    it('first learning path has prev = null, next = second path', () => {
      const nav = getLearningPathNavigation('organisation-owner');
      expect(nav.prev).toBeNull();
      expect(nav.next?.slug).toBe('centre-manager');
    });

    it('last learning path has prev = fourth path, next = null', () => {
      const nav = getLearningPathNavigation('parent-portal');
      expect(nav.prev?.slug).toBe('tutor-club-leader');
      expect(nav.next).toBeNull();
    });

    it('middle learning path has valid prev and next', () => {
      const nav = getLearningPathNavigation('front-desk');
      expect(nav.prev?.slug).toBe('centre-manager');
      expect(nav.next?.slug).toBe('tutor-club-leader');
    });
  });

  // F. View Component Rendering
  describe('F. View Component Rendering', () => {
    it('renders LearningPathsListView with all 5 paths and role recommendation', () => {
      const paths = getAllLearningPaths();
      const recommendedPath = getLearningPathForRole('MANAGER');

      const html = renderToStaticMarkup(
        <LearningPathsListView
          userRole="MANAGER"
          roleLabel="Centre Manager"
          paths={paths}
          recommendedPath={recommendedPath}
        />
      );

      expect(html).toContain('Role Learning Paths');
      expect(html).toContain('Recommended for your role');
      expect(html).toContain('Centre Manager: Daily Operations, Triage &amp; Supervisory Oversight');
      expect(html).toContain('Organisation Owner: Governance, Finance &amp; Multi-Centre Control');
      expect(html).toContain('Front Desk: Reception, Intake &amp; Daily Administration');
      expect(html).toContain('Tutor &amp; Club Leader: Session Delivery, Attendance &amp; Welfare');
      expect(html).toContain('Parent Portal: Staff Reference &amp; Family Assistance');
    });

    it('renders LearningPathDetailView with sections, guide and video cards', () => {
      const path = getLearningPathBySlug('tutor-club-leader')!;
      const { prev, next } = getLearningPathNavigation('tutor-club-leader');

      const resolvedSections = path.sections.map(sec => ({
        id: sec.id,
        title: sec.title,
        description: sec.description,
        items: sec.items.map(it => ({
          type: it.type,
          slug: it.slug,
          title: `Title for ${it.slug}`,
          description: `Description for ${it.slug}`,
          note: it.note,
          durationLabel: it.type === 'video' ? '60s' : undefined,
          readingTimeMinutes: it.type === 'guide' ? 5 : undefined,
          url: it.type === 'guide' ? `/dashboard/help/guides/${it.slug}` : `/dashboard/help/videos/${it.slug}`,
        })),
      }));

      const html = renderToStaticMarkup(
        <LearningPathDetailView
          path={path}
          userRole="TUTOR"
          roleLabel="Tutor / Club Leader"
          resolvedSections={resolvedSections}
          prevPath={prev}
          nextPath={next}
        />
      );

      expect(html).toContain('Tutor &amp; Club Leader: Session Delivery, Attendance &amp; Welfare');
      expect(html).toContain('First Day Orientation &amp; Roll Call');
      expect(html).toContain('Read Guide');
      expect(html).toContain('Watch Video Walkthrough');
    });
  });
});
