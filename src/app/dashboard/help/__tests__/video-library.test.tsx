/**
 * SprintScale CMS — Milestone PM-1E Automated Test Suite
 * Comprehensive testing for Training Video Library, playback route, metadata, security, and category-local navigation.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import {
  getAllVideos,
  getVideoBySlug,
  getVideoById,
  getVideosByCategory,
  getVideosByRole,
  getVideoNavigation,
  getAllGuides,
} from '@/lib/help/get-help-content';
import { HELP_VIDEOS } from '@/lib/help/help-videos-manifest';
import { HELP_CATEGORIES } from '@/lib/help/help-manifest';
import { STAFF_ROLE_LABELS } from '@/lib/help/types';
import VideoLibraryView from '../videos/_components/VideoLibraryView';
import VideoPlayerView from '../videos/[slug]/_components/VideoPlayerView';

describe('PM-1E — Training Video Library & Playback Automated Suite', () => {
  // -------------------------------------------------------------
  // A, B, C, D, E, F, G, H: Manifest & Checksum Integrity
  // -------------------------------------------------------------
  describe('Corpus & Manifest Integrity', () => {
    it('A. video manifest contains exactly 52 certified videos', () => {
      expect(HELP_VIDEOS.length).toBe(52);
      expect(getAllVideos().length).toBe(52);
    });

    it('B. video IDs are unique and strictly adhere to SS-D6-V001 to SS-D6-V052 format', () => {
      const ids = new Set<string>();
      for (let i = 1; i <= 52; i++) {
        const expectedId = `SS-D6-V${String(i).padStart(3, '0')}`;
        const found = HELP_VIDEOS.find(v => v.id === expectedId);
        expect(found).toBeDefined();
        expect(ids.has(expectedId)).toBe(false);
        ids.add(expectedId);
      }
      expect(ids.size).toBe(52);
    });

    it('C. video slugs are unique, URL-safe, and lowercase', () => {
      const slugs = new Set<string>();
      for (const video of HELP_VIDEOS) {
        expect(slugs.has(video.slug)).toBe(false);
        expect(video.slug).toMatch(/^[a-z0-9-]+$/);
        slugs.add(video.slug);
      }
      expect(slugs.size).toBe(52);
    });

    it('D, E, F. public URLs use controlled /training/assets/videos/ prefix without path traversal or absolute paths', () => {
      for (const video of HELP_VIDEOS) {
        expect(video.videoUrl.startsWith('/training/assets/videos/')).toBe(true);
        expect(video.videoUrl).not.toContain('..');
        expect(video.videoUrl).not.toContain('file://');
        expect(video.videoUrl).not.toContain('/Users/');
        expect(video.videoUrl).not.toContain('project-notes');
        expect(video.videoUrl.endsWith('.mp4')).toBe(true);
      }
    });

    it('G. all 52 video files physically exist in both source and public directories', () => {
      const srcDir = path.resolve('project-notes/documentation-training/assets/videos');
      const publicDir = path.resolve('public/training/assets/videos');

      for (const video of HELP_VIDEOS) {
        const srcPath = path.join(srcDir, `${video.id}.mp4`);
        const publicPath = path.join(publicDir, `${video.id}.mp4`);

        expect(fs.existsSync(srcPath)).toBe(true);
        expect(fs.existsSync(publicPath)).toBe(true);
      }
    });

    it('H. source and public video files are byte-identical with matching SHA-256 checksums', () => {
      const srcDir = path.resolve('project-notes/documentation-training/assets/videos');
      const publicDir = path.resolve('public/training/assets/videos');

      for (const video of HELP_VIDEOS) {
        const srcPath = path.join(srcDir, `${video.id}.mp4`);
        const publicPath = path.join(publicDir, `${video.id}.mp4`);

        const srcHash = crypto.createHash('sha256').update(fs.readFileSync(srcPath)).digest('hex');
        const publicHash = crypto.createHash('sha256').update(fs.readFileSync(publicPath)).digest('hex');

        expect(srcHash).toBe(publicHash);
      }
    });
  });

  // -------------------------------------------------------------
  // I, U: Default Deny & Path Traversal Boundary
  // -------------------------------------------------------------
  describe('Security Boundary & Default Deny', () => {
    it('I. unknown video slug safely returns null (triggers notFound)', () => {
      expect(getVideoBySlug('unknown-video-slug')).toBeNull();
      expect(getVideoBySlug('ss-d6-v999')).toBeNull();
      expect(getVideoBySlug('')).toBeNull();
    });

    it('U. path traversal attempts in slug return null', () => {
      expect(getVideoBySlug('../../../etc/passwd')).toBeNull();
      expect(getVideoBySlug('..%2F..%2Fetc')).toBeNull();
      expect(getVideoById('../SS-D6-V001')).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // J, K, L: Presentation & Role Labels
  // -------------------------------------------------------------
  describe('Library Presentation & Terminology', () => {
    it('J, K. library renders canonical human-readable titles, not raw asset IDs', () => {
      const sampleVideos = HELP_VIDEOS.slice(0, 5);
      const html = renderToStaticMarkup(
        <VideoLibraryView videos={sampleVideos} userRole="MANAGER" />
      );

      // Verifies canonical titles are present
      expect(html).toContain('Registering a Multi-Child Family via Public Portal');
      expect(html).toContain('Reviewing &amp; Approving a Public Registration');

      // Verifies raw IDs like SS-D6-V001 are not rendered as visible text titles
      expect(html).not.toMatch(/>SS-D6-V001</);
    });

    it('L. role labels use human-readable format without raw enum codes', () => {
      const sample = HELP_VIDEOS[0]; // Recommended for all staff
      const html = renderToStaticMarkup(
        <VideoPlayerView
          video={sample}
          relatedGuides={[]}
          navigation={{ prev: null, next: null }}
        />
      );

      // Verifies human-readable labels appear
      expect(html).toContain('Organisation Owner');
      expect(html).toContain('Centre Manager');
      expect(html).toContain('Front Desk');
      expect(html).toContain('Tutor / Club Leader');

      // Verifies raw enum strings are not displayed as visible text badges
      expect(html).not.toMatch(/>ORG_OWNER</);
      expect(html).not.toMatch(/>FRONT_DESK</);
    });
  });

  // -------------------------------------------------------------
  // M, N, O: Guide References & Related Guide Mappings
  // -------------------------------------------------------------
  describe('Guide Reference Integration', () => {
    it('M, N. all 77 guide video references map to certified video entries', () => {
      const allGuides = getAllGuides();
      let refCount = 0;

      for (const g of allGuides) {
        const guidePath = path.join(process.cwd(), 'src/content/help', g.contentPath);
        const content = fs.readFileSync(guidePath, 'utf-8');
        const matches = [...content.matchAll(/\[(.*?)\]\((.*?(\.mp4|\/videos\/).*?)\)/g)];

        for (const m of matches) {
          refCount++;
          const filename = path.basename(m[2]);
          const videoId = filename.replace(/\.mp4$/, '');
          const video = getVideoById(videoId);

          expect(video).toBeDefined();
          expect(video?.id).toBe(videoId);
        }
      }

      expect(refCount).toBe(77);
    });

    it('O. related guide slugs in manifest all resolve to valid guides', () => {
      const allGuides = getAllGuides();
      const guideSlugs = new Set(allGuides.map(g => g.slug));

      for (const video of HELP_VIDEOS) {
        for (const slug of video.relatedGuideSlugs) {
          expect(guideSlugs.has(slug)).toBe(true);
        }
      }
    });
  });

  // -------------------------------------------------------------
  // P, Q: Category-Local Navigation Sequencing
  // -------------------------------------------------------------
  describe('Category-Local Video Sequencing', () => {
    it('P, Q. category boundaries have null prev at start and null next at end', () => {
      const categories = HELP_CATEGORIES.map(c => c.id);

      for (const cat of categories) {
        const catVideos = getVideosByCategory(cat);
        if (catVideos.length === 0) continue;

        const first = catVideos[0];
        const last = catVideos[catVideos.length - 1];

        const firstNav = getVideoNavigation(first.slug);
        const lastNav = getVideoNavigation(last.slug);

        expect(firstNav.prev).toBeNull();
        expect(lastNav.next).toBeNull();

        if (catVideos.length > 1) {
          expect(firstNav.next?.slug).toBe(catVideos[1].slug);
          expect(lastNav.prev?.slug).toBe(catVideos[catVideos.length - 2].slug);
        }
      }
    });

    it('P. core-operations video navigation stays strictly within core-operations', () => {
      const catVideos = getVideosByCategory('core-operations');
      expect(catVideos.length).toBe(19);

      for (let i = 0; i < catVideos.length; i++) {
        const nav = getVideoNavigation(catVideos[i].slug);
        if (i > 0) {
          expect(nav.prev?.category).toBe('core-operations');
          expect(nav.prev?.slug).toBe(catVideos[i - 1].slug);
        }
        if (i < catVideos.length - 1) {
          expect(nav.next?.category).toBe('core-operations');
          expect(nav.next?.slug).toBe(catVideos[i + 1].slug);
        }
      }
    });
  });

  // -------------------------------------------------------------
  // R, S: Player Configuration & Autoplay Absence
  // -------------------------------------------------------------
  describe('Video Player Configuration', () => {
    it('R, S. player renders native controls, preload="metadata", and NO autoplay', () => {
      const video = HELP_VIDEOS[0];
      const html = renderToStaticMarkup(
        <VideoPlayerView
          video={video}
          relatedGuides={[]}
          navigation={{ prev: null, next: null }}
        />
      );

      // Verifies video element attributes
      expect(html).toContain('<video');
      expect(html).toContain('controls=""');
      expect(html).toContain('preload="metadata"');
      expect(html).not.toContain('autoplay');
      expect(html).toContain(`src="${video.videoUrl}"`);
      expect(html).toContain('type="video/mp4"');
    });
  });

  // -------------------------------------------------------------
  // T: Help Hub Link Integration
  // -------------------------------------------------------------
  describe('Help Hub Link Integration', () => {
    it('T. Help Hub exposes Training Videos link pointing to /dashboard/help/videos', () => {
      const helpHubFile = path.resolve('src/app/dashboard/help/_components/HelpHubView.tsx');
      const content = fs.readFileSync(helpHubFile, 'utf-8');

      expect(content).toContain('/dashboard/help/videos');
      expect(content).toContain('Training Video Library');
      expect(content).toContain('Browse Video Library');
    });
  });

  // -------------------------------------------------------------
  // PM-1E.R1: Category Navigation Visual Reconciliation
  // -------------------------------------------------------------
  describe('PM-1E.R1: Category Navigation Visual Reconciliation', () => {
    it('renders all category pills including Troubleshooting with exact counts', () => {
      const html = renderToStaticMarkup(
        <VideoLibraryView videos={HELP_VIDEOS} userRole="MANAGER" />
      );

      // Verify All Videos + 6 categories
      expect(html).toContain('All Videos (52)');
      expect(html).toContain('Core Operations (19)');
      expect(html).toContain('Administration (15)');
      expect(html).toContain('Finance &amp; Payments (10)');
      expect(html).toContain('Getting Started (5)');
      expect(html).toContain('Safeguarding (2)');
      expect(html).toContain('Troubleshooting (1)');
    });

    it('renders category controls with flex-wrap on desktop and scrollable rail on mobile', () => {
      const html = renderToStaticMarkup(
        <VideoLibraryView videos={HELP_VIDEOS} userRole="MANAGER" />
      );

      // Verify tablist container has responsive hybrid classes
      expect(html).toContain('role="tablist"');
      expect(html).toContain('overflow-x-auto');
      expect(html).toContain('sm:overflow-x-visible');
      expect(html).toContain('sm:flex-wrap');

      // Verify pills have flex-shrink-0 to prevent label compression
      expect(html).toContain('flex-shrink-0');
      expect(html).toContain('whitespace-nowrap');
    });

    it('Troubleshooting video count matches manifest exactly without taxonomy mutation', () => {
      const troubleshootingVideos = getVideosByCategory('troubleshooting');
      expect(troubleshootingVideos.length).toBe(1);
      expect(troubleshootingVideos[0].id).toBe('SS-D6-V052');
      expect(troubleshootingVideos[0].title).toBe('Understanding the Parent Portal Rate-Limit Warning');
    });
  });
});
