import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import {
  getCategoryById,
  getGuideBySlug,
  getGuideNavigation,
  getAllGuides,
} from '@/lib/help/get-help-content';
import { STAFF_ROLE_LABELS, HelpStaffRole } from '@/lib/help/types';
import { extractTOC, MarkdownArticle } from '@/lib/help/markdown-renderer';
import MobileTOC from './_components/MobileTOC';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  BookOpen,
  ChevronRight,
  ListTree,
  UserCheck,
} from 'lucide-react';

interface GuidePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = getGuideBySlug(slug);
  if (!data) {
    return {
      title: 'Guide Not Found | SprintScale CMS',
    };
  }
  return {
    title: `${data.meta.title} | Help & Training | SprintScale CMS`,
    description: data.meta.description,
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const session = await auth();

  // 1. Enforce authenticated dashboard boundary
  if (!session?.user) {
    return redirect('/login');
  }

  // 2. Enforce completed onboarding
  const user = session.user as { role?: string; organisationId?: string };
  if (!user.organisationId) {
    return redirect('/onboarding');
  }

  const { slug } = await params;

  // 3. Resolve guide data from certified manifest
  const guideData = getGuideBySlug(slug);
  if (!guideData) {
    return notFound();
  }

  const { meta: guide, content } = guideData;
  const category = getCategoryById(guide.category);
  const navigation = getGuideNavigation(slug);
  const toc = extractTOC(content);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* 1. Breadcrumbs & Top Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-text-muted flex-wrap">
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-1.5 hover:text-accent font-medium transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Help &amp; Training</span>
        </Link>
        <ChevronRight className="size-3.5 text-border" aria-hidden="true" />
        <span className="text-text-secondary">{category?.name ?? 'Guides'}</span>
        <ChevronRight className="size-3.5 text-border" aria-hidden="true" />
        <span className="text-text font-semibold truncate max-w-xs">{guide.title}</span>
      </nav>

      {/* 2. Guide Header */}
      <header className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
              {category.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
            <Clock className="size-3.5" aria-hidden="true" />
            <span>{guide.readingTimeMinutes}m read</span>
          </span>
          {guide.recommendedStaffRoles.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted border-l border-border pl-2">
              <UserCheck className="size-3.5" aria-hidden="true" />
              <span>
                Recommended for:{' '}
                {guide.recommendedStaffRoles
                  .map(r => STAFF_ROLE_LABELS[r as HelpStaffRole] || r)
                  .join(', ')}
              </span>
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-text">
            {guide.title}
          </h1>
          <p className="text-text-secondary text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
            {guide.description}
          </p>
        </div>
      </header>

      {/* 3. Guide Main Grid (Article + Table of Contents) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Mobile TOC (Collapsed by default) */}
        <div className="lg:hidden col-span-1">
          <MobileTOC items={toc} />
        </div>

        {/* Main Article Content */}
        <article className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 lg:p-10 shadow-xs">
            <MarkdownArticle content={content} guideTitle={guide.title} />
          </div>

          {/* Previous / Next Guide Navigation */}
          <nav
            aria-label="Previous and Next Guides"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4"
          >
            {navigation.prev ? (
              <Link
                href={`/dashboard/help/guides/${navigation.prev.slug}`}
                className="group p-4 rounded-xl border border-border bg-surface hover:border-accent/40 hover:bg-surface-elevated transition-all flex flex-col justify-between space-y-2"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted group-hover:text-accent transition-colors">
                  <ArrowLeft className="size-3.5 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
                  <span>Previous Guide</span>
                </span>
                <span className="text-sm font-bold text-text group-hover:text-accent transition-colors line-clamp-2">
                  {navigation.prev.title}
                </span>
                <span className="text-xs text-text-muted">
                  {navigation.prev.readingTimeMinutes}m read
                </span>
              </Link>
            ) : (
              <div aria-hidden="true" />
            )}

            {navigation.next && (
              <Link
                href={`/dashboard/help/guides/${navigation.next.slug}`}
                className="group p-4 rounded-xl border border-border bg-surface hover:border-accent/40 hover:bg-surface-elevated transition-all flex flex-col justify-between space-y-2 text-right sm:col-start-2"
              >
                <span className="inline-flex items-center justify-end gap-1.5 text-xs font-semibold text-text-muted group-hover:text-accent transition-colors">
                  <span>Next Guide</span>
                  <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold text-text group-hover:text-accent transition-colors line-clamp-2">
                  {navigation.next.title}
                </span>
                <span className="text-xs text-text-muted">
                  {navigation.next.readingTimeMinutes}m read
                </span>
              </Link>
            )}
          </nav>

          {/* Return to Help Centre Link */}
          <div className="text-center pt-6">
            <Link
              href="/dashboard/help"
              className="inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>Return to Help &amp; Training Home</span>
            </Link>
          </div>
        </article>

        {/* Desktop Sticky Table of Contents */}
        {toc.length > 0 && (
          <aside
            aria-label="Table of contents"
            className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-20 space-y-3"
          >
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text pb-2 border-b border-border-subtle">
                <ListTree className="size-4 text-accent" aria-hidden="true" />
                <span>On this page</span>
              </div>
              <ul className="space-y-1.5 text-xs max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
                {toc.map(item => (
                  <li
                    key={item.id}
                    className={item.level === 3 ? 'pl-3' : 'font-medium'}
                  >
                    <a
                      href={`#${item.id}`}
                      className="text-text-secondary hover:text-accent hover:translate-x-0.5 transition-all block py-1"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Helper Card */}
            <div className="p-4 rounded-xl border border-dashed border-border bg-surface/50 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-text">
                <BookOpen className="size-4 text-accent" aria-hidden="true" />
                <span>Need assistance?</span>
              </div>
              <p className="text-text-muted leading-relaxed">
                Contact your centre administrator or check the Troubleshooting guides for common setup questions.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
