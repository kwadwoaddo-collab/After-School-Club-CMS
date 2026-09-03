/**
 * SprintScale CMS — Client-Safe Help Search Engine
 * Searches certified guides, training videos, and role-based learning paths in-memory.
 * Zero Node.js 'fs' dependencies, completely safe for Client and Server components.
 */

import { HELP_GUIDES, HELP_VIDEOS } from './help-manifest';
import { HELP_LEARNING_PATHS } from './help-learning-paths-manifest';
import { HelpSearchResult } from './types';

/**
 * Unified search across approved Help content: guides, videos, and learning paths.
 * Strictly default-deny: only searches manifest-registered items.
 */
export function searchHelp(query: string): HelpSearchResult {
  if (!query || query.trim().length === 0) {
    return { guides: [], videos: [], learningPaths: [], totalCount: 0 };
  }

  const q = query.toLowerCase().trim();

  const matchingGuides = HELP_GUIDES.filter(g => {
    return (
      (g.title && g.title.toLowerCase().includes(q)) ||
      (g.description && g.description.toLowerCase().includes(q)) ||
      (g.audience && g.audience.toLowerCase().includes(q)) ||
      (g.category && g.category.toLowerCase().includes(q)) ||
      (g.keywords && g.keywords.some(k => k && k.toLowerCase().includes(k ? q : '')))
    );
  });

  const matchingVideos = HELP_VIDEOS.filter(v => {
    return (
      (v.title && v.title.toLowerCase().includes(q)) ||
      (v.description && v.description.toLowerCase().includes(q)) ||
      (v.audienceLabel && v.audienceLabel.toLowerCase().includes(q)) ||
      (v.category && v.category.toLowerCase().includes(q))
    );
  });

  const matchingPaths = HELP_LEARNING_PATHS.filter(p => {
    return (
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.audienceLabel && p.audienceLabel.toLowerCase().includes(q)) ||
      p.sections.some(
        s =>
          (s.title && s.title.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.items.some(it => it.note && it.note.toLowerCase().includes(q))
      )
    );
  });

  const totalCount = matchingGuides.length + matchingVideos.length + matchingPaths.length;

  return {
    guides: matchingGuides,
    videos: matchingVideos,
    learningPaths: matchingPaths,
    totalCount,
  };
}
