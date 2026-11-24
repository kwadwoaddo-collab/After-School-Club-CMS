import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockUpdate = vi.fn();
const mockFindCentre = vi.fn();
const mockFindOrg = vi.fn();
const mockFindOrgMembership = vi.fn();
const mockAssertOrgActive = vi.fn().mockResolvedValue(undefined);

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock('@/lib/session', () => ({
  requireTenantSession: vi.fn(),
}));

vi.mock('@/lib/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/permissions')>();
  return {
    ...actual,
    getUserAccessibleCentres: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('@/lib/centre-filter', () => ({
  resolveActiveCentreId: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/org-approval-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/org-approval-guard')>();
  return {
    ...actual,
    assertOrgActive: (orgId: string) => mockAssertOrgActive(orgId),
  };
});

vi.mock('@/db', () => ({
  db: {
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return { set: () => ({ where: async () => [] }) };
    },
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ name: 'Active Club' }]),
        }),
      }),
    }),
    query: {
      centres: { findFirst: (...args: unknown[]) => mockFindCentre(...args) },
      organisations: { findFirst: (...args: unknown[]) => mockFindOrg(...args) },
      orgMemberships: { findFirst: (...args: unknown[]) => mockFindOrgMembership(...args) },
    },
  },
}));

describe('PR-07: Subdomain & Org-Switch Active-Org Guard + No GET DB Mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertOrgActive.mockResolvedValue(undefined);
  });

  it('DashboardLayout never mutates users.organisationId during a GET render on a cross-org subdomain', async () => {
    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-subdomain': 'other-active-club' }) as never);

    const { requireTenantSession } = await import('@/lib/session');
    vi.mocked(requireTenantSession).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Staff User',
        email: 'staff@club.co.uk',
        role: 'MANAGER',
        organisationId: 'org-active-1',
        needsOnboarding: false,
      },
      expires: '2026-12-31T00:00:00Z',
    });

    mockFindCentre.mockResolvedValueOnce(null);
    mockFindOrg.mockResolvedValueOnce({ id: 'org-active-2', approvalStatus: 'ACTIVE' });
    mockFindOrgMembership.mockResolvedValueOnce({
      userId: 'user-1',
      organisationId: 'org-active-2',
      role: 'TUTOR',
    });

    const { default: DashboardLayout } = await import('@/app/dashboard/layout');
    const rendered = await DashboardLayout({ children: null });
    expect(rendered).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('DashboardLayout redirects member to /pending-approval when visiting a SUSPENDED org subdomain without mutating users', async () => {
    const { headers } = await import('next/headers');
    vi.mocked(headers).mockResolvedValue(new Headers({ 'x-subdomain': 'suspended-club' }) as never);

    const { requireTenantSession } = await import('@/lib/session');
    vi.mocked(requireTenantSession).mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Staff User',
        email: 'staff@club.co.uk',
        role: 'MANAGER',
        organisationId: 'org-active-1',
        needsOnboarding: false,
      },
      expires: '2026-12-31T00:00:00Z',
    });

    mockFindCentre.mockResolvedValueOnce(null);
    mockFindOrg.mockResolvedValueOnce({ id: 'org-suspended-2', approvalStatus: 'SUSPENDED' });
    mockFindOrgMembership.mockResolvedValueOnce({
      userId: 'user-1',
      organisationId: 'org-suspended-2',
      role: 'MANAGER',
    });

    const { default: DashboardLayout } = await import('@/app/dashboard/layout');
    await expect(DashboardLayout({ children: null })).rejects.toThrow('REDIRECT:/pending-approval');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('POST /api/user/switch-org rejects switching into a SUSPENDED organisation with 403', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user-1', organisationId: 'org-1', role: 'ORG_OWNER' },
      expires: '2026-12-31T00:00:00Z',
    } as never);

    mockFindOrgMembership.mockResolvedValueOnce({
      userId: 'user-1',
      organisationId: 'a0000000-0000-4000-a000-000000000099',
      role: 'MANAGER',
    });

    const { OrgNotActiveError } = await import('@/lib/org-approval-guard');
    mockAssertOrgActive.mockRejectedValueOnce(
      new OrgNotActiveError('a0000000-0000-4000-a000-000000000099', 'SUSPENDED')
    );

    const { POST } = await import('@/app/api/user/switch-org/route');
    const req = new NextRequest('http://localhost/api/user/switch-org', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'a0000000-0000-4000-a000-000000000099' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('requirePermission rejects with OrgNotActiveError when organisation is SUSPENDED', async () => {
    const { auth } = await import('@/lib/auth');
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: 'user-1', organisationId: 'org-suspended', role: 'ORG_OWNER' },
      expires: '2026-12-31T00:00:00Z',
    } as never);

    const { OrgNotActiveError } = await import('@/lib/org-approval-guard');
    mockAssertOrgActive.mockRejectedValueOnce(new OrgNotActiveError('org-suspended', 'SUSPENDED'));

    const { requirePermission } = await import('@/lib/permissions');
    await expect(requirePermission('MANAGER')).rejects.toThrow(OrgNotActiveError);
  });
});
