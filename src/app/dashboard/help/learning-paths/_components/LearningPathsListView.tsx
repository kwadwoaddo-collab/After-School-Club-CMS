'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  BookOpen,
  Video,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Layers,
  ShieldAlert,
  Users,
  ChevronRight,
} from 'lucide-react';
import { HelpLearningPathMetadata, HelpStaffRole } from '@/lib/help/types';
import HelpSearchBar from '../../_components/HelpSearchBar';

interface LearningPathsListViewProps {
  userRole: HelpStaffRole;
  roleLabel: string;
  paths: HelpLearningPathMetadata[];
  recommendedPath: HelpLearningPathMetadata | null;
}

const PERSONA_ICONS: Record<string, React.ElementType> = {
  ORG_OWNER: Layers,
  MANAGER: Users,
  FRONT_DESK: Compass,
  TUTOR: BookOpen,
  PARENT: Sparkles,
};

export default function LearningPathsListView({
  userRole,
  roleLabel,
  paths,
  recommendedPath,
}: LearningPathsListViewProps) {
  return (
    <div className="space-y-8 pb-16 max-w-7xl mx-auto">
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
          Learning Paths
        </span>
      </nav>

      {/* 2. Header */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-soft text-accent text-xs font-semibold mb-2">
              <Compass className="size-3.5" aria-hidden="true" />
              <span>5 Curated Role Sequences</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Role Learning Paths
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-3xl leading-relaxed">
              Curated reading and video watching sequences tailored to your operational responsibilities. Every path combines foundational written guides with click-by-click certified screencasts.
            </p>
          </div>
        </div>

        {/* Unified Help Search */}
        <div className="max-w-2xl pt-2">
          <HelpSearchBar placeholder="Search learning paths, guides, or video tasks..." />
        </div>
      </header>

      {/* 3. Recommended for Your Role Highlight Card */}
      {recommendedPath && (
        <section aria-labelledby="recommended-path-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="recommended-path-heading" className="text-base font-bold text-text flex items-center gap-2">
              <span>Recommended for your role</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent-soft text-accent">
                {roleLabel}
              </span>
            </h2>
            <span className="text-xs text-text-muted">
              Guidance tailored to your CMS responsibilities
            </span>
          </div>

          <div className="rounded-2xl border-2 border-accent/40 bg-gradient-to-br from-surface via-surface to-accent-soft/20 p-6 sm:p-8 shadow-sm transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent text-white">
                  <Sparkles className="size-3" aria-hidden="true" />
                  <span>Primary Recommendation</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-text">
                  {recommendedPath.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {recommendedPath.description}
                </p>

                {/* Section topics preview */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-text-muted">
                  <span className="font-semibold text-text">Key topics:</span>
                  {recommendedPath.sections.map((sec, i) => (
                    <span
                      key={sec.id}
                      className="px-2 py-0.5 rounded-md bg-surface-elevated border border-border text-text-secondary"
                    >
                      {sec.title}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1 font-medium">
                    <BookOpen className="size-3.5 text-accent" />
                    {recommendedPath.sections.reduce(
                      (acc, s) => acc + s.items.filter(it => it.type === 'guide').length,
                      0
                    )}{' '}
                    Guides
                  </span>
                  <span className="flex items-center gap-1 font-medium">
                    <Video className="size-3.5 text-rose-500" />
                    {recommendedPath.sections.reduce(
                      (acc, s) => acc + s.items.filter(it => it.type === 'video').length,
                      0
                    )}{' '}
                    Videos
                  </span>
                </div>

                <Link
                  href={`/dashboard/help/learning-paths/${recommendedPath.slug}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent/90 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span>Start Learning Path</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. All Learning Paths Grid */}
      <section aria-labelledby="all-paths-heading" className="space-y-4">
        <div>
          <h2 id="all-paths-heading" className="text-lg sm:text-xl font-bold text-text">
            All Learning Paths
          </h2>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            As an authorised staff member, you have full access to explore cross-functional learning paths across every operational domain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paths.map(path => {
            const Icon = PERSONA_ICONS[path.persona] || Compass;
            const guideCount = path.sections.reduce(
              (acc, s) => acc + s.items.filter(it => it.type === 'guide').length,
              0
            );
            const videoCount = path.sections.reduce(
              (acc, s) => acc + s.items.filter(it => it.type === 'video').length,
              0
            );
            const isPrimaryForRole = path.primaryStaffRole === userRole;

            return (
              <div
                key={path.id}
                className={`flex flex-col justify-between rounded-xl border bg-surface p-6 transition-all duration-200 hover:shadow-md ${
                  isPrimaryForRole
                    ? 'border-accent/50 ring-1 ring-accent/30'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="p-2.5 rounded-lg bg-accent-soft text-accent">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {path.isStaffReferenceOnly ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Staff Reference
                        </span>
                      ) : isPrimaryForRole ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent-soft text-accent border border-accent/20">
                          Your Role
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-base text-text leading-snug">
                      {path.title}
                    </h3>
                    <p className="text-xs text-text-muted mt-1 font-medium">
                      Audience: {path.audienceLabel}
                    </p>
                    <p className="text-xs text-text-secondary mt-2 leading-relaxed line-clamp-3">
                      {path.description}
                    </p>
                  </div>

                  {/* Sections List Preview */}
                  <div className="pt-3 border-t border-border-subtle space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      {path.sections.length} Curated Sections
                    </p>
                    <ul className="space-y-1 text-xs text-text-secondary">
                      {path.sections.slice(0, 3).map(sec => (
                        <li key={sec.id} className="flex items-center gap-1.5 truncate">
                          <CheckCircle2 className="size-3 text-accent shrink-0" aria-hidden="true" />
                          <span className="truncate">{sec.title}</span>
                        </li>
                      ))}
                      {path.sections.length > 3 && (
                        <li className="text-[11px] text-text-muted pl-4">
                          +{path.sections.length - 3} more sections
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <BookOpen className="size-3.5" />
                      {guideCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Video className="size-3.5" />
                      {videoCount}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/help/learning-paths/${path.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors group"
                  >
                    <span>View Path</span>
                    <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
