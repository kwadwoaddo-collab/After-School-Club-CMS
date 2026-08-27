import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe('/api/cron/school-year-roll (D5.R)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
  });

  it('rejects requests without Authorization header with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorised');
  });

  it('rejects requests with invalid Authorization token with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 503 if CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll', {
      headers: { authorization: 'Bearer some-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(503);
  });

  it('handles concurrency safely: returns skipped when advisory lock cannot be acquired', async () => {
    (db.transaction as any).mockImplementationOnce(async (cb: any) => {
      const tx = {
        execute: vi.fn().mockResolvedValueOnce([{ locked: false }]),
      };
      return cb(tx);
    });

    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll?year=2026', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.rolledCount).toBe(0);
    expect(body.reason).toContain('currently running in another process');
  });

  it('handles duplicate/sequential execution: returns skipped when year already rolled in auditEvents', async () => {
    (db.transaction as any).mockImplementationOnce(async (cb: any) => {
      const tx = {
        execute: vi.fn().mockResolvedValueOnce([{ locked: true }]),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValueOnce([{ id: 'existing-audit-id' }]),
            })),
          })),
        })),
      };
      return cb(tx);
    });

    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll?year=2026', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
    expect(body.rolledCount).toBe(0);
    expect(body.reason).toContain('already completed');
  });

  it('executes rollover successfully and advances year groups correctly', async () => {
    const updatedChildren: Array<{ id: string; schoolYear: string }> = [];
    const insertedAuditEvents: any[] = [];

    (db.transaction as any).mockImplementationOnce(async (cb: any) => {
      const tx = {
        execute: vi.fn().mockResolvedValueOnce([{ locked: true }]),
        select: vi.fn((fields: any) => ({
          from: vi.fn((table: any) => {
            return {
              where: vi.fn(() => ({
                limit: vi.fn().mockResolvedValueOnce([]), // no existing audit run
              })),
              // when select(orgs) or select(children) without where:
              then: (resolve: any) => {
                // If selecting organisations
                if (fields?.id && !fields?.schoolYear) {
                  resolve([{ id: 'org-1' }]);
                } else {
                  // selecting children
                  resolve([
                    { id: 'c1', schoolYear: 'Nursery', organisationId: 'org-1' },
                    { id: 'c2', schoolYear: 'Reception', organisationId: 'org-1' },
                    { id: 'c3', schoolYear: '4', organisationId: 'org-1' },
                    { id: 'c4', schoolYear: '13', organisationId: 'org-1' },
                    { id: 'c5', schoolYear: 'Graduated', organisationId: 'org-1' },
                  ]);
                }
              },
            };
          }),
        })),
        update: vi.fn(() => ({
          set: vi.fn((data: any) => ({
            where: vi.fn((whereClause: any) => {
              updatedChildren.push(data);
              return Promise.resolve(true);
            }),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((val: any) => {
            insertedAuditEvents.push(val);
            return Promise.resolve(true);
          }),
        })),
      };
      return cb(tx);
    });

    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll?year=2026', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.skipped).toBe(false);
    expect(body.rolledCount).toBe(4); // c1, c2, c3, c4 rolled; c5 (Graduated) remained unchanged

    // Check individual progression
    expect(updatedChildren).toEqual([
      { schoolYear: 'Reception', updatedAt: expect.any(Date) }, // Nursery -> Reception
      { schoolYear: '1', updatedAt: expect.any(Date) },         // Reception -> 1
      { schoolYear: '5', updatedAt: expect.any(Date) },         // 4 -> 5
      { schoolYear: 'Graduated', updatedAt: expect.any(Date) }, // 13 -> Graduated
    ]);

    // Check audit event recorded
    expect(insertedAuditEvents.length).toBe(1);
    expect(insertedAuditEvents[0].organisationId).toBe('org-1');
    expect(insertedAuditEvents[0].eventType).toBe('school_year_rollover_completed');
    expect(JSON.parse(insertedAuditEvents[0].eventData).rolloverYear).toBe(2026);
  });
});
