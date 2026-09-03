'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Video,
  Play,
  Clock,
  ArrowRight,
  ChevronRight,
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { HelpCategory, HelpStaffRole, HelpVideoMetadata, STAFF_ROLE_LABELS } from '@/lib/help/types';

interface VideoLibraryViewProps {
  videos: HelpVideoMetadata[];
  userRole: HelpStaffRole;
}

const CATEGORY_NAMES: Record<HelpCategory, string> = {
  'getting-started': 'Getting Started',
  'core-operations': 'Core Operations',
  safeguarding: 'Safeguarding',
  finance: 'Finance & Payments',
  administration: 'Administration',
  troubleshooting: 'Troubleshooting',
  'master-manual': 'Master Manual',
};

export default function VideoLibraryView({ videos, userRole }: VideoLibraryViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Categories present in video corpus
  const availableCategories = useMemo(() => {
    const cats = new Set<HelpCategory>();
    for (const v of videos) {
      cats.add(v.category);
    }
    return Array.from(cats);
  }, [videos]);

  // Filtered video list
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesCategory = selectedCategory === 'all' || v.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        (v.audienceLabel && v.audienceLabel.toLowerCase().includes(q)) ||
        CATEGORY_NAMES[v.category]?.toLowerCase().includes(q)
      );
    });
  }, [videos, selectedCategory, searchQuery]);

  const tablistRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active category pill into view on mobile if needed
  useEffect(() => {
    if (tablistRef.current && selectedCategory !== 'all') {
      const activeBtn = tablistRef.current.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [selectedCategory]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-text-muted">
        <Link
          href="/dashboard/help"
          className="hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xs"
        >
          <BookOpen className="size-3.5" aria-hidden="true" />
          <span>Help &amp; Training</span>
        </Link>
        <ChevronRight className="size-3 text-border" aria-hidden="true" />
        <span className="text-text font-medium" aria-current="page">
          Training Videos
        </span>
      </nav>

      {/* 2. Header & Overview */}
      <header className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-soft text-accent text-xs font-semibold mb-2">
              <Video className="size-3.5" aria-hidden="true" />
              <span>{videos.length} Certified Screencasts</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Training Videos
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-3xl leading-relaxed">
              Concise, click-by-click micro-video walkthroughs (30–60 seconds each) demonstrating exact operational tasks across daily attendance, session bookings, invoicing, staff management, and system administration.
            </p>
          </div>
        </div>
      </header>

      {/* 3. Search & Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search training videos by title, task, or module..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
              aria-label="Search training videos"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="relative w-full min-w-0">
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="Filter videos by category"
            className="flex items-center gap-2 overflow-x-auto sm:overflow-x-visible sm:flex-wrap pb-2 sm:pb-0 scroll-smooth scrollbar-thin"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                selectedCategory === 'all'
                  ? 'bg-accent text-white shadow-xs'
                  : 'bg-surface border border-border text-text-secondary hover:text-text hover:border-accent/40'
              }`}
            >
              All Videos ({videos.length})
            </button>
            {availableCategories.map(cat => {
              const count = videos.filter(v => v.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-surface border border-border text-text-secondary hover:text-text hover:border-accent/40'
                  }`}
                >
                  {CATEGORY_NAMES[cat] || cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Video Cards Grid */}
      {filteredVideos.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-surface/50">
          <Video className="size-8 text-text-muted mx-auto mb-3" aria-hidden="true" />
          <h3 className="font-semibold text-base text-text">No matching videos found</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different category tab.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent-soft transition-colors"
          >
            <span>Reset filters</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map(video => {
            const roleLabels = video.recommendedStaffRoles.map(r => STAFF_ROLE_LABELS[r] || r);
            const isRelevant = video.recommendedStaffRoles.includes(userRole);

            return (
              <div
                key={video.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface overflow-hidden hover:border-accent/40 hover:shadow-md transition-all duration-200"
              >
                {/* Visual Thumbnail Area */}
                <div className="relative aspect-16/9 bg-page flex items-center justify-center border-b border-border/80 overflow-hidden">
                  {/* Subtle decorative grid/gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-60" />
                  
                  {/* Duration & Category Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide uppercase bg-surface/90 backdrop-blur-xs text-text border border-border/60">
                      {CATEGORY_NAMES[video.category] || video.category}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface/90 backdrop-blur-xs text-text-secondary border border-border/60 z-10">
                    <Clock className="size-3 text-accent" aria-hidden="true" />
                    <span>{video.durationLabel}</span>
                  </div>

                  {/* Play Button Icon Graphic */}
                  <div className="size-12 rounded-full bg-accent/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-accent transition-all duration-200 z-10">
                    <Play className="size-5 ml-0.5 fill-current" aria-hidden="true" />
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h2 className="font-semibold text-base text-text group-hover:text-accent transition-colors line-clamp-2 leading-snug">
                      {video.title}
                    </h2>
                    <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                      {video.description}
                    </p>
                  </div>

                  {/* Metadata: Roles */}
                  <div className="pt-3 border-t border-border-subtle space-y-2">
                    <div className="text-[11px] text-text-muted flex items-center gap-1.5">
                      <span className="font-medium text-text-secondary">Audience:</span>
                      <span className="truncate">{roleLabels.slice(0, 2).join(', ')}{roleLabels.length > 2 ? ` +${roleLabels.length - 2}` : ''}</span>
                    </div>

                    {/* Action CTA */}
                    <Link
                      href={`/dashboard/help/videos/${video.slug}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-accent bg-accent-soft hover:bg-accent hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Play className="size-3.5 fill-current" aria-hidden="true" />
                      <span>Watch video</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
