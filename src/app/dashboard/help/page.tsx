import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getAllCategories,
  getAllGuides,
  getAllLearningPaths,
  getGuidesByCategory,
  getGuidesByRole,
  getLearningPathForRole,
} from '@/lib/help/get-help-content';

import { CMS_STAFF_ROLES, HelpStaffRole } from '@/lib/help/types';
import HelpHubView from './_components/HelpHubView';

export const metadata: Metadata = {
  title: 'Help & Training | SprintScale CMS',
  description:
    'Guides, walkthroughs and operational training resources for SprintScale after-school club management.',
};

const STAFF_ROLE_LABELS: Record<HelpStaffRole, string> = {
  ORG_OWNER: 'Organisation Owner',
  MANAGER: 'Centre Manager',
  FRONT_DESK: 'Front Desk',
  TUTOR: 'Tutor / Club Leader',
};

const COMMON_TASK_SLUGS = [
  'attendance-roll-call',
  'bookings-scheduling',
  'registrations-intake',
  'invoices-billing',
  'payments-reconciliation',
  'incidents-safeguarding',
];

export default async function HelpPage() {
  const session = await auth();

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

  // 4. Fetch manifest-derived category and guide data
  const allCategories = getAllCategories();
  const allGuides = getAllGuides();

  const categoriesWithGuides = allCategories.map(cat => ({
    ...cat,
    guides: getGuidesByCategory(cat.id),
  }));

  const recommendedGuides = getGuidesByRole(userRole);
  const recommendedPath = getLearningPathForRole(userRole);
  const allLearningPaths = getAllLearningPaths();

  const commonTaskGuides = COMMON_TASK_SLUGS.map(slug =>
    allGuides.find(g => g.slug === slug)
  ).filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <HelpHubView
      userRole={userRole}
      roleLabel={roleLabel}
      categories={categoriesWithGuides}
      recommendedGuides={recommendedGuides}
      commonTaskGuides={commonTaskGuides}
      totalGuideCount={allGuides.length}
      recommendedPath={recommendedPath}
      totalPathCount={allLearningPaths.length}
    />
  );
}
