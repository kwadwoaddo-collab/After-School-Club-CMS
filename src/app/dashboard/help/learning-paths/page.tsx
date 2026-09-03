import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getAllLearningPaths,
  getLearningPathForRole,
} from '@/lib/help/get-help-content';
import { CMS_STAFF_ROLES, HelpStaffRole, STAFF_ROLE_LABELS } from '@/lib/help/types';
import LearningPathsListView from './_components/LearningPathsListView';

export const metadata: Metadata = {
  title: 'Role Learning Paths | Help & Training | SprintScale CMS',
  description:
    'Curated role-based onboarding and operational training paths combining written guides and video walkthroughs.',
};

export default async function LearningPathsPage() {
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

  // 4. Fetch learning paths
  const paths = getAllLearningPaths();
  const recommendedPath = getLearningPathForRole(userRole);

  return (
    <LearningPathsListView
      userRole={userRole}
      roleLabel={roleLabel}
      paths={paths}
      recommendedPath={recommendedPath}
    />
  );
}
