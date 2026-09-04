import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireTenantSession } from '@/lib/session';
import {
  getAllLearningPaths,
  getGuideBySlug,
  getLearningPathBySlug,
  getLearningPathNavigation,
  getVideoBySlug,
} from '@/lib/help/get-help-content';
import { CMS_STAFF_ROLES, HelpStaffRole, STAFF_ROLE_LABELS } from '@/lib/help/types';
import LearningPathDetailView from './_components/LearningPathDetailView';

interface LearningPathPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const paths = getAllLearningPaths();
  return paths.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: LearningPathPageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = getLearningPathBySlug(slug);

  if (!path) {
    return {
      title: 'Learning Path Not Found | SprintScale CMS',
    };
  }

  return {
    title: `${path.title} | Learning Paths | SprintScale CMS`,
    description: path.description,
  };
}

export default async function LearningPathDetailPage({ params }: LearningPathPageProps) {
  const session = await requireTenantSession();

  // 1. Enforce authenticated dashboard boundary
  if (!session?.user) {
    return redirect('/login');
  }

  // 2. Enforce completed onboarding
  const user = session.user as { role?: string; organisationId?: string };
  const organisationId = user.organisationId;
  if (!organisationId) {
    return redirect('/onboarding');
  }

  // 3. Resolve authenticated staff role
  const rawRole = (user.role || 'TUTOR').toUpperCase();
  const userRole: HelpStaffRole = (
    CMS_STAFF_ROLES.includes(rawRole as HelpStaffRole) ? rawRole : 'TUTOR'
  ) as HelpStaffRole;

  const roleLabel = STAFF_ROLE_LABELS[userRole] ?? 'Staff Member';

  // 4. Resolve learning path slug
  const { slug } = await params;
  const path = getLearningPathBySlug(slug);

  if (!path) {
    notFound();
  }

  // 5. Resolve navigation & items
  const { prev, next } = getLearningPathNavigation(slug);

  const resolvedSections = path.sections.map(sec => {
    const items = sec.items.map(it => {
      if (it.type === 'guide') {
        const guideData = getGuideBySlug(it.slug);
        return {
          type: 'guide' as const,
          slug: it.slug,
          title: it.title || guideData?.meta.title || it.slug,
          description: it.description || guideData?.meta.description || '',
          note: it.note,
          readingTimeMinutes: guideData?.meta.readingTimeMinutes || 5,
          url: `/dashboard/help/guides/${it.slug}`,
        };
      } else {
        const videoData = getVideoBySlug(it.slug);
        return {
          type: 'video' as const,
          slug: it.slug,
          title: it.title || videoData?.title || it.slug,
          description: it.description || videoData?.description || '',
          note: it.note,
          durationLabel: videoData?.durationLabel || '60s',
          url: `/dashboard/help/videos/${it.slug}`,
        };
      }
    });

    return {
      id: sec.id,
      title: sec.title,
      description: sec.description,
      items,
    };
  });

  return (
    <LearningPathDetailView
      path={path}
      userRole={userRole}
      roleLabel={roleLabel}
      resolvedSections={resolvedSections}
      prevPath={prev}
      nextPath={next}
    />
  );
}
