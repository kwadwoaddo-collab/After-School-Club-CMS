import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import { GET, maxDuration, computeNextSchoolYear } from './route';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe('/api/cron/school-year-roll (D5.R + PR-14)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
  });

  it('schedules /api/cron/school-year-roll on 1 September (0 3 1 9 *) in vercel.json', () => {
    const vercelPath = path.resolve(process.cwd(), 'vercel.json');
    const config = JSON.parse(fs.readFileSync(vercelPath, 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>;
    };

    expect(config.crons).toContainEqual({
      path: '/api/cron/school-year-roll',
      schedule: '0 3 1 9 *',
    });
  });

  it('exports numeric maxDuration = 60', () => {
    expect(maxDuration).toBe(60);
  });

  it('computes canonical Y1..Y13 / Reception / Graduated transitions without corrupting multi-year strings', () => {
    expect(computeNextSchoolYear('Nursery')).toBe('Reception');
    expect(computeNextSchoolYear('yr nursery')).toBe('Reception');
    expect(computeNextSchoolYear('Reception')).toBe('Y1');
    expect(computeNextSchoolYear('Year R')).toBe('Y1');
    expect(computeNextSchoolYear('0')).toBe('Y1');
    expect(computeNextSchoolYear('Y1')).toBe('Y2');
    expect(computeNextSchoolYear('4')).toBe('Y5');
    expect(computeNextSchoolYear('Year 3')).toBe('Y4');
    expect(computeNextSchoolYear('Y3')).toBe('Y4');
    expect(computeNextSchoolYear('Y12')).toBe('Y13');
    expect(computeNextSchoolYear('12')).toBe('Y13');
    expect(computeNextSchoolYear('Y13')).toBe('Graduated');
    expect(computeNextSchoolYear('Year 13')).toBe('Graduated');
    expect(computeNextSchoolYear('13')).toBe('Graduated');

    // Never concatenate digits or re-roll non-standard / already-graduated strings
    expect(computeNextSchoolYear('Year 3/4')).toBe('Year 3/4');
    expect(computeNextSchoolYear('Graduated')).toBe('Graduated');
    expect(computeNextSchoolYear('KS2')).toBe('KS2');
    expect(computeNextSchoolYear('')).toBe('');
  });

  it('rejects requests without Authorization header with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Missing authorization header');
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
    vi.mocked(db.transaction).mockImplementationOnce(async (cb) => {
      const tx = {
        execute: vi.fn().mockResolvedValueOnce([{ locked: false }]),
      };
      return cb(tx as never);
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
    vi.mocked(db.transaction).mockImplementationOnce(async (cb) => {
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
      return cb(tx as never);
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

  it('executes set-based rollover excluding soft-deleted children and bulk-inserts audit events', async () => {
    const insertedAuditBatches: Array<Array<{ organisationId: string; eventType: string; eventData: string }>> = [];
    const executeMock = vi
      .fn()
      .mockResolvedValueOnce([{ locked: true }])
      .mockResolvedValueOnce([{ rolled_count: 4 }]);

    let selectCall = 0;
    const selectMock = vi.fn().mockImplementation(() => {
      selectCall += 1;
      if (selectCall === 1) {
        return {
          from: () => ({
            where: () => ({
              limit: vi.fn().mockResolvedValueOnce([]),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockResolvedValueOnce([{ id: 'org-1' }, { id: 'org-2' }]),
      };
    });

    const insertMock = vi.fn(() => ({
      values: vi.fn((rows: Array<{ organisationId: string; eventType: string; eventData: string }>) => {
        insertedAuditBatches.push(rows);
        return Promise.resolve(true);
      }),
    }));

    vi.mocked(db.transaction).mockImplementationOnce(async (cb) =>
      cb({
        execute: executeMock,
        select: selectMock,
        insert: insertMock,
      } as never)
    );

    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll?year=2026', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      skipped: false,
      rolledCount: 4,
      rolloverYear: 2026,
    });

    // 1 advisory lock query + 1 set-based UPDATE CTE excluding soft-deleted children
    expect(executeMock).toHaveBeenCalledTimes(2);
    const updateSqlArg = new PgDialect().sqlToQuery(executeMock.mock.calls[1][0]).sql;
    expect(updateSqlArg).toContain('WHERE deleted_at IS NULL');
    expect(updateSqlArg).toContain('AND c.deleted_at IS NULL');
    expect(updateSqlArg).toContain("^(?:year[[:space:]]*|yr[.]?[[:space:]]*|y)?(0?[0-9]|1[0-3])$");
    expect(updateSqlArg).toContain("^(?:year[[:space:]]*|yr[.]?[[:space:]]*|y)?([0-9]{1,2})$");
    expect(updateSqlArg).not.toContain('(d{1,2})');
    expect(updateSqlArg).not.toContain('years*');

    // Single bulk insert across all organisations
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertedAuditBatches).toHaveLength(1);
    expect(insertedAuditBatches[0]).toHaveLength(2);
    expect(insertedAuditBatches[0][0].organisationId).toBe('org-1');
    expect(insertedAuditBatches[0][0].eventType).toBe('school_year_rollover_completed');
    expect(JSON.parse(insertedAuditBatches[0][0].eventData)).toMatchObject({
      rolloverYear: 2026,
      academicYearLabel: '2026/2027',
      totalRolled: 4,
    });
  });

  it('returns sanitized 500 error when transaction throws', async () => {
    vi.mocked(db.transaction).mockRejectedValueOnce(
      new Error('Neon connection timeout postgres://secret')
    );

    const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll?year=2026', {
      headers: { authorization: 'Bearer test-cron-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal database error' });
  });
});
