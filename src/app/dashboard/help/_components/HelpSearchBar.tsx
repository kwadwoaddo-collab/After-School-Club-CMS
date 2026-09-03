'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, X, BookOpen, Video, Compass, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { searchHelp } from '@/lib/help/search-help';
import { HelpGuideMetadata, HelpLearningPathMetadata, HelpVideoMetadata } from '@/lib/help/types';

interface HelpSearchBarProps {
  placeholder?: string;
  autoFocus?: boolean;
}

type FilterTab = 'all' | 'guides' | 'videos' | 'paths';

export default function HelpSearchBar({
  placeholder = 'Search all training guides, videos, and learning paths...',
  autoFocus = false,
}: HelpSearchBarProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    if (!query.trim()) {
      return { guides: [], videos: [], learningPaths: [], totalCount: 0 };
    }
    return searchHelp(query);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const totalResults = searchResults.totalCount || 0;
  const hasQuery = query.trim().length > 0;

  const filteredItems = useMemo(() => {
    const list: Array<
      | { type: 'guide'; data: HelpGuideMetadata }
      | { type: 'video'; data: HelpVideoMetadata }
      | { type: 'path'; data: HelpLearningPathMetadata }
    > = [];

    if (activeFilter === 'all' || activeFilter === 'paths') {
      (searchResults.learningPaths || []).forEach(p => list.push({ type: 'path', data: p }));
    }
    if (activeFilter === 'all' || activeFilter === 'guides') {
      searchResults.guides.forEach(g => list.push({ type: 'guide', data: g }));
    }
    if (activeFilter === 'all' || activeFilter === 'videos') {
      searchResults.videos.forEach(v => list.push({ type: 'video', data: v }));
    }

    return list;
  }, [searchResults, activeFilter]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search
          className="absolute left-3.5 size-4 text-text-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent shadow-xs transition-all"
          aria-label="Search training guides, videos and learning paths"
          role="combobox"
          aria-expanded={isOpen && hasQuery}
          aria-haspopup="listbox"
          aria-controls="help-search-dropdown"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 p-1 rounded-md text-text-muted hover:text-text hover:bg-page transition-colors"
            aria-label="Clear search query"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Results Dropdown Overlay */}
      {isOpen && hasQuery && (
        <div
          id="help-search-dropdown"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-border bg-surface shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-[540px] flex flex-col"
        >
          {/* Filter Bar & Count */}
          <div className="p-3 border-b border-border-subtle bg-surface-elevated flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'all'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text hover:bg-page'
                }`}
              >
                All ({totalResults})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('paths')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'paths'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text hover:bg-page'
                }`}
              >
                Learning Paths ({(searchResults.learningPaths || []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('guides')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'guides'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text hover:bg-page'
                }`}
              >
                Guides ({searchResults.guides.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('videos')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'videos'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text hover:bg-page'
                }`}
              >
                Videos ({searchResults.videos.length})
              </button>
            </div>
            <span className="text-[11px] text-text-muted">
              {totalResults} {totalResults === 1 ? 'match' : 'matches'} for &quot;{query}&quot;
            </span>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto p-2 divide-y divide-border-subtle space-y-1">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-text">No results found</p>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  We couldn&apos;t find any approved guides, videos, or learning paths matching &quot;{query}&quot;. Try searching for attendance, billing, roll call, or safeguarding.
                </p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                if (item.type === 'path') {
                  const p = item.data;
                  return (
                    <Link
                      key={`path-${p.id}-${idx}`}
                      href={`/dashboard/help/learning-paths/${p.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-surface-elevated transition-colors"
                    >
                      <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                        <Compass className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Learning Path
                          </span>
                          <span className="text-xs text-text-muted truncate">
                            {p.audienceLabel}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-text group-hover:text-accent transition-colors leading-snug">
                          {p.title}
                        </h4>
                        <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">
                          {p.description}
                        </p>
                      </div>
                      <ArrowRight className="size-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0 mt-2" aria-hidden="true" />
                    </Link>
                  );
                }

                if (item.type === 'guide') {
                  const g = item.data;
                  return (
                    <Link
                      key={`guide-${g.id}-${idx}`}
                      href={`/dashboard/help/guides/${g.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-surface-elevated transition-colors"
                    >
                      <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                        <BookOpen className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            Written Guide
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-text-muted">
                            <Clock className="size-3" aria-hidden="true" />
                            {g.readingTimeMinutes}m read
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-text group-hover:text-accent transition-colors leading-snug">
                          {g.title}
                        </h4>
                        <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">
                          {g.description}
                        </p>
                      </div>
                      <ArrowRight className="size-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0 mt-2" aria-hidden="true" />
                    </Link>
                  );
                }

                if (item.type === 'video') {
                  const v = item.data;
                  return (
                    <Link
                      key={`video-${v.id}-${idx}`}
                      href={`/dashboard/help/videos/${v.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-surface-elevated transition-colors"
                    >
                      <span className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                        <Video className="size-4" aria-hidden="true" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-rose-500/10 text-rose-600 dark:text-rose-400">
                            Video Screencast
                          </span>
                          <span className="text-[11px] font-medium text-text-muted">
                            {v.durationLabel}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-text group-hover:text-accent transition-colors leading-snug">
                          {v.title}
                        </h4>
                        <p className="text-xs text-text-secondary line-clamp-1 mt-0.5">
                          {v.description}
                        </p>
                      </div>
                      <ArrowRight className="size-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0 mt-2" aria-hidden="true" />
                    </Link>
                  );
                }

                return null;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
