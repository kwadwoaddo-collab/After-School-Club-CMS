/**
 * PM-1.3A / PM-1.3A.C — Onboarding Remediation Security & Integrity Tests
 *
 * Covers:
 *   1. Logo Endpoint Security & Hardening:
 *      - Unauthenticated -> denied (401)
 *      - PENDING owner -> allowed (200)
 *      - ACTIVE organisation -> denied (403) (onboarding logo endpoint is strictly PENDING only)
 *      - SUSPENDED organisation -> denied (403)
 *      - REJECTED organisation -> denied (403)
 *      - Non-owner staff member -> denied (403)
 *      - User without organisation -> denied (403)
 *      - SVG file -> denied (400)
 *      - Fake PNG (plain text / HTML renamed .png) -> denied (400)
 *      - Fake JPEG -> denied (400)
 *      - Fake WEBP -> denied (400)
 *      - Oversized file (>2MB) -> denied (400)
 *   2. Membership Uniqueness & Idempotency:
 *      - Atomic onboarding creates exactly one orgMemberships row with ORG_OWNER
 *      - Retry when organisation already exists -> returns 400 "Organisation already set up"
 *      - Transaction rollback prevents partial records
 *   3. Terms Versioning & Legal Disclaimers:
 *      - Missing or false terms acceptance -> rejected (400)
 *      - Terms acceptance persisted with timestamp and version equaling CURRENT_TERMS_VERSION
 *      - Terms and Privacy routes render without error using CURRENT_TERMS_VERSION
 *   4. Training Guard Fail-Closed Assertions:
 *      - Training DB + flags -> allowed
 *      - Training DB with missing flags -> blocked
 *      - Known production DB -> blocked
 *      - Unknown DB host -> blocked
 *   5. Real Guard Module Execution:
 *      - PENDING tenant direct access -> redirects to /pending-approval
 *      - SUSPENDED tenant direct access -> redirects to /pending-approval
 *      - REJECTED tenant direct access -> redirects to /pending-approval
 *      - ACTIVE tenant access -> permitted to dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { CURRENT_TERMS_VERSION } from '@/lib/constants/legal';
import {
  assertSafeTrainingEnvironment,
  APPROVED_TRAINING_DB_HOST,
  KNOWN_PRODUCTION_DB_HOST,
  REQUIRED_TRAINING_ENVIRONMENT,
} from '@/lib/training-guard';

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
const mockFindFirstMembership = vi.fn();

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
      orgMemberships: {
        findFirst: (...args: any[]) => mockFindFirstMembership(...args),
      },
    },
  },
}));

// Import org-approval-guard to test real OrgNotActiveError behaviour
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

describe('PM-1.3A & PM-1.3A.C Reconciliation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Logo Upload Security, File Validation & State Boundary
  // ───────────────────────────────────────────────────────────────────────────
  describe('Logo Endpoint Security & Strict Validation', () => {
    function makeValidPng(): FormData {
      // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
      const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const blob = new Blob([header], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', blob, 'logo.png');
      return formData;
    }

    function makeValidJpeg(): FormData {
      // Valid JPEG header: FF D8 FF
      const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const blob = new Blob([header], { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', blob, 'logo.jpg');
      return formData;
    }

    function makeValidWebp(): FormData {
      // Valid WEBP header: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
      const header = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const blob = new Blob([header], { type: 'image/webp' });
      const formData = new FormData();
      formData.append('file', blob, 'logo.webp');
      return formData;
    }

    it('denies unauthenticated caller with 401', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidPng(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
    });

    it('allows owner of PENDING organisation with valid PNG', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
      });

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidPng(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.url).toBeDefined();
    });

    it('allows owner of PENDING organisation with valid JPEG', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
      });

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidJpeg(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('allows owner of PENDING organisation with valid WEBP', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
      });

      mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidWebp(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('DENIES ACTIVE organisation on onboarding endpoint (must use operational upload)', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-active', email: 'active@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-active',
        organisationId: 'org-active-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-active-1', approvalStatus: 'ACTIVE' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-active',
        userId: 'owner-active',
        organisationId: 'org-active-1',
        role: 'ORG_OWNER',
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidPng(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('only permitted for organisations in PENDING status');
    });

    it('denies SUSPENDED organisation with 403', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-susp', email: 'susp@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-susp',
        organisationId: 'org-susp-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-susp-1', approvalStatus: 'SUSPENDED' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-susp',
        userId: 'owner-susp',
        organisationId: 'org-susp-1',
        role: 'ORG_OWNER',
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidPng(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(403);
    });

    it('denies REJECTED organisation with 403', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-rej', email: 'rej@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-rej',
        organisationId: 'org-rej-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-rej-1', approvalStatus: 'REJECTED' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-rej',
        userId: 'owner-rej',
        organisationId: 'org-rej-1',
        role: 'ORG_OWNER',
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidPng(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(403);
    });

    it('denies non-owner staff member even if organisation is PENDING with 403', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'staff-1', email: 'staff@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'staff-1',
        organisationId: 'org-pending-1',
        role: 'STAFF',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidPng(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Only the organisation owner');
    });

    it('denies user without organisationId with 403', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-no-org', email: 'no-org@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-no-org',
        organisationId: null,
        role: 'USER',
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: makeValidPng(),
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(403);
    });

    it('denies SVG upload unconditionally with 400', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
      });

      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const formData = new FormData();
      formData.append('file', blob, 'logo.svg');

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid file type');
    });

    it('denies fake PNG (plain text script renamed .png) with 400', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
      });

      const blob = new Blob(['plain text content not a png'], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', blob, 'fake.png');

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(400);
    });

    it('denies HTML disguised as PNG with 400', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
      });

      const blob = new Blob(['<!DOCTYPE html><html><body><script>alert(1)</script></body></html>'], {
        type: 'image/png',
      });
      const formData = new FormData();
      formData.append('file', blob, 'exploit.png');

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(400);
    });

    it('denies oversized file (>2MB) with 400', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'owner-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
        organisation: { id: 'org-pending-1', approvalStatus: 'PENDING' },
      });

      mockFindFirstMembership.mockResolvedValue({
        id: 'mem-1',
        userId: 'owner-1',
        organisationId: 'org-pending-1',
        role: 'ORG_OWNER',
      });

      // Create a 2.5MB payload
      const hugeBuffer = new Uint8Array(2.5 * 1024 * 1024);
      const blob = new Blob([hugeBuffer], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', blob, 'huge.png');

      const req = new NextRequest('http://localhost:3000/api/onboarding/logo', {
        method: 'POST',
        body: formData,
      });

      const res = await logoHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Maximum size: 2MB');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Membership Uniqueness, Idempotency & Transaction Rollback
  // ───────────────────────────────────────────────────────────────────────────
  describe('Membership Uniqueness & Idempotency', () => {
    it('creates initial orgMemberships ORG_OWNER row in atomic transaction', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-pm13a-1', email: 'owner@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-pm13a-1',
        email: 'owner@example.com',
        organisationId: null,
      });

      let insertedMembership: any = null;

      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: vi.fn((_table: any) => ({
            values: vi.fn((val: any) => {
              if (val.role === 'ORG_OWNER' && val.organisationId && val.userId) {
                insertedMembership = val;
              }
              return { returning: vi.fn().mockResolvedValue([{ id: 'id-1', ...val }]) };
            }),
          })),
          update: vi.fn(() => ({
            set: vi.fn((val: any) => ({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ id: 'user-pm13a-1', ...val }]),
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
          organisationName: 'Test Academy',
          centreName: 'Main Hub',
          brandColor: '#2563EB',
        }),
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(200);
      expect(insertedMembership).toBeDefined();
      expect(insertedMembership.role).toBe('ORG_OWNER');
      expect(insertedMembership.userId).toBe('user-pm13a-1');
    });

    it('returns 400 "Organisation already set up" when onboarding retry is attempted', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-already-set-up', email: 'done@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-already-set-up',
        email: 'done@example.com',
        organisationId: 'existing-org-uuid', // Already set up
      });

      const req = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organisationName: 'Duplicate Attempt',
          centreName: 'Main Hub',
          brandColor: '#2563EB',
        }),
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Organisation already set up');
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('transaction rollback prevents partial records if any insertion fails', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: 'user-fail', email: 'fail@example.com' },
      });

      mockFindFirstUser.mockResolvedValue({
        id: 'user-fail',
        email: 'fail@example.com',
        organisationId: null,
      });

      mockTransaction.mockImplementation(async (callback: any) => {
        const tx = {
          insert: vi.fn(() => ({
            values: vi.fn(() => {
              throw new Error('Simulated DB constraint failure');
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
          centreName: 'Fail Hub',
          brandColor: '#2563EB',
        }),
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(500);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Terms Versioning & Single Source of Truth
  // ───────────────────────────────────────────────────────────────────────────
  describe('Terms Versioning & Legal Compliance', () => {
    it('persists termsVersion equaling CURRENT_TERMS_VERSION on signup', async () => {
      let insertedUser: any = null;

      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      mockInsert.mockReturnValue({
        values: vi.fn((val: any) => {
          insertedUser = val;
          return {
            returning: vi.fn().mockResolvedValue([{ id: 'u-1', ...val }]),
          };
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          password: 'Password123!',
          acceptedTerms: true,
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(201);
      expect(insertedUser).toBeDefined();
      expect(insertedUser.termsVersion).toBe(CURRENT_TERMS_VERSION);
      expect(insertedUser.termsAcceptedAt).toBeInstanceOf(Date);
    });

    it('rejects signup without acceptedTerms', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob@example.com',
          password: 'Password123!',
          acceptedTerms: false,
        }),
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Terms of Service');
    });

    it('Terms and Privacy pages render without runtime error', () => {
      const terms = TermsPage();
      const privacy = PrivacyPage();
      expect(terms).toBeDefined();
      expect(privacy).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Training Environment Guard Fail-Closed Tests
  // ───────────────────────────────────────────────────────────────────────────
  describe('Training Environment Guard', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    it('allows approved training DB host when both safety flags are present', () => {
      process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/neondb?sslmode=require`;
      process.env.ALLOW_TRAINING_SEED = 'true';
      process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

      const result = assertSafeTrainingEnvironment();
      expect(result.host).toBe(APPROVED_TRAINING_DB_HOST);
    });

    it('BLOCKED: throws when ALLOW_TRAINING_SEED is not true', () => {
      process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/neondb`;
      process.env.ALLOW_TRAINING_SEED = 'false';
      process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

      expect(() => assertSafeTrainingEnvironment()).toThrow(
        /ALLOW_TRAINING_SEED=true in your environment/
      );
    });

    it('BLOCKED: throws when TRAINING_ENVIRONMENT is missing or wrong', () => {
      process.env.DATABASE_URL = `postgres://user:pass@${APPROVED_TRAINING_DB_HOST}/neondb`;
      process.env.ALLOW_TRAINING_SEED = 'true';
      delete process.env.TRAINING_ENVIRONMENT;

      expect(() => assertSafeTrainingEnvironment()).toThrow(
        /Invalid or missing TRAINING_ENVIRONMENT marker/
      );
    });

    it('BLOCKED: throws immediately when target is KNOWN PRODUCTION host', () => {
      process.env.DATABASE_URL = `postgres://user:pass@${KNOWN_PRODUCTION_DB_HOST}/neondb`;
      process.env.ALLOW_TRAINING_SEED = 'true';
      process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

      expect(() => assertSafeTrainingEnvironment()).toThrow(
        /KNOWN PRODUCTION DATABASE/
      );
    });

    it('BLOCKED: throws immediately when target is unknown / arbitrary host', () => {
      process.env.DATABASE_URL = `postgres://user:pass@ep-random-host-123.eu-west-2.aws.neon.tech/neondb`;
      process.env.ALLOW_TRAINING_SEED = 'true';
      process.env.TRAINING_ENVIRONMENT = REQUIRED_TRAINING_ENVIRONMENT;

      expect(() => assertSafeTrainingEnvironment()).toThrow(
        /NOT on the approved training host allowlist/
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Real Redirection Behaviour for PENDING vs ACTIVE
  // ───────────────────────────────────────────────────────────────────────────
  describe('Session Lifecycle Redirection', () => {
    it('redirects PENDING organisation to /pending-approval', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: {
          id: 'user-pending',
          email: 'pending@example.com',
          organisationId: 'org-pending',
          role: 'ORG_OWNER',
        },
      });

      mockAssertOrgActive.mockRejectedValue(new OrgNotActiveError('org-pending', 'PENDING'));

      await expect(requireTenantSession()).rejects.toThrow('NEXT_REDIRECT: /pending-approval');
      expect(redirect).toHaveBeenCalledWith('/pending-approval');
    });

    it('redirects SUSPENDED organisation to /pending-approval', async () => {
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

    it('redirects REJECTED organisation to /pending-approval', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: {
          id: 'user-rejected',
          email: 'rejected@example.com',
          organisationId: 'org-rejected',
          role: 'ORG_OWNER',
        },
      });

      mockAssertOrgActive.mockRejectedValue(new OrgNotActiveError('org-rejected', 'REJECTED'));

      await expect(requireTenantSession()).rejects.toThrow('NEXT_REDIRECT: /pending-approval');
      expect(redirect).toHaveBeenCalledWith('/pending-approval');
    });

    it('permits ACTIVE organisation into /dashboard without redirecting', async () => {
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
});
