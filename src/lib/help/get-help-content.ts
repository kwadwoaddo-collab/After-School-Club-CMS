/**
 * SprintScale CMS — In-App Help Content Accessor & Security Boundary
 * Controlled server-side accessor for help content, videos, categories, and manifest searches.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { HELP_CATEGORIES, HELP_GUIDES, HELP_VIDEOS } from './help-manifest';
import { HELP_LEARNING_PATHS } from './help-learning-paths-manifest';
import {
  CMS_STAFF_ROLES,
  HelpAudience,
  HelpCategory,
  HelpCategoryDefinition,
  HelpGuideMetadata,
  HelpLearningPathMetadata,
  HelpStaffRole,
  HelpSearchResult,
  HelpVideoMetadata,
} from './types';


const CONTENT_BASE_DIR = path.resolve(process.cwd(), 'src/content/help');

/**
 * Get all available help category definitions.
 */
export function getAllCategories(): HelpCategoryDefinition[] {
  return [...HELP_CATEGORIES].sort((a, b) => a.order - b.order);
}

/**
 * Get a specific category by ID.
 */
export function getCategoryById(categoryId: string): HelpCategoryDefinition | null {
  return HELP_CATEGORIES.find(c => c.id === categoryId) || null;
}

/**
 * Get all manifest-registered help guides.
 */
export function getAllGuides(): HelpGuideMetadata[] {
  return [...HELP_GUIDES].sort((a, b) => a.order - b.order);
}

/**
 * Get all guides within a specific category.
 */
export function getGuidesByCategory(category: HelpCategory): HelpGuideMetadata[] {
  return HELP_GUIDES.filter(g => g.category === category).sort((a, b) => a.order - b.order);
}

/**
 * Get recommended guides for an authenticated CMS staff role.
 * Enforces staff RBAC boundaries: only 'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR' are accepted.
 * Non-staff personas such as 'PARENT' return an empty array.
 */
export function getGuidesByRole(role: string): HelpGuideMetadata[] {
  const normalizedRole = role.toUpperCase() as HelpStaffRole;
  if (!CMS_STAFF_ROLES.includes(normalizedRole)) {
    return [];
  }
  return HELP_GUIDES.filter(g => g.recommendedStaffRoles.includes(normalizedRole)).sort(
    (a, b) => a.order - b.order
  );
}

/**
 * Get guides by target audience persona (e.g. 'PARENT', 'TUTOR', 'ALL_STAFF').
 */
export function getGuidesByAudience(audience: string): HelpGuideMetadata[] {
  const normalizedAudience = audience.toUpperCase() as HelpAudience;
  return HELP_GUIDES.filter(g => g.targetAudience.includes(normalizedAudience)).sort(
    (a, b) => a.order - b.order
  );
}

/**
 * Get a specific guide metadata and markdown content by slug.
 * Strictly enforces default-deny: only manifest-registered guides can be loaded.
 */
export function getGuideBySlug(slug: string): { meta: HelpGuideMetadata; content: string } | null {
  const meta = HELP_GUIDES.find(g => g.slug === slug);
  if (!meta) {
    return null;
  }

  const safeFilePath = path.join(CONTENT_BASE_DIR, meta.contentPath);

  // Security guard: Ensure resolved path remains strictly within CONTENT_BASE_DIR
  if (!safeFilePath.startsWith(CONTENT_BASE_DIR)) {
    logger.error(`[HELP SECURITY VIOLATION] Path traversal attempted for slug: ${slug}`);
    return null;
  }

  if (!fs.existsSync(safeFilePath)) {
    logger.error(`[HELP CONTENT MISSING] Guide content file not found: ${safeFilePath}`);
    return null;
  }

  const content = fs.readFileSync(safeFilePath, 'utf-8');
  return { meta, content };
}

/**
 * Deterministic previous / next navigation derived from category-local guide order.
 * First guide in category has prev: null; last guide in category has next: null.
 */
export function getGuideNavigation(slug: string): {
  prev: HelpGuideMetadata | null;
  next: HelpGuideMetadata | null;
} {
  const guide = HELP_GUIDES.find(g => g.slug === slug);
  if (!guide) {
    return { prev: null, next: null };
  }
  const catGuides = getGuidesByCategory(guide.category);
  const index = catGuides.findIndex(g => g.slug === slug);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? catGuides[index - 1] : null,
    next: index < catGuides.length - 1 ? catGuides[index + 1] : null,
  };
}

