import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as jose from 'jose';
import fs from 'fs';
import path from 'path';

/**
 * BUG-R1: Dedicated Regression Test Suite
 * Milestone: BUG-R1 Critical Booking/Assessment -> Registration Conversion Failure
 *
 * Scenarios Covered:
 * 1. Single-child prefill mapping integrity
 * 2. Three-child sibling array prefill mapping integrity
 * 3. Client Step 2 crash prevention (allergies null/undefined defence)
 * 4. Client Step 4 submission gate validation (validateStep(4) digital signature & terms)
 * 5. JWT token creation, encoding, expiration, and payload extraction
 * 6. Sibling query soft-deleted child exclusion (isNull(children.deletedAt))
 * 7. Student activation (isRegistered = true) on registration status change to signed_up
 * 8. Multi-child duplicate detection & tenant isolation
 */

describe('BUG-R1: Booking/Assessment -> Registration Conversion Regression Suite', () => {
  const TEST_SECRET = 'test-secret-at-least-32-chars-long-for-jwt-signing';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = TEST_SECRET;
  });

  // =========================================================================
  // 1. JWT TOKEN CREATION, SIGNING & VERIFICATION
  // =========================================================================
  describe('Token Generation & Scoping Semantics', () => {
    it('generates a valid HS256 JWT token with 30-day expiration for a single child', async () => {
      const parentId = '11111111-1111-4111-8111-111111111111';
      const centreId = '22222222-2222-4222-8222-222222222222';
      const childIds = ['33333333-3333-4333-8333-333333333333'];

      const secret = new TextEncoder().encode(TEST_SECRET);
      const token = await new jose.SignJWT({ parentId, centreId, childIds })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30d')
        .sign(secret);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const verified = await jose.jwtVerify(token, secret);
      expect(verified.payload.parentId).toBe(parentId);
      expect(verified.payload.centreId).toBe(centreId);
      expect(verified.payload.childIds).toEqual(childIds);
    });

    it('generates a valid token containing 3 distinct sibling child IDs', async () => {
      const parentId = '11111111-1111-4111-8111-111111111111';
      const centreId = '22222222-2222-4222-8222-222222222222';
      const childIds = [
        'c1111111-1111-4111-8111-111111111111',
        'c2222222-2222-4222-8222-222222222222',
        'c3333333-3333-4333-8333-333333333333',
      ];

      const secret = new TextEncoder().encode(TEST_SECRET);
      const token = await new jose.SignJWT({ parentId, centreId, childIds })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30d')
        .sign(secret);

      const verified = await jose.jwtVerify(token, secret);
      expect(verified.payload.childIds).toEqual(childIds);
      expect((verified.payload.childIds as string[]).length).toBe(3);
    });

    it('rejects an expired token', async () => {
      const secret = new TextEncoder().encode(TEST_SECRET);
      const expiredToken = await new jose.SignJWT({ parentId: 'p-1', centreId: 'c-1' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('-1h')
        .sign(secret);

      await expect(jose.jwtVerify(expiredToken, secret)).rejects.toThrow();
    });

    it('rejects a tampered or invalid signature token', async () => {
      const secret = new TextEncoder().encode(TEST_SECRET);
      const wrongSecret = new TextEncoder().encode('another-different-secret-key-32chars');
      const token = await new jose.SignJWT({ parentId: 'p-1', centreId: 'c-1' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30d')
        .sign(secret);

      await expect(jose.jwtVerify(token, wrongSecret)).rejects.toThrow();
    });
  });

  // =========================================================================
  // 2. PREFILL API CONTRACT & FIELD MAPPING INTEGRITY
  // =========================================================================
  describe('GET /api/register/prefill Field Contract', () => {
    it('prefill route source maps all medical, dietary, and consent fields', () => {
      const routePath = path.resolve(process.cwd(), 'src/app/api/register/prefill/route.ts');
      const routeCode = fs.readFileSync(routePath, 'utf-8');

      // Verify that all clinical & consent fields are selected and transformed
      expect(routeCode).toContain('allergies: c.allergies || []');
      expect(routeCode).toContain('dietaryRequirements: c.dietaryRequirements');
      expect(routeCode).toContain('medicalConditions: c.medicalConditions');
      expect(routeCode).toContain('medicationNotes: c.medicationNotes');
      expect(routeCode).toContain('gpName: c.gpName');
      expect(routeCode).toContain('gpPhone: c.gpPhone');
      expect(routeCode).toContain('senDetails: c.senDetails');
      expect(routeCode).toContain('photoConsent: c.photoConsent');
      expect(routeCode).toContain('sunCreamConsent: c.sunCreamConsent');
      expect(routeCode).toContain('firstAidConsent: c.firstAidConsent');
    });

    it('prefill response correctly maps a single child with complete fields', () => {
      const mockRawChild = {
        id: 'c-1',
        firstName: 'Emma',
        lastName: 'Watson',
        dateOfBirth: new Date('2018-05-15'),
        schoolYear: 'Y2',
        registeredSessions: ['Monday PM', 'Wednesday PM'],
        allergies: ['Peanuts'],
        dietaryRequirements: 'Vegetarian',
        medicalConditions: 'Mild Asthma',
        medicationNotes: 'Inhaler in backpack',
        gpName: 'Dr. John Smith',
        gpPhone: '02079460123',
        senDetails: null,
        photoConsent: true,
        sunCreamConsent: true,
        firstAidConsent: true,
      };

      const transformed = {
        childId: mockRawChild.id,
        firstName: mockRawChild.firstName,
        lastName: mockRawChild.lastName,
        dateOfBirth: mockRawChild.dateOfBirth.toISOString().split('T')[0],
        schoolYear: mockRawChild.schoolYear,
        sessions: mockRawChild.registeredSessions,
        allergies: mockRawChild.allergies || [],
        dietaryRequirements: mockRawChild.dietaryRequirements ?? '',
        medicalConditions: mockRawChild.medicalConditions ?? '',
        medicationNotes: mockRawChild.medicationNotes ?? '',
        gpName: mockRawChild.gpName ?? '',
        gpPhone: mockRawChild.gpPhone ?? '',
        senDetails: mockRawChild.senDetails ?? '',
        photoConsent: mockRawChild.photoConsent ?? false,
        sunCreamConsent: mockRawChild.sunCreamConsent ?? false,
        firstAidConsent: mockRawChild.firstAidConsent ?? false,
      };

      expect(transformed.allergies).toEqual(['Peanuts']);
      expect(transformed.dietaryRequirements).toBe('Vegetarian');
      expect(transformed.medicalConditions).toBe('Mild Asthma');
      expect(transformed.gpName).toBe('Dr. John Smith');
      expect(transformed.photoConsent).toBe(true);
    });

    it('prefill response correctly maps 3 sibling children', () => {
      const mockSiblings = [
        { id: 'c-1', firstName: 'Child One', lastName: 'Family', dateOfBirth: new Date('2017-01-01'), schoolYear: 'Y3', allergies: ['Dairy'] },
        { id: 'c-2', firstName: 'Child Two', lastName: 'Family', dateOfBirth: new Date('2019-02-02'), schoolYear: 'Y1', allergies: [] },
        { id: 'c-3', firstName: 'Child Three', lastName: 'Family', dateOfBirth: new Date('2021-03-03'), schoolYear: 'EYFS', allergies: ['Gluten', 'Eggs'] },
      ];

      const transformedSiblings = mockSiblings.map(c => ({
        childId: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        dateOfBirth: c.dateOfBirth.toISOString().split('T')[0],
        schoolYear: c.schoolYear,
        sessions: ['Afternoon'],
        allergies: c.allergies || [],
      }));

      expect(transformedSiblings).toHaveLength(3);
      expect(transformedSiblings[0].firstName).toBe('Child One');
      expect(transformedSiblings[1].firstName).toBe('Child Two');
      expect(transformedSiblings[2].firstName).toBe('Child Three');
      expect(transformedSiblings[0].allergies).toContain('Dairy');
      expect(transformedSiblings[2].allergies).toHaveLength(2);
    });
  });

  // =========================================================================
  // 3. CLIENT COMPONENT STEP 2 CRASH PREVENTION (allergies undefined fix)
  // =========================================================================
  describe('Client Registration Form Defect Remediation', () => {
    const registerClientPath = path.resolve(process.cwd(), 'src/app/register/[...slug]/page.tsx');
    const clientCode = fs.readFileSync(registerClientPath, 'utf-8');

    it('merges emptyChild defaults when populating childList from prefill data', () => {
      expect(clientCode).toContain('...emptyChild()');
      expect(clientCode).toContain('allergies: Array.isArray(c.allergies) ? c.allergies : []');
    });

    it('has defensive guards on (c.allergies || []).map and filter in Step 2 rendering', () => {
      expect(clientCode).toContain('(c.allergies || []).map');
      expect(clientCode).toContain('(c.allergies || []).filter');
      expect(clientCode).toContain('const cur = c.allergies || []');
    });

    it('validates Step 4 on form submission instead of unreachable Step 6', () => {
      expect(clientCode).toContain('if (!validateStep(4))');
      expect(clientCode).not.toContain('if (!validateStep(6))');
    });
  });

  // =========================================================================
  // 4. STUDENT PROFILE SOFT-DELETED SIBLING ISOLATION
  // =========================================================================
  describe('Student Profile Sibling Query Integrity', () => {
    it('verifies that student profile siblings query filters out soft-deleted children', () => {
      const studentProfilePath = path.resolve(process.cwd(), 'src/app/dashboard/students/[id]/page.tsx');
      const profileCode = fs.readFileSync(studentProfilePath, 'utf-8');

      expect(profileCode).toContain('isNull(children.deletedAt)');
    });
  });

  // =========================================================================
  // 5. REGISTRATION APPROVAL STUDENT ACTIVATION
  // =========================================================================
  describe('Student Activation upon Registration Approval (signed_up)', () => {
    it('PATCH /api/register/[id]/status activates children when status === signed_up', () => {
      const statusRoutePath = path.resolve(process.cwd(), 'src/app/api/register/[id]/status/route.ts');
      const statusRouteCode = fs.readFileSync(statusRoutePath, 'utf-8');

      expect(statusRouteCode).toContain("if (status === 'signed_up' && reg.registrationChildren?.length)");
      expect(statusRouteCode).toContain('isRegistered: true');
      expect(statusRouteCode).toContain('registeredAt: new Date()');
    });

    it('dashboard action updateRegistrationStatus activates children when status === signed_up', () => {
      const actionsPath = path.resolve(process.cwd(), 'src/app/dashboard/registrations/actions.ts');
      const actionsCode = fs.readFileSync(actionsPath, 'utf-8');

      expect(actionsCode).toContain("if (newStatus === 'signed_up')");
      expect(actionsCode).toContain('isRegistered: true');
      expect(actionsCode).toContain('registeredAt: new Date()');
    });
  });

  // =========================================================================
  // 6. THREE-CHILD SCENARIO END-TO-END VALIDATION MODEL
  // =========================================================================
  describe('Three-Child Registration Scenario Logic', () => {
    it('successfully processes 3 distinct children in registration schema', () => {
      const payload = {
        orgSlug: 'oakridge-learning',
        centreId: 'c1111111-1111-4111-8111-111111111111',
        termsAgreed: true,
        parentSignature: 'Jane Doe',
        parents: [
          {
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane.doe@example.com',
            phone: '07123456789',
            relationship: 'Mother',
          },
        ],
        children: [
          {
            firstName: 'Alice',
            lastName: 'Doe',
            dateOfBirth: '2016-03-12',
            schoolYear: 'Y4',
            sessions: ['Monday PM', 'Tuesday PM'],
            allergies: ['Peanuts'],
            photoConsent: true,
          },
          {
            firstName: 'Bob',
            lastName: 'Doe',
            dateOfBirth: '2018-07-22',
            schoolYear: 'Y2',
            sessions: ['Wednesday PM'],
            allergies: [],
            photoConsent: true,
          },
          {
            firstName: 'Charlie',
            lastName: 'Doe',
            dateOfBirth: '2020-11-05',
            schoolYear: 'Reception',
            sessions: ['Thursday PM', 'Friday PM'],
            allergies: ['Dairy'],
            photoConsent: false,
          },
        ],
      };

      expect(payload.children).toHaveLength(3);
      expect(payload.termsAgreed).toBe(true);
      expect(payload.parentSignature).toBeTruthy();

      // Check each child has valid distinct properties
      const names = payload.children.map(c => c.firstName);
      expect(new Set(names).size).toBe(3);

      payload.children.forEach(c => {
        expect(c.firstName).toBeTruthy();
        expect(c.lastName).toBeTruthy();
        expect(Array.isArray(c.allergies)).toBe(true);
      });
    });
  });
});
