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
  authorisedCollectors as authorisedCollectorsTable,
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { POST } from './route';

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

describe('PM-2E2.B1: Public Registration & CRM Data Protection Integration Suite', () => {
  const RUN_ID = `pm2e2b1_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
      throw new Error('[CRITICAL SAFETY] Neither AUTH_SECRET nor NEXTAUTH_SECRET is configured. Aborting integration tests.');
    }
    serverSecret = new TextEncoder().encode(rawSecret);
  });

  afterAll(async () => {
    // Strict Cleanup of all synthetic fixtures
    let cleanupError: unknown = null;
    try {
      if (createdOrgIds.length > 0) {
        await db.delete(authorisedCollectorsTable).where(inArray(authorisedCollectorsTable.organisationId, createdOrgIds));
        await db.delete(registrationChildren).where(
          inArray(
            registrationChildren.registrationId,
            db.select({ id: registrations.id }).from(registrations).where(inArray(registrations.organisationId, createdOrgIds))
          )
        );
        await db.delete(registrationParents).where(
          inArray(
            registrationParents.registrationId,
            db.select({ id: registrations.id }).from(registrations).where(inArray(registrations.organisationId, createdOrgIds))
          )
        );
        await db.delete(registrations).where(inArray(registrations.organisationId, createdOrgIds));
        await db.delete(children).where(inArray(children.organisationId, createdOrgIds));
        await db.delete(parents).where(inArray(parents.organisationId, createdOrgIds));
        await db.delete(centres).where(inArray(centres.organisationId, createdOrgIds));
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

  // Helper to create synthetic family
  async function createSyntheticFamily(
    orgId: string,
    centreId: string,
    parentEmail: string,
    childData: {
      firstName: string;
      lastName: string;
      medicalConditions?: string;
      allergies?: string[];
      photoConsent?: boolean;
    }
  ) {
    const [parent] = await db
      .insert(parents)
      .values({
        organisationId: orgId,
        firstName: 'AuthoritativeParent',
        lastName: `Parent_${RUN_ID}`,
        email: parentEmail,
        phone: '07111111111',
        preferredContact: 'email',
        addressLine1: '10 Authentic Way',
        city: 'London',
        postcode: 'SW1A 1AA',
      })
      .returning();
    createdParentIds.push(parent.id);

    const [child] = await db
      .insert(children)
      .values({
        organisationId: orgId,
        centreId,
        parentId: parent.id,
        firstName: childData.firstName,
        lastName: childData.lastName,
        isRegistered: true,
        schoolYear: 'Y2',
        medicalConditions: childData.medicalConditions ?? 'Severe Asthma',
        allergies: childData.allergies ?? ['Peanuts', 'Dairy'],
        photoConsent: childData.photoConsent ?? false,
        sunCreamConsent: false,
        firstAidConsent: true,
      })
      .returning();
    createdChildIds.push(child.id);

    const [collector] = await db
      .insert(authorisedCollectorsTable)
      .values({
        organisationId: orgId,
        childId: child.id,
        name: 'Grandma Jones',
        relationship: 'Grandmother',
        phone: '07999999999',
      })
      .returning();

    return { parent, child, collector };
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
  // TEST 1: ANONYMOUS CALLER CANNOT OVERWRITE EXISTING PARENT CRM DATA
  // =========================================================================
  it('Test 1: Anonymous registration matching existing parent email does NOT overwrite parent profile in DB', async () => {
    const { org, centre } = await createSyntheticTenant('p_immut');
    const parentEmail = `alice_${RUN_ID}@example.com`;
    const { parent } = await createSyntheticFamily(org.id, centre.id, parentEmail, {
      firstName: 'AliceChild',
      lastName: 'Smith',
    });

    // Anonymous attacker attempts to alter phone, address, name
    const res = await callRegisterRoute({
      orgSlug: org.slug,
      centreId: centre.id,
      parents: [{
        firstName: 'AttackerParent',
        lastName: 'Malicious',
        email: parentEmail,
        phone: '07000000666',
        addressLine1: '666 Hacker St',
        city: 'MaliceCity',
        postcode: 'XX1 1XX',
      }],
      children: [{
        firstName: 'AliceChild',
        lastName: 'Smith',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify canonical parent record in DB was NOT mutated
    const currentParent = await db.query.parents.findFirst({
      where: eq(parents.id, parent.id),
    });
    expect(currentParent).toBeDefined();
    expect(currentParent?.firstName).toBe('AuthoritativeParent');
    expect(currentParent?.lastName).toBe(`Parent_${RUN_ID}`);
    expect(currentParent?.phone).toBe('07111111111');
    expect(currentParent?.addressLine1).toBe('10 Authentic Way');
    expect(currentParent?.city).toBe('London');
    expect(currentParent?.postcode).toBe('SW1A 1AA');
  });

  // =========================================================================
  // TEST 2: ANONYMOUS CALLER CANNOT OVERWRITE EXISTING CHILD MEDICAL/SAFEGUARDING
  // =========================================================================
  it('Test 2: Anonymous registration matching existing child cannot overwrite medical conditions, allergies, consents, or authorised collectors', async () => {
    const { org, centre } = await createSyntheticTenant('c_immut');
    const parentEmail = `safeguard_${RUN_ID}@example.com`;
    const { child, collector } = await createSyntheticFamily(org.id, centre.id, parentEmail, {
      firstName: 'Bobby',
      lastName: 'Protect',
      medicalConditions: 'Epilepsy, Severe Asthma',
      allergies: ['Peanuts', 'Tree Nuts', 'Penicillin'],
      photoConsent: false,
    });

    // Anonymous attacker attempts to wipe allergies, change medical conditions, grant photo consent, and replace collectors
    const res = await callRegisterRoute({
      orgSlug: org.slug,
      centreId: centre.id,
      parents: [{
        firstName: 'AnyName',
        lastName: 'AnySurname',
        email: parentEmail,
      }],
      children: [{
        firstName: 'Bobby',
        lastName: 'Protect',
        medicalConditions: 'None / Cured',
        allergies: [],
        dietaryRequirements: 'Anything',
        photoConsent: true,
        sunCreamConsent: true,
      }],
      authorisedCollectors: [{
        name: 'Malicious Stranger',
        relationship: 'Unknown',
        phone: '07000000999',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify canonical child record in DB was NOT mutated
    const currentChild = await db.query.children.findFirst({
      where: eq(children.id, child.id),
    });
    expect(currentChild).toBeDefined();
    expect(currentChild?.medicalConditions).toBe('Epilepsy, Severe Asthma');
    expect(currentChild?.allergies).toEqual(['Peanuts', 'Tree Nuts', 'Penicillin']);
    expect(currentChild?.photoConsent).toBe(false);
    expect(currentChild?.sunCreamConsent).toBe(false);

    // Verify original authorised collectors were NOT deleted or replaced
    const currentCollectors = await db.query.authorisedCollectors.findMany({
      where: eq(authorisedCollectorsTable.childId, child.id),
    });
    expect(currentCollectors).toHaveLength(1);
    expect(currentCollectors[0].name).toBe('Grandma Jones');
    expect(currentCollectors[0].phone).toBe('07999999999');
  });

  // =========================================================================
  // TEST 3: CASING AND WHITESPACE VARIATIONS CANNOT BYPASS PROTECTION
  // =========================================================================
  it('Test 3: Changing case/whitespace in parent email matches existing parent without allowing mutation', async () => {
    const { org, centre } = await createSyntheticTenant('case_var');
    const canonicalEmail = `charlie_${RUN_ID}@example.com`;
    const { parent, child } = await createSyntheticFamily(org.id, centre.id, canonicalEmail, {
      firstName: 'CharlieJr',
      lastName: 'CaseTest',
      medicalConditions: 'Heart Condition',
    });

    // Attacker sends UPPERCASE and whitespace-padded email
    const noisyEmail = `   CHARLIE_${RUN_ID.toUpperCase()}@EXAMPLE.COM   `;
    const res = await callRegisterRoute({
      orgSlug: org.slug,
      centreId: centre.id,
      parents: [{
        firstName: 'MutatedName',
        lastName: 'MutatedSurname',
        email: noisyEmail,
        phone: '07999888777',
      }],
      children: [{
        firstName: '  charliejr  ',
        lastName: '  casetest  ',
        medicalConditions: 'No Issues',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify parent was matched and NOT overwritten
    const checkParent = await db.query.parents.findFirst({
      where: eq(parents.id, parent.id),
    });
    expect(checkParent?.firstName).toBe('AuthoritativeParent');
    expect(checkParent?.phone).toBe('07111111111');

    // Verify child was matched and NOT overwritten
    const checkChild = await db.query.children.findFirst({
      where: eq(children.id, child.id),
    });
    expect(checkChild?.medicalConditions).toBe('Heart Condition');
  });

  // =========================================================================
  // TEST 4: EXISTING FAMILY REGISTRATION STILL COMPLETES LEGITIMATELY
  // =========================================================================
  it('Test 4: Existing family registration creates registration record for staff review without 409 or CRM corruption', async () => {
    const { org, centre } = await createSyntheticTenant('legit_ret');
    const parentEmail = `returning_${RUN_ID}@example.com`;
    const { parent, child } = await createSyntheticFamily(org.id, centre.id, parentEmail, {
      firstName: 'Daisy',
      lastName: 'Returner',
    });

    const res = await callRegisterRoute({
      orgSlug: org.slug,
      centreId: centre.id,
      parents: [{
        firstName: 'AuthoritativeParent',
        lastName: `Parent_${RUN_ID}`,
        email: parentEmail,
        phone: '07111111111',
      }],
      children: [{
        firstName: 'Daisy',
        lastName: 'Returner',
        schoolYear: 'Y3',
        sessions: ['mon_am', 'wed_pm'],
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.registrationId).toBeDefined();

    // Verify registration and link tables were created with wasMatched: true
    const regParent = await db.query.registrationParents.findFirst({
      where: and(
        eq(registrationParents.registrationId, res.body.registrationId),
        eq(registrationParents.parentId, parent.id)
      ),
    });
    expect(regParent).toBeDefined();
    expect(regParent?.wasMatched).toBe(true);

    const regChild = await db.query.registrationChildren.findFirst({
      where: and(
        eq(registrationChildren.registrationId, res.body.registrationId),
        eq(registrationChildren.childId, child.id)
      ),
    });
    expect(regChild).toBeDefined();
    expect(regChild?.wasMatched).toBe(true);
  });

  // =========================================================================
  // TEST 5: VALID PREFILL TOKEN RETAINS AUTHORISED UPDATE CAPABILITY
  // =========================================================================
  it('Test 5: Valid signed prefill token authorizes controlled CRM update for verified parent and child', async () => {
    const { org, centre } = await createSyntheticTenant('token_auth');
    const parentEmail = `prefill_${RUN_ID}@example.com`;
    const { parent, child } = await createSyntheticFamily(org.id, centre.id, parentEmail, {
      firstName: 'Eli',
      lastName: 'TokenUser',
      medicalConditions: 'Mild Asthma',
      allergies: ['Pollen'],
    });

    const token = await generateToken({
      parentId: parent.id,
      centreId: centre.id,
      childIds: [child.id],
    });

    const res = await callRegisterRoute({
      orgSlug: org.slug,
      prefillToken: token,
      centreId: centre.id,
      parents: [{
        parentId: parent.id,
        firstName: 'AuthoritativeParent',
        lastName: `Parent_${RUN_ID}`,
        email: parentEmail,
        phone: '07222333444', // Authorized update
        addressLine1: '99 Updated Lane',
      }],
      children: [{
        childId: child.id,
        firstName: 'Eli',
        lastName: 'TokenUser',
        medicalConditions: 'Updated: Mild Asthma + Inhaler',
        allergies: ['Pollen', 'Dust'],
        photoConsent: true,
      }],
      authorisedCollectors: [{
        name: 'Authorised Aunt',
        relationship: 'Aunt',
        phone: '07888777666',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify authorized parent update took effect
    const updatedParent = await db.query.parents.findFirst({
      where: eq(parents.id, parent.id),
    });
    expect(updatedParent?.phone).toBe('07222333444');
    expect(updatedParent?.addressLine1).toBe('99 Updated Lane');

    // Verify authorized child update took effect
    const updatedChild = await db.query.children.findFirst({
      where: eq(children.id, child.id),
    });
    expect(updatedChild?.medicalConditions).toBe('Updated: Mild Asthma + Inhaler');
    expect(updatedChild?.allergies).toEqual(['Pollen', 'Dust']);
    expect(updatedChild?.photoConsent).toBe(true);

    // Verify authorised collectors were refreshed
    const updatedCollectors = await db.query.authorisedCollectors.findMany({
      where: eq(authorisedCollectorsTable.childId, child.id),
    });
    expect(updatedCollectors).toHaveLength(1);
    expect(updatedCollectors[0].name).toBe('Authorised Aunt');
  });

  // =========================================================================
  // TEST 6: INVALID / TAMPERED TOKEN DOES NOT GRANT MUTATION CAPABILITY
  // =========================================================================
  it('Test 6: Invalid/tampered/expired token is rejected with HTTP 400 fail-closed without DB mutation', async () => {
    const { org, centre } = await createSyntheticTenant('tamper_tok');
    const parentEmail = `tamper_${RUN_ID}@example.com`;
    const { parent, child } = await createSyntheticFamily(org.id, centre.id, parentEmail, {
      firstName: 'Frank',
      lastName: 'TamperTest',
      medicalConditions: 'Original Condition',
    });

    // Create token signed with a bogus secret
    const bogusSecret = new TextEncoder().encode('wrong-bogus-secret-key-32-chars-long!');
    const forgedToken = await new jose.SignJWT({
      parentId: parent.id,
      centreId: centre.id,
      childIds: [child.id],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(bogusSecret);

    const res = await callRegisterRoute({
      orgSlug: org.slug,
      prefillToken: forgedToken,
      centreId: centre.id,
      parents: [{
        parentId: parent.id,
        firstName: 'ForgedParent',
        lastName: 'ForgedSurname',
        email: parentEmail,
        phone: '07000000000',
      }],
      children: [{
        childId: child.id,
        firstName: 'Frank',
        lastName: 'TamperTest',
        medicalConditions: 'Forged Medical State',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid or expired registration token');

    // Verify DB remains untouched
    const checkParent = await db.query.parents.findFirst({
      where: eq(parents.id, parent.id),
    });
    expect(checkParent?.phone).toBe('07111111111');

    const checkChild = await db.query.children.findFirst({
      where: eq(children.id, child.id),
    });
    expect(checkChild?.medicalConditions).toBe('Original Condition');
  });

  // =========================================================================
  // TEST 7: CROSS-ORGANISATION MATCHING REMAINS IMPOSSIBLE
  // =========================================================================
  it('Test 7: Submitting registration in Org B with Org A parent email creates distinct Org B parent without accessing Org A records', async () => {
    const { org: orgA, centre: centreA } = await createSyntheticTenant('tenantA');
    const { org: orgB, centre: centreB } = await createSyntheticTenant('tenantB');

    const sharedEmail = `cross_${RUN_ID}@example.com`;
    const { parent: parentA, child: childA } = await createSyntheticFamily(orgA.id, centreA.id, sharedEmail, {
      firstName: 'Grace',
      lastName: 'OrgATest',
      medicalConditions: 'Org A Condition',
    });

    // Submit registration to Org B using Org A email
    const res = await callRegisterRoute({
      orgSlug: orgB.slug,
      centreId: centreB.id,
      parents: [{
        firstName: 'OrgBParent',
        lastName: 'Smith',
        email: sharedEmail,
        phone: '07444555666',
      }],
      children: [{
        firstName: 'Grace',
        lastName: 'OrgATest',
        medicalConditions: 'Org B Condition',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify Org A parent and child remain completely untouched
    const currentParentA = await db.query.parents.findFirst({
      where: eq(parents.id, parentA.id),
    });
    expect(currentParentA?.organisationId).toBe(orgA.id);
    expect(currentParentA?.phone).toBe('07111111111');

    const currentChildA = await db.query.children.findFirst({
      where: eq(children.id, childA.id),
    });
    expect(currentChildA?.medicalConditions).toBe('Org A Condition');

    // Verify a distinct parent was created for Org B
    const parentsInOrgB = await db.query.parents.findMany({
      where: and(
        eq(parents.email, sharedEmail),
        eq(parents.organisationId, orgB.id)
      ),
    });
    expect(parentsInOrgB).toHaveLength(1);
    expect(parentsInOrgB[0].id).not.toBe(parentA.id);
    createdParentIds.push(parentsInOrgB[0].id);

    const childrenInOrgB = await db.query.children.findMany({
      where: eq(children.parentId, parentsInOrgB[0].id),
    });
    expect(childrenInOrgB).toHaveLength(1);
    createdChildIds.push(childrenInOrgB[0].id);
  });

  // =========================================================================
  // TEST 8: SIBLING / MULTI-CHILD BEHAVIOUR REMAINS CORRECT
  // =========================================================================
  it('Test 8: Existing parent registering a new sibling creates the new child without mutating the existing child or parent', async () => {
    const { org, centre } = await createSyntheticTenant('sibling');
    const parentEmail = `sibling_parent_${RUN_ID}@example.com`;
    const { parent, child: firstChild } = await createSyntheticFamily(org.id, centre.id, parentEmail, {
      firstName: 'Harry',
      lastName: 'Potter',
      medicalConditions: 'Scar',
      allergies: ['Magic'],
    });

    // Parent registers a NEW sibling "Ginny Potter" anonymously
    const res = await callRegisterRoute({
      orgSlug: org.slug,
      centreId: centre.id,
      parents: [{
        firstName: 'AuthoritativeParent',
        lastName: `Parent_${RUN_ID}`,
        email: parentEmail,
      }],
      children: [{
        firstName: 'Ginny',
        lastName: 'Potter',
        medicalConditions: 'None',
        allergies: ['None'],
        schoolYear: 'Reception',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify existing child was NOT modified
    const currentFirstChild = await db.query.children.findFirst({
      where: eq(children.id, firstChild.id),
    });
    expect(currentFirstChild?.medicalConditions).toBe('Scar');
    expect(currentFirstChild?.allergies).toEqual(['Magic']);

    // Verify new sibling was created under the same parent
    const allParentChildren = await db.query.children.findMany({
      where: eq(children.parentId, parent.id),
    });
    expect(allParentChildren).toHaveLength(2);
    const sibling = allParentChildren.find(c => c.firstName === 'Ginny');
    expect(sibling).toBeDefined();
    expect(sibling?.lastName).toBe('Potter');
    expect(sibling?.schoolYear).toBe('Reception');
  });

  // =========================================================================
  // TEST 9: CONCURRENT / REPEATED SUBMISSIONS PREVENT DUPLICATES AND MUTATIONS
  // =========================================================================
  it('Test 9: Repeated identical submission for existing registered child is rejected as duplicate with HTTP 409', async () => {
    const { org, centre } = await createSyntheticTenant('dup_guard');
    const parentEmail = `dup_${RUN_ID}@example.com`;

    // Submission 1: completely new registration
    const res1 = await callRegisterRoute({
      orgSlug: org.slug,
      centreId: centre.id,
      parents: [{
        firstName: 'UniqueParent',
        lastName: 'Family',
        email: parentEmail,
      }],
      children: [{
        firstName: 'Isla',
        lastName: 'Family',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);

    // Submission 2: immediate replay for same email and child name
    const res2 = await callRegisterRoute({
      orgSlug: org.slug,
      centreId: centre.id,
      parents: [{
        firstName: 'UniqueParent',
        lastName: 'Family',
        email: parentEmail,
      }],
      children: [{
        firstName: 'Isla',
        lastName: 'Family',
      }],
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,sig',
    });

    expect(res2.status).toBe(409);
    expect(res2.body.duplicate).toBe(true);
    expect(res2.body.error).toContain('A registration for this child already exists');
  });
});
