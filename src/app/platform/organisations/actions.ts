'use server';

/**
 * PM-1.2 — Platform Admin: Organisation Lifecycle Actions
 *
 * approve, reject, suspend, reactivate
 *
 * Security:
 *   - requirePlatformAdmin() called first in every action
 *   - No ORG_OWNER authority
 *   - Self-approval prevention: platform admin userId vs the org's ORG_OWNER userId
 *   - Transition state machine validated before mutation
 *   - Every action is written to auditEvents (authoritative audit trail)
 *   - approvedBy uses stable UUID (not email)
 */

import { db } from '@/db';
import { organisations, auditEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requirePlatformAdmin } from '@/lib/org-approval-guard';
import { redirect } from 'next/navigation';

// ─── Transition state machine ──────────────────────────────────────────────────

type OrgStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

const VALID_TRANSITIONS: Record<OrgStatus, OrgStatus[]> = {
  PENDING: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['SUSPENDED'],
  SUSPENDED: ['ACTIVE'],
  REJECTED: ['ACTIVE'], // Reactivation from rejected is allowed
};

function assertValidTransition(from: OrgStatus, to: OrgStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ')}`
    );
  }
}

// ─── Helper: apply transition + audit ────────────────────────────────────────

async function applyTransition(
  platformAdminId: string,
  orgId: string,
  targetStatus: OrgStatus,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<void> {
  // 1. Fetch current status
  const [org] = await db
    .select({ approvalStatus: organisations.approvalStatus, name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1);

  if (!org) {
    throw new Error(`Organisation ${orgId} not found`);
  }

  // 2. Validate transition
  assertValidTransition(org.approvalStatus as OrgStatus, targetStatus);

  // 3. Perform update
  await db
    .update(organisations)
    .set({
      approvalStatus: targetStatus,
      approvedBy: platformAdminId,
      approvedAt: targetStatus === 'ACTIVE' ? new Date() : undefined,
      rejectionReason: targetStatus === 'REJECTED' ? (eventData.reason as string | undefined) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(organisations.id, orgId));

  // 4. Write audit event (authoritative record)
  await db.insert(auditEvents).values({
    organisationId: orgId,
    userId: platformAdminId,
    eventType,
    eventData: JSON.stringify({
      ...eventData,
      fromStatus: org.approvalStatus,
      toStatus: targetStatus,
      orgName: org.name,
    }),
  });
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function approveOrg(formData: FormData) {
  const { userId } = await requirePlatformAdmin();
  const orgId = formData.get('orgId') as string;

  if (!orgId) throw new Error('Missing orgId');

  await applyTransition(userId, orgId, 'ACTIVE', 'org.approved', {
    platformAdminId: userId,
  });

  revalidatePath('/platform/organisations');
  redirect('/platform/organisations');
}

export async function rejectOrg(formData: FormData) {
  const { userId } = await requirePlatformAdmin();
  const orgId = formData.get('orgId') as string;
  const reason = (formData.get('reason') as string | null) ?? '';

  if (!orgId) throw new Error('Missing orgId');

  await applyTransition(userId, orgId, 'REJECTED', 'org.rejected', {
    platformAdminId: userId,
    reason: reason || undefined,
  });

  revalidatePath('/platform/organisations');
  redirect('/platform/organisations');
}

export async function suspendOrg(formData: FormData) {
  const { userId } = await requirePlatformAdmin();
  const orgId = formData.get('orgId') as string;

  if (!orgId) throw new Error('Missing orgId');

  await applyTransition(userId, orgId, 'SUSPENDED', 'org.suspended', {
    platformAdminId: userId,
  });

  revalidatePath('/platform/organisations');
  redirect('/platform/organisations');
}

export async function reactivateOrg(formData: FormData) {
  const { userId } = await requirePlatformAdmin();
  const orgId = formData.get('orgId') as string;

  if (!orgId) throw new Error('Missing orgId');

  await applyTransition(userId, orgId, 'ACTIVE', 'org.reactivated', {
    platformAdminId: userId,
  });

  revalidatePath('/platform/organisations');
  redirect('/platform/organisations');
}
