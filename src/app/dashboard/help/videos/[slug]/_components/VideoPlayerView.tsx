'use client';

import React from 'react';
import Link from 'next/link';
import {
  Video,
  Play,
  Clock,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  BookOpen,
  Users,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import {
  HelpCategory,
  HelpGuideMetadata,
  HelpVideoMetadata,
  STAFF_ROLE_LABELS,
} from '@/lib/help/types';

interface VideoPlayerViewProps {
  video: HelpVideoMetadata;
  relatedGuides: HelpGuideMetadata[];
  navigation: {
    prev: HelpVideoMetadata | null;
    next: HelpVideoMetadata | null;
  };
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

export default function VideoPlayerView({
  video,
  relatedGuides,
  navigation,
}: VideoPlayerViewProps) {
  const roleLabels = video.recommendedStaffRoles.map(r => STAFF_ROLE_LABELS[r] || r);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
        <Link
          href="/dashboard/help"
          className="hover:text-accent transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xs"
        >
          <BookOpen className="size-3.5" aria-hidden="true" />
          <span>Help &amp; Training</span>
        </Link>
        <ChevronRight className="size-3 text-border shrink-0" aria-hidden="true" />
        <Link
          href="/dashboard/help/videos"
          className="hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xs"
        >
          Training Videos
        </Link>
        <ChevronRight className="size-3 text-border shrink-0" aria-hidden="true" />
        <span className="text-text font-medium truncate max-w-[280px] sm:max-w-md" aria-current="page">
          {video.title}
        </span>
      </nav>

      {/* 2. Header & Badges */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
            {CATEGORY_NAMES[video.category] || video.category}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface text-text-secondary border border-border">
            <Clock className="size-3 text-accent" aria-hidden="true" />
            <span>Duration: {video.durationLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface text-text-secondary border border-border">
            <ShieldCheck className="size-3 text-emerald-500" aria-hidden="true" />
            <span>Verified Training Asset</span>
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
          {video.title}
        </h1>

        <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-3xl">
          {video.description}
        </p>

        {/* Recommended Roles */}
        <div className="flex items-center gap-2 pt-1 text-xs text-text-muted">
          <Users className="size-3.5 text-accent shrink-0" aria-hidden="true" />
          <span className="font-medium text-text-secondary">Recommended for:</span>
          <span className="text-text">{roleLabels.join(', ')}</span>
        </div>
      </header>

      {/* 3. Responsive Video Player Container */}
      <section aria-label="Video Player" className="rounded-2xl border border-border bg-black shadow-lg overflow-hidden">
        <div className="relative aspect-16/9 w-full bg-black flex items-center justify-center">
          <video
            controls
            preload="metadata"
            playsInline
            className="w-full h-full object-contain"
            aria-label={`Training video: ${video.title}`}
            data-video-id={video.id}
          >
            <source src={video.videoUrl} type="video/mp4" />
            <p className="text-white text-xs p-4 text-center">
              Your browser does not support the HTML5 video element. You can view this training asset directly in a modern web browser.
            </p>
          </video>
        </div>
      </section>

      {/* 4. Related Written Guides */}
      {relatedGuides.length > 0 && (
        <section aria-label="Related Written Guides" className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <FileText className="size-5 text-accent" aria-hidden="true" />
              <span>Related Written Guides</span>
            </h2>
            <span className="text-xs text-text-muted">
              {relatedGuides.length} manual{relatedGuides.length > 1 ? 's' : ''} covering this workflow
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {relatedGuides.map(guide => (
              <Link
                key={guide.id}
                href={`/dashboard/help/guides/${guide.slug}`}
                className="group flex flex-col justify-between p-4 rounded-xl border border-border bg-surface hover:border-accent/40 hover:shadow-xs transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                      {CATEGORY_NAMES[guide.category] || guide.category}
                    </span>
                    <span className="text-[11px] text-text-muted flex items-center gap-1">
                      <Clock className="size-3" aria-hidden="true" />
                      {guide.readingTimeMinutes} min read
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm text-text group-hover:text-accent transition-colors leading-snug">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {guide.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                  <span className="text-[11px] truncate max-w-[180px]">{guide.audience}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-accent group-hover:translate-x-0.5 transition-transform text-[11px]">
                    <span>Read Guide</span>
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 5. Previous / Next Category-Local Video Navigation */}
      <nav aria-label="Adjacent Training Videos" className="pt-6 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {navigation.prev ? (
            <Link
              href={`/dashboard/help/videos/${navigation.prev.slug}`}
              className="group flex flex-col p-4 rounded-xl border border-border bg-surface hover:border-accent/40 transition-all text-left"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent mb-1">
                <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
                <span>Previous Video</span>
              </span>
              <span className="text-sm font-medium text-text group-hover:text-accent transition-colors line-clamp-1">
                {navigation.prev.title}
              </span>
              <span className="text-xs text-text-muted mt-0.5">
                {navigation.prev.durationLabel} · {CATEGORY_NAMES[navigation.prev.category]}
              </span>
            </Link>
          ) : (
            <div className="p-4 rounded-xl border border-border/40 bg-surface/30 opacity-60 flex flex-col justify-center">
              <span className="text-xs text-text-muted font-medium">First video in this category</span>
            </div>
          )}

          {navigation.next ? (
            <Link
              href={`/dashboard/help/videos/${navigation.next.slug}`}
              className="group flex flex-col p-4 rounded-xl border border-border bg-surface hover:border-accent/40 transition-all text-right sm:items-end"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent mb-1">
                <span>Next Video</span>
                <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-text group-hover:text-accent transition-colors line-clamp-1">
                {navigation.next.title}
              </span>
              <span className="text-xs text-text-muted mt-0.5">
                {navigation.next.durationLabel} · {CATEGORY_NAMES[navigation.next.category]}
              </span>
            </Link>
          ) : (
            <div className="p-4 rounded-xl border border-border/40 bg-surface/30 opacity-60 flex flex-col justify-center sm:items-end">
              <span className="text-xs text-text-muted font-medium">End of category</span>
            </div>
          )}
        </div>
      </nav>

      {/* 6. Return Actions */}
      <footer className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link
          href="/dashboard/help/videos"
          className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Back to all training videos</span>
        </Link>

        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <BookOpen className="size-3.5" aria-hidden="true" />
          <span>Help &amp; Training Home</span>
        </Link>
      </footer>
    </div>
  );
}
