import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, status: 'allowed' }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendRegistrationConfirmation: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/db-notifications', () => ({
  notifyOwners: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      organisations: { findFirst: vi.fn() },
      centres: { findFirst: vi.fn() },
      parents: { findFirst: vi.fn() },
      children: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    transaction: vi.fn(),
  },
}));

describe('SEC-F-07: Public Registration & Prefill ACTIVE Organisation Guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const validRegisterPayload = {
    orgSlug: 'oakridge-club',
    children: [{ firstName: 'Alice', lastName: 'Smith', schoolYear: 'Y3' }],
    parents: [{ firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com' }],
    termsAgreed: true,
  };

  it.each(['PENDING', 'SUSPENDED', 'REJECTED'] as const)(
    'POST /api/register returns 403 when organisation approvalStatus is %s and performs zero DB writes',
    async (approvalStatus) => {
      const { db } = await import('@/db');
      const { emailService } = await import('@/lib/services/email');

      (db.query.organisations.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'org-1',
        name: 'Oakridge Club',
        slug: 'oakridge-club',
        approvalStatus,
      });

      const { POST } = await import('@/app/api/register/route');
      const req = new Request('http://localhost/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRegisterPayload),
      });

      const res = await POST(req as never);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Organisation is not active' });
      expect(db.transaction).not.toHaveBeenCalled();
      expect(emailService.sendRegistrationConfirmation).not.toHaveBeenCalled();
    }
  );

  it('POST /api/register proceeds past org status check when approvalStatus is ACTIVE', async () => {
    const { db } = await import('@/db');

    (db.query.organisations.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'org-1',
      name: 'Oakridge Club',
      slug: 'oakridge-club',
      approvalStatus: 'ACTIVE',
    });
    (db.transaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isDuplicate: true, error: 'Duplicate test stop' });

    const { POST } = await import('@/app/api/register/route');
    const req = new Request('http://localhost/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRegisterPayload),
    });

    const res = await POST(req as never);
    // Reached transaction (past 403 gate)
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(409);
  });

  it.each(['PENDING', 'SUSPENDED', 'REJECTED'] as const)(
    'GET /api/register/prefill returns 403 when centre organisation approvalStatus is %s without querying PII',
    async (approvalStatus) => {
      const { jwtVerify } = await import('jose');
      const { db } = await import('@/db');

      (jwtVerify as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        payload: { parentId: 'parent-1', centreId: 'centre-1', childIds: [] },
      });
      (db.query.centres.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'centre-1',
        organisationId: 'org-1',
        organisation: { id: 'org-1', approvalStatus },
      });

      const { GET } = await import('@/app/api/register/prefill/route');
      const req = new Request('http://localhost/api/register/prefill?token=valid-token');
      const res = await GET(req as never);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: 'Organisation is not active' });
      expect(db.query.parents.findFirst).not.toHaveBeenCalled();
      expect(db.query.children.findMany).not.toHaveBeenCalled();
    }
  );
});
