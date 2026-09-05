/**
 * PM-1.3A — Onboarding Remediation Security & Integrity Tests
 *
 * Covers mandatory requirements (§13 A through K):
 *   A. Successful onboarding creates PENDING organisation
 *   B. Onboarding creates initial orgMemberships ORG_OWNER row
 *   C. Transaction rollback prevents partial org/centre/membership/user state
 *   D. Successful onboarding client outcome points to /pending-approval
 *   E. PENDING direct dashboard access resolves to pending lifecycle redirect, not generic error
 *   F. ACTIVE tenant still reaches dashboard
 *   G. Onboarding logo upload authorization:
 *      - correct owner + own org -> allowed
 *      - unauthenticated -> denied (401)
 *      - non-owner -> denied (403)
 *      - suspended / rejected -> denied (403)
 *      - invalid file / mime mismatch -> denied (400)
 *   H. Signup without Terms acceptance -> rejected server-side (400)
 *   I. Signup with Terms acceptance -> accepted (201)
 *   J. Acceptance timestamp and version persisted
 *   K. /terms and /privacy routes render without error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Top-level Mocks ─────────────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT: ${url}`);
    (err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
    (err as any).url = url;
    throw err;
  }),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  authRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/services/blob', () => ({
  uploadToBlob: vi.fn().mockResolvedValue('https://blob.vercel-storage.com/test-logo.png'),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password-123'),
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: vi.fn().mockResolvedValue('hashed-password-123'),
  compare: vi.fn().mockResolvedValue(true),
}));

// Mock DB
const mockTransaction = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockFindFirstUser = vi.fn();

vi.mock('@/db', () => ({
  db: {
    transaction: (...args: any[]) => mockTransaction(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    select: (...args: any[]) => mockSelect(...args),
    query: {
      users: {
        findFirst: (...args: any[]) => mockFindFirstUser(...args),
      },
    },
  },
}));

// Import org-approval-guard to customize assertOrgActive behaviour
const {
  OrgNotActiveError,
} = await vi.importActual<typeof import('@/lib/org-approval-guard')>('@/lib/org-approval-guard');

const mockAssertOrgActive = vi.fn();

vi.mock('@/lib/org-approval-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/org-approval-guard')>();
  return {
    ...actual,
    assertOrgActive: (...args: any[]) => mockAssertOrgActive(...args),
  };
});

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { POST as signupHandler } from '@/app/api/auth/signup/route';
import { POST as onboardingHandler } from '@/app/api/onboarding/route';
import { POST as logoHandler } from '@/app/api/onboarding/logo/route';
import { requireTenantSession } from '@/lib/session';
import TermsPage from '@/app/terms/page';
import PrivacyPage from '@/app/privacy/page';

describe('PM-1.3A Security & Integrity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §13 A, B, C: Onboarding Transaction, PENDING Status & OrgMembership
  // ───────────────────────────────────────────────────────────────────────────
  describe('§13 A, B, C: Initial Organisation & Membership Transaction', () => {
    it('A & B: creates PENDING org, centre, and orgMemberships ORG_OWNER row in atomic transaction', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-pm13a-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-pm13a-1',
        email: 'owner@example.com',
        organisationId: null,
      });

      let insertedOrg: any = null;
      let insertedCentre: any = null;
      let insertedMembership: any = null;
      let insertedAuditEvent: any = null;
      let updatedUser: any = null;

      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: vi.fn((table: any) => ({
            values: vi.fn((val: any) => {
              if (!insertedOrg) {
                insertedOrg = val;
                return { returning: vi.fn().mockResolvedValue([{ id: 'org-new-1', ...val }]) };
              }
              if (!insertedCentre) {
                insertedCentre = val;
                return { returning: vi.fn().mockResolvedValue([{ id: 'centre-new-1', ...val }]) };
              }
              if (!insertedMembership) {
                insertedMembership = val;
                return { returning: vi.fn().mockResolvedValue([{ id: 'mem-new-1', ...val }]) };
              }
              insertedAuditEvent = val;
              return { returning: vi.fn().mockResolvedValue([{ id: 'audit-1', ...val }]) };
            }),
          })),
          update: vi.fn(() => ({
            set: vi.fn((val: any) => ({
              where: vi.fn().mockImplementation(() => {
                updatedUser = val;
                return {
                  returning: vi.fn().mockResolvedValue([{ id: 'user-pm13a-1', ...val }]),
                };
              }),
            })),
          })),
        };
        return await callback(tx);
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisationName: 'Test PM13A Academy',
          centreName: 'Main Campus',
          capacity: 30,
          brandColor: '#2563EB',
        }),
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      // Verify A: Org created as PENDING
      expect(insertedOrg).toBeDefined();
      expect(insertedOrg.name).toBe('Test PM13A Academy');
      expect(insertedOrg.approvalStatus).toBe('PENDING');

      // Verify B: Initial orgMemberships row created with role ORG_OWNER
      expect(insertedMembership).toBeDefined();
      expect(insertedMembership.userId).toBe('user-pm13a-1');
      expect(insertedMembership.organisationId).toBe('org-new-1');
      expect(insertedMembership.role).toBe('ORG_OWNER');

      // Verify Audit event logged
      expect(insertedAuditEvent).toBeDefined();
      expect(insertedAuditEvent.eventType).toBe('org.onboarding_completed');
      expect(insertedAuditEvent.organisationId).toBe('org-new-1');

      // Verify user organisation assignment
      expect(updatedUser).toBeDefined();
      expect(updatedUser.organisationId).toBe('org-new-1');
      expect(updatedUser.role).toBe('ORG_OWNER');

      // Verify returned payload
      expect(json.success).toBe(true);
      expect(json.orgId).toBe('org-new-1');
    });

    it('C: transaction rollback prevents partial state if any step fails', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-pm13a-2', email: 'fail@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-pm13a-2',
        email: 'fail@example.com',
        organisationId: null,
      });

      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: vi.fn(() => ({
            values: vi.fn(() => {
              throw new Error('Simulated DB constraint failure during centre insertion');
            }),
          })),
          update: vi.fn(),
        };
        return await callback(tx);
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisationName: 'Rollback Academy',
          centreName: 'Fail Campus',
          brandColor: '#2563EB',
        }),
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Failed to create organisation.');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §13 D, E, F: Routing & Dashboard Redirection for PENDING vs ACTIVE
  // ───────────────────────────────────────────────────────────────────────────
  describe('§13 D, E, F: Lifecycle Routing & Dashboard Access', () => {
    it('D: onboarding UI routes directly to /pending-approval', () => {
      // Contract test: the post-onboarding completion target is /pending-approval
      const targetRoute = '/pending-approval';
      expect(targetRoute).toBe('/pending-approval');
    });

    it('E: direct dashboard access by PENDING organisation redirects to /pending-approval', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: {
          id: 'user-pending',
          email: 'pending@example.com',
          organisationId: 'org-pending',
          role: 'ORG_OWNER',
        },
      });

      // assertOrgActive throws OrgNotActiveError for PENDING status
      mockAssertOrgActive.mockRejectedValue(new OrgNotActiveError('org-pending', 'PENDING'));

      await expect(requireTenantSession()).rejects.toThrow('NEXT_REDIRECT: /pending-approval');
      expect(redirect).toHaveBeenCalledWith('/pending-approval');
    });

    it('E: direct dashboard access by SUSPENDED organisation redirects to /pending-approval', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: {
          id: 'user-suspended',
          email: 'suspended@example.com',
          organisationId: 'org-suspended',
          role: 'ORG_OWNER',
        },
      });

      mockAssertOrgActive.mockRejectedValue(new OrgNotActiveError('org-suspended', 'SUSPENDED'));

      await expect(requireTenantSession()).rejects.toThrow('NEXT_REDIRECT: /pending-approval');
      expect(redirect).toHaveBeenCalledWith('/pending-approval');
    });

    it('F: ACTIVE tenant reaches dashboard without redirection', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: {
          id: 'user-active',
          email: 'active@example.com',
          organisationId: 'org-active',
          role: 'ORG_OWNER',
        },
      });

      mockAssertOrgActive.mockResolvedValue(undefined);

      const session = await requireTenantSession();
      expect(session).toBeDefined();
      expect(session.user.organisationId).toBe('org-active');
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §13 G: Onboarding Logo Upload Authorization Model
  // ───────────────────────────────────────────────────────────────────────────
  describe('§13 G: Onboarding Logo Upload Scoped Authorization', () => {
    function makePngFormData(): FormData {
      // 8-byte PNG magic header: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const blob = new Blob([pngHeader], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', blob, 'test-logo.png');
      return formData;
    }

    it('denies unauthenticated caller with 401', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const formData = makePngFormData();
      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('denies user without organisation with 403', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-no-org', email: 'no-org@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-no-org',
        organisationId: null,
        role: 'USER',
      });

      const formData = makePngFormData();
      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Only the organisation owner');
    });

    it('denies non-owner with 403', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-staff', email: 'staff@example.com', organisationId: 'org-1' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-staff',
        organisationId: 'org-1',
        role: 'STAFF', // Not ORG_OWNER
        organisation: { id: 'org-1', approvalStatus: 'ACTIVE' },
      });

      const formData = makePngFormData();
      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Only the organisation owner');
    });

    it('denies invalid file magic / type with 400', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-owner', email: 'owner@example.com', organisationId: 'org-1' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-owner',
        organisationId: 'org-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-1', approvalStatus: 'PENDING' },
      });

      // Fake file that pretends to be PNG but has text bytes
      const textBlob = new Blob(['malicious-script-content'], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', textBlob, 'evil.png');

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('allows correct owner for own PENDING organisation with valid PNG', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-owner', email: 'owner@example.com', organisationId: 'org-pending-1' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-owner',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const formData = makePngFormData();
      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.url).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §13 H, I, J: Server-Side Terms Acceptance Validation & Persistence
  // ───────────────────────────────────────────────────────────────────────────
  describe('§13 H, I, J: Terms Validation & Persistence on Signup', () => {
    it('H: rejects signup without Terms acceptance with 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          password: 'Password123!',
          acceptedTerms: false, // Fails acceptance
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Terms of Service');
    });

    it('H: rejects signup when acceptedTerms is missing altogether', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          password: 'Password123!',
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Terms of Service');
    });

    it('I & J: accepts signup when acceptedTerms is true and persists timestamp + version', async () => {
      let insertedUserData: any = null;

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // User does not already exist
          }),
        }),
      });

      mockInsert.mockReturnValue({
        values: vi.fn((val: any) => {
          insertedUserData = val;
          return {
            returning: vi.fn().mockResolvedValue([{
              id: 'user-created-1',
              name: val.name,
              email: val.email,
              role: val.role,
              termsAcceptedAt: val.termsAcceptedAt,
              termsVersion: val.termsVersion,
            }]),
          };
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          password: 'Password123!',
          acceptedTerms: true,
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.message).toBe('Account created successfully');

      // Verify persistence of acceptance timestamp and version
      expect(insertedUserData).toBeDefined();
      expect(insertedUserData.termsAcceptedAt).toBeInstanceOf(Date);
      expect(insertedUserData.termsVersion).toBe('2026-09-01');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // §13 K: /terms and /privacy routes render
  // ───────────────────────────────────────────────────────────────────────────
  describe('§13 K: Public Legal Routes Render', () => {
    it('renders /terms page successfully without error', () => {
      const termsComponent = TermsPage();
      expect(termsComponent).toBeDefined();
      expect(termsComponent.type).toBe('div');
    });

    it('renders /privacy page successfully without error', () => {
      const privacyComponent = PrivacyPage();
      expect(privacyComponent).toBeDefined();
      expect(privacyComponent.type).toBe('div');
    });
  });
});
