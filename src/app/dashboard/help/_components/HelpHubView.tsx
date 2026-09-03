'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  CalendarCheck,
  ShieldAlert,
  Wallet,
  Settings,
  LifeBuoy,
  BookOpen,
  Video,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
  FileText,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  HelpCategory,
  HelpCategoryDefinition,
  HelpGuideMetadata,
  HelpLearningPathMetadata,
  HelpStaffRole,
} from '@/lib/help/types';

import HelpSearchBar from './HelpSearchBar';

interface HelpHubViewProps {
  userRole: HelpStaffRole;
  roleLabel: string;
  categories: (HelpCategoryDefinition & { guides: HelpGuideMetadata[] })[];
  recommendedGuides: HelpGuideMetadata[];
  commonTaskGuides: HelpGuideMetadata[];
  totalGuideCount: number;
  recommendedPath?: HelpLearningPathMetadata | null;
  totalPathCount?: number;
}

const CATEGORY_ICONS: Record<HelpCategory, React.ElementType> = {
  'getting-started': Compass,
  'core-operations': CalendarCheck,
  safeguarding: ShieldAlert,
  finance: Wallet,
  administration: Settings,
  troubleshooting: LifeBuoy,
  'master-manual': BookOpen,
};

export default function HelpHubView({
  userRole,
  roleLabel,
  categories,
  recommendedGuides,
  commonTaskGuides,
  totalGuideCount,
  recommendedPath,
  totalPathCount = 5,
}: HelpHubViewProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(prev => (prev === categoryId ? null : categoryId));
  };

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      {/* 1. Page Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Help &amp; Training
            </h1>
            <p className="text-text-secondary text-sm sm:text-base mt-1">
              Guides, walkthroughs and training resources to help you get the most from SprintScale.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {totalGuideCount} Training Guides
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-elevated text-text-secondary border border-border">
              <Video className="size-3.5" aria-hidden="true" />
              52 Training Videos
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Compass className="size-3.5" aria-hidden="true" />
              {totalPathCount} Learning Paths
            </span>
          </div>
        </div>

        {/* Unified Help Search */}
        <div className="max-w-2xl pt-1">
          <HelpSearchBar />
        </div>
      </header>

      {/* 2. Welcome Banner */}

      <section
        aria-label="Welcome and Training Overview"
        className="rounded-xl border border-border bg-gradient-to-br from-surface via-surface to-page p-6 sm:p-8 shadow-sm"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2 space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <span>Operational Guidance</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-text">
              Welcome to the SprintScale Training Centre
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed max-w-2xl">
              Browse role-specific onboarding paths, daily operational checklists, and step-by-step
              functional guides designed to support consistent safeguarding, attendance, finance
              and day-to-day centre operations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg border border-border bg-surface-elevated space-y-1">
              <div className="flex items-center gap-2 text-text font-semibold text-xs">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span>Standardised</span>
              </div>
              <p className="text-xs text-text-muted">Consistent staff operating procedures</p>
            </div>
            <div className="p-3.5 rounded-lg border border-border bg-surface-elevated space-y-1">
              <div className="flex items-center gap-2 text-text font-semibold text-xs">
                <Layers className="size-4 text-accent shrink-0" />
                <span>7 Domains</span>
              </div>
              <p className="text-xs text-text-muted">Attendance, finance, intake &amp; safety</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Role-Aware Recommendations */}
      <section aria-labelledby="recommended-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <div>
            <h2 id="recommended-heading" className="text-lg sm:text-xl font-bold text-text flex items-center gap-2">
              <span>Recommended for you</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent-soft text-accent">
                {roleLabel}
              </span>
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
              Curated guides tailored to your role. As an authorised staff member, you can also browse all categories below.
            </p>
          </div>
        </div>

        {/* Recommended Learning Path Banner */}
        {recommendedPath && (
          <div className="rounded-xl border border-accent/40 bg-accent-soft/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent text-white">
                  Recommended Learning Path
                </span>
                <span className="text-xs text-text-muted">
                  {roleLabel} Sequence
                </span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-text">
                {recommendedPath.title}
              </h3>
              <p className="text-xs text-text-secondary line-clamp-1 max-w-2xl">
                {recommendedPath.description}
              </p>
            </div>
            <Link
              href={`/dashboard/help/learning-paths/${recommendedPath.slug}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white font-semibold text-xs hover:bg-accent/90 shrink-0 transition-colors"
            >
              <span>Explore Role Path</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recommendedGuides.slice(0, 4).map(guide => {
            const Icon = CATEGORY_ICONS[guide.category] || FileText;
            return (
              <Link
                key={guide.id}
                href={`/dashboard/help/guides/${guide.slug}`}
                className="group relative flex flex-col justify-between p-5 rounded-lg border border-border bg-surface hover:border-accent/40 hover:shadow-md transition-all duration-200"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="p-2 rounded-md bg-accent-soft text-accent">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
                      <Clock className="size-3" aria-hidden="true" />
                      {guide.readingTimeMinutes} min
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-text group-hover:text-accent transition-colors leading-snug">
                      {guide.title}
                    </h3>
                    <p className="text-xs text-text-secondary line-clamp-2 mt-1.5 leading-relaxed">
                      {guide.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
                  <span className="truncate max-w-[140px]">{guide.audience}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-accent/80 group-hover:text-accent transition-colors flex items-center gap-1">
                    <span>Read Guide</span>
                    <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. Common Tasks Section */}
      <section aria-labelledby="common-tasks-heading" className="space-y-4">
        <div>
          <h2 id="common-tasks-heading" className="text-lg sm:text-xl font-bold text-text">
            Common tasks
          </h2>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Quick reference guides for frequent daily workflows across attendance, billing, and bookings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {commonTaskGuides.map(guide => {
            const Icon = CATEGORY_ICONS[guide.category] || FileText;
            return (
              <Link
                key={`common-${guide.id}`}
                href={`/dashboard/help/guides/${guide.slug}`}
                className="flex items-start gap-4 p-4 rounded-lg border border-border bg-surface hover:border-accent/40 hover:bg-surface-elevated transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-page text-text-secondary shrink-0 mt-0.5 group-hover:text-accent transition-colors">
                  <Icon className="size-4 text-accent" aria-hidden="true" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text group-hover:text-accent transition-colors truncate">
                      {guide.title}
                    </h3>
                    <span className="text-[11px] text-text-muted whitespace-nowrap">
                      {guide.readingTimeMinutes} min
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                    {guide.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 5. Training Categories Grid */}
      <section aria-labelledby="categories-heading" className="space-y-4">
        <div>
          <h2 id="categories-heading" className="text-lg sm:text-xl font-bold text-text">
            Browse by Category
          </h2>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Explore all 34 training guides organised across core operational domains.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat.id] || FileText;
            const isExpanded = expandedCategory === cat.id;

            return (
              <div
                key={cat.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 hover:border-accent/30 transition-all duration-200"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-lg bg-accent-soft text-accent">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-page text-text-secondary border border-border">
                      {cat.guides.length} {cat.guides.length === 1 ? 'guide' : 'guides'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-text">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  {/* Expandable Guide List */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-border-subtle space-y-2 animate-in fade-in duration-150">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        Included Guides
                      </p>
                      <ul className="space-y-1 text-xs">
                        {cat.guides.map(g => (
                          <li key={g.id}>
                            <Link
                              href={`/dashboard/help/guides/${g.slug}`}
                              className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-page transition-colors group"
                            >
                              <span className="text-text group-hover:text-accent font-medium truncate">
                                {g.title}
                              </span>
                              <span className="text-[11px] text-text-muted whitespace-nowrap">
                                {g.readingTimeMinutes}m
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-accent hover:text-accent/80 transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                    aria-expanded={isExpanded}
                  >
                    <span>{isExpanded ? 'Hide guide list' : 'View included guides'}</span>
                    {isExpanded ? (
                      <ChevronUp className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Media Modules, Learning Paths & Master Manual */}
      <section aria-label="Core Training Modules" className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        {/* Learning Paths Card */}
        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col justify-between space-y-4 hover:border-accent/40 hover:shadow-xs transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-lg bg-accent-soft text-accent">
                <Compass className="size-5" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary border border-border">
                {totalPathCount} Paths
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base text-text">
                Role Learning Paths
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                Curated reading and video sequences tailored to Organisation Owners, Centre Managers, Front Desk, and Tutors.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border-subtle">
            <Link
              href="/dashboard/help/learning-paths"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors group"
            >
              <span>Explore Learning Paths</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Video Library Card */}
        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col justify-between space-y-4 hover:border-accent/40 hover:shadow-xs transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-lg bg-accent-soft text-accent">
                <Video className="size-5" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary border border-border">
                52 Videos
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base text-text">
                Training Video Library
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                52 short walkthrough videos (30–60 seconds each) demonstrating real operational
                tasks including roll-call attendance, kiosk sign-in, booking adjustments, and payment reconciliation.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border-subtle">
            <Link
              href="/dashboard/help/videos"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors group"
            >
              <span>Browse Video Library</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Master Manual Card */}
        <div className="rounded-xl border border-border bg-surface p-6 flex flex-col justify-between space-y-4 hover:border-accent/40 hover:shadow-xs transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="p-2.5 rounded-lg bg-accent-soft text-accent">
                <BookOpen className="size-5" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-elevated text-text-secondary border border-border">
                5 Chapters
              </span>
            </div>
            <div>
              <h3 className="font-bold text-base text-text">
                Full Continuous User Manual
              </h3>
              <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                Comprehensive 5-part continuous operational handbook covering System Foundations,
                Family-to-Booking Journey, Attendance-to-Safeguarding, Finance &amp; Payments, and Administration.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border-subtle">
            <Link
              href="/dashboard/help/guides/master-system-foundations"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors group"
            >
              <span>Open User Manual</span>
              <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
