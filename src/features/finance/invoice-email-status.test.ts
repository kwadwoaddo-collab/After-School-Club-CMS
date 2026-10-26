import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ insert: vi.fn(), findFirst: vi.fn(), send: vi.fn(), values: vi.fn() }));
vi.mock('@/db', () => ({ db: { insert: mocks.insert, query: { auditEvents: { findFirst: mocks.findFirst } } } }));
vi.mock('@/lib/services/email', () => ({ emailService: { sendInvoiceCreated: mocks.send } }));
import { readInvoiceEmailStatus, sendAuditedInvoiceEmail } from './invoice-email-status';
const input = { invoiceId: 'invoice', organisationId: 'org', userId: 'actor', parentFirstName: 'Sample', parentEmail: 'dummy@example.test', invoiceNumber: 'INV-1', amount: 1900, dueDate: new Date('2026-11-06'), centreName: 'Test centre', portalUrl: 'http://localhost/portal/billing' };
beforeEach(() => { vi.clearAllMocks(); mocks.insert.mockReturnValue({ values: mocks.values }); mocks.values.mockResolvedValue(undefined); mocks.send.mockResolvedValue({ success: true, messageId: 'provider-id' }); });
describe('audited invoice email outcomes', () => {
 it('records provider acceptance, never claims delivered, and keeps invoice identity', async () => {
  expect((await sendAuditedInvoiceEmail(input)).status).toBe('accepted');
  const events = mocks.values.mock.calls.map(call => ({ ...call[0], data: JSON.parse(call[0].eventData) }));
  expect(events.map(e => e.data.status)).toEqual(['sending', 'accepted']);
  expect(events[1]).toMatchObject({ organisationId:'org', userId:'actor', data:{invoiceId:'invoice',messageId:'provider-id'} });
 });
 it('records no-address without calling the provider', async () => {
  expect((await sendAuditedInvoiceEmail({...input,parentEmail:null})).status).toBe('no_address');
  expect(mocks.send).not.toHaveBeenCalled();
 });
 it('does not send if the initial audit write fails', async () => {
  mocks.values.mockRejectedValueOnce(new Error('audit unavailable'));
  expect((await sendAuditedInvoiceEmail(input)).status).toBe('unknown');
  expect(mocks.send).not.toHaveBeenCalled();
 });
 it('uses unknown when provider acceptance may precede a transport error', async () => {
  mocks.send.mockResolvedValue({ success:false, error:'connection lost',outcome:'unknown' });
  expect((await sendAuditedInvoiceEmail(input)).status).toBe('unknown');
  mocks.send.mockRejectedValueOnce(new Error('socket closed'));
  expect((await sendAuditedInvoiceEmail(input)).status).toBe('unknown');
 });
 it('uses failed only when known not sent, and does not retry', async () => {
  mocks.send.mockResolvedValue({success:false,outcome:'not_sent'});
  expect((await sendAuditedInvoiceEmail(input)).status).toBe('failed');
  expect(mocks.send).toHaveBeenCalledTimes(1);
 });
 it('does not report success if the final audit result could not be stored', async () => {
  mocks.values.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('lost result'));
  expect((await sendAuditedInvoiceEmail(input)).status).toBe('unknown');
  expect(mocks.send).toHaveBeenCalledTimes(1);
 });
 it('reads a persisted scoped status after reload and handles old invoices', async () => {
  mocks.findFirst.mockResolvedValue({eventData:JSON.stringify({status:'accepted',attemptedAt:'2026-10-26T10:00:00Z'})});
  expect(await readInvoiceEmailStatus('invoice','org')).toEqual({status:'accepted',attemptedAt:'2026-10-26T10:00:00Z'});
  expect(mocks.findFirst.mock.calls[0][0].where).toBeTruthy();
  mocks.findFirst.mockResolvedValue(null);
  expect(await readInvoiceEmailStatus('old','org')).toBeNull();
 });
});
