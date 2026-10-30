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
  const tokens = q.split(/\s+/).filter(Boolean);

  const matchingGuides = HELP_GUIDES.filter(g => {
    const title = (g.title || '').toLowerCase();
    const description = (g.description || '').toLowerCase();
    const audience = (g.audience || '').toLowerCase();
    const category = (g.category || '').toLowerCase();
    const keywords = (g.keywords || []).filter(Boolean).map(k => k.toLowerCase());

    return tokens.every(token =>
      title.includes(token) ||
      description.includes(token) ||
      audience.includes(token) ||
      category.includes(token) ||
      keywords.some(k => k.includes(token))
    );
  });

  const matchingVideos = HELP_VIDEOS.filter(v => {
    const title = (v.title || '').toLowerCase();
    const description = (v.description || '').toLowerCase();
    const audienceLabel = (v.audienceLabel || '').toLowerCase();
    const category = (v.category || '').toLowerCase();

    return tokens.every(token =>
      title.includes(token) ||
      description.includes(token) ||
      audienceLabel.includes(token) ||
      category.includes(token)
    );
  });

  const matchingPaths = HELP_LEARNING_PATHS.filter(p => {
    const title = (p.title || '').toLowerCase();
    const description = (p.description || '').toLowerCase();
    const audienceLabel = (p.audienceLabel || '').toLowerCase();

    return tokens.every(token =>
      title.includes(token) ||
      description.includes(token) ||
      audienceLabel.includes(token) ||
      p.sections.some(
        s =>
          (s.title && s.title.toLowerCase().includes(token)) ||
          (s.description && s.description.toLowerCase().includes(token)) ||
          s.items.some(it => it.note && it.note.toLowerCase().includes(token))
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
