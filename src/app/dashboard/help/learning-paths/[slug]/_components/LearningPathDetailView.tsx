'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  BookOpen,
  Video,
  Clock,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  HelpGuideMetadata,
  HelpLearningPathMetadata,
  HelpStaffRole,
  HelpVideoMetadata,
} from '@/lib/help/types';

interface ResolvedSectionItem {
  type: 'guide' | 'video';
  slug: string;
  title: string;
  description: string;
  note?: string;
  durationLabel?: string;
  readingTimeMinutes?: number;
  url: string;
}

interface ResolvedSection {
  id: string;
  title: string;
  description?: string;
  items: ResolvedSectionItem[];
}

interface LearningPathDetailViewProps {
  path: HelpLearningPathMetadata;
  userRole: HelpStaffRole;
  roleLabel: string;
  resolvedSections: ResolvedSection[];
  prevPath: HelpLearningPathMetadata | null;
  nextPath: HelpLearningPathMetadata | null;
}

export default function LearningPathDetailView({
  path,
  userRole,
  roleLabel,
  resolvedSections,
  prevPath,
  nextPath,
}: LearningPathDetailViewProps) {
  const isRecommended = path.recommendedStaffRoles.includes(userRole);

  const totalGuides = resolvedSections.reduce(
    (acc, s) => acc + s.items.filter(it => it.type === 'guide').length,
    0
  );
  const totalVideos = resolvedSections.reduce(
    (acc, s) => acc + s.items.filter(it => it.type === 'video').length,
    0
  );

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
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
        <Link
          href="/dashboard/help/learning-paths"
          className="hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xs"
        >
          Learning Paths
        </Link>
        <ChevronRight className="size-3 text-border" aria-hidden="true" />
        <span className="text-text font-medium truncate max-w-xs" aria-current="page">
          {path.title}
        </span>
      </nav>

      {/* 2. Path Header & Meta */}
      <header className="rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-page p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
              <Compass className="size-3.5" aria-hidden="true" />
              <span>Learning Path</span>
            </span>
            {path.isStaffReferenceOnly ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Info className="size-3" aria-hidden="true" />
                <span>Staff Reference for Parent Support</span>
              </span>
            ) : isRecommended ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="size-3" aria-hidden="true" />
                <span>Recommended for your role ({roleLabel})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-elevated text-text-muted border border-border">
                <span>Audience: {path.audienceLabel}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <BookOpen className="size-3.5 text-accent" />
              {totalGuides} Guides
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Video className="size-3.5 text-rose-500" />
              {totalVideos} Videos
            </span>
            <span>·</span>
            <span>{resolvedSections.length} Sections</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            {path.title}
          </h1>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed max-w-3xl">
            {path.description}
          </p>
        </div>

        {/* Operational Guard Note */}
        <div className="p-3.5 rounded-xl border border-border bg-surface-elevated flex items-start gap-3 text-xs text-text-secondary">
          <ShieldCheck className="size-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold text-text">Role Guidance Notice: </span>
            <span>
              This learning sequence is designed for {path.audienceLabel}. As an authorised SprintScale staff member, you have unrestricted access to read and watch all modules across every department.
            </span>
          </div>
        </div>
      </header>

      {/* 3. Curated Path Sections */}
      <div className="space-y-10">
        {resolvedSections.map((section, secIdx) => (
          <section
            key={section.id}
            aria-labelledby={`section-heading-${section.id}`}
            className="space-y-4"
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <span className="flex items-center justify-center size-7 rounded-lg bg-accent text-white font-bold text-xs shrink-0">
                {secIdx + 1}
              </span>
              <div>
                <h2
                  id={`section-heading-${section.id}`}
                  className="text-lg font-bold text-text"
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {section.description}
                  </p>
                )}
              </div>
            </div>

            {/* Section Item Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.items.map((item, itemIdx) => {
                const isGuide = item.type === 'guide';

                return (
                  <Link
                    key={`${section.id}-${item.slug}-${itemIdx}`}
                    href={item.url}
                    className="group flex flex-col justify-between p-5 rounded-xl border border-border bg-surface hover:border-accent/40 hover:shadow-md transition-all duration-150"
                  >
                    <div className="space-y-3">
                      {/* Badge Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {isGuide ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <BookOpen className="size-3" aria-hidden="true" />
                              <span>Guide</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400">
                              <Video className="size-3" aria-hidden="true" />
                              <span>Video</span>
                            </span>
                          )}
                          <span className="text-[11px] text-text-muted">
                            {isGuide
                              ? `${item.readingTimeMinutes} min read`
                              : item.durationLabel}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-sm font-bold text-text group-hover:text-accent transition-colors leading-snug">
                          {item.title}
                        </h3>
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Operational Note */}
                      {item.note && (
                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border-subtle text-[11px] text-text-muted leading-relaxed">
                          <span className="font-semibold text-text-secondary">Focus: </span>
                          {item.note}
                        </div>
                      )}
                    </div>

                    {/* Footer CTA */}
                    <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                      <span className="font-medium text-accent group-hover:text-accent/80 transition-colors">
                        {isGuide ? 'Read Guide' : 'Watch Video Walkthrough'}
                      </span>
                      <ArrowRight className="size-3.5 text-accent group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* 4. Sequential Previous / Next Path Navigation */}
      <footer className="pt-8 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prevPath ? (
            <Link
              href={`/dashboard/help/learning-paths/${prevPath.slug}`}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:border-accent/40 hover:bg-surface-elevated transition-all group"
            >
              <ArrowLeft className="size-4 text-text-muted group-hover:text-accent group-hover:-translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
                  Previous Learning Path
                </span>
                <span className="text-xs font-bold text-text group-hover:text-accent transition-colors truncate block">
                  {prevPath.title}
                </span>
              </div>
            </Link>
          ) : (
            <div />
          )}

          {nextPath && (
            <Link
              href={`/dashboard/help/learning-paths/${nextPath.slug}`}
              className="flex items-center justify-between sm:justify-end gap-3 p-4 rounded-xl border border-border bg-surface hover:border-accent/40 hover:bg-surface-elevated transition-all group text-right"
            >
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted block">
                  Next Learning Path
                </span>
                <span className="text-xs font-bold text-text group-hover:text-accent transition-colors truncate block">
                  {nextPath.title}
                </span>
              </div>
              <ArrowRight className="size-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/dashboard/help/learning-paths"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-accent transition-colors"
          >
            <span>← Back to all Learning Paths</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
