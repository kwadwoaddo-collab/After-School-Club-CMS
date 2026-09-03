// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import HelpHubView from '../_components/HelpHubView';
import HelpSearchBar from '../_components/HelpSearchBar';
import VideoLibraryView from '../videos/_components/VideoLibraryView';
import VideoPlayerView from '../videos/[slug]/_components/VideoPlayerView';
import LearningPathsListView from '../learning-paths/_components/LearningPathsListView';
import LearningPathDetailView from '../learning-paths/[slug]/_components/LearningPathDetailView';
import {
  getAllGuides,
  getAllVideos,
  getAllLearningPaths,
  getAllCategories,
  getGuidesByCategory,
  getGuidesByRole,
  getLearningPathForRole,
  getGuideBySlug,
  getVideoBySlug,
  getLearningPathBySlug,
  getPrimaryLearningPathForRole,
} from '@/lib/help/get-help-content';

describe('PM-1G Final Help Centre QA & Regression Suite', () => {
  afterEach(() => {
    cleanup();
  });

  const allGuides = getAllGuides();
  const allVideos = getAllVideos();
  const allPaths = getAllLearningPaths();
  const allCategories = getAllCategories();

  const categoriesWithGuides = allCategories.map(cat => ({
    ...cat,
    guides: getGuidesByCategory(cat.id),
  }));

  describe('1. Heading Hierarchy & Single H1 Invariant', () => {
    it('HelpHubView renders exactly one H1 element', () => {
      const html = renderToStaticMarkup(
        <HelpHubView
          userRole="ORG_OWNER"
          roleLabel="Organisation Owner"
          categories={categoriesWithGuides}
          recommendedGuides={getGuidesByRole('ORG_OWNER')}
          commonTaskGuides={allGuides.slice(0, 4)}
          totalGuideCount={allGuides.length}
          recommendedPath={getLearningPathForRole('ORG_OWNER')}
          totalPathCount={allPaths.length}
        />
      );
      const h1Matches = html.match(/<h1[\s>]/g);
      expect(h1Matches).not.toBeNull();
      expect(h1Matches!.length).toBe(1);
      expect(html).toContain('Help &amp; Training');
    });

    it('VideoLibraryView renders exactly one H1 element', () => {
      const html = renderToStaticMarkup(
        <VideoLibraryView
          videos={allVideos}
          userRole="ORG_OWNER"
        />
      );
      const h1Matches = html.match(/<h1[\s>]/g);
      expect(h1Matches).not.toBeNull();
      expect(h1Matches!.length).toBe(1);
      expect(html).toContain('Training Videos');
    });

    it('VideoPlayerView renders exactly one H1 element', () => {
      const video = allVideos[0];
      const html = renderToStaticMarkup(
        <VideoPlayerView
          video={video}
          relatedGuides={allGuides.slice(0, 2)}
          navigation={{ prev: null, next: allVideos[1] }}
        />
      );
      const h1Matches = html.match(/<h1[\s>]/g);
      expect(h1Matches).not.toBeNull();
      expect(h1Matches!.length).toBe(1);
      expect(html).toContain(video.title);
    });

    it('LearningPathsListView renders exactly one H1 element', () => {
      const html = renderToStaticMarkup(
        <LearningPathsListView
          paths={allPaths}
          roleLabel="Organisation Owner"
          recommendedPath={getLearningPathForRole('ORG_OWNER')}
          userRole="ORG_OWNER"
        />
      );
      const h1Matches = html.match(/<h1[\s>]/g);
      expect(h1Matches).not.toBeNull();
      expect(h1Matches!.length).toBe(1);
      expect(html).toContain('Role Learning Paths');
    });

    it('LearningPathDetailView renders exactly one H1 element', () => {
      const path = allPaths[0];
      const html = renderToStaticMarkup(
        <LearningPathDetailView
          path={path}
          userRole="ORG_OWNER"
          roleLabel="Organisation Owner"
          prevPath={null}
          nextPath={allPaths[1] || null}
          resolvedSections={[]}
        />
      );
      const h1Matches = html.match(/<h1[\s>]/g);
      expect(h1Matches).not.toBeNull();
      expect(h1Matches!.length).toBe(1);
      expect(html).toContain('Organisation Owner: Governance');
    });
  });

  describe('2. User-Facing Terminology & Compliance Overclaim Exclusions', () => {
    it('HelpHubView does not contain compliance overclaims or internal buzzwords', () => {
      const html = renderToStaticMarkup(
        <HelpHubView
          userRole="ORG_OWNER"
          roleLabel="Organisation Owner"
          categories={categoriesWithGuides}
          recommendedGuides={getGuidesByRole('ORG_OWNER')}
          commonTaskGuides={allGuides.slice(0, 4)}
          totalGuideCount={allGuides.length}
          recommendedPath={getLearningPathForRole('ORG_OWNER')}
          totalPathCount={allPaths.length}
        />
      );
      expect(html.toLowerCase()).not.toContain('certified for compliance');
      expect(html.toLowerCase()).not.toContain('ofsted certified');
      expect(html.toLowerCase()).not.toContain('statutory certification');
      expect(html).not.toContain('certified training guides');
    });

    it('VideoLibraryView uses neutral verified wording and does not render raw role enums', () => {
      const html = renderToStaticMarkup(
        <VideoLibraryView
          videos={allVideos}
          userRole="ORG_OWNER"
        />
      );
      expect(html).toContain(`${allVideos.length} Training Videos`);
      expect(html).not.toContain('Certified Screencasts');
      expect(html).not.toMatch(/>ORG_OWNER</);
      expect(html).not.toMatch(/>FRONT_DESK</);
      expect(html).not.toMatch(/>TUTOR</);
      expect(html).not.toMatch(/>MANAGER</);
    });

    it('VideoPlayerView uses neutral Verified Training Asset and safe player attributes', () => {
      const video = allVideos[0];
      const html = renderToStaticMarkup(
        <VideoPlayerView
          video={video}
          relatedGuides={allGuides.slice(0, 2)}
          navigation={{ prev: null, next: allVideos[1] }}
        />
      );
      expect(html).toContain('Verified Training Asset');
      expect(html).not.toContain('Certified Training Asset');
      expect(html).toContain('controls');
      expect(html).toContain('playsInline');
      expect(html).toContain('preload="metadata"');
      expect(html).not.toContain('autoplay');
    });

    it('LearningPathsListView uses video walkthroughs rather than certified screencasts', () => {
      const html = renderToStaticMarkup(
        <LearningPathsListView
          paths={allPaths}
          roleLabel="Organisation Owner"
          recommendedPath={getLearningPathForRole('ORG_OWNER')}
          userRole="ORG_OWNER"
        />
      );
      expect(html).toContain('video walkthroughs');
      expect(html).not.toContain('certified screencasts');
    });
  });

  describe('3. HelpSearchBar Accessibility & Interaction', () => {
    it('has combobox role, accessible name, and listbox popup attributes', () => {
      const { getByRole } = render(<HelpSearchBar />);
      const input = getByRole('combobox', {
        name: /Search training guides, videos and learning paths/i,
      });
      expect(input).not.toBeNull();
      expect(input.getAttribute('aria-haspopup')).toBe('listbox');
      expect(input.getAttribute('aria-controls')).toBe('help-search-dropdown');
    });

    it('closes dropdown when Escape key is pressed', () => {
      const { getByRole, queryByRole } = render(<HelpSearchBar />);
      const input = getByRole('combobox');
      fireEvent.change(input, { target: { value: 'attendance' } });

      expect(getByRole('listbox')).not.toBeNull();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(queryByRole('listbox')).toBeNull();
    });

    it('clears query and restores focus to input when clear button clicked', () => {
      const { getByRole } = render(<HelpSearchBar />);
      const input = getByRole('combobox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'attendance' } });

      const clearButton = getByRole('button', { name: /Clear search query/i });
      fireEvent.click(clearButton);

      expect(input.value).toBe('');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('4. Semantic Invariant & Canonical Role Mapping', () => {
    it('maps all 4 CMS staff roles strictly to their canonical primary path', () => {
      expect(getPrimaryLearningPathForRole('ORG_OWNER')?.slug).toBe('organisation-owner');
      expect(getPrimaryLearningPathForRole('MANAGER')?.slug).toBe('centre-manager');
      expect(getPrimaryLearningPathForRole('FRONT_DESK')?.slug).toBe('front-desk');
      expect(getPrimaryLearningPathForRole('TUTOR')?.slug).toBe('tutor-club-leader');
    });

    it('Parent Portal is never a staff role primary recommendation', () => {
      const parentPath = getLearningPathBySlug('parent-portal');
      expect(parentPath).not.toBeNull();
      expect(parentPath?.primaryStaffRole).toBeUndefined();
      expect(parentPath?.isStaffReferenceOnly).toBe(true);

      const roles = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR'] as const;
      for (const role of roles) {
        expect(getPrimaryLearningPathForRole(role)?.slug).not.toBe('parent-portal');
      }
    });
  });

  describe('5. Unknown Slug Safety', () => {
    it('returns null safely for unknown guide slug', () => {
      expect(getGuideBySlug('non-existent-guide-xyz')).toBeNull();
    });

    it('returns null safely for unknown video slug', () => {
      expect(getVideoBySlug('non-existent-video-xyz')).toBeNull();
    });

    it('returns null safely for unknown learning path slug', () => {
      expect(getLearningPathBySlug('non-existent-path-xyz')).toBeNull();
    });
  });
});
