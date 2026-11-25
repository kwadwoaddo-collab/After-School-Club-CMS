import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ session: vi.fn(), registration: vi.fn(), centres: vi.fn(), transaction: vi.fn(), updates: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/session', () => ({ getApiSession: m.session }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: m.centres }));
vi.mock('@/lib/services/email', () => ({ emailService: { sendRegistrationStatusUpdate: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db', () => ({ db: { query: { registrations: { findFirst: m.registration } }, transaction: m.transaction } }));
import { emailService } from '@/lib/services/email';
import { PATCH } from './route';
const REGISTRATION_ID = '00000000-0000-4000-8000-000000000001';
const params = { params: Promise.resolve({ id: REGISTRATION_ID }) };
function request(status = 'signed_up') { return new Request('http://localhost/test', { method: 'PATCH', body: JSON.stringify({ status }) }); }
beforeEach(() => {
    vi.clearAllMocks();
    m.session.mockResolvedValue({ user: { id: 'actor', organisationId: 'org', role: 'MANAGER' } }); m.centres.mockResolvedValue(['centre']);
    m.registration.mockResolvedValue({ id: REGISTRATION_ID, status: 'awaiting_confirmation', centreId: 'centre', startDate: new Date('2026-10-01'), registrationChildren: [{ childId: 'enrolling-child' }], registrationParents: [] });
    m.transaction.mockImplementation(async callback => callback({ execute: vi.fn().mockResolvedValue([]), update: () => ({ set: (data: unknown) => { m.updates(data); return { where: vi.fn().mockResolvedValue([]) }; } }), insert: () => ({ values: m.audit.mockResolvedValue([]) }) }));
});
describe('registration enrolment confirmation', () => {
    it('does not permit tutors to confirm enrolment', async () => { m.session.mockResolvedValue({ user: { id: 'tutor', organisationId: 'org', role: 'TUTOR' } }); expect((await PATCH(request() as never, params)).status).toBe(403); expect(m.transaction).not.toHaveBeenCalled(); });
    it('requires an accessible centre for non-owner confirmation', async () => { m.centres.mockResolvedValue([]); expect((await PATCH(request() as never, params)).status).toBe(403); expect(m.transaction).not.toHaveBeenCalled(); });
    it('records actor, agreed start date and state transition atomically', async () => { expect((await PATCH(request() as never, params)).status).toBe(200); expect(m.transaction).toHaveBeenCalledOnce(); expect(m.updates).toHaveBeenCalledWith(expect.objectContaining({ isRegistered: true })); expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: 'actor', organisationId: 'org', eventType: 'registration_status_changed', eventData: expect.stringContaining('"status":"signed_up"') })); });
    it('keeps returned forms awaiting confirmation without activating children', async () => { expect((await PATCH(request('awaiting_confirmation') as never, params)).status).toBe(200); expect(m.updates).toHaveBeenCalledTimes(1); expect(m.updates).toHaveBeenCalledWith(expect.objectContaining({ status: 'awaiting_confirmation' })); });
    it('propagates failed audit so the database transaction cannot commit the activation', async () => {
        m.audit.mockRejectedValueOnce(new Error('audit failure'));
        const res = await PATCH(request() as never, params);
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({ error: 'Internal server error' });
        expect(emailService.sendRegistrationStatusUpdate).not.toHaveBeenCalled();
    });
});
