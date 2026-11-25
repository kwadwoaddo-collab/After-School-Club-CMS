/**
 * PM-1.2 — Platform Admin Shell Layout
 *
 * Guards all /platform/* routes with requirePlatformAdmin().
 * Does NOT require tenant membership, organisation, or org ACTIVE status.
 */

import { requirePlatformAdmin } from '@/lib/org-approval-guard';
import Link from 'next/link';

export const metadata = {
  title: 'Platform Administration',
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-[#05070A]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2.5 focus:rounded-md focus:bg-[var(--if-accent)] focus:text-[var(--if-on-accent)] focus:text-sm focus:font-semibold focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--if-accent)]"
      >
        Skip to main content
      </a>
      <nav aria-label="Platform administration" className="border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-sm px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-xs font-bold tracking-widest text-white/70 uppercase">
              SprintScale
            </span>
            <span className="text-white/20" aria-hidden="true">|</span>
            <span className="text-xs font-semibold text-teal-300 tracking-wide uppercase">
              Platform Admin
            </span>
            <div className="flex items-center gap-1">
              <Link
                href="/platform/organisations"
                id="platform-nav-organisations"
                className="min-h-11 inline-flex items-center text-sm text-white/75 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
              >
                Organisations
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-white/70">{email}</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
              PLATFORM ADMIN
            </span>
          </div>
        </div>
      </nav>
      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 py-8 outline-none">
        {children}
      </main>
    </div>
  );
}
