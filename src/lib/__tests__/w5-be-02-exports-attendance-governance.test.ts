/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuth = vi.fn();
const mockGetApiSession = vi.fn();
const mockGetTypedSession = vi.fn();
const mockRequireTenantSession = vi.fn();
const mockRequireApiAuth = vi.fn();
const mockRequirePlatformAdmin = vi.fn();
const mockSendEmail = vi.fn();

const mockDb: any = {
  execute: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  transaction: vi.fn(),
  query: {
    registrations: { findMany: vi.fn() },
    invoices: { findMany: vi.fn() },
    organisations: { findMany: vi.fn(), findFirst: vi.fn() },
    parents: { findMany: vi.fn(), findFirst: vi.fn() },
    children: { findMany: vi.fn(), findFirst: vi.fn() },
    centres: { findMany: vi.fn(), findFirst: vi.fn() },
    users: { findFirst: vi.fn() },
    orgMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
    centreMemberships: { findFirst: vi.fn(), findMany: vi.fn() },
    billingConfigs: { findFirst: vi.fn() },
  },
};

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/lib/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

vi.mock('@/lib/session', () => ({
  getApiSession: (...args: any[]) => mockGetApiSession(...args),
  getTypedSession: (...args: any[]) => mockGetTypedSession(...args),
  requireTenantSession: (...args: any[]) => mockRequireTenantSession(...args),
}));

vi.mock('@/lib/require-auth', () => ({
  requireApiAuth: (...args: any[]) => mockRequireApiAuth(...args),
}));

