import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Shared Mocks ──────────────────────────────────────────────────────────────
const mockGetApiSession = vi.fn();
const mockRequireTenantSession = vi.fn();
const mockRequireApiAuth = vi.fn();
const mockRequirePermission = vi.fn();
const mockCanUserAccessCentre = vi.fn();
const mockGetUserAccessibleCentreIds = vi.fn();
const mockBcryptHash = vi.fn().mockResolvedValue('hashed-new-pw');
const mockBcryptCompare = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getApiSession: (...args: unknown[]) => mockGetApiSession(...args),
  requireTenantSession: (...args: unknown[]) => mockRequireTenantSession(...args),
}));

vi.mock('@/lib/require-auth', () => ({
  requireApiAuth: (...args: unknown[]) => mockRequireApiAuth(...args),
}));

vi.mock('@/lib/permissions', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
  canUserAccessCentre: (...args: unknown[]) => mockCanUserAccessCentre(...args),
  getUserAccessibleCentreIds: (...args: unknown[]) => mockGetUserAccessibleCentreIds(...args),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: (...args: unknown[]) => mockBcryptHash(...args),
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
  },
  hash: (...args: unknown[]) => mockBcryptHash(...args),
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
}));

vi.mock('@/lib/services/email', () => ({
  emailService: {
    sendStaffInvitation: vi.fn().mockResolvedValue({ success: true }),
    sendAssessmentFeedback: vi.fn().mockResolvedValue({ success: true }),
    sendBroadcastMessage: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/lib/services/sms', () => ({
  smsService: {
    sendBroadcastSms: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  strictRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/base-url', () => ({
  getTrustedApplicationUrl: vi.fn().mockReturnValue('http://localhost:3018'),
}));

// ── Flexible DB Mock ──────────────────────────────────────────────────────────
const mockSelectLimitQueue: unknown[][] = [];

function makeChainableQuery(defaultResult: unknown[] = []) {
  const chain: Record<string, any> = {};
  const resolveResult = () =>
    Promise.resolve(mockSelectLimitQueue.length > 0 ? mockSelectLimitQueue.shift()! : defaultResult);
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => resolveResult());
  chain.limit = vi.fn(() => resolveResult());
  chain.then = (onFulfilled?: any, onRejected?: any) => resolveResult().then(onFulfilled, onRejected);
  return chain;
}

const mockInsertValues = vi.fn().mockImplementation(() => ({
  onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  returning: vi.fn().mockResolvedValue([{ id: 'created-id' }]),
}));
const mockUpdateSet = vi.fn().mockImplementation(() => ({
  where: vi.fn().mockImplementation(() => ({
    returning: vi.fn().mockResolvedValue([{ id: 'updated-id' }]),
  })),
}));
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);

const mockDb: Record<string, any> = {
  query: {
    users: { findFirst: vi.fn() },
    organisations: { findFirst: vi.fn() },
    centres: { findFirst: vi.fn(), findMany: vi.fn() },
    staffInvitations: { findFirst: vi.fn() },
    verificationTokens: { findFirst: vi.fn() },
    orgMemberships: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    centreMemberships: { findMany: vi.fn().mockResolvedValue([]) },
    incidents: { findMany: vi.fn() },
    children: { findFirst: vi.fn(), findMany: vi.fn() },
    parents: { findFirst: vi.fn(), findMany: vi.fn() },
    classes: { findFirst: vi.fn(), findMany: vi.fn() },
    broadcastMessages: { findFirst: vi.fn(), findMany: vi.fn() },
    bookings: { findFirst: vi.fn() },
    bookingAttendees: { findFirst: vi.fn() },
    registrations: { findFirst: vi.fn() },
    registrationSubmissions: { findFirst: vi.fn() },
  },
  insert: vi.fn().mockImplementation(() => ({
    values: mockInsertValues,
  })),
  update: vi.fn().mockImplementation(() => ({
    set: mockUpdateSet,
  })),
  delete: vi.fn().mockImplementation(() => ({
    where: mockDeleteWhere,
  })),
  select: vi.fn().mockImplementation(() => makeChainableQuery([])),
  transaction: vi.fn().mockImplementation(async (cb: any) => cb(mockDb)),
};

vi.mock('@/db', () => ({
  db: mockDb,
}));

const CENTRE_B1_UUID = '11111111-1111-4111-8111-111111111111';
const CENTRE_2_UUID = '22222222-2222-4222-8222-222222222222';