/**
 * Get all 52 certified micro-videos.
 */
export function getAllVideos(): HelpVideoMetadata[] {
  return [...HELP_VIDEOS];
}

/**
 * Get a specific micro-video by slug (e.g., 'marking-morning-and-afternoon-class-register').
 */
export function getVideoBySlug(slug: string): HelpVideoMetadata | null {
  return HELP_VIDEOS.find(v => v.slug === slug) || null;
}

/**
 * Get a specific micro-video by asset ID (e.g., 'SS-D6-V001').
 */
export function getVideoById(videoId: string): HelpVideoMetadata | null {
  return HELP_VIDEOS.find(v => v.id === videoId) || null;
}

/**
 * Get all videos within a specific category.
 */
export function getVideosByCategory(category: HelpCategory): HelpVideoMetadata[] {
  return HELP_VIDEOS.filter(v => v.category === category).sort((a, b) => a.order - b.order);
}

/**
 * Get recommended videos for an authenticated CMS staff role.
 */
export function getVideosByRole(role: string): HelpVideoMetadata[] {
  const normalizedRole = role.toUpperCase() as HelpStaffRole;
  if (!CMS_STAFF_ROLES.includes(normalizedRole)) {
    return [];
  }
  return HELP_VIDEOS.filter(v => v.recommendedStaffRoles.includes(normalizedRole));
}

/**
 * Get all videos mapped to a specific guide slug.
 */
export function getVideosByGuideSlug(slug: string): HelpVideoMetadata[] {
  return HELP_VIDEOS.filter(v => v.relatedGuideSlugs.includes(slug) || v.targetGuideSlug === slug);
}

/**
 * Deterministic previous / next navigation derived from category-local video order.
 * First video in category has prev: null; last video in category has next: null.
 */
export function getVideoNavigation(slug: string): {
  prev: HelpVideoMetadata | null;
  next: HelpVideoMetadata | null;
} {
  const video = HELP_VIDEOS.find(v => v.slug === slug);
  if (!video) {
    return { prev: null, next: null };
  }
  const catVideos = getVideosByCategory(video.category);
  const index = catVideos.findIndex(v => v.slug === slug);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? catVideos[index - 1] : null,
    next: index < catVideos.length - 1 ? catVideos[index + 1] : null,
  };
}

/**
 * Get all role-based learning paths.
 */
export function getAllLearningPaths(): HelpLearningPathMetadata[] {
  return [...HELP_LEARNING_PATHS].sort((a, b) => a.order - b.order);
}

/**
 * Get a specific learning path by slug.
 */
export function getLearningPathBySlug(slug: string): HelpLearningPathMetadata | null {
  return HELP_LEARNING_PATHS.find(p => p.slug === slug) || null;
}

/**
 * Resolve the recommended learning path for an authenticated staff role.
 * Mapping:
 * ORG_OWNER -> Organisation Owner
 * MANAGER -> Centre Manager
 * FRONT_DESK -> Front Desk
 * TUTOR -> Tutor / Club Leader
 */
export function getLearningPathForRole(role: string): HelpLearningPathMetadata | null {
  const normalized = role.toUpperCase() as HelpStaffRole;
  switch (normalized) {
    case 'ORG_OWNER':
      return getLearningPathBySlug('organisation-owner');
    case 'MANAGER':
      return getLearningPathBySlug('centre-manager');
    case 'FRONT_DESK':
      return getLearningPathBySlug('front-desk');
    case 'TUTOR':
      return getLearningPathBySlug('tutor-club-leader');
    default:
      return null;
  }
}

/**
 * Deterministic previous / next navigation derived from learning path order.
 */
export function getLearningPathNavigation(slug: string): {
  prev: HelpLearningPathMetadata | null;
  next: HelpLearningPathMetadata | null;
} {
  const paths = getAllLearningPaths();
  const index = paths.findIndex(p => p.slug === slug);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: index > 0 ? paths[index - 1] : null,
    next: index < paths.length - 1 ? paths[index + 1] : null,
  };
}

export { searchHelp } from './search-help';
