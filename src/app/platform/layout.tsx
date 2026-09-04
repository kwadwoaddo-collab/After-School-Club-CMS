/**
 * PM-1.2 — Platform Admin Shell Layout
 *
 * Guards all /platform/* routes with requirePlatformAdmin().
 * Does NOT require tenant membership, organisation, or org ACTIVE status.
 */

import { requirePlatformAdmin } from '@/lib/org-approval-guard';
import Link from 'next/link';

export const metadata = {
  title: 'Platform Administration | SprintScale',
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This throws and redirects if not an allowlisted platform admin.
  // No tenant membership or org-active check is performed.
  const { email } = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-[#05070A]">
      {/* Platform admin nav */}
      <nav className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold tracking-widest text-white/30 uppercase">
              SprintScale
            </span>
            <span className="text-white/10">|</span>
            <span className="text-xs font-semibold text-indigo-400 tracking-wide uppercase">
              Platform Admin
            </span>
            <div className="flex items-center gap-1">
              <Link
                href="/platform/organisations"
                id="platform-nav-organisations"
                className="text-sm text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all"
              >
                Organisations
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/30">{email}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              PLATFORM ADMIN
            </span>
          </div>
        </div>
      </nav>
      {/* Page content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
