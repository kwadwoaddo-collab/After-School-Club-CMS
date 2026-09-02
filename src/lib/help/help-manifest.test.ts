/**
 * SprintScale CMS — PM-1B.R1 Help Manifest & Role Model Forensic Tests
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { userRoleEnum } from '@/db/schema';
import { HELP_CATEGORIES, HELP_GUIDES, HELP_VIDEOS } from './help-manifest';
import { CMS_STAFF_ROLES, HELP_AUDIENCES } from './types';
import {
  getAllCategories,
  getAllGuides,
  getAllVideos,
  getCategoryById,
  getGuideBySlug,
  getGuidesByCategory,
  getGuidesByRole,
  getGuidesByAudience,
  getVideoById,
  getVideosByGuideSlug,
  searchHelp,
} from './get-help-content';

describe('PM-1B.R1 Help Manifest & Foundation Validation', () => {
  describe('Staff Role vs Audience Model Forensic Integrity', () => {
    it('should derive CMS_STAFF_ROLES exactly from the canonical userRoleEnum', () => {
      const canonicalRoles = userRoleEnum.enumValues;
      expect(CMS_STAFF_ROLES).toEqual(canonicalRoles);
      expect(CMS_STAFF_ROLES).toEqual(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']);
    });

    it('should NOT treat PARENT as an authenticated CMS staff role', () => {
      expect((CMS_STAFF_ROLES as readonly string[]).includes('PARENT')).toBe(false);
      expect((userRoleEnum.enumValues as readonly string[]).includes('PARENT')).toBe(false);
    });

    it('should classify PARENT strictly as an audience persona in HELP_AUDIENCES', () => {
      expect(HELP_AUDIENCES).toContain('PARENT');
    });

    it('should ensure no guide has PARENT in recommendedStaffRoles', () => {
      for (const guide of HELP_GUIDES) {
        expect((guide.recommendedStaffRoles as string[]).includes('PARENT')).toBe(false);
        for (const role of guide.recommendedStaffRoles) {
          expect(CMS_STAFF_ROLES).toContain(role);
        }
      }
    });

    it('should return empty array when getGuidesByRole is queried with PARENT or invalid role', () => {
      const parentResult = getGuidesByRole('PARENT');
      expect(parentResult).toEqual([]);

      const invalidResult = getGuidesByRole('SUPERUSER');
      expect(invalidResult).toEqual([]);
    });

    it('should allow querying parent guides via getGuidesByAudience', () => {
      const parentAudienceGuides = getGuidesByAudience('PARENT');
      expect(parentAudienceGuides.length).toBeGreaterThan(0);
      expect(parentAudienceGuides.some(g => g.slug === 'parent-portal-guide')).toBe(true);
      expect(parentAudienceGuides.some(g => g.slug === 'parent-getting-started')).toBe(true);
    });
  });

  describe('Category Integrity', () => {
    it('should have 7 distinct categories', () => {
      expect(HELP_CATEGORIES.length).toBe(7);
      const categoryIds = HELP_CATEGORIES.map(c => c.id);
      const uniqueIds = new Set(categoryIds);
      expect(uniqueIds.size).toBe(7);
    });

    it('should retrieve category by id', () => {
      const cat = getCategoryById('core-operations');
      expect(cat).toBeDefined();
      expect(cat?.name).toBe('Core Operations');
    });
  });

  describe('Guide Manifest Integrity', () => {
    it('should contain exactly 34 approved user guides', () => {
      expect(HELP_GUIDES.length).toBe(34);
    });

    it('should have unique IDs and slugs across all 34 guides', () => {
      const ids = new Set<string>();
      const slugs = new Set<string>();

      for (const guide of HELP_GUIDES) {
        expect(ids.has(guide.id)).toBe(false);
        expect(slugs.has(guide.slug)).toBe(false);
        ids.add(guide.id);
        slugs.add(guide.slug);
      }
    });

    it('should ensure all 34 guide content files physically exist in src/content/help/', () => {
      const baseDir = path.resolve(process.cwd(), 'src/content/help');
      for (const guide of HELP_GUIDES) {
        const fullPath = path.join(baseDir, guide.contentPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });

    it('should ensure all guide categories are valid', () => {
      const validCategories = new Set(HELP_CATEGORIES.map(c => c.id));
      for (const guide of HELP_GUIDES) {
        expect(validCategories.has(guide.category)).toBe(true);
      }
    });
  });

  describe('Video Manifest & Public Asset Integrity', () => {
    it('should contain exactly 52 certified micro-videos', () => {
      expect(HELP_VIDEOS.length).toBe(52);
    });

    it('should have unique video IDs from SS-D6-V001 to SS-D6-V052', () => {
      const videoIds = new Set<string>();
      for (const video of HELP_VIDEOS) {
        expect(videoIds.has(video.id)).toBe(false);
        videoIds.add(video.id);
      }
      expect(videoIds.size).toBe(52);
    });

    it('should ensure all 52 video files physically exist in public/training/assets/videos/', () => {
      const videoDir = path.resolve(process.cwd(), 'public/training/assets/videos');
      for (const video of HELP_VIDEOS) {
        const fullPath = path.join(videoDir, `${video.id}.mp4`);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });

    it('should ensure all video target guide slugs exist in the guide manifest', () => {
      const guideSlugs = new Set(HELP_GUIDES.map(g => g.slug));
      for (const video of HELP_VIDEOS) {
        expect(guideSlugs.has(video.targetGuideSlug)).toBe(true);
      }
    });
  });

  describe('Screenshot Asset Integrity', () => {
    it('should ensure all referenced screenshots physically exist in public/training/assets/screenshots/annotated/', () => {
      const screenshotDir = path.resolve(process.cwd(), 'public/training/assets/screenshots/annotated');
      const allReferencedScreenshots = new Set<string>();
      for (const guide of HELP_GUIDES) {
        for (const s of guide.screenshots) {
          allReferencedScreenshots.add(s);
        }
      }

      for (const sId of allReferencedScreenshots) {
        const fullPath = path.join(screenshotDir, `${sId}.png`);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });
  });

  describe('Security & Default-Deny Access Boundary', () => {
    it('should return null when querying an unmanifested or arbitrary slug', () => {
      const result = getGuideBySlug('unknown-arbitrary-guide');
      expect(result).toBeNull();
    });

    it('should reject path traversal attempts and return null', () => {
      const result1 = getGuideBySlug('../../../package.json');
      const result2 = getGuideBySlug('../../project-notes/documentation-training/README.md');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should prevent arbitrary unmanifested Markdown files from becoming exposed', () => {
      // e.g. An internal audit file in project-notes
      const result = getGuideBySlug('d0-production-documentation-audit');
      expect(result).toBeNull();
    });

    it('should successfully load content for allowlisted guides', () => {
      const result = getGuideBySlug('attendance-roll-call');
      expect(result).not.toBeNull();
      expect(result?.meta.title).toBe('Functional Manual: Attendance & Roll Call');
      expect(result?.content).toContain('# SprintScale CMS');
    });
  });

  describe('Role Filtering & Search Capabilities', () => {
    it('should filter guides by authenticated staff role', () => {
      const tutorGuides = getGuidesByRole('TUTOR');
      expect(tutorGuides.length).toBeGreaterThan(0);
      expect(tutorGuides.some(g => g.slug === 'tutor-first-day')).toBe(true);
      expect(tutorGuides.some(g => g.slug === 'attendance-roll-call')).toBe(true);

      const frontDeskGuides = getGuidesByRole('FRONT_DESK');
      expect(frontDeskGuides.length).toBeGreaterThan(0);
      // Front desk is recommended to reference parent guide for parent support
      expect(frontDeskGuides.some(g => g.slug === 'parent-portal-guide')).toBe(true);
    });

    it('should search guides and videos by query keyword', () => {
      const searchRes = searchHelp('attendance');
      expect(searchRes.guides.length).toBeGreaterThan(0);
      expect(searchRes.videos.length).toBeGreaterThan(0);
      expect(searchRes.guides.some(g => g.slug === 'attendance-roll-call')).toBe(true);
    });

    it('should return empty arrays for blank search queries', () => {
      const searchRes = searchHelp('   ');
      expect(searchRes.guides).toEqual([]);
      expect(searchRes.videos).toEqual([]);
    });

    it('should retrieve videos by guide slug', () => {
      const videos = getVideosByGuideSlug('attendance-roll-call');
      expect(videos.length).toBeGreaterThan(0);
      expect(videos.some(v => v.id === 'SS-D6-V006')).toBe(true);
    });
  });
});
