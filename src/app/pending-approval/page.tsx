/**
 * PM-1.2 — Organisation Lifecycle Status Page
 *
 * Handles PENDING, SUSPENDED, and REJECTED states with distinct messaging.
 *
 * Auth: requireAuthenticatedIdentity() — requires a valid session but does NOT
 * check or require ACTIVE organisation status (avoids redirect loops).
 *
 * Redirect matrix:
 *   Unauthenticated          → /login  (handled by requireAuthenticatedIdentity)
 *   No org                   → /onboarding
 *   ACTIVE org               → /dashboard (approved, shouldn't be here)
 *   PENDING org              → renders pending copy
 *   SUSPENDED org            → renders suspended copy
 *   REJECTED org             → renders rejected copy
 */

import { requireAuthenticatedIdentity } from '@/lib/session';
import { db } from '@/db';
import { organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth';
import OrgStatusClient from './_components/OrgStatusClient';

export const metadata = {
  title: 'Account Status | SprintScale',
  description: 'Your organisation account status with SprintScale.',
  robots: { index: false, follow: false },
};

export default async function PendingApprovalPage() {
  // Identity check only — no ACTIVE requirement
  const session = await requireAuthenticatedIdentity();

  if (!session.user.organisationId) {
    redirect('/onboarding');
  }

  // Read current status from DB (authoritative source — not JWT)
  const [org] = await db
    .select({
      approvalStatus: organisations.approvalStatus,
      name: organisations.name,
      rejectionReason: organisations.rejectionReason,
    })
    .from(organisations)
    .where(eq(organisations.id, session.user.organisationId))
    .limit(1);

  if (!org) {
    // Org was deleted — sign out and send to login
    redirect('/login');
  }

  // ACTIVE org should not be on this page — redirect to dashboard
  if (org.approvalStatus === 'ACTIVE') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#05070A] flex items-center justify-center px-4">
      <OrgStatusClient
        orgName={org.name}
        status={org.approvalStatus}
        rejectionReason={org.rejectionReason ?? undefined}
        userEmail={session.user.email}
      />
    </div>
  );
}
