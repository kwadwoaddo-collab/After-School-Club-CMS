import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.ALLOW_TRAINING_SEED = 'true';
process.env.TRAINING_ENVIRONMENT = 'oakridge';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as jose from 'jose';
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';
import { db } from '@/db';
import {
  organisations,
  centres,
  parents,
  children,
  registrations,
  registrationParents,
  registrationChildren,
} from '@/db/schema';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import { POST } from './route';
import { updateRegistrationStatus } from '@/app/dashboard/registrations/actions';

// Mock only external side effects so zero external communications escape
vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendRegistrationConfirmation: vi.fn().mockResolvedValue(undefined),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    sendRegistrationStatusUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/db-notifications', () => ({
  notifyOwners: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  apiRateLimit: {},
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock requireTenantSession for updateRegistrationStatus
const mockSessionUser = {
  id: 'synthetic-staff-id',
  role: 'ORG_OWNER',
  organisationId: '',
};

vi.mock('@/lib/session', () => ({
  requireTenantSession: vi.fn(async () => ({
    user: mockSessionUser,
  })),
  getApiSession: vi.fn(async () => ({
    user: mockSessionUser,
  })),
}));

describe('BUG-R1.F.R: Real Runtime & PostgreSQL Replay Certification Suite', () => {
  const RUN_ID = `r1fr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let trainingHost: string;
  let serverSecret: Uint8Array;

  // Track created IDs for strict guaranteed cleanup
  const createdOrgIds: string[] = [];
  const createdCentreIds: string[] = [];
  const createdParentIds: string[] = [];
  const createdChildIds: string[] = [];
  const createdRegIds: string[] = [];

  beforeAll(async () => {
    // 1. Safety Guard Verification
    const guard = assertSafeTrainingEnvironment();
    trainingHost = guard.host;
    expect(trainingHost).toBe('ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech');

    const rawSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!rawSecret) {
      throw new Error('[CRITICAL SAFETY] Neither AUTH_SECRET nor NEXTAUTH_SECRET is configured. Aborting integration certification.');
    }
    serverSecret = new TextEncoder().encode(rawSecret);
  });

  afterAll(async () => {
    // Strict Cleanup of all synthetic fixtures
    let cleanupError: unknown = null;
    try {
      if (createdRegIds.length > 0) {
        await db.delete(registrationChildren).where(inArray(registrationChildren.registrationId, createdRegIds));
        await db.delete(registrationParents).where(inArray(registrationParents.registrationId, createdRegIds));
        await db.delete(registrations).where(inArray(registrations.id, createdRegIds));
      }
      if (createdChildIds.length > 0) {
        await db.delete(children).where(inArray(children.id, createdChildIds));
      }
      if (createdParentIds.length > 0) {
        await db.delete(parents).where(inArray(parents.id, createdParentIds));
      }
      if (createdCentreIds.length > 0) {
        await db.delete(centres).where(inArray(centres.id, createdCentreIds));
      }
      if (createdOrgIds.length > 0) {
        await db.delete(organisations).where(inArray(organisations.id, createdOrgIds));
      }
    } catch (err) {
      cleanupError = err;
      console.error('Error during test cleanup:', err);
    }

    // Verify 0 synthetic rows remain
    if (createdOrgIds.length > 0) {
      const remainingOrgs = await db
        .select({ id: organisations.id })
        .from(organisations)
        .where(inArray(organisations.id, createdOrgIds));
      expect(remainingOrgs).toHaveLength(0);
    }
    if (cleanupError) {
      throw new Error(`[CRITICAL] Cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
    }
  });

  // Helper to create synthetic organisation and centre
  async function createSyntheticTenant(prefix: string) {
    const slug = `${RUN_ID}_${prefix}_${Math.random().toString(36).substring(2, 6)}`;
    const [org] = await db
      .insert(organisations)
      .values({
        name: `Synthetic Org ${slug}`,
        slug,
      })
      .returning();
    createdOrgIds.push(org.id);

    const [centre] = await db
      .insert(centres)
      .values({
        organisationId: org.id,
        name: `Synthetic Centre ${slug}`,
        slug: `centre_${slug}`,
      })
      .returning();
    createdCentreIds.push(centre.id);

    return { org, centre };
  }

  // Helper to create synthetic parent and child
  async function createSyntheticFamily(
    orgId: string,
    centreId: string,
    childNames: Array<{ first: string; last: string }>,
    parentEmail: string | null = null
  ) {
    const [parent] = await db
      .insert(parents)
      .values({
        organisationId: orgId,
        firstName: 'CanaryParent',
        lastName: `Synthetic_${RUN_ID}`,
        email: parentEmail,
        phone: '07123456789',
        preferredContact: 'phone',
      })
      .returning();
    createdParentIds.push(parent.id);

    const createdChildren = [];
    for (const c of childNames) {
      const [child] = await db
        .insert(children)
        .values({
          organisationId: orgId,
          centreId,
          parentId: parent.id,
          firstName: c.first,
          lastName: c.last,
          isRegistered: false,
          schoolYear: 'Y1',
        })
        .returning();
      createdChildIds.push(child.id);
      createdChildren.push(child);
    }

    return { parent, children: createdChildren };
  }

  // Helper to generate real signed JWT
  async function generateToken(payload: { parentId: string; centreId: string; childIds: string[] }) {
    return new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(serverSecret);
  }

  // Helper to call real POST handler
  async function callRegisterRoute(body: any) {
    const req = new Request('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await POST(req as any);
    const json = await res.json().catch(() => ({}));
    if (json.registrationId) {
      createdRegIds.push(json.registrationId);
    }
    return { status: res.status, body: json };
  }

  // =========================================================================
  // TEST 1: REAL DEFECT REPRODUCTION — SEQUENTIAL REPLAY ACROSS MUTABLE EMAIL
  // =========================================================================
  it('1. Real Defect Reproduction: sequential replay with null email -> populated email rejected with HTTP 409', async () => {
    const { org, centre } = await createSyntheticTenant('seq');
    const { parent, children: [child] } = await createSyntheticFamily(
      org.id,
      centre.id,
      [{ first: 'Penelope', last: 'Canary' }],
      null
    );

    const token = await generateToken({
      parentId: parent.id,
      centreId: centre.id,
      childIds: [child.id],
    });

    // Submission A (Penelope Canary initial production state: null email)
    const subA = await callRegisterRoute({
      orgSlug: org.slug,
      prefillToken: token,
      centreId: centre.id,
      children: [{ childId: child.id, firstName: 'Penelope', lastName: 'Canary' }],
      parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic', email: null }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sample',
    });

    expect(subA.status).toBe(201);
    expect(subA.body.success).toBe(true);

    // Submission B (The exact production defect sequence: SAME token, SAME child, but parent adds synthetic email)
    const subB = await callRegisterRoute({
      orgSlug: org.slug,
      prefillToken: token,
      centreId: centre.id,
      children: [{ childId: child.id, firstName: 'Penelope', lastName: 'Canary' }],
      parents: [
        {
          firstName: 'CanaryParent',
          lastName: 'Synthetic',
          email: `canary.${RUN_ID}.replay@example.test`,
        },
      ],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sample',
    });

    expect(subB.status).toBe(409);
    expect(subB.body.error).toContain('A registration for this child already exists');

    // Query REAL PostgreSQL: exactly 1 registration, 1 parent row, 1 child row
    const dbRegs = await db
      .select({ id: registrations.id })
      .from(registrations)
      .where(eq(registrations.organisationId, org.id));
    expect(dbRegs).toHaveLength(1);

    const dbRegChildren = await db
      .select({ id: registrationChildren.id, childId: registrationChildren.childId })
      .from(registrationChildren)
      .where(eq(registrationChildren.registrationId, subA.body.registrationId));
    expect(dbRegChildren).toHaveLength(1);
    expect(dbRegChildren[0].childId).toBe(child.id);
  });

  // =========================================================================
  // TEST 2: REAL POSTGRESQL CONCURRENCY TEST (MANDATORY PRINCIPAL GATE)
  // =========================================================================
  describe('2. Real PostgreSQL Concurrency Certification', () => {
    it('Case C1: Concurrent identical replay creates exactly 1 registration on PostgreSQL', async () => {
      const { org, centre } = await createSyntheticTenant('c1');
      const { parent, children: [child] } = await createSyntheticFamily(
        org.id,
        centre.id,
        [{ first: 'ConcurA', last: 'Child' }],
        `concur1.${RUN_ID}@example.test`
      );

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child.id],
      });

      const payload = {
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ childId: child.id, firstName: 'ConcurA', lastName: 'Child' }],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic', email: `concur1.${RUN_ID}@example.test` }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      };

      // Execute concurrently on separate DB transactions
      const [res1, res2] = await Promise.all([
        callRegisterRoute(payload),
        callRegisterRoute(payload),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Query REAL PostgreSQL
      const dbRegs = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(eq(registrations.organisationId, org.id));
      expect(dbRegs).toHaveLength(1);

      const dbRegChildren = await db
        .select({ id: registrationChildren.id })
        .from(registrationChildren)
        .where(eq(registrationChildren.registrationId, dbRegs[0].id));
      expect(dbRegChildren).toHaveLength(1);
    });

    it('Case C2: Concurrent changed-email replay creates exactly 1 registration on PostgreSQL', async () => {
      const { org, centre } = await createSyntheticTenant('c2');
      const { parent, children: [child] } = await createSyntheticFamily(
        org.id,
        centre.id,
        [{ first: 'ConcurB', last: 'Child' }],
        null
      );

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child.id],
      });

      const payloadA = {
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ childId: child.id, firstName: 'ConcurB', lastName: 'Child' }],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic', email: null }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      };

      const payloadB = {
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ childId: child.id, firstName: 'ConcurB', lastName: 'Child' }],
        parents: [
          {
            firstName: 'CanaryParent',
            lastName: 'Synthetic',
            email: `concurrent.changed.${RUN_ID}@example.test`,
          },
        ],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      };

      // Competing concurrent requests differing only by mutable email
      const [res1, res2] = await Promise.all([
        callRegisterRoute(payloadA),
        callRegisterRoute(payloadB),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Query REAL PostgreSQL
      const dbRegs = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(eq(registrations.organisationId, org.id));
      expect(dbRegs).toHaveLength(1);
    });
  });

  // =========================================================================
  // TEST 3: REAL TRUST-BOUNDARY GATES & INJECTION ATTACK PROOFS
  // =========================================================================
  describe('3. Real Trust-Boundary & Child-ID Injection Verification', () => {
    it('T1: Token with nonexistent parent rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t1');
      const token = await generateToken({
        parentId: '00000000-0000-0000-0000-000000000000',
        centreId: centre.id,
        childIds: [],
      });

      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        children: [{ firstName: 'Test', lastName: 'Child' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Parent record not found');
    });

    it('T2: Child belonging to another parent rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t2');
      const { parent: parent1 } = await createSyntheticFamily(org.id, centre.id, [{ first: 'P1', last: 'Child' }]);
      const { children: [childOfParent2] } = await createSyntheticFamily(org.id, centre.id, [{ first: 'P2', last: 'Child' }]);

      // Token claims parent1, but specifies child belonging to parent2
      const token = await generateToken({
        parentId: parent1.id,
        centreId: centre.id,
        childIds: [childOfParent2.id],
      });

      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ childId: childOfParent2.id, firstName: 'P2', lastName: 'Child' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Child record not found for this organisation');
    });

    it('T3: Child belonging to another organisation rejected with HTTP 400', async () => {
      const { org: org1, centre: centre1 } = await createSyntheticTenant('t3_org1');
      const { org: org2, centre: centre2 } = await createSyntheticTenant('t3_org2');
      const { parent: parent1 } = await createSyntheticFamily(org1.id, centre1.id, [{ first: 'Org1', last: 'Child' }]);
      const { children: [childOrg2] } = await createSyntheticFamily(org2.id, centre2.id, [{ first: 'Org2', last: 'Child' }]);

      const token = await generateToken({
        parentId: parent1.id,
        centreId: centre1.id,
        childIds: [childOrg2.id],
      });

      const res = await callRegisterRoute({
        orgSlug: org1.slug,
        prefillToken: token,
        centreId: centre1.id,
        children: [{ childId: childOrg2.id, firstName: 'Org2', lastName: 'Child' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Child record not found for this organisation');
    });

    it('T4: Soft-deleted child rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t4');
      const { parent, children: [child] } = await createSyntheticFamily(org.id, centre.id, [{ first: 'Deleted', last: 'Child' }]);

      // Mark child soft-deleted
      await db.update(children).set({ deletedAt: new Date() }).where(eq(children.id, child.id));

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child.id],
      });

      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ childId: child.id, firstName: 'Deleted', lastName: 'Child' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Child record not found for this organisation');
    });

    it('T5: Submitted centre conflicts with signed centre rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t5');
      const [centre2] = await db
        .insert(centres)
        .values({
          organisationId: org.id,
          name: `Synthetic Centre 2 ${RUN_ID}`,
          slug: `centre2_${RUN_ID}`,
        })
        .returning();
      createdCentreIds.push(centre2.id);

      const { parent, children: [child] } = await createSyntheticFamily(org.id, centre.id, [{ first: 'T5', last: 'Child' }]);

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child.id],
      });

      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre2.id, // Conflict!
        children: [{ childId: child.id, firstName: 'T5', lastName: 'Child' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('does not match registration invitation');
    });

    it('T6 & Section 13 Critic Issue: Missing childId attack rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t6_miss');
      const { parent, children: [child] } = await createSyntheticFamily(org.id, centre.id, [{ first: 'Real', last: 'Child' }]);

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child.id],
      });

      // Attacker passes signed token for child X, but OMITS childId to try to spawn an un-signed child
      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ firstName: 'InjectedUnsigned', lastName: 'Person' }], // missing childId!
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unrelated child injection detected');
    });

    it('T7 & Section 13 Critic Issue: Mixed signed and unsigned child attack rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t7_mix');
      const { parent, children: [child1, child2] } = await createSyntheticFamily(org.id, centre.id, [
        { first: 'Child1', last: 'Family' },
        { first: 'Child2', last: 'Family' },
      ]);

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child1.id, child2.id],
      });

      // Submits Child1 with ID, but Child2 without ID
      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [
          { childId: child1.id, firstName: 'Child1', lastName: 'Family' },
          { firstName: 'UnsignedChild', lastName: 'Family' }, // missing childId!
        ],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unrelated child injection detected');
    });

    it('T8: Malformed JWT rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t8');
      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: 'garbage.not.a.token',
        centreId: centre.id,
        children: [{ firstName: 'C', lastName: 'L' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid or expired registration token');
    });

    it('T9: Expired JWT rejected with HTTP 400', async () => {
      const { org, centre } = await createSyntheticTenant('t9');
      const { parent, children: [child] } = await createSyntheticFamily(org.id, centre.id, [{ first: 'C', last: 'L' }]);

      const expiredToken = await new jose.SignJWT({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child.id],
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('-1h')
        .sign(serverSecret);

      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: expiredToken,
        centreId: centre.id,
        children: [{ childId: child.id, firstName: 'C', lastName: 'L' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid or expired registration token');
    });

    it('T10: Token with nonexistent centre ID rejected with HTTP 400', async () => {
      const { org } = await createSyntheticTenant('t10');
      const token = await generateToken({
        parentId: '00000000-0000-0000-0000-000000000000',
        centreId: '11111111-1111-1111-1111-111111111111',
        childIds: [],
      });

      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        children: [{ firstName: 'C', lastName: 'L' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
    });

    it('T11: Token with cross-tenant centre ID rejected with HTTP 400', async () => {
      const { org: org1 } = await createSyntheticTenant('t11_org1');
      const { org: org2, centre: centre2 } = await createSyntheticTenant('t11_org2');
      const { parent, children: [child] } = await createSyntheticFamily(org1.id, centre2.id, [{ first: 'C', last: 'L' }]);

      // Token for Org1 specifies centre2 which belongs to Org2
      const token = await generateToken({
        parentId: parent.id,
        centreId: centre2.id,
        childIds: [child.id],
      });

      const res = await callRegisterRoute({
        orgSlug: org1.slug,
        prefillToken: token,
        children: [{ childId: child.id, firstName: 'C', lastName: 'L' }],
        parents: [{ firstName: 'P', lastName: 'L' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid centre: does not belong to this organisation');
    });
  });

  // =========================================================================
  // TEST 4: REAL SIBLING & MULTI-CHILD SEMANTICS
  // =========================================================================
  describe('4. Real Sibling & Multi-Child Semantics', () => {
    it('Sibling Registrations: Same parent registering genuinely different children succeeds', async () => {
      const { org, centre } = await createSyntheticTenant('sib');
      const { parent, children: [childX, childY] } = await createSyntheticFamily(org.id, centre.id, [
        { first: 'ChildX', last: 'Sibling' },
        { first: 'ChildY', last: 'Sibling' },
      ]);

      const tokenX = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [childX.id],
      });

      const tokenY = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [childY.id],
      });

      // Submit Child X
      const resX = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: tokenX,
        centreId: centre.id,
        children: [{ childId: childX.id, firstName: 'ChildX', lastName: 'Sibling' }],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });
      expect(resX.status).toBe(201);

      // Submit Child Y (Legitimate Sibling)
      const resY = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: tokenY,
        centreId: centre.id,
        children: [{ childId: childY.id, firstName: 'ChildY', lastName: 'Sibling' }],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });
      expect(resY.status).toBe(201);

      // Query PostgreSQL: exactly 2 registrations, 1 child X, 1 child Y
      const dbRegs = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(eq(registrations.organisationId, org.id));
      expect(dbRegs).toHaveLength(2);
    });

    it('Multi-Child: 3 siblings registered in 1 submission, replay rejected with 409', async () => {
      const { org, centre } = await createSyntheticTenant('multi');
      const { parent, children: [childA, childB, childC] } = await createSyntheticFamily(org.id, centre.id, [
        { first: 'ChildA', last: 'Trio' },
        { first: 'ChildB', last: 'Trio' },
        { first: 'ChildC', last: 'Trio' },
      ]);

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [childA.id, childB.id, childC.id],
      });

      const payload = {
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [
          { childId: childA.id, firstName: 'ChildA', lastName: 'Trio' },
          { childId: childB.id, firstName: 'ChildB', lastName: 'Trio' },
          { childId: childC.id, firstName: 'ChildC', lastName: 'Trio' },
        ],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic', email: null }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      };

      // First submission
      const sub1 = await callRegisterRoute(payload);
      expect(sub1.status).toBe(201);

      // Replay with changed email
      const replay = await callRegisterRoute({
        ...payload,
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic', email: `new.${RUN_ID}@example.test` }],
      });
      expect(replay.status).toBe(409);

      // PostgreSQL check: exactly 1 registration with 3 registration_children
      const dbRegChildren = await db
        .select({ id: registrationChildren.id, childId: registrationChildren.childId })
        .from(registrationChildren)
        .where(eq(registrationChildren.registrationId, sub1.body.registrationId));
      expect(dbRegChildren).toHaveLength(3);
    });

    it('Partial Child Selection: Submitting a subset of signed children succeeds', async () => {
      const { org, centre } = await createSyntheticTenant('partial');
      const { parent, children: [child1, child2] } = await createSyntheticFamily(org.id, centre.id, [
        { first: 'Part1', last: 'Family' },
        { first: 'Part2', last: 'Family' },
      ]);

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child1.id, child2.id],
      });

      // Token has [child1, child2], but caller registers only child1
      const res = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ childId: child1.id, firstName: 'Part1', lastName: 'Family' }],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const dbRegChildren = await db
        .select({ id: registrationChildren.id, childId: registrationChildren.childId })
        .from(registrationChildren)
        .where(eq(registrationChildren.registrationId, res.body.registrationId));
      expect(dbRegChildren).toHaveLength(1);
      expect(dbRegChildren[0].childId).toBe(child1.id);
    });

    it('Multi-Child Deadlock & Race Resistance: Concurrent 3-child submissions complete without deadlock', async () => {
      const { org, centre } = await createSyntheticTenant('deadlock_test');
      const { parent, children: [child1, child2, child3] } = await createSyntheticFamily(org.id, centre.id, [
        { first: 'D1', last: 'Race' },
        { first: 'D2', last: 'Race' },
        { first: 'D3', last: 'Race' },
      ]);

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child1.id, child2.id, child3.id],
      });

      const payload = {
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [
          { childId: child1.id, firstName: 'D1', lastName: 'Race' },
          { childId: child2.id, firstName: 'D2', lastName: 'Race' },
          { childId: child3.id, firstName: 'D3', lastName: 'Race' },
        ],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      };

      // Competing requests for 3 children
      const [res1, res2] = await Promise.all([
        callRegisterRoute(payload),
        callRegisterRoute(payload),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const dbRegs = await db
        .select({ id: registrations.id })
        .from(registrations)
        .where(eq(registrations.organisationId, org.id));
      expect(dbRegs).toHaveLength(1);
    });
  });

  // =========================================================================
  // TEST 5: REAL STUDENT ACTIVATION LIFECYCLE (SECTION 18)
  // =========================================================================
  describe('5. Real Student Activation Lifecycle on PostgreSQL', () => {
    it('Child isRegistered remains false on registration submission, and transitions to true upon staff signed_up', async () => {
      const { org, centre } = await createSyntheticTenant('active');
      const { parent, children: [child] } = await createSyntheticFamily(org.id, centre.id, [
        { first: 'Student', last: 'Lifecycle' },
      ]);

      const token = await generateToken({
        parentId: parent.id,
        centreId: centre.id,
        childIds: [child.id],
      });

      const sub = await callRegisterRoute({
        orgSlug: org.slug,
        prefillToken: token,
        centreId: centre.id,
        children: [{ childId: child.id, firstName: 'Student', lastName: 'Lifecycle' }],
        parents: [{ firstName: 'CanaryParent', lastName: 'Synthetic' }],
        termsAgreed: true,
        parentSignature: 'data:image/png;base64,sample',
      });
      expect(sub.status).toBe(201);
      const regId = sub.body.registrationId;

      // 1. Verify child in PostgreSQL has isRegistered = false
      const [childBefore] = await db
        .select({ isRegistered: children.isRegistered, registeredAt: children.registeredAt })
        .from(children)
        .where(eq(children.id, child.id));
      expect(childBefore.isRegistered).toBe(false);
      expect(childBefore.registeredAt).toBeNull();

      // 2. Staff executes updateRegistrationStatus to 'signed_up'
      mockSessionUser.organisationId = org.id;
      const transitionResult = await updateRegistrationStatus(regId, 'signed_up');
      expect(transitionResult.success).toBe(true);

      // 3. Verify child in PostgreSQL transitioned to isRegistered = true with registeredAt set
      const [childAfter] = await db
        .select({ isRegistered: children.isRegistered, registeredAt: children.registeredAt })
        .from(children)
        .where(eq(children.id, child.id));
      expect(childAfter.isRegistered).toBe(true);
      expect(childAfter.registeredAt).toBeInstanceOf(Date);
    });
  });
});
