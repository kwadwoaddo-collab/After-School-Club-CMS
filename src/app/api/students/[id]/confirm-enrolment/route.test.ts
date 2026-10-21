import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), centres: vi.fn(), child: vi.fn(), link: vi.fn(), transaction: vi.fn(), set: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/require-auth', () => ({ requireApiAuth: m.auth }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: m.centres }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db', () => ({ db: { query: { children: { findFirst: m.child }, registrationChildren: { findFirst: m.link } }, transaction: m.transaction } }));
import { POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
function request(body: object = { reason: 'Already attending before CMS', startDate: '2026-09-01' }) { return new Request('http://localhost/test', { method: 'POST', body: JSON.stringify(body) }); }
const params = { params: Promise.resolve({ id }) };
beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ organisationId: 'org', user: { id: 'actor', role: 'ORG_OWNER' } });
    m.child.mockResolvedValue({ id, centreId: 'centre' }); m.link.mockResolvedValue(null); m.centres.mockResolvedValue(['centre']);
    m.transaction.mockImplementation(async callback => callback({ execute: vi.fn().mockResolvedValue([]), query: { registrationChildren: { findFirst: m.link } }, update: () => ({ set: (data: unknown) => { m.set(data); return { where: vi.fn().mockResolvedValue([]) }; } }), insert: () => ({ values: m.audit.mockResolvedValue([]) }) }));
});
describe('explicit existing-student confirmation', () => {
    it('requires Owner or Manager authorization before reading student details', async () => { m.auth.mockResolvedValue(null); expect((await POST(request(), params)).status).toBe(401); expect(m.child).not.toHaveBeenCalled(); });
    it('rejects impossible calendar dates', async () => { expect((await POST(request({ reason: 'Already attending', startDate: '2026-02-31' }), params)).status).toBe(400); expect(m.transaction).not.toHaveBeenCalled(); });
    it('does not expose a student outside the authenticated organisation', async () => { m.child.mockResolvedValue(null); expect((await POST(request(), params)).status).toBe(404); expect(m.transaction).not.toHaveBeenCalled(); });
    it('rolls back when a registration is linked during confirmation', async () => { m.link.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'new-link' }); await expect(POST(request(), params)).rejects.toThrow('registration was linked'); expect(m.audit).not.toHaveBeenCalled(); });
    it('rejects missing reason/date and leaves history unchanged', async () => { expect((await POST(request({ reason: '' }), params)).status).toBe(400); expect(m.transaction).not.toHaveBeenCalled(); });
    it('rejects registration-linked students instead of bypassing awaiting confirmation', async () => { m.link.mockResolvedValue({ id: 'registration-link' }); expect((await POST(request(), params)).status).toBe(409); expect(m.transaction).not.toHaveBeenCalled(); });
    it('enforces Manager centre isolation', async () => { m.auth.mockResolvedValue({ organisationId: 'org', user: { id: 'actor', role: 'MANAGER' } }); m.centres.mockResolvedValue([]); expect((await POST(request(), params)).status).toBe(403); expect(m.audit).not.toHaveBeenCalled(); });
    it('couples eligibility and actor/reason/start-date audit in a transaction', async () => { expect((await POST(request(), params)).status).toBe(200); expect(m.set).toHaveBeenCalledWith(expect.objectContaining({ isRegistered: true })); expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ organisationId: 'org', userId: 'actor', eventType: 'manual_student_enrolment_confirmed', eventData: expect.stringContaining('"startDate":"2026-09-01"') })); });
    it('fails the request if the audit transaction fails', async () => { m.audit.mockRejectedValueOnce(new Error('audit unavailable')); await expect(POST(request(), params)).rejects.toThrow('audit unavailable'); });
});
