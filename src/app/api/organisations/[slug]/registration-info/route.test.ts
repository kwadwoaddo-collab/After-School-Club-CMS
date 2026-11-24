import { NextRequest } from 'next/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    query: {
      organisations: { findFirst: vi.fn() },
    },
  },
}));

import { db } from '@/db';
import { GET } from './route';

describe('GET /api/organisations/[slug]/registration-info', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when slug does not match any organisation', async () => {
    vi.mocked(db.query.organisations.findFirst).mockResolvedValueOnce(undefined);

    const req = new NextRequest('http://localhost/api/organisations/unknown-club/registration-info');
    const res = await GET(req, { params: Promise.resolve({ slug: 'unknown-club' }) });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Organisation not found' });
  });

  it.each(['PENDING', 'SUSPENDED', 'REJECTED'] as const)(
    'returns 403 and hides metadata when organisation approvalStatus is %s',
    async (approvalStatus) => {
      vi.mocked(db.query.organisations.findFirst).mockResolvedValueOnce({
        id: 'org-1',
        name: 'Inactive Club',
        approvalStatus,
        logoUrl: 'https://blob.example.com/secret-logo.png',
        brandColor: '#0F766E',
        registrationTerms: 'Private draft terms',
        contactEmail: 'owner@inactive.example.co.uk',
        sessionSlots: '["Monday 15:30-17:30"]',
        registrationPricing: '{"selfFinanceRate":25,"taxCreditRate":35}',
        centres: [{ id: 'c1', name: 'Main Centre' }],
      } as never);

      const req = new NextRequest('http://localhost/api/organisations/inactive-club/registration-info');
      const res = await GET(req, { params: Promise.resolve({ slug: 'inactive-club' }) });
      const body = await res.json();

      expect(res.status).toBe(403);
      expect(body).toEqual({ error: 'Organisation is not active' });
      expect(JSON.stringify(body)).not.toContain('owner@inactive.example.co.uk');
      expect(JSON.stringify(body)).not.toContain('Inactive Club');
    },
  );

  it('returns 200 with public metadata and strips approvalStatus when organisation is ACTIVE', async () => {
    vi.mocked(db.query.organisations.findFirst).mockResolvedValueOnce({
      id: 'org-active',
      name: 'Sydenham After School Club',
      approvalStatus: 'ACTIVE',
      logoUrl: null,
      brandColor: '#0F766E',
      registrationTerms: 'Standard T&Cs',
      contactEmail: 'hello@sydenham.example.co.uk',
      sessionSlots: '["Monday 15:30-17:30"]',
      registrationPricing: '{"selfFinanceRate":22}',
      centres: [{ id: 'c1', name: 'Sydenham Centre' }],
    } as never);

    const req = new NextRequest('http://localhost/api/organisations/sydenham/registration-info');
    const res = await GET(req, { params: Promise.resolve({ slug: 'sydenham' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe('Sydenham After School Club');
    expect(body.sessionSlots).toEqual(['Monday 15:30-17:30']);
    expect(body.pricing).toEqual({ selfFinanceRate: 22, taxCreditRate: 30 });
    expect(body).not.toHaveProperty('approvalStatus');
  });
});
