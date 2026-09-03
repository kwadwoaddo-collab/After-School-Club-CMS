import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAllVideos } from '@/lib/help/get-help-content';
import { CMS_STAFF_ROLES, HelpStaffRole } from '@/lib/help/types';
import VideoLibraryView from './_components/VideoLibraryView';

export const metadata: Metadata = {
  title: 'Training Videos | Help & Training | SprintScale CMS',
  description:
    'Click-by-click walkthrough videos demonstrating daily operations, session bookings, roll call, invoicing, and administration.',
};

export default async function VideosPage() {
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

  // 4. Fetch all 52 certified training videos
  const videos = getAllVideos();

  return <VideoLibraryView videos={videos} userRole={userRole} />;
}