describe('Priority 2 & Priority 3 Security Reconciliation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectLimitQueue.length = 0;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 2: Cross-Tenant Staff Invite Account Takeover & Membership Safety
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Priority 2 — Staff Invite Account Takeover & Premature Membership Protection', () => {
    it('POST /api/staff/invite does not mutate existing cross-org user or return raw inviteLink', async () => {
      const { POST } = await import('@/app/api/staff/invite/route');

      mockGetApiSession.mockResolvedValue({
        user: { id: 'attacker-owner', organisationId: 'org-b', role: 'ORG_OWNER', name: 'Attacker' },
      });
      // currentUser lookup via db.select().from(users).where(...).limit(1)
      mockSelectLimitQueue.push([
        { id: 'attacker-owner', organisationId: 'org-b', role: 'ORG_OWNER', firstName: 'Attacker', lastName: 'Owner' },
      ]);
      mockDb.query.organisations.findFirst.mockResolvedValue({ id: 'org-b', name: 'Attacker Org' });
      mockDb.query.centres.findFirst.mockResolvedValue({
        id: CENTRE_B1_UUID,
        name: 'Centre B1',
        organisationId: 'org-b',
      });
      // Existing user belongs to org-a with a passwordHash
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'victim-user-id',
        email: 'victim@org-a.com',
        organisationId: 'org-a',
        role: 'ORG_OWNER',
        passwordHash: 'existing-hash',
      });
      mockDb.query.orgMemberships.findFirst.mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3018/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'victim@org-a.com',
          firstName: 'Victim',
          lastName: 'Owner',
          role: 'TUTOR',
          centreId: CENTRE_B1_UUID,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();

      // Raw inviteLink must NOT be returned in API response
      expect(body.inviteLink).toBeUndefined();
      // Existing user record must NOT be updated at invite time
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('GET /api/staff/magic-login refuses to sign in existing password-protected or cross-org user', async () => {
      const { GET } = await import('@/app/api/staff/magic-login/route');

      mockSelectLimitQueue.push([
        {
          id: 'inv-1',
          token: 'hashed-tok',
          email: 'victim@org-a.com',
          role: 'TUTOR',
          organisationId: 'org-b',
          usedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'victim-user-id',
        email: 'victim@org-a.com',
        organisationId: 'org-a',
        role: 'ORG_OWNER',
        passwordHash: 'existing-bcrypt-hash',
      });

      const req = new NextRequest('http://localhost:3018/api/staff/magic-login?token=tok-123');
      const res = await GET(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/Existing accounts cannot be signed in via magic-login token/i);
    });

    it('POST /api/staff/accept-invite blocks unauthenticated password overwrite on existing cross-org user', async () => {
      const { POST } = await import('@/app/api/staff/accept-invite/route');

      mockGetApiSession.mockResolvedValue(null);
      mockBcryptCompare.mockResolvedValue(false);
      // 1st select: staffInvites
      mockSelectLimitQueue.push([
        {
          id: 'inv-1',
          token: 'hashed-tok',
          email: 'victim@org-a.com',
          role: 'TUTOR',
          organisationId: 'org-b',
          usedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'victim-user-id',
        email: 'victim@org-a.com',
        organisationId: 'org-a',
        role: 'ORG_OWNER',
        passwordHash: 'victim-real-hash',
      });

      const req = new NextRequest('http://localhost:3018/api/staff/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'tok-123',
          password: 'AttackerPassword1!',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/Account verification required/i);
      expect(data.requiresAuth).toBe(true);
    });

    it('POST /api/staff/accept-invite allows existing user with valid current password to join invited org without overwriting passwordHash', async () => {
      const { POST } = await import('@/app/api/staff/accept-invite/route');

      mockGetApiSession.mockResolvedValue(null);
      mockBcryptCompare.mockResolvedValue(true);
      mockSelectLimitQueue.push([
        {
          id: 'inv-1',
          token: 'hashed-tok',
          email: 'victim@org-a.com',
          role: 'MANAGER',
          organisationId: 'org-b',
          usedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'victim-user-id',
        email: 'victim@org-a.com',
        organisationId: 'org-a',
        role: 'ORG_OWNER',
        passwordHash: 'victim-real-hash',
      });
      mockDb.query.verificationTokens.findFirst.mockResolvedValue({
        identifier: 'invite-centre:hashed-tok',
        token: `hashed-tok:${CENTRE_B1_UUID}`,
      });

      const req = new NextRequest('http://localhost:3018/api/staff/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'tok-123',
          password: 'VictimRealPassword1!',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      // bcrypt.hash must NOT have been called to overwrite the existing user's password
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('POST /api/staff/accept-invite materializes org and centre memberships for new placeholder invitee', async () => {
      const { POST } = await import('@/app/api/staff/accept-invite/route');

      mockGetApiSession.mockResolvedValue(null);
      mockSelectLimitQueue.push([
        {
          id: 'inv-new',
          token: 'hashed-tok-new',
          email: 'newstaff@org-b.com',
          role: 'FRONT_DESK',
          organisationId: 'org-b',
          usedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'new-user-id',
        email: 'newstaff@org-b.com',
        organisationId: null,
        role: 'TUTOR',
        passwordHash: null,
        emailVerified: null,
      });
      mockDb.query.verificationTokens.findFirst.mockResolvedValue({
        identifier: 'invite-centre:hashed-tok-new',
        token: `hashed-tok-new:${CENTRE_B1_UUID}`,
      });

      const req = new NextRequest('http://localhost:3018/api/staff/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'tok-new',
          password: 'NewStaffPassword1!',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(mockBcryptHash).toHaveBeenCalledWith('NewStaffPassword1!', 10);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIORITY 3: Server Action & API Route Tenant / Centre / Role Matrix
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Priority 3 — Incidents, Communications & Bookings Actions Isolation', () => {
    it('getIncidents and createIncident enforce non-owner centre membership and child-centre ownership', async () => {
      const { getIncidents, createIncident } = await import('@/features/incidents/actions');

      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      mockRequirePermission.mockResolvedValue(undefined);
      mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

      // Unassigned centre is blocked for MANAGER
      await expect(getIncidents('centre-2')).rejects.toThrow(/Forbidden: No access to this centre/);

      // Assigned centre succeeds for MANAGER
      mockDb.query.centres.findFirst.mockResolvedValue({ id: 'centre-1', organisationId: 'org-1' });
      await expect(getIncidents('centre-1')).resolves.toEqual([]);

      // createIncident blocks child belonging to another centre
      mockDb.query.children.findFirst.mockResolvedValue(null);
      await expect(
        createIncident({
          centreId: 'centre-1',
          childId: 'child-from-centre-2',
          type: 'accident',
          date: new Date(),
          description: 'Scraped knee',
        })
      ).rejects.toThrow(/Child not found or access denied/);
    });

    it('sendBroadcast and getBroadcasts block TUTOR and enforce centre/class scoping for MANAGER/FRONT_DESK', async () => {
      const { sendBroadcast, getBroadcasts } = await import('@/features/communications/actions');

      // TUTOR is blocked from broadcasts
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'tutor-1', organisationId: 'org-1', role: 'TUTOR' },
      });
      await expect(getBroadcasts('centre-1')).resolves.toEqual([]);
      const tutorSendRes = await sendBroadcast({
        centreId: 'centre-1',
        audienceParentIds: ['parent-1'],
        subject: 'Subj',
        message: 'Body',
      });
      expect(tutorSendRes.success).toBe(false);
      expect(tutorSendRes.error).toMatch(/Unauthorized: only Owner\/Manager may send broadcasts/);

      // MANAGER blocked on unassigned centre
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);
      const mgrUnassignedSend = await sendBroadcast({
        centreId: 'centre-2',
        audienceParentIds: ['parent-2'],
        subject: 'Subj',
        message: 'Body',
      });
      expect(mgrUnassignedSend.success).toBe(false);
      expect(mgrUnassignedSend.error).toMatch(/No access to this centre/);

      // MANAGER blocked when audienceParentIds have no consented bookings in accessible centres
      const mgrCrossRecipientSend = await sendBroadcast({
        centreId: 'centre-1',
        audienceParentIds: ['parent-from-centre-2'],
        subject: 'Subj',
        message: 'Body',
      });
      expect(mgrCrossRecipientSend.success).toBe(false);
      expect(mgrCrossRecipientSend.error).toMatch(/No eligible recipients/);
    });

    it('updateBookingStatus, rescheduleBooking, saveAssessmentFeedback, and sendAssessmentFeedback enforce role and centre checks', async () => {
      const {
        updateBookingStatus,
        rescheduleBooking,
        saveAssessmentFeedback,
        sendAssessmentFeedback,
      } = await import('@/features/bookings/actions');

      // TUTOR cannot modify booking status or reschedule
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'tutor-1', organisationId: 'org-1', role: 'TUTOR' },
      });
      await expect(updateBookingStatus('b-1', 'cancelled')).rejects.toThrow(/Forbidden/);
      await expect(rescheduleBooking('b-1', '2026-10-20T15:00:00Z')).rejects.toThrow(/Forbidden/);

      // MANAGER blocked when booking belongs to unassigned centre
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      mockDb.query.bookings.findFirst.mockResolvedValue({
        id: 'b-2',
        centre: { id: 'centre-2', organisationId: 'org-1' },
      });
      mockCanUserAccessCentre.mockResolvedValue(false);
      await expect(updateBookingStatus('b-2', 'confirmed')).rejects.toThrow(/Unauthorized access to this booking/);
      await expect(rescheduleBooking('b-2', '2026-10-20T15:00:00Z')).rejects.toThrow(/Unauthorized access to this booking/);

      // Assessment feedback blocked on unassigned centre
      mockDb.query.bookingAttendees.findFirst.mockResolvedValue({
        id: 'att-2',
        bookingId: 'b-2',
        feedbackStatus: 'DRAFT',
        booking: { centre: { id: 'centre-2', name: 'Centre 2', organisationId: 'org-1' } },
      });
      await expect(saveAssessmentFeedback('att-2', { notes: 'Good' })).rejects.toThrow(/Unauthorized access/);
      await expect(sendAssessmentFeedback('att-2')).rejects.toThrow(/Unauthorized access/);
    });
  });

  describe('Priority 3 — Registrations, Students, Search, Finance, Availability & Subdomain Isolation', () => {
    it('registration actions block TUTOR and unassigned centres for MANAGER/FRONT_DESK', async () => {
      const {
        assignRegistrationCentre,
        updateRegistrationDetails,
        generateRegistrationLink,
        updateRegistrationStatus,
      } = await import('@/app/dashboard/registrations/actions');

      // TUTOR blocked
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'tutor-1', organisationId: 'org-1', role: 'TUTOR' },
      });
      await expect(generateRegistrationLink('parent-1', 'centre-1')).rejects.toThrow(/Forbidden/);
      await expect(updateRegistrationStatus('reg-1', 'signed_up')).rejects.toThrow(/Forbidden/);

      // MANAGER blocked from assigning registration to an unassigned target centre
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);
      mockDb.query.registrations.findFirst.mockResolvedValue({
        id: 'reg-1',
        organisationId: 'org-1',
        centreId: 'centre-1',
      });
      mockDb.query.centres.findFirst.mockResolvedValue({ id: 'centre-2', organisationId: 'org-1' });
      await expect(assignRegistrationCentre('reg-1', 'centre-2')).rejects.toThrow(/Forbidden: No access to target centre/);

      // FRONT_DESK blocked from updating registration belonging to unassigned centre
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'fd-1', organisationId: 'org-1', role: 'FRONT_DESK' },
      });
      mockDb.query.registrations.findFirst.mockResolvedValue({
        id: 'reg-2',
        organisationId: 'org-1',
        centreId: 'centre-2',
      });
      await expect(
        updateRegistrationDetails({
          registrationId: 'reg-2',
          startDate: null,
          fundingType: 'self_funded',
          fundingOther: '',
          emergencyContactName: 'Contact',
          emergencyContactRelationship: 'Aunt',
          emergencyContactPhone: '07700900111',
          hasSpecialNeeds: false,
          specialNeedsDetails: '',
          parentsData: [],
          childrenData: [],
        })
      ).rejects.toThrow(/Forbidden: No access to this centre/);
    });

    it('student actions and API routes enforce centre membership on schedule update, CSV import, create, and centre reassignment', async () => {
      const { updateStudentSchedule } = await import('@/features/students/student-actions');
      const { importStudentsAction } = await import('@/features/students/import-actions');
      const { POST: createStudent } = await import('@/app/api/students/route');
      const { PATCH: patchStudent } = await import('@/app/api/students/[id]/route');

      // updateStudentSchedule blocks MANAGER for student in unassigned centre
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);
      mockDb.query.children.findFirst.mockResolvedValue({
        id: 'student-2',
        organisationId: 'org-1',
        centreId: 'centre-2',
      });
      await expect(updateStudentSchedule('student-2', ['monday'])).rejects.toThrow(/Forbidden: No access to this centre/);

      // importStudentsAction blocks MANAGER for unassigned centre and null centre
      mockRequireApiAuth.mockResolvedValue({
        user: { id: 'mgr-1', name: 'Manager', role: 'MANAGER' },
        organisationId: 'org-1',
      });
      mockDb.query.centres.findFirst.mockResolvedValue({ id: 'centre-2', organisationId: 'org-1' });
      await expect(
        importStudentsAction(
          [
            {
              studentFirstName: 'Alice',
              studentLastName: 'Smith',
              studentSchoolYear: 'Year 5',
              parentFirstName: 'Bob',
              parentLastName: 'Smith',
              parentEmail: 'bob@example.com',
            },
          ],
          'centre-2'
        )
      ).rejects.toThrow(/Forbidden: You do not have access to this centre/);

      await expect(
        importStudentsAction(
          [
            {
              studentFirstName: 'Alice',
              studentLastName: 'Smith',
              studentSchoolYear: 'Year 5',
              parentFirstName: 'Bob',
              parentLastName: 'Smith',
              parentEmail: 'bob@example.com',
            },
          ],
          null
        )
      ).rejects.toThrow(/Forbidden: Centre selection is required for your role/);

      // POST /api/students blocks MANAGER for unassigned centre
      mockDb.query.centres.findFirst.mockResolvedValue({ id: CENTRE_2_UUID });
      const postRes = await createStudent(
        new Request('http://localhost:3018/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: 'Alice',
            lastName: 'Smith',
            dateOfBirth: '2016-05-10',
            schoolYear: 'Year 5',
            parentFirstName: 'Bob',
            parentLastName: 'Smith',
            parentEmail: 'bob@example.com',
            parentPhone: '07700900123',
            centreId: CENTRE_2_UUID,
          }),
        })
      );
      expect(postRes.status).toBe(403);

      // PATCH /api/students/[id] blocks MANAGER from reassigning student to null
      mockSelectLimitQueue.push([
        { id: 'student-1', parentId: 'p-1', centreId: 'centre-1', organisationId: 'org-1' },
      ]);
      const patchNullRes = await patchStudent(
        new Request('http://localhost:3018/api/students/student-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ centreId: null }),
        }),
        { params: Promise.resolve({ id: 'student-1' }) }
      );
      expect(patchNullRes.status).toBe(403);
    });

    it('GET /api/search returns empty results when non-owner staff has no accessible centres', async () => {
      const { GET } = await import('@/app/api/search/route');

      mockGetApiSession.mockResolvedValue({
        user: { id: 'fd-no-centres', organisationId: 'org-1', role: 'FRONT_DESK' },
      });
      mockGetUserAccessibleCentreIds.mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3018/api/search?q=Alice');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.results).toEqual([]);
    });

    it('finance, availability, and subdomain endpoints enforce Manager/Owner role gates and centre access', async () => {
      const { createLegacyFamilyAndInvoice, createAdHocInvoice, getParents } = await import('@/features/finance/actions');
      const { updateAvailability } = await import('@/app/dashboard/availability/actions');
      const { PATCH: patchSubdomain } = await import('@/app/api/centres/[id]/subdomain/route');

      // FRONT_DESK with centre access is still blocked from creating legacy or ad-hoc invoices
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'fd-1', organisationId: 'org-1', role: 'FRONT_DESK' },
      });
      mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);

      await expect(
        createLegacyFamilyAndInvoice({
          parent: { firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', phone: '07700900123' },
          children: [{ firstName: 'Alice', lastName: 'Smith', schoolYear: 'Year 5' }],
          invoice: {
            amount: '50.00',
            invoiceDate: new Date(),
            dueDate: new Date(),
            centreId: 'centre-1',
          },
        })
      ).rejects.toThrow(/Only Managers and Owners can create invoices/);

      await expect(
        createAdHocInvoice({
          parentId: 'p-1',
          childName: 'Alice Smith',
          amount: '50.00',
          invoiceDate: new Date(),
          dueDate: new Date(),
          centreId: 'centre-1',
        })
      ).rejects.toThrow(/Only Managers and Owners can create invoices/);

      // TUTOR blocked from getParents and updateAvailability
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'tutor-1', organisationId: 'org-1', role: 'TUTOR' },
      });
      await expect(getParents('Smith')).rejects.toThrow(/Forbidden/);
      await expect(updateAvailability('centre-1', [])).rejects.toThrow(/Only Managers and Owners can update availability/);

      // FRONT_DESK blocked from updateAvailability
      mockRequireTenantSession.mockResolvedValue({
        user: { id: 'fd-1', organisationId: 'org-1', role: 'FRONT_DESK' },
      });
      await expect(updateAvailability('centre-1', [])).rejects.toThrow(/Only Managers and Owners can update availability/);

      // MANAGER blocked from updating subdomain of an unassigned centre
      mockGetApiSession.mockResolvedValue({
        user: { id: 'mgr-1', organisationId: 'org-1', role: 'MANAGER' },
      });
      mockGetUserAccessibleCentreIds.mockResolvedValue(['centre-1']);
      mockDb.query.centres.findFirst.mockResolvedValue({ id: 'centre-2', organisationId: 'org-1' });

      const subRes = await patchSubdomain(
        new NextRequest('http://localhost:3018/api/centres/centre-2/subdomain', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subdomain: 'centre-two' }),
        }),
        { params: Promise.resolve({ id: 'centre-2' }) }
      );
      expect(subRes.status).toBe(403);
    });
  });
});
