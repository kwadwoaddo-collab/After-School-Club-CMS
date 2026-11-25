import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  sentryCaptureMessageMock,
  mockGetApiSession,
  mockGetTypedSession,
  mockGetUserAccessibleCentreIds,
  mockRunSweeper,
  mockStartInvocationBudget,
  mockDbSelect,
  mockDbQueryOrgs,
  mockDbQueryUsers,
  mockDbQueryAuditEvents,
  mockDbQueryNotifications,
  mockDbQueryBookings,
  mockDbInsert,
  mockDbExecute,
  mockFetchDrafts,
  mockFetchSetupRequired,
  mockFetchPaymentsExpected,
  mockFetchOverdue,
  mockSendEmail,
} = vi.hoisted(() => ({
  sentryCaptureMessageMock: vi.fn(),
  mockGetApiSession: vi.fn(),
  mockGetTypedSession: vi.fn(),
  mockGetUserAccessibleCentreIds: vi.fn(),
  mockRunSweeper: vi.fn(),
  mockStartInvocationBudget: vi.fn((origin: string, opts?: { budgetMs?: number }) => ({
    origin,
    budgetMs: opts?.budgetMs ?? 50_000,
    startedAtMs: 0,
    deadlineMs: opts?.budgetMs ?? 50_000,
    clock: () => 0,
  })),
  mockDbSelect: vi.fn(),
  mockDbQueryOrgs: vi.fn(),
  mockDbQueryUsers: vi.fn(),
  mockDbQueryAuditEvents: vi.fn(),
  mockDbQueryNotifications: vi.fn(),
  mockDbQueryBookings: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbExecute: vi.fn(),
  mockFetchDrafts: vi.fn(),
  mockFetchSetupRequired: vi.fn(),
  mockFetchPaymentsExpected: vi.fn(),
  mockFetchOverdue: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: sentryCaptureMessageMock,
}));

vi.mock('@/lib/session', () => ({
  getApiSession: (...args: unknown[]) => mockGetApiSession(...args),
  getTypedSession: (...args: unknown[]) => mockGetTypedSession(...args),
  requireTenantSession: vi.fn(async () => ({
    user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER', email: 'owner@club.co.uk' },
  })),
}));

vi.mock('@/lib/permissions', () => ({
  getUserAccessibleCentreIds: (...args: unknown[]) => mockGetUserAccessibleCentreIds(...args),
}));

vi.mock('@/db', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
    execute: (...args: unknown[]) => mockDbExecute(...args),
    query: {
      organisations: { findMany: (...args: unknown[]) => mockDbQueryOrgs(...args) },
      users: { findMany: (...args: unknown[]) => mockDbQueryUsers(...args) },
      auditEvents: { findFirst: (...args: unknown[]) => mockDbQueryAuditEvents(...args) },
      notifications: { findFirst: (...args: unknown[]) => mockDbQueryNotifications(...args) },
      bookings: { findMany: (...args: unknown[]) => mockDbQueryBookings(...args) },
    },
    insert: (...args: unknown[]) => ({
      values: (...vArgs: unknown[]) => mockDbInsert(...args, ...vArgs),
    }),
  },
}));

vi.mock('@/features/billing/queries', () => ({
  fetchDraftsToReview: (...args: unknown[]) => mockFetchDrafts(...args),
  fetchBillingSetupRequired: (...args: unknown[]) => mockFetchSetupRequired(...args),
  fetchPaymentsExpected: (...args: unknown[]) => mockFetchPaymentsExpected(...args),
  fetchOverdueInvoices: (...args: unknown[]) => mockFetchOverdue(...args),
}));