vi.mock('@/lib/org-approval-guard', () => ({
  requirePlatformAdmin: (...args: any[]) => mockRequirePlatformAdmin(...args),
  assertOrgActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/email', () => ({
  sendEmail: (...args: any[]) => mockSendEmail(...args),
  emailService: {},
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const ORG_UUID = '11111111-1111-4111-8111-111111111111';
const CENTRE_1_UUID = '22222222-2222-4222-8222-222222222222';
const CENTRE_2_UUID = '33333333-3333-4333-8333-333333333333';

describe('Wave 5 BE-02 — Exports, Attendance, Safeguarding & Governance Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTypedSession.mockResolvedValue(null);
  });

  it('W5-BE-04: GET /api/register blocks TUTOR, validates status & centreId, limits rows, and sets private no-store cache header', async () => {
    const { GET } = await import('@/app/api/register/route');

    // 1. TUTOR blocked with 403
    mockGetApiSession.mockResolvedValueOnce({
      user: { id: 'tutor-1', organisationId: ORG_UUID, role: 'TUTOR' },
    });
    const tutorRes = await GET(new NextRequest('http://localhost/api/register'));
    expect(tutorRes.status).toBe(403);
    expect(tutorRes.headers.get('Cache-Control')).toBe('private, no-store');

    // 2. Invalid status enum rejected with 400
    mockGetApiSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    const badStatusRes = await GET(new NextRequest('http://localhost/api/register?status=invalid_enum'));
    expect(badStatusRes.status).toBe(400);

    // 3. Invalid centreId UUID rejected with 400
    mockGetApiSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    const badCentreRes = await GET(new NextRequest('http://localhost/api/register?centreId=not-a-uuid'));
    expect(badCentreRes.status).toBe(400);

    // 4. Valid ORG_OWNER request applies limit: 1000 and Cache-Control: private, no-store
    mockGetApiSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    mockDb.query.registrations.findMany.mockResolvedValueOnce([]);
    const okRes = await GET(
      new NextRequest(`http://localhost/api/register?status=awaiting_confirmation&centreId=${CENTRE_1_UUID}`)
    );
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockDb.query.registrations.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1000 })
    );
  });

  it('W5-BE-04: GET /api/export/finance rejects invalid centre UUID with 400 and bounds findMany to 5000', async () => {
    const { GET } = await import('@/app/api/export/finance/route');

    mockGetApiSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    const badCentre = await GET(
      new NextRequest('http://localhost/api/export/finance?centre=invalid-uuid')
    );
    expect(badCentre.status).toBe(400);
    expect(mockDb.query.invoices.findMany).not.toHaveBeenCalled();

    mockGetApiSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    mockDb.query.invoices.findMany.mockResolvedValueOnce([]);
    const okRes = await GET(
      new NextRequest(`http://localhost/api/export/finance?centre=${CENTRE_1_UUID}`)
    );
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mockDb.query.invoices.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5000 })
    );
  });

  it('W5-SEC-05: processBroadcastDeliveries fails deliveries for SUSPENDED orgs and soft-deleted parents without calling sendEmail', async () => {
    const { processBroadcastDeliveries } = await import('@/features/communications/delivery');

    mockDb.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'del-suspended-org',
            organisationId: 'org-suspended',
            broadcastId: 'b-1',
            parentId: 'p-active',
            recipientEmail: 'parent1@example.com',
            recipientName: 'Parent One',
            channel: 'email',
            status: 'PROCESSING',
            attemptCount: 1,
          },
          {
            id: 'del-deleted-parent',
            organisationId: 'org-active',
            broadcastId: 'b-2',
            parentId: 'p-deleted',
            recipientEmail: 'parent2@example.com',
            recipientName: 'Parent Two',
            channel: 'email',
            status: 'PROCESSING',
            attemptCount: 1,
          },
        ],
      })
      .mockResolvedValue({ rows: [{ sent_count: 0, failed_count: 2, pending_count: 0, total_count: 2 }] });

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'b-1', organisationId: 'org-suspended', subject: 'Hello', message: 'Msg 1' },
          { id: 'b-2', organisationId: 'org-active', subject: 'Hello', message: 'Msg 2' },
        ]),
      }),
    });

    mockDb.query.organisations.findMany.mockResolvedValueOnce([
      { id: 'org-suspended', approvalStatus: 'SUSPENDED' },
      { id: 'org-active', approvalStatus: 'ACTIVE' },
    ]);

    mockDb.query.parents.findMany.mockResolvedValueOnce([
      { id: 'p-active', deletedAt: null },
    ]);

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const res = await processBroadcastDeliveries({ workerToken: 'worker-1' });
    expect(res.sentCount).toBe(0);
    expect(res.failedCount).toBe(2);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('W5-BE-05: forgiveSessionsAction & updateChildFlags validate bounds, block unassigned/deleted children for non-owners, and block TUTOR', async () => {
    const { forgiveSessionsAction, updateChildFlags } = await import('@/features/attendance/actions');

    mockRequireTenantSession.mockResolvedValue({
      user: { id: 'mgr-1', organisationId: ORG_UUID, role: 'MANAGER' },
    });

    await expect(
      forgiveSessionsAction({ childId: 'child-1', sessionsAmount: -3, note: 'bad' })
    ).rejects.toThrow(/Invalid sessions amount/);
    await expect(
      forgiveSessionsAction({ childId: 'child-1', sessionsAmount: 101, note: 'too many' })
    ).rejects.toThrow(/Invalid sessions amount/);
    expect(mockDb.query.children.findFirst).not.toHaveBeenCalled();

    // Unassigned child (centreId: null) blocked for MANAGER
    mockDb.query.children.findFirst.mockResolvedValueOnce({
      id: 'child-null-centre',
      organisationId: ORG_UUID,
      centreId: null,
      deletedAt: null,
    });
    await expect(
      forgiveSessionsAction({ childId: 'child-null-centre', sessionsAmount: 1, note: 'ok' })
    ).rejects.toThrow(/Child not found or unauthorized/);

    // Soft-deleted child blocked
    mockDb.query.children.findFirst.mockResolvedValueOnce({
      id: 'child-deleted',
      organisationId: ORG_UUID,
      centreId: CENTRE_1_UUID,
      deletedAt: new Date(),
    });
    await expect(
      forgiveSessionsAction({ childId: 'child-deleted', sessionsAmount: 1, note: 'ok' })
    ).rejects.toThrow(/Child not found or unauthorized/);

    // TUTOR blocked on updateChildFlags
    mockRequireTenantSession.mockResolvedValueOnce({
      user: { id: 'tutor-1', organisationId: ORG_UUID, role: 'TUTOR' },
    });
    await expect(
      updateChildFlags({ childId: 'child-1', flagHomework: true, flagBehaviour: false })
    ).rejects.toThrow(/Forbidden/);
  });

  it('W5-BE-05: PATCH /api/students/[id] blocks soft-deleted students and runs centre reassignment inside db.transaction', async () => {
    const { PATCH } = await import('@/app/api/students/[id]/route');

    mockRequireApiAuth.mockResolvedValue({
      user: { id: 'owner-1', role: 'ORG_OWNER' },
      organisationId: ORG_UUID,
    });

    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: 'student-del',
                parentId: 'p-1',
                centreId: CENTRE_1_UUID,
                organisationId: ORG_UUID,
                deletedAt: new Date(),
              },
            ]),
        }),
      }),
    });

    const delRes = await PATCH(
      new Request('http://localhost/api/students/student-del', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Updated' }),
      }),
      { params: Promise.resolve({ id: 'student-del' }) }
    );
    expect(delRes.status).toBe(404);

    mockDb.select
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 'student-1',
                  parentId: 'p-1',
                  centreId: CENTRE_1_UUID,
                  organisationId: ORG_UUID,
                  deletedAt: null,
                },
              ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ organisationId: ORG_UUID }]),
          }),
        }),
      });

    const txSelect = vi.fn().mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ registrationId: 'reg-1' }]),
      }),
    });
    const txUpdate = vi.fn().mockReturnValue({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([{ id: 'student-1', centreId: CENTRE_2_UUID }]),
        }),
      }),
    });
    mockDb.transaction.mockImplementationOnce(async (cb: any) =>
      cb({
        select: txSelect,
        update: txUpdate,
        query: {
          billingConfigs: {
            findFirst: vi
              .fn()
              .mockResolvedValueOnce({ id: 'bc-1', children: [{ childId: 'student-1' }] })
              .mockResolvedValueOnce(null),
          },
        },
      })
    );

    const okRes = await PATCH(
      new Request('http://localhost/api/students/student-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centreId: CENTRE_2_UUID }),
      }),
      { params: Promise.resolve({ id: 'student-1' }) }
    );
    expect(okRes.status).toBe(200);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledTimes(4);
  });

  it('W5-BE-07: platform approveOrg / rejectOrg enforce UUID validation, self-approval block, reason cap, and db.transaction', async () => {
    const { approveOrg, rejectOrg } = await import('@/app/platform/organisations/actions');

    mockRequirePlatformAdmin.mockResolvedValue({
      userId: 'admin-uuid',
      email: 'admin@sprintscale.co.uk',
    });

    const badFd = new FormData();
    badFd.set('orgId', 'not-a-uuid');
    await expect(approveOrg(badFd)).rejects.toThrow(/Invalid organisation ID/);

    mockDb.query.orgMemberships.findFirst.mockResolvedValueOnce({
      userId: 'admin-uuid',
      organisationId: ORG_UUID,
      role: 'ORG_OWNER',
    });
    const selfFd = new FormData();
    selfFd.set('orgId', ORG_UUID);
    await expect(approveOrg(selfFd)).rejects.toThrow(/Self-approval is not permitted/);

    const longFd = new FormData();
    longFd.set('orgId', ORG_UUID);
    longFd.set('reason', 'x'.repeat(1001));
    await expect(rejectOrg(longFd)).rejects.toThrow(/1000 characters or fewer/);

    mockDb.query.orgMemberships.findFirst.mockResolvedValueOnce(null);
    mockDb.query.users.findFirst.mockResolvedValueOnce({ id: 'admin-uuid', organisationId: null });
    const txInsertValues = vi.fn().mockResolvedValue(undefined);
    mockDb.transaction.mockImplementationOnce(async (cb: any) =>
      cb({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ approvalStatus: 'PENDING', name: 'Test Club' }]),
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => Promise.resolve({ rowCount: 1 }),
          }),
        }),
        insert: () => ({ values: txInsertValues }),
      })
    );

    const okFd = new FormData();
    okFd.set('orgId', ORG_UUID);
    await expect(approveOrg(okFd)).rejects.toThrow('REDIRECT:/platform/organisations');
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(txInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: ORG_UUID,
        eventType: 'org.approved',
      })
    );
  });

  it('W5-SEC-07 & W5-BE-07: createIncident blocks TUTOR & FRONT_DESK on safeguarding, validates bounds, logs auditEvents, and caps getIncidents at 500', async () => {
    const { createIncident, getIncidents } = await import('@/features/incidents/actions');

    // TUTOR blocked from creating any incident
    mockRequireTenantSession.mockResolvedValueOnce({
      user: { id: 'tutor-1', organisationId: ORG_UUID, role: 'TUTOR' },
    });
    await expect(
      createIncident({
        centreId: 'centre-1',
        childId: 'child-1',
        type: 'accident',
        date: new Date(),
        description: 'Minor bump',
      })
    ).rejects.toThrow(/Forbidden/);

    // FRONT_DESK blocked from creating safeguarding incident
    mockRequireTenantSession.mockResolvedValueOnce({
      user: { id: 'fd-1', organisationId: ORG_UUID, role: 'FRONT_DESK' },
    });
    mockAuth.mockResolvedValueOnce({
      user: { id: 'fd-1', organisationId: ORG_UUID, role: 'FRONT_DESK' },
    });
    await expect(
      createIncident({
        centreId: 'centre-1',
        childId: 'child-1',
        type: 'safeguarding',
        date: new Date(),
        description: 'Safeguarding disclosure',
      })
    ).rejects.toThrow(/Forbidden/);

    // Overlong description rejected
    mockRequireTenantSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    await expect(
      createIncident({
        centreId: 'centre-1',
        childId: 'child-1',
        type: 'accident',
        date: new Date(),
        description: 'a'.repeat(5001),
      })
    ).rejects.toThrow(/Description must be between 1 and 5000 characters/);

    // Valid ORG_OWNER safeguarding incident logs SAFEGUARDING_INCIDENT_CREATED
    mockRequireTenantSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    mockAuth.mockResolvedValue({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    mockDb.query.orgMemberships.findFirst.mockResolvedValue({
      userId: 'owner-1',
      organisationId: ORG_UUID,
      role: 'ORG_OWNER',
    });
    mockDb.query.users.findFirst.mockResolvedValue({
      id: 'owner-1',
      organisationId: ORG_UUID,
      role: 'ORG_OWNER',
    });
    mockDb.query.centres.findFirst.mockResolvedValue({ id: 'centre-1', organisationId: ORG_UUID });
    mockDb.query.children.findFirst.mockResolvedValue({ id: 'child-1', centreId: 'centre-1' });

    const auditInsertValues = vi.fn().mockResolvedValue(undefined);
    mockDb.insert
      .mockReturnValueOnce({
        values: () => ({
          returning: () => Promise.resolve([{ id: 'inc-1', type: 'safeguarding' }]),
        }),
      })
      .mockReturnValueOnce({
        values: auditInsertValues,
      });

    const created = await createIncident({
      centreId: 'centre-1',
      childId: 'child-1',
      type: 'safeguarding',
      date: new Date(),
      description: 'Safeguarding concern noted',
    });
    expect(created).toEqual({ id: 'inc-1', type: 'safeguarding' });
    expect(auditInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: ORG_UUID,
        eventType: 'SAFEGUARDING_INCIDENT_CREATED',
      })
    );

    // getIncidents invokes .limit(500) when available on query builder
    mockRequireTenantSession.mockResolvedValueOnce({
      user: { id: 'owner-1', organisationId: ORG_UUID, role: 'ORG_OWNER' },
    });
    const limitSpy = vi.fn().mockResolvedValue([]);
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({ limit: limitSpy }),
          }),
        }),
      }),
    });
    await getIncidents('centre-1');
    expect(limitSpy).toHaveBeenCalledWith(500);
  });

  it('W5-BE-08: WondeService ignores soft-deleted parents and children during sync', async () => {
    const { WondeService } = await import('@/lib/services/wonde');
    const service = new WondeService(ORG_UUID, CENTRE_1_UUID);

    mockDb.query.parents.findMany.mockResolvedValueOnce([
      { id: 'p-binned', email: 'bob@example.com', deletedAt: new Date() },
    ]);
    mockDb.query.children.findMany.mockResolvedValueOnce([
      { id: 'c-binned', dateOfBirth: new Date('2016-05-15T00:00:00.000Z'), deletedAt: new Date() },
    ]);
    mockDb.insert
      .mockReturnValueOnce({
        values: () => ({
          returning: () => Promise.resolve([{ id: 'p-fresh' }]),
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockResolvedValue(undefined),
      });

    const stats = await service.syncStudents([
      {
        id: 'w-1',
        forename: 'Alice',
        surname: 'Smith',
        date_of_birth: '2016-05-15',
        contact_details: [{ id: 'wc-1', forename: 'Bob', surname: 'Smith', email: 'bob@example.com' }],
      },
    ]);

    expect(stats.matchedContacts).toBe(0);
    expect(stats.createdContacts).toBe(1);
    expect(stats.matchedStudents).toBe(0);
    expect(stats.createdStudents).toBe(1);
  });
});
