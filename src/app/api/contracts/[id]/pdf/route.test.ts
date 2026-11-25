import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ session: vi.fn(), accessible: vi.fn(), selects: [] as unknown[][], audits: [] as unknown[] }));
vi.mock('@/lib/session', () => ({ getApiSession: m.session }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: m.accessible }));
vi.mock('@/db', () => ({ db: {
    select: () => ({ from: () => ({ where: () => Promise.resolve(m.selects.shift() ?? []) }) }),
    insert: () => ({ values: (v: unknown) => { m.audits.push(v); return Promise.resolve([]); } }),
} }));
import { GET } from './route';

const id = '44444444-4444-4444-8444-444444444444';
const call = (cid = id) => GET({} as never, { params: Promise.resolve({ id: cid }) });
const as = (role: string) => m.session.mockResolvedValue({ user: { id: 'u', role, organisationId: 'org' } });

beforeEach(() => { vi.clearAllMocks(); m.selects.length = 0; m.audits.length = 0; m.accessible.mockResolvedValue(['centre']); as('MANAGER'); });

describe('signed contract download', () => {
    it('streams a private PDF to an authorised manager and audits it', async () => {
        m.selects.push([{ centreId: 'centre', status: 'signed' }], [{ content: Buffer.from('%PDF-1.4'), sizeBytes: 8 }]);
        const res = await call();
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('private, no-store');
        expect(res.headers.get('Content-Type')).toBe('application/pdf');
        expect(m.audits.length).toBe(1);
    });
    it('requires sign-in', async () => {
        m.session.mockResolvedValue(null);
        expect((await call()).status).toBe(401);
    });
    it('hides it from front desk, other centres, unsigned contracts and bad ids', async () => {
        as('FRONT_DESK'); m.selects.push([{ centreId: 'centre', status: 'signed' }]);
        expect((await call()).status).toBe(404);
        as('MANAGER'); m.accessible.mockResolvedValue(['other']); m.selects.push([{ centreId: 'centre', status: 'signed' }]);
        expect((await call()).status).toBe(404);
        m.accessible.mockResolvedValue(['centre']); m.selects.push([{ centreId: 'centre', status: 'sent' }]);
        expect((await call()).status).toBe(404);
        expect((await call('not-a-uuid')).status).toBe(404);
        m.selects.push([]);
        expect((await call()).status).toBe(404);
    });
});
