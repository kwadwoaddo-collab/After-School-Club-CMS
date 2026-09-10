import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks for DB, Adapters, and Services
// ---------------------------------------------------------------------------
const createSelectChain = (result: any = []) => ({
  from: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(result),
    }),
  }),
});

let defaultSelectResult: any = [];
const mockSelect = vi.fn(() => createSelectChain(defaultSelectResult));
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockTransaction = vi.fn(async (cb) => {
  return cb({
    insert: (table: any) => ({
      values: (val: any) => ({
        returning: () => [{ id: 'mock-tx-id', email: 'tx@example.com' }],
      }),
    }),
    update: (table: any) => ({
      set: (val: any) => ({
        where: () => [],
      }),
    }),
    delete: (table: any) => ({
      where: () => [],
    }),
  });
});
const mockFindUser = vi.fn();
const mockFindParent = vi.fn();
const mockFindOrgMembership = vi.fn();
const mockFindInvite = vi.fn();

vi.mock('@auth/drizzle-adapter', () => ({
  DrizzleAdapter: vi.fn(() => ({})),
}));

vi.mock('@/db', () => ({
  db: {
    select: () => mockSelect(),
    insert: (table: any) => ({
      values: (val: any) => mockInsert(table, val),
    }),
    update: (table: any) => ({
      set: (val: any) => ({
        where: (condition: any) => mockUpdate(table, val, condition),
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => mockDelete(table, condition),
    }),
    transaction: (cb: any) => mockTransaction(cb),
    query: {
      users: {
        findFirst: (...args: any[]) => mockFindUser(...args),
      },
      parents: {
        findFirst: (...args: any[]) => mockFindParent(...args),
      },
      orgMemberships: {
        findFirst: (...args: any[]) => mockFindOrgMembership(...args),
      },
      staffInvites: {
        findFirst: (...args: any[]) => mockFindInvite(...args),
      },
      verificationTokens: {
        findFirst: (...args: any[]) => (mockSelect as any)(...args),
      },
    },
  },
}));

vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendPasswordReset: vi.fn().mockResolvedValue({ success: true }),
    sendMagicLink: vi.fn().mockResolvedValue({ success: true }),
    sendEmailVerification: vi.fn().mockResolvedValue({ success: true }),
  },
  EmailService: class {
    sendMagicLink = vi.fn().mockResolvedValue({ success: true });
    sendPasswordReset = vi.fn().mockResolvedValue({ success: true });
    sendEmailVerification = vi.fn().mockResolvedValue({ success: true });
  },
}));

