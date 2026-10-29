import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ session: vi.fn(), select: vi.fn(), from: vi.fn(), role: vi.fn(), centre: vi.fn() }));
vi.mock('@/lib/session', () => ({ getApiSession: m.session }));
vi.mock('@/lib/permissions', () => ({ getUserRoleForCentre: m.role }));
vi.mock('@/db', () => ({ db: { select: m.select, query: { centres: { findFirst: m.centre } } } }));
import { GET } from './route';
const id = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id }) };
const request = () => new NextRequest(`https://app.example.test/api/documents/${id}`);
beforeEach(() => {
    vi.resetAllMocks();
    m.session.mockResolvedValue({ user: { id: 'staff', organisationId: 'org' } });
    m.select.mockImplementation(() => ({ from: m.from }));
    m.from.mockReturnValueOnce({ where: async () => [{ centreId: 'centre' }] }).mockReturnValueOnce({ where: async () => [{ content: Buffer.from('%PDF-1.7\n%%EOF'), filename: 'policy "\r\n漢.pdf', sizeBytes: 14 }] });
    m.role.mockResolvedValue('FRONT_DESK');
    m.centre.mockResolvedValue({ id: 'centre' });
});
describe('private centre PDF response boundary', () => {
    it('does not query metadata or bytes for unauthenticated requests', async () => {
        m.session.mockResolvedValue(null);
        expect((await GET(request(), context)).status).toBe(401);
        expect(m.select).not.toHaveBeenCalled();
    });
    it('does not query metadata for invalid identifiers', async () => {
        expect((await GET(request(), { params: Promise.resolve({ id: '../policy' }) })).status).toBe(404);
        expect(m.select).not.toHaveBeenCalled();
    });
    it('does not fetch document bytes when live centre membership is absent', async () => {
        m.role.mockResolvedValue(null);
        expect((await GET(request(), context)).status).toBe(404);
        expect(m.select).toHaveBeenCalledTimes(1);
    });
    it('does not fetch bytes for foreign tenant or removed metadata', async () => {
        m.from.mockReset().mockReturnValueOnce({ where: async () => [] });
        expect((await GET(request(), context)).status).toBe(404);
        expect(m.select).toHaveBeenCalledTimes(1);
        expect(m.role).not.toHaveBeenCalled();
    });
    it('serves private attachment with safe content headers after access succeeds', async () => {
        const response = await GET(request(), context);
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('content-security-policy')).toContain('sandbox');
        expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="document.pdf"; filename\*=UTF-8''/);
        expect(response.headers.get('content-disposition')).not.toMatch(/[\r\n]/);
        expect(m.select).toHaveBeenCalledTimes(2);
    });
    it('only switches to sandboxed inline view on explicit view=1', async () => {
        const response = await GET(new NextRequest(`https://app.example.test/api/documents/${id}?view=1`), context);
        expect(response.headers.get('content-disposition')).toMatch(/^inline;/);
        expect(response.headers.get('content-security-policy')).toContain('sandbox');
    });
});
