import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), centres: vi.fn(), child: vi.fn(), confirmed: vi.fn(), previous: vi.fn(), values: vi.fn(), transaction: vi.fn(), execute: vi.fn() }));
vi.mock('@/lib/require-auth', () => ({ requireApiAuth: m.auth }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: m.centres }));
vi.mock('@/lib/enrolment/finance-eligibility', () => ({ confirmedEnrolmentChildSql: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db', () => ({ db: { transaction: m.transaction } }));
import { POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
const params = { params: Promise.resolve({ id }) };
const pause = { action: 'status', status: 'paused', effectiveDate: '2026-10-21', reason: 'Parent requested a temporary break', expectedRestartDate: '2026-11-21', nextContactDate: '2026-11-14' };
function request(body: object = pause) { return new Request('http://localhost/test', { method: 'POST', body: JSON.stringify(body) }); }
beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ organisationId: 'org', user: { id: 'actor', role: 'MANAGER' } }); m.centres.mockResolvedValue(['centre']);
    m.child.mockResolvedValue({ id, centreId: 'centre' }); m.confirmed.mockResolvedValue([{ id }]); m.previous.mockResolvedValue({ status: 'paused' }); m.values.mockResolvedValue([]); m.execute.mockResolvedValue([]);
    m.transaction.mockImplementation(async callback => callback({ execute: m.execute, query: { children: { findFirst: m.child }, studentEnrolmentEvents: { findFirst: m.previous } }, select: () => ({ from: () => ({ where: () => ({ limit: m.confirmed }) }) }), insert: () => ({ values: m.values }) }));
});
describe('student lifecycle and follow-up', () => {
    it('requires authentication', async () => { m.auth.mockResolvedValue(null); expect((await POST(request(), params)).status).toBe(401); expect(m.transaction).not.toHaveBeenCalled(); });
    it('denies status changes by front desk while permitting scoped contact logging', async () => { m.auth.mockResolvedValue({ organisationId: 'org', user: { id: 'actor', role: 'FRONT_DESK' } }); expect((await POST(request(), params)).status).toBe(403); expect((await POST(request({ action: 'contact', notes: 'Parent called to discuss restarting', nextContactDate: '2026-11-01' }), params)).status).toBe(200); expect(m.confirmed).not.toHaveBeenCalled(); });
    it('does not expose a student outside the organisation', async () => { m.child.mockResolvedValue(null); expect((await POST(request(), params)).status).toBe(404); expect(m.values).not.toHaveBeenCalled(); });
    it('enforces centre membership on the transactionally refreshed child', async () => { m.centres.mockResolvedValue([]); expect((await POST(request(), params)).status).toBe(403); expect(m.values).not.toHaveBeenCalled(); });
    it('cannot use active status to admit a prospect', async () => { m.confirmed.mockResolvedValue([]); expect((await POST(request({ ...pause, status: 'active' }), params)).status).toBe(409); expect(m.values).not.toHaveBeenCalled(); });
    it('validates real dates, required reason and restart ordering', async () => { for (const data of [{ ...pause, effectiveDate: '2026-02-31' }, { ...pause, reason: '' }, { ...pause, expectedRestartDate: '2026-09-01' }]) expect((await POST(request(data), params)).status).toBe(400); expect(m.transaction).not.toHaveBeenCalled(); });
    it('records a durable pause and actor audit after acquiring the billing lock', async () => { expect((await POST(request(), params)).status).toBe(200); expect(m.execute).toHaveBeenCalledOnce(); expect(m.values).toHaveBeenNthCalledWith(1, expect.objectContaining({ childId: id, organisationId: 'org', createdBy: 'actor', status: 'paused', effectiveDate: '2026-10-21', expectedRestartDate: '2026-11-21', feeReviewConfirmed: false })); expect(m.values).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: 'actor', eventType: 'student_enrolment_status_changed' })); });
    it('reactivates without trusting a client fee-review flag or generating an invoice', async () => { expect((await POST(request({ ...pause, status: 'active', feeReviewConfirmed: true, expectedRestartDate: null }), params)).status).toBe(200); expect(m.values).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'active', feeReviewConfirmed: false })); expect(m.values).toHaveBeenCalledTimes(2); });
    it('does not turn an already-active record into a new billing hold accidentally', async () => { m.previous.mockResolvedValue({ status: 'active' }); expect((await POST(request({ ...pause, status: 'active' }), params)).status).toBe(409); expect(m.values).not.toHaveBeenCalled(); });
    it('records actual contact time and next call without changing enrolment', async () => { expect((await POST(request({ action: 'contact', notes: 'Parent confirmed they will call back', nextContactDate: '2026-11-01' }), params)).status).toBe(200); expect(m.values).toHaveBeenNthCalledWith(1, expect.objectContaining({ contactedAt: expect.any(Date), notes: 'Parent confirmed they will call back', nextContactDate: '2026-11-01', createdBy: 'actor' })); expect(m.previous).not.toHaveBeenCalled(); });
    it('fails the whole transaction on audit failure', async () => { m.values.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('audit failure')); expect((await POST(request(), params)).status).toBe(500); });
});