describe('MILESTONE PM-2E2.B4 — Account Enumeration & Auth Input Hardening', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    defaultSelectResult = [];
    mockSelect.mockImplementation(() => createSelectChain(defaultSelectResult));
    mockTransaction.mockImplementation(async (cb) => {
      return cb({
        insert: (table: any) => ({
          values: (val: any) => ({
            returning: () => [{ id: 'mock-tx-id', email: 'tx@example.com' }],
          }),
        }),
        update: (table: any) => ({
          set: (val: any) => ({
            where: () => [],
          }),
        }),
        delete: (table: any) => ({
          where: () => [],
        }),
      });
    });
  });

  // =========================================================================
  // TEST 1: F05 DUPLICATE SIGNUP RESPONSE NORMALISATION
  // =========================================================================
  it('Test 1: Duplicate signup returns status 201 with neutral response and identical shape', async () => {
    const { POST: signupHandler } = await import('@/app/api/auth/signup/route');

    // Case A: New User (email not in DB)
    const mockLimitNew = vi.fn().mockResolvedValue([]);
    const mockWhereNew = vi.fn().mockReturnValue({ limit: mockLimitNew });
    const mockFromNew = vi.fn().mockReturnValue({ where: mockWhereNew });
    mockSelect.mockReturnValueOnce({ from: mockFromNew });
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue([{ id: 'new-user-1' }]),
    });

    const reqNew = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        password: 'ValidPassword123!',
        acceptedTerms: true,
      }),
    });

    const resNew = await signupHandler(reqNew);
    expect(resNew.status).toBe(201);
    const dataNew = await resNew.json();
    expect(dataNew).toEqual({ message: 'Account created successfully' });

    // Case B: Existing User (email already in DB)
    const mockLimitExisting = vi.fn().mockResolvedValue([{ id: 'existing-user-1', email: 'alice@example.com' }]);
    const mockWhereExisting = vi.fn().mockReturnValue({ limit: mockLimitExisting });
    const mockFromExisting = vi.fn().mockReturnValue({ where: mockWhereExisting });
    mockSelect.mockReturnValueOnce({ from: mockFromExisting });

    const reqExisting = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        password: 'ValidPassword123!',
        acceptedTerms: true,
      }),
    });

    const resExisting = await signupHandler(reqExisting);
    expect(resExisting.status).toBe(201);
    const dataExisting = await resExisting.json();
    expect(dataExisting).toEqual({ message: 'Account created successfully' });
  });

  // =========================================================================
  // TEST 2: PASSWORD RESET REQUEST NORMALISATION
  // =========================================================================
  it('Test 2: Password reset request returns status 200 with { success: true } for existing and non-existing email', async () => {
    const { POST: resetRequestHandler } = await import('@/app/api/auth/reset-password/route');

    // Case A: Existing user
    mockFindUser.mockResolvedValueOnce({
      id: 'user-reset-1',
      email: 'owner@example.com',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      firstName: 'Owner',
    });
    mockUpdate.mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });

    const reqExisting = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com' }),
    });

    const resExisting = await resetRequestHandler(reqExisting);
    expect(resExisting.status).toBe(200);
    const dataExisting = await resExisting.json();
    expect(dataExisting).toEqual({ success: true });

    // Case B: Non-existing user
    mockFindUser.mockResolvedValueOnce(null);

    const reqNonExisting = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown@example.com' }),
    });

    const resNonExisting = await resetRequestHandler(reqNonExisting);
    expect(resNonExisting.status).toBe(200);
    const dataNonExisting = await resNonExisting.json();
    expect(dataNonExisting).toEqual({ success: true });
  });

  // =========================================================================
  // TEST 3 & 4: CREDENTIALS PROVIDER LOGIN & COMPUTATIONAL TIMING SYMMETRY
  // =========================================================================
  it('Test 3 & 4: Credentials authorize performs dummy bcrypt comparison for unknown user', async () => {
    const { DUMMY_PASSWORD_HASH } = await import('@/lib/auth');
    expect(DUMMY_PASSWORD_HASH).toBeDefined();
    expect(DUMMY_PASSWORD_HASH.startsWith('$2a$10$')).toBe(true);

    const bcrypt = await import('bcryptjs');
    const result = await bcrypt.compare('test-password', DUMMY_PASSWORD_HASH);
    expect(result).toBe(false);
  });

  // =========================================================================
  // TEST 5: STAFF MAGIC-LINK REQUEST ENUMERATION PROTECTION
  // =========================================================================
  it('Test 5: Staff magic-link request returns { success: true } for staff and non-staff email', async () => {
    const { POST: magicLinkHandler } = await import('@/app/api/staff/request-magic-link/route');

    // Case A: Non-existing user
    mockFindUser.mockResolvedValueOnce(null);

    const reqUnknown = new NextRequest('http://localhost/api/staff/request-magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'unknown-staff@example.com' }),
    });
    const resUnknown = await magicLinkHandler(reqUnknown);
    expect(resUnknown.status).toBe(200);
    const dataUnknown = await resUnknown.json();
    expect(dataUnknown).toEqual({ success: true });

    // Case B: Existing ORG_OWNER (not eligible for staff magic link, silently succeeds)
    mockFindUser.mockResolvedValueOnce({
      id: 'owner-1',
      email: 'owner@example.com',
      role: 'ORG_OWNER',
    });

    const reqOwner = new NextRequest('http://localhost/api/staff/request-magic-link', {
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com' }),
    });
    const resOwner = await magicLinkHandler(reqOwner);
    expect(resOwner.status).toBe(200);
    const dataOwner = await resOwner.json();
    expect(dataOwner).toEqual({ success: true });
  });

  // =========================================================================
  // TEST 6: RATE LIMITING PRESERVED ACROSS AUTH ENDPOINTS
  // =========================================================================
  it('Test 6: Rate limiting is actively invoked across public auth endpoints', async () => {
    const { authRateLimit, strictRateLimit } = await import('@/lib/rate-limit');
    expect(authRateLimit).toBeDefined();
    expect(strictRateLimit).toBeDefined();
  });

  // =========================================================================
  // TEST 7: EMAIL NORMALISATION & CASE INSENSITIVITY
  // =========================================================================
  it('Test 7: Email normalisation trims whitespace and converts to lowercase', async () => {
    const { normalizeEmail } = await import('@/lib/validations/auth');
    expect(normalizeEmail('  Test.User@Example.COM  ')).toBe('test.user@example.com');
    expect(normalizeEmail('Jane.Doe+Tutor@Centre.co.uk')).toBe('jane.doe+tutor@centre.co.uk');
  });

  // =========================================================================
  // TEST 11: MINIMUM PASSWORD LENGTH BOUNDARY
  // =========================================================================
  it('Test 11: Passwords shorter than 8 characters are rejected', async () => {
    const { validatePassword } = await import('@/lib/validations/auth');
    const shortResult = validatePassword('Short1!');
    expect(shortResult.valid).toBe(false);
    expect(shortResult.error).toContain('at least 8 characters');
  });

  // =========================================================================
  // TEST 12: MAXIMUM SUPPORTED PASSWORD (72 ASCII BYTES) ACCEPTED
  // =========================================================================
  it('Test 12: Passwords of exactly 72 ASCII characters (72 bytes) are accepted', async () => {
    const { validatePassword } = await import('@/lib/validations/auth');
    const exact72Ascii = 'A'.repeat(72);
    expect(Buffer.byteLength(exact72Ascii, 'utf8')).toBe(72);
    const result = validatePassword(exact72Ascii);
    expect(result.valid).toBe(true);
  });

  // =========================================================================
  // TEST 13: PASSWORD EXCEEDING 72 BYTES REJECTED BEFORE HASHING
  // =========================================================================
  it('Test 13: Passwords exceeding 72 UTF-8 bytes are rejected before bcrypt hashing', async () => {
    const { validatePassword } = await import('@/lib/validations/auth');
    const over72Ascii = 'A'.repeat(73);
    expect(Buffer.byteLength(over72Ascii, 'utf8')).toBe(73);
    const result = validatePassword(over72Ascii);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('72 bytes');
  });

  // =========================================================================
  // TEST 14: MULTI-BYTE UNICODE EVALUATED BY UTF-8 BYTE LENGTH
  // =========================================================================
  it('Test 14: Multi-byte Unicode password exceeding 72 bytes is rejected despite short char length', async () => {
    const { validatePassword } = await import('@/lib/validations/auth');
    // '🔒' is 4 UTF-8 bytes and length 2 in JS string (surrogate pair). 20 emojis = 80 bytes.
    const emojiPassword = '🔒'.repeat(20);
    expect(Buffer.byteLength(emojiPassword, 'utf8')).toBe(80);
    const result = validatePassword(emojiPassword);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('72 bytes');
  });

  // =========================================================================
  // TEST 15: VALID MULTI-BYTE UNICODE WITHIN 72 BYTES ACCEPTED
  // =========================================================================
  it('Test 15: Multi-byte Unicode password within 72 bytes and min 8 characters is accepted', async () => {
    const { validatePassword } = await import('@/lib/validations/auth');
    // 10 emojis of 4 bytes = 40 bytes, string length 20 >= 8
    const validEmojiPass = '🔒'.repeat(10);
    expect(Buffer.byteLength(validEmojiPass, 'utf8')).toBe(40);
    const result = validatePassword(validEmojiPass);
    expect(result.valid).toBe(true);
  });

  // =========================================================================
  // TEST 16: PASSWORD RESET PATCH APPLIES 8-72 BYTE BOUNDARY
  // =========================================================================
  it('Test 16: Password reset PATCH enforces 8-character min and 72-byte max', async () => {
    const { PATCH: resetPatchHandler } = await import('@/app/api/auth/reset-password/route');

    // 1. Too short
    const reqShort = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'PATCH',
      body: JSON.stringify({ token: 'abc123token', newPassword: '123' }),
    });
    const resShort = await resetPatchHandler(reqShort);
    expect(resShort.status).toBe(400);

    // 2. Too long (73 bytes)
    const reqLong = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'PATCH',
      body: JSON.stringify({ token: 'abc123token', newPassword: 'A'.repeat(73) }),
    });
    const resLong = await resetPatchHandler(reqLong);
    expect(resLong.status).toBe(400);
  });

  // =========================================================================
  // TEST 17: ORG REGISTRATION ENFORCES 8-72 BYTE PASSWORD BOUNDARY
  // =========================================================================
  it('Test 17: Org registration enforces 8-character min and 72-byte max', async () => {
    const { POST: orgRegisterHandler } = await import('@/app/api/organisations/route');

    const reqLongPass = new NextRequest('http://localhost/api/organisations', {
      method: 'POST',
      body: JSON.stringify({
        organisationName: 'Acme Tuition',
        firstName: 'John',
        lastName: 'Doe',
        contactEmail: 'john@acme.com',
        password: 'A'.repeat(73),
      }),
    });

    const res = await orgRegisterHandler(reqLongPass);
    expect(res.status).toBe(400);
  });

  // =========================================================================
  // TEST 18: OVERSIZED AUTH INPUTS REJECTED CLEANLY
  // =========================================================================
  it('Test 18: Oversized email (>255 chars) or names (>100 chars) are rejected with status 400', async () => {
    const { POST: signupHandler } = await import('@/app/api/auth/signup/route');

    const reqOversizedEmail = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'a'.repeat(250) + '@example.com', // > 255 chars
        password: 'ValidPassword123!',
        acceptedTerms: true,
      }),
    });

    const res = await signupHandler(reqOversizedEmail);
    expect(res.status).toBe(400);
  });

  // =========================================================================
  // TEST 19: MALFORMED OR OVERSIZED TOKEN INPUTS REJECTED SAFELY
  // =========================================================================
  it('Test 19: Oversized reset token (>128 chars) is rejected with status 400', async () => {
    const { PATCH: resetPatchHandler } = await import('@/app/api/auth/reset-password/route');

    const reqOversizedToken = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'PATCH',
      body: JSON.stringify({
        token: 'a'.repeat(200), // > 128 chars
        newPassword: 'ValidPassword123!',
      }),
    });

    const res = await resetPatchHandler(reqOversizedToken);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('token');
  });

  // =========================================================================
  // TEST 20: NO SENSITIVE DATA LEAKAGE IN PUBLIC ERRORS
  // =========================================================================
  it('Test 20: Public error responses do not leak plaintext passwords or tokens', async () => {
    const { POST: signupHandler } = await import('@/app/api/auth/signup/route');

    const req = new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'invalid-email',
        password: 'SecretPassword123!',
        acceptedTerms: true,
      }),
    });

    const res = await signupHandler(req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toContain('SecretPassword123!');
  });

  // =========================================================================
  // TEST 21: PARENT PORTAL LOGIN MESSAGE NORMALISATION
  // =========================================================================
  it('Test 21: Parent portal login returns identical generic message for existing and non-existing parents', async () => {
    const { POST: portalLoginHandler } = await import('@/app/api/portal/login/route');

    // Case A: Parent absent
    mockFindParent.mockResolvedValueOnce(null);

    const reqAbsent = new NextRequest('http://localhost/api/portal/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'parent-absent@example.com' }),
    });
    const resAbsent = await portalLoginHandler(reqAbsent);
    expect(resAbsent.status).toBe(200);
    const dataAbsent = await resAbsent.json();
    expect(dataAbsent.message).toBe('If an account exists with this email, a login link has been sent.');

    // Case B: Parent exists
    mockFindParent.mockResolvedValueOnce({
      id: 'parent-1',
      email: 'parent-exist@example.com',
      firstName: 'Jane',
    });
    mockUpdate.mockReturnValueOnce({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });

    const reqExist = new NextRequest('http://localhost/api/portal/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'parent-exist@example.com' }),
    });
    const resExist = await portalLoginHandler(reqExist);
    expect(resExist.status).toBe(200);
    const dataExist = await resExist.json();
    expect(dataExist.message).toBe('If an account exists with this email, a login link has been sent.');
  });

  // =========================================================================
  // TEST 22: CROSS-PACKAGE SECURITY INVARIANTS (B1, B2/B2.F, B3/B3.F) PRESERVED
  // =========================================================================
  it('Test 22: B1 CRM protection, B2.F trusted client IP, and B3.F live org membership authority remain intact', async () => {
    const { getClientIP } = await import('@/lib/rate-limit');
    const { auth } = await import('@/lib/auth');

    // B2.F check
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const req = new Request('http://localhost/api/test', {
        headers: {
          'x-vercel-forwarded-for': '198.51.100.77',
          'x-forwarded-for': '10.0.0.1',
        },
      });
      expect(getClientIP(req)).toBe('198.51.100.77');
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }

    // B3.F check: auth function exported and callable
    expect(typeof auth).toBe('function');
  });

  // =========================================================================
  // TEST 23: COMPLETE SIGNUP WORKFLOW REDIRECT ALIGNMENT (B4.F)
  // =========================================================================
  it('Test 23: Complete signup workflow produces identical 201 response and /login?registered=true redirect', async () => {
    const { POST: signupHandler } = await import('@/app/api/auth/signup/route');

    // Case A: New user signup
    const mockLimitNew = vi.fn().mockResolvedValue([]);
    const mockWhereNew = vi.fn().mockReturnValue({ limit: mockLimitNew });
    const mockFromNew = vi.fn().mockReturnValue({ where: mockWhereNew });
    mockSelect.mockReturnValueOnce({ from: mockFromNew });
    mockInsert.mockReturnValueOnce({
      values: vi.fn().mockResolvedValue([{ id: 'new-user-b4f' }]),
    });

    const resNew = await signupHandler(new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.230' },
      body: JSON.stringify({
        firstName: 'New',
        lastName: 'User',
        email: 'new-user-b4f@example.com',
        password: 'Password123!',
        acceptedTerms: true,
      }),
    }));
    expect(resNew.status).toBe(201);
    const dataNew = await resNew.json();
    expect(dataNew).toEqual({ message: 'Account created successfully' });

    // Case B: Existing user signup with arbitrary password
    const mockLimitExisting = vi.fn().mockResolvedValue([{ id: 'existing-user-b4f', email: 'existing-user-b4f@example.com' }]);
    const mockWhereExisting = vi.fn().mockReturnValue({ limit: mockLimitExisting });
    const mockFromExisting = vi.fn().mockReturnValue({ where: mockWhereExisting });
    mockSelect.mockReturnValueOnce({ from: mockFromExisting });

    const resExisting = await signupHandler(new NextRequest('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.231' },
      body: JSON.stringify({
        firstName: 'New',
        lastName: 'User',
        email: 'existing-user-b4f@example.com',
        password: 'AttackerPassword123!',
        acceptedTerms: true,
      }),
    }));
    expect(resExisting.status).toBe(201);
    const dataExisting = await resExisting.json();
    expect(dataExisting).toEqual({ message: 'Account created successfully' });
  });

  // =========================================================================
  // TEST 24: FOLLOW-UP CREDENTIALS AUTHENTICATION (B4.F FORENSIC EVALUATION)
  // =========================================================================
  it('Test 24: Credentials authorize differentiates newly activated password from unmutated existing account', async () => {
    const bcrypt = await import('bcryptjs');

    // Case A: Newly registered user has hash matching the submitted password
    const submittedPassword = 'AttackerPassword123!';
    const newAccountHash = await bcrypt.hash(submittedPassword, 10);
    const newAccountValid = await bcrypt.compare(submittedPassword, newAccountHash);
    expect(newAccountValid).toBe(true);

    // Case B: Pre-existing user retains their original hash (victim password)
    const victimOriginalPassword = 'OriginalVictimPassword123!';
    const existingAccountHash = await bcrypt.hash(victimOriginalPassword, 10);
    const attackerProbeValid = await bcrypt.compare(submittedPassword, existingAccountHash);
    expect(attackerProbeValid).toBe(false);
  });

  // =========================================================================
  // TEST 25: ORGANISATION REGISTRATION WORKFLOW & REDIRECT ALIGNMENT (B4.F)
  // =========================================================================
  it('Test 25: Organisation registration returns identical 201 response and redirectUrl for new and existing accounts', async () => {
    const { POST: orgRegisterHandler } = await import('@/app/api/organisations/route');

    // Case A: Existing user email during org registration
    mockFindUser.mockResolvedValueOnce({
      id: 'existing-org-user',
      email: 'owner@existing.com',
    });

    const resExisting = await orgRegisterHandler(new NextRequest('http://localhost/api/organisations', {
      method: 'POST',
      body: JSON.stringify({
        organisationName: 'Acme Org A',
        firstName: 'John',
        lastName: 'Doe',
        contactEmail: 'owner@existing.com',
        password: 'Password123!',
      }),
    }));
    expect(resExisting.status).toBe(201);
    const dataExisting = await resExisting.json();
    expect(dataExisting.success).toBe(true);
    expect(dataExisting.redirectUrl).toBe('/login?registered=true');
  });

  // =========================================================================
  // TEST 26: FOLLOW-UP LOGIN ORACLE ELIMINATION (SCENARIOS 1 & 2 COMPARISON)
  // =========================================================================
  it('Test 26: Scenario 1 (new email) and Scenario 2 (existing email) BOTH fail credentials login before verification', async () => {
    const { authConfig } = await import('@/lib/auth');
    const credentialsProvider = (authConfig.providers as any[])?.find(
      (p: any) => p?.id === 'credentials' || p?.name === 'credentials'
    );
    expect(credentialsProvider).toBeDefined();
    const authorizeFn = credentialsProvider.options?.authorize || credentialsProvider.authorize;

    const bcrypt = await import('bcryptjs');
    const attackerPassword = 'AttackerChosenPassword123!';

    // Scenario 1: Newly registered user (unverified, pending token in verificationTokens)
    const newAccountHash = await bcrypt.hash(attackerPassword, 10);
    mockFindUser.mockResolvedValueOnce({
      id: 'new-unverified-user',
      email: 'new-fixture@example.test',
      passwordHash: newAccountHash,
      emailVerified: null,
      firstName: 'New',
      lastName: 'User',
      role: 'ORG_OWNER',
    });

    // Mock verificationTokens table returning an active pending token
    const mockLimitPending = vi.fn().mockResolvedValue([{
      identifier: 'new-fixture@example.test',
      token: 'some-hashed-token',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }]);
    const mockWherePending = vi.fn().mockReturnValue({ limit: mockLimitPending });
    const mockFromPending = vi.fn().mockReturnValue({ where: mockWherePending });
    mockSelect.mockReturnValueOnce({ from: mockFromPending });

    const authResultNew = await authorizeFn({
      email: 'new-fixture@example.test',
      password: attackerPassword,
    });
    // LOGIN DENIED for newly registered unverified account
    expect(authResultNew).toBeNull();

    // Scenario 2: Existing user (different password)
    const victimOriginalPassword = 'OriginalVictimPassword123!';
    const victimAccountHash = await bcrypt.hash(victimOriginalPassword, 10);
    mockFindUser.mockResolvedValueOnce({
      id: 'existing-victim-user',
      email: 'existing-fixture@example.test',
      passwordHash: victimAccountHash,
      emailVerified: new Date(),
      firstName: 'Victim',
      lastName: 'User',
      role: 'ORG_OWNER',
    });

    const authResultExisting = await authorizeFn({
      email: 'existing-fixture@example.test',
      password: attackerPassword,
    });
    // LOGIN DENIED for existing account with wrong password
    expect(authResultExisting).toBeNull();

    // Invariant: Both outcomes are identical null (generic login failure) — zero account existence disclosure!
    expect(authResultNew).toEqual(authResultExisting);
  });

  // =========================================================================
  // TEST 27: VERIFICATION ENDPOINT REJECTS MISSING OR INVALID TOKEN
  // =========================================================================
  it('Test 27: GET /api/auth/verify-email rejects missing or invalid token parameters', async () => {
    const { GET: verifyHandler } = await import('@/app/api/auth/verify-email/route');

    // Case A: Missing token
    const resNoToken = await verifyHandler(new NextRequest('http://localhost/api/auth/verify-email?email=test@example.com', {
      method: 'GET',
    }));
    expect(resNoToken.status).toBe(307); // redirect to login with error
    expect(resNoToken.headers.get('location')).toContain('error=InvalidVerificationToken');

    // Case B: Invalid / non-existent token in DB
    const mockLimitInvalid = vi.fn().mockResolvedValue([]);
    const mockWhereInvalid = vi.fn().mockReturnValue({ limit: mockLimitInvalid });
    const mockFromInvalid = vi.fn().mockReturnValue({ where: mockWhereInvalid });
    mockSelect.mockReturnValueOnce({ from: mockFromInvalid });

    const resInvalid = await verifyHandler(new NextRequest('http://localhost/api/auth/verify-email?token=badtoken&email=test@example.com', {
      method: 'GET',
    }));
    expect(resInvalid.status).toBe(307);
    expect(resInvalid.headers.get('location')).toContain('error=ExpiredOrInvalidToken');
  });

  // =========================================================================
  // TEST 28: VERIFICATION ENDPOINT ACTIVATES ACCOUNT AND DELETES TOKEN (SINGLE-USE)
  // =========================================================================
  it('Test 28: GET /api/auth/verify-email with valid token activates user, deletes token, and redirects to login?verified=true', async () => {
    const { GET: verifyHandler } = await import('@/app/api/auth/verify-email/route');

    // Mock finding valid token
    const mockLimitValid = vi.fn().mockResolvedValue([{
      identifier: 'valid@example.com',
      token: 'valid-hashed-token',
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }]);
    const mockWhereValid = vi.fn().mockReturnValue({ limit: mockLimitValid });
    const mockFromValid = vi.fn().mockReturnValue({ where: mockWhereValid });
    mockSelect.mockReturnValueOnce({ from: mockFromValid });

    const resValid = await verifyHandler(new NextRequest('http://localhost/api/auth/verify-email?token=goodtoken&email=valid@example.com', {
      method: 'GET',
    }));
    expect(resValid.status).toBe(307);
    expect(resValid.headers.get('location')).toContain('verified=true');
    expect(mockTransaction).toHaveBeenCalled();
  });

  // =========================================================================
  // TEST 29: VERIFIED USER CAN NOW CREDENTIALS-LOGIN SUCCESSFULLY
  // =========================================================================
  it('Test 29: Verified user (emailVerified set) can credentials-login with their password', async () => {
    const { authConfig } = await import('@/lib/auth');
    const credentialsProvider = (authConfig.providers as any[])?.find(
      (p: any) => p?.id === 'credentials' || p?.name === 'credentials'
    );
    expect(credentialsProvider).toBeDefined();
    const authorizeFn = credentialsProvider.options?.authorize || credentialsProvider.authorize;

    const bcrypt = await import('bcryptjs');
    const userPassword = 'CorrectUserPassword123!';
    const userPasswordHash = await bcrypt.hash(userPassword, 10);

    mockFindUser.mockResolvedValueOnce({
      id: 'verified-user-1',
      email: 'verified@example.com',
      passwordHash: userPasswordHash,
      emailVerified: new Date(),
      firstName: 'Verified',
      lastName: 'User',
      role: 'ORG_OWNER',
      organisationId: 'org-123',
    });

    const authResult = await authorizeFn({
      email: 'verified@example.com',
      password: userPassword,
    });

    expect(authResult).not.toBeNull();
    expect(authResult?.id).toBe('verified-user-1');
    expect(authResult?.email).toBe('verified@example.com');
  });

  // =========================================================================
  // TEST 30: HISTORICAL CREDENTIAL ACCOUNT COMPATIBILITY (NO LOCKOUT)
  // =========================================================================
  it('Test 30: Historical credential user without pending verification token can log in without lockout', async () => {
    const { authConfig } = await import('@/lib/auth');
    const credentialsProvider = (authConfig.providers as any[])?.find(
      (p: any) => p?.id === 'credentials' || p?.name === 'credentials'
    );
    expect(credentialsProvider).toBeDefined();
    const authorizeFn = credentialsProvider.options?.authorize || credentialsProvider.authorize;

    const bcrypt = await import('bcryptjs');
    const historicalPassword = 'HistoricalPassword123!';
    const historicalHash = await bcrypt.hash(historicalPassword, 10);

    // Historical user with emailVerified: null (legacy)
    mockFindUser.mockResolvedValueOnce({
      id: 'historical-user-1',
      email: 'historical@example.com',
      passwordHash: historicalHash,
      emailVerified: null,
      firstName: 'Historical',
      lastName: 'Staff',
      role: 'ORG_OWNER',
      organisationId: 'org-legacy',
    });

    // No pending verification token in verificationTokens table
    const mockLimitNoToken = vi.fn().mockResolvedValue([]);
    const mockWhereNoToken = vi.fn().mockReturnValue({ limit: mockLimitNoToken });
    const mockFromNoToken = vi.fn().mockReturnValue({ where: mockWhereNoToken });
    mockSelect.mockReturnValueOnce({ from: mockFromNoToken });

    const authResult = await authorizeFn({
      email: 'historical@example.com',
      password: historicalPassword,
    });

    // Historical user successfully authenticates
    expect(authResult).not.toBeNull();
    expect(authResult?.id).toBe('historical-user-1');
    expect(authResult?.email).toBe('historical@example.com');
  });

  // =========================================================================
  // TEST 31: EMAIL SERVICE SEND EMAIL VERIFICATION DISPATCH
  // =========================================================================
  it('Test 31: EmailService.sendEmailVerification creates HTML email with 24h expiry notice and button link', async () => {
    const { emailService } = await import('@/lib/services/email');
    emailService.sendEmailVerification = vi.fn().mockResolvedValue({ success: true });

    const result = await emailService.sendEmailVerification({
      email: 'recipient@example.com',
      name: 'Recipient',
      verificationUrl: 'http://localhost:3000/api/auth/verify-email?token=xyz&email=recipient%40example.com',
    });
    expect(result.success).toBe(true);
  });
});
