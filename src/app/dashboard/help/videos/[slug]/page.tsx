import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  getAllVideos,
  getVideoBySlug,
  getVideoNavigation,
  getAllGuides,
} from '@/lib/help/get-help-content';
import VideoPlayerView from './_components/VideoPlayerView';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const videos = getAllVideos();
  return videos.map(video => ({
    slug: video.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const video = getVideoBySlug(slug);

  if (!video) {
    return {
      title: 'Video Not Found | Help & Training | SprintScale CMS',
    };
  }

  return {
    title: `${video.title} | Training Videos | SprintScale CMS`,
    description: video.description,
  };
}

export default async function VideoPlaybackPage({ params }: PageProps) {
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

  // 3. Resolve slug strictly against manifest
  const { slug } = await params;
  const video = getVideoBySlug(slug);
  if (!video) {
    notFound();
  }

  // 4. Resolve category-local previous/next navigation
  const navigation = getVideoNavigation(slug);

  // 5. Resolve related written guides
  const allGuides = getAllGuides();
  const relatedGuides = allGuides.filter(g =>
    video.relatedGuideSlugs.includes(g.slug) || video.targetGuideSlug === g.slug
  );

  return (
    <VideoPlayerView
      video={video}
      relatedGuides={relatedGuides}
      navigation={navigation}
    />
  );
}
