import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const checkRateLimit = vi.fn();
const getClientIP = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
    strictRateLimit: { name: 'strict' },
    checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
    getClientIP: (...args: unknown[]) => getClientIP(...args),
}));

const sendMagicLink = vi.fn();
vi.mock('@/lib/services/email', () => ({
    EmailService: class {
        sendMagicLink(...args: unknown[]) {
            return sendMagicLink(...args);
        }
    },
}));

vi.mock('@/lib/base-url', () => ({
    getBaseUrl: () => 'https://portal.example.com',
}));

const parentsFindFirst = vi.fn();
const updateWhere = vi.fn().mockResolvedValue(undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const dbUpdate = vi.fn<(...args: unknown[]) => { set: typeof updateSet }>(() => ({ set: updateSet }));

vi.mock('@/db', () => ({
    db: {
        query: {
            parents: {
                findFirst: (...args: unknown[]) => parentsFindFirst(...args),
            },
        },
        update: (...args: unknown[]) => dbUpdate(...args),
    },
}));

const pgDialect = new PgDialect();

describe('POST /api/portal/login — DC-05 soft-deleted parent filtering & deterministic order', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getClientIP.mockReturnValue('127.0.0.1');
        checkRateLimit.mockResolvedValue({ success: true });
        sendMagicLink.mockResolvedValue({ success: true });
    });

    it('applies isNull(parents.deletedAt) and deterministic orderBy(desc(updatedAt), desc(createdAt))', async () => {
        parentsFindFirst.mockResolvedValue(undefined);

        const { POST } = await import('../route');
        const req = new NextRequest('http://localhost/api/portal/login', {
            method: 'POST',
            body: JSON.stringify({ email: '  Parent@Example.com ' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);

        expect(parentsFindFirst).toHaveBeenCalledTimes(1);
        const queryArgs = parentsFindFirst.mock.calls[0][0] as {
            where: SQL;
            orderBy: SQL[];
        };

        expect(queryArgs.where).toBeDefined();
        const compiledWhere = pgDialect.sqlToQuery(queryArgs.where);
        expect(compiledWhere.sql).toContain('"parents"."email" = $1');
        expect(compiledWhere.sql.toLowerCase()).toContain('"parents"."deleted_at" is null');
        expect(compiledWhere.params).toContain('parent@example.com');

        expect(Array.isArray(queryArgs.orderBy)).toBe(true);
        expect(queryArgs.orderBy).toHaveLength(2);
        const compiledOrder0 = pgDialect.sqlToQuery(queryArgs.orderBy[0]).sql.toLowerCase();
        const compiledOrder1 = pgDialect.sqlToQuery(queryArgs.orderBy[1]).sql.toLowerCase();
        expect(compiledOrder0).toContain('"parents"."updated_at" desc');
        expect(compiledOrder1).toContain('"parents"."created_at" desc');
    });

    it('sends no magic link and writes no token when only a soft-deleted parent exists (preserving anti-enumeration)', async () => {
        const dbRows = [
            {
                id: 'deleted-parent-1',
                firstName: 'Deleted',
                email: 'deleted@example.com',
                deletedAt: new Date('2026-10-01T10:00:00Z'),
                updatedAt: new Date('2026-10-01T10:00:00Z'),
                createdAt: new Date('2026-01-01T10:00:00Z'),
            },
        ];

        parentsFindFirst.mockImplementation(async (queryArgs: { where: SQL }) => {
            const compiledWhere = pgDialect.sqlToQuery(queryArgs.where);
            const enforcesNotDeleted = compiledWhere.sql.toLowerCase().includes('"parents"."deleted_at" is null');
            return dbRows.find(
                row => row.email === compiledWhere.params[0] && (!enforcesNotDeleted || row.deletedAt === null)
            );
        });

        const { POST } = await import('../route');
        const req = new NextRequest('http://localhost/api/portal/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'deleted@example.com' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).toEqual({
            success: true,
            message: 'If an account exists with this email, a login link has been sent.',
        });

        expect(dbUpdate).not.toHaveBeenCalled();
        expect(sendMagicLink).not.toHaveBeenCalled();
    });

    it('authenticates the active parent when a soft-deleted duplicate exists for the same email', async () => {
        const dbRows = [
            {
                id: 'deleted-parent-old',
                firstName: 'Archived',
                email: 'shared@example.com',
                deletedAt: new Date('2026-11-01T12:00:00Z'),
                updatedAt: new Date('2026-11-01T12:00:00Z'),
                createdAt: new Date('2026-01-01T00:00:00Z'),
            },
            {
                id: 'active-parent-current',
                firstName: 'Active',
                email: 'shared@example.com',
                deletedAt: null,
                updatedAt: new Date('2026-10-15T12:00:00Z'),
                createdAt: new Date('2026-10-15T12:00:00Z'),
            },
        ];

        parentsFindFirst.mockImplementation(async (queryArgs: { where: SQL }) => {
            const compiledWhere = pgDialect.sqlToQuery(queryArgs.where);
            const enforcesNotDeleted = compiledWhere.sql.toLowerCase().includes('"parents"."deleted_at" is null');
            const matching = dbRows
                .filter(row => row.email === compiledWhere.params[0] && (!enforcesNotDeleted || row.deletedAt === null))
                .sort(
                    (a, b) =>
                        b.updatedAt.getTime() - a.updatedAt.getTime() ||
                        b.createdAt.getTime() - a.createdAt.getTime()
                );
            return matching[0];
        });

        const { POST } = await import('../route');
        const req = new NextRequest('http://localhost/api/portal/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'shared@example.com' }),
        });

        const res = await POST(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);

        expect(dbUpdate).toHaveBeenCalledTimes(1);
        const whereUpdateSql = pgDialect.sqlToQuery(updateWhere.mock.calls[0][0] as SQL);
        expect(whereUpdateSql.params).toContain('active-parent-current');
        expect(whereUpdateSql.params).not.toContain('deleted-parent-old');

        expect(sendMagicLink).toHaveBeenCalledTimes(1);
        expect(sendMagicLink).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'shared@example.com',
                name: 'Active',
                magicLink: expect.stringContaining('https://portal.example.com/portal/verify?token='),
            })
        );
    });

    it('preserves rate limiting (429 when exceeded, 503 when unavailable)', async () => {
        checkRateLimit.mockResolvedValueOnce({ success: false, status: 'limited' });
        const { POST } = await import('../route');
        const req429 = new NextRequest('http://localhost/api/portal/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'parent@example.com' }),
        });
        const res429 = await POST(req429);
        expect(res429.status).toBe(429);
        expect(parentsFindFirst).not.toHaveBeenCalled();

        checkRateLimit.mockResolvedValueOnce({ success: false, status: 'unavailable' });
        const req503 = new NextRequest('http://localhost/api/portal/login', {
            method: 'POST',
            body: JSON.stringify({ email: 'parent@example.com' }),
        });
        const res503 = await POST(req503);
        expect(res503.status).toBe(503);
        expect(parentsFindFirst).not.toHaveBeenCalled();
    });
});