vi.mock('@/lib/services/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

describe('Wave 4B — CSV safety, logger 1st-arg redaction, security headers, reports & cron hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'w4-cron-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('neutralizeCsvFormula & encodeCsvCell neutralize whitespace/tab/CR/LF-prefixed formulas and escape quotes', async () => {
    const { neutralizeCsvFormula, encodeCsvCell } = await import('@/lib/csv-safety');

    for (const payload of [
      ' =cmd|calc',
      '\t=SUM(A1:A2)',
      '\r+1+1',
      '\n-2+3',
      '   @IMPORTXML("https://evil.test")',
      '\tplain-tab-leading',
      '\rplain-cr-leading',
    ]) {
      expect(neutralizeCsvFormula(payload)).toBe(`'${payload}`);
    }

    expect(encodeCsvCell(' =1+1')).toBe(`"' =1+1"`);
    expect(encodeCsvCell('O"Connor')).toBe('"O""Connor"');
    expect(encodeCsvCell(null)).toBe('""');
    expect(encodeCsvCell(undefined)).toBe('""');
  });

  it('logger redacts emails and magic-link tokens in the 1st-argument message string before stdout and Sentry', async () => {
    const { logger } = await import('@/lib/logger');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.error('Failed sending magic link to parent.jane@example.co.uk');
    expect(spy.mock.calls[0]?.[0]).toContain('[REDACTED_EMAIL]');
    expect(spy.mock.calls[0]?.[0]).not.toContain('parent.jane@example.co.uk');
    expect(sentryCaptureMessageMock).toHaveBeenCalledWith(
      'Failed sending magic link to [REDACTED_EMAIL]',
      expect.objectContaining({ level: 'error' }),
    );

    sentryCaptureMessageMock.mockClear();
    logger.warn('Verification failed for https://app.sprintscaleit.co.uk/portal/verify?token=topsecret999');
    expect(sentryCaptureMessageMock).toHaveBeenCalledWith(
      '[REDACTED_TOKEN_URL]',
      expect.objectContaining({ level: 'warning' }),
    );

    spy.mockRestore();
  });

  it('buildSecurityHeaders attaches Cache-Control: private, no-store, max-age=0 to /api/:path*', async () => {
    const { buildSecurityHeaders } = await import('@/lib/security-headers');
    const rules = buildSecurityHeaders();
    const apiRule = rules.find((r) => r.source === '/api/:path*');
    expect(apiRule).toBeDefined();
    expect(apiRule?.headers).toContainEqual({
      key: 'Cache-Control',
      value: 'private, no-store, max-age=0',
    });
  });

  it('GET /api/register/prefill sets Cache-Control: private, no-store on responses', async () => {
    const { GET } = await import('@/app/api/register/prefill/route');
    const res = await GET(new NextRequest('http://localhost/api/register/prefill'));
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('GET /api/reports/attendance and /api/reports/bookings enforce row limit 10000 and Cache-Control: private, no-store', async () => {
    mockGetApiSession.mockResolvedValue({
      user: { id: 'u-owner', organisationId: 'org-1', role: 'ORG_OWNER', email: 'owner@club.co.uk' },
    });
    mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

    const limitSpy = vi.fn().mockResolvedValue([
      {
        bookingId: 'b-1',
        startAt: new Date('2026-11-25T15:30:00Z'),
        status: 'confirmed',
        childFirstName: ' =Evil',
        childLastName: 'Student',
        parentEmail: 'parent@example.com',
        centreName: 'Main Hall',
        confirmationCode: 'ABC123',
        modality: 'in_person',
        attendanceStatus: 'present',
        attendanceNote: null,
        attendanceMarkedAt: null,
        feedbackStatus: null,
        feedbackScore: null,
      },
    ]);
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = limitSpy;
    mockDbSelect.mockReturnValue(chain);

    const attendanceMod = await import('@/app/api/reports/attendance/route');
    const attRes = await attendanceMod.GET();
    expect(attRes.status).toBe(200);
    expect(attRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(limitSpy).toHaveBeenCalledWith(10_000);
    const attCsv = await attRes.text();
    expect(attCsv).toContain(`"' =Evil Student"`);

    limitSpy.mockClear();
    const bookingsMod = await import('@/app/api/reports/bookings/route');
    const bkgRes = await bookingsMod.GET();
    expect(bkgRes.status).toBe(200);
    expect(bkgRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(limitSpy).toHaveBeenCalledWith(10_000);
  });

  it('communications/actions excludes soft-deleted parents in sendBroadcast', async () => {
    const whereSpy = vi.fn().mockResolvedValue([
      {
        id: 'parent-deleted',
        firstName: 'Deleted',
        email: 'deleted@example.com',
        communicationsConsent: true,
        deletedAt: new Date(),
      },
    ]);
    mockDbSelect.mockReturnValue({
      from: vi.fn(() => ({ where: whereSpy })),
    });

    const { sendBroadcast } = await import('@/features/communications/actions');
    const res = await sendBroadcast({
      audienceParentIds: ['parent-deleted'],
      subject: 'Term notice',
      message: 'Hello',
      skipImmediateProcessing: true,
    });

    expect(whereSpy).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(false);
    expect(res.count).toBe(0);
  });

  it('cron/reminders skips soft-deleted parents and SUSPENDED organisations', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    mockDbQueryBookings.mockResolvedValue([
      {
        id: 'b-deleted-parent',
        status: 'confirmed',
        startAt: tomorrow,
        parent: { email: 'deleted@example.com', firstName: 'Deleted', deletedAt: new Date() },
        centre: { name: 'Centre A', organisation: { name: 'Active Org', approvalStatus: 'ACTIVE' } },
        attendees: [],
      },
      {
        id: 'b-suspended-org',
        status: 'confirmed',
        startAt: tomorrow,
        parent: { email: 'active@example.com', firstName: 'Active', deletedAt: null },
        centre: { name: 'Centre B', organisation: { name: 'Suspended Org', approvalStatus: 'SUSPENDED' } },
        attendees: [],
      },
    ]);

    const { POST } = await import('@/app/api/cron/reminders/route');
    const res = await POST(
      new NextRequest('http://localhost/api/cron/reminders', {
        method: 'POST',
        headers: { Authorization: 'Bearer w4-cron-secret' },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.errors).toBe(0);
  });

  it('cron/digest filters non-ACTIVE organisations and memoises identical (org, scope) metric queries across recipients', async () => {
    mockDbQueryOrgs.mockResolvedValue([
      { id: 'org-active', name: 'Active Club', approvalStatus: 'ACTIVE' },
      { id: 'org-suspended', name: 'Suspended Club', approvalStatus: 'SUSPENDED' },
    ]);
    mockDbQueryUsers.mockResolvedValue([
      { id: 'owner-1', organisationId: 'org-active', role: 'ORG_OWNER', email: 'o1@club.co.uk' },
      { id: 'owner-2', organisationId: 'org-active', role: 'ORG_OWNER', email: 'o2@club.co.uk' },
    ]);
    mockDbQueryAuditEvents.mockResolvedValue(null);
    mockDbQueryNotifications.mockResolvedValue(null);
    mockFetchDrafts.mockResolvedValue([{ id: 'inv-1', amount: '50.00' }]);
    mockFetchSetupRequired.mockResolvedValue([]);
    mockFetchPaymentsExpected.mockResolvedValue([]);
    mockFetchOverdue.mockResolvedValue([]);
    mockDbInsert.mockResolvedValue(undefined);
    mockSendEmail.mockResolvedValue({ success: true });

    const { POST } = await import('@/app/api/cron/digest/route');
    const res = await POST(
      new NextRequest('http://localhost/api/cron/digest', {
        method: 'POST',
        headers: { Authorization: 'Bearer w4-cron-secret' },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organisationsCount).toBe(1);
    expect(body.totalEmailsSent).toBe(2);
    expect(mockFetchDrafts).toHaveBeenCalledTimes(1);
    expect(mockFetchSetupRequired).toHaveBeenCalledTimes(1);
    expect(mockFetchPaymentsExpected).toHaveBeenCalledTimes(1);
    expect(mockFetchOverdue).toHaveBeenCalledTimes(1);
  });

  it('getPlatformDiagnostics tolerates an empty booking_email_provider_state table and runs all 6 queries concurrently', async () => {
    const { getPlatformDiagnostics } = await import('@/lib/services/email-outbox');
    const rootDbMock = {
      execute: vi.fn().mockResolvedValue([]),
    };

    const diag = await getPlatformDiagnostics(rootDbMock as unknown as Parameters<typeof getPlatformDiagnostics>[0]);
    expect(rootDbMock.execute).toHaveBeenCalledTimes(6);
    expect(diag.scope).toBe('PLATFORM');
    expect(diag.breaker.state).toBe('CLOSED');
    expect(diag.heldCount).toBe(0);
    expect(diag.attentionIdentifiers).toEqual([]);
    expect(diag.heldIdentifiers).toEqual([]);
  });

  it('outbox-diagnostics returns 403 on TENANT scope when getApiSession rejects an inactive organisation', async () => {
    mockGetTypedSession.mockResolvedValue({
      user: {
        id: 'owner-suspended',
        email: 'owner@suspended.co.uk',
        role: 'ORG_OWNER',
        organisationId: 'org-suspended',
        needsOnboarding: false,
      },
      expires: '2099-01-01T00:00:00Z',
    });
    mockGetApiSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/communications/outbox-diagnostics/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/communications/outbox-diagnostics'));
    expect(res.status).toBe(403);
  });

  it('cron/email-outbox returns 503 when CRON_SECRET is unset, uses 50_000ms budget, and returns 500 when sweeper reports error', async () => {
    vi.resetModules();
    vi.doMock('@/lib/services/email-outbox', () => ({
      runSweeper: (...args: unknown[]) => mockRunSweeper(...args),
      startInvocationBudget: (origin: string, opts?: { budgetMs?: number }) =>
        mockStartInvocationBudget(origin, opts),
    }));

    const { GET } = await import('@/app/api/cron/email-outbox/route');

    delete process.env.CRON_SECRET;
    const missingSecretRes = await GET(
      new NextRequest('http://localhost/api/cron/email-outbox', {
        headers: { Authorization: 'Bearer anything' },
      }),
    );
    expect(missingSecretRes.status).toBe(503);

    process.env.CRON_SECRET = 'w4-cron-secret';
    mockRunSweeper.mockResolvedValueOnce({
      paused: false,
      maintenance: null,
      claimed: 2,
      results: [],
      error: 'DatabaseTimeoutError',
    });

    const errRes = await GET(
      new NextRequest('http://localhost/api/cron/email-outbox', {
        headers: { Authorization: 'Bearer w4-cron-secret' },
      }),
    );
    expect(errRes.status).toBe(500);
    expect(mockStartInvocationBudget).toHaveBeenCalledWith('cron', { budgetMs: 50_000 });
    const errBody = await errRes.json();
    expect(errBody.ok).toBe(false);
    expect(errBody.error).toBe('DatabaseTimeoutError');

    vi.doUnmock('@/lib/services/email-outbox');
  });
});
