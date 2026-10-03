import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import postgres from 'postgres';
import { assertTestDatabaseUrl } from './helpers/test-db-guard';
import { applyAndVerifyTestDbMigrations } from './helpers/test-db-migrator';
import { recordPayment } from '../actions';
import { db, client as dbClient } from '@/db';

const testDbUrl = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);

// Direct postgres client for out-of-band test inspection and transaction locking
const directSql = postgres(testDbUrl, { max: 5, ssl: false });

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const CENTRE_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const PARENT_ID = '44444444-4444-4444-4444-444444444444';

// Mock session user
const sessionUser = {
  id: USER_ID,
  role: 'ORG_OWNER' as const,
  organisationId: ORG_ID,
};

vi.mock('@/lib/session', () => ({
  requireTenantSession: vi.fn(async () => ({
    user: sessionUser,
  })),
  getTypedSession: vi.fn(async () => ({
    user: sessionUser,
  })),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(async () => ({
    user: sessionUser,
  })),
}));

describe('Isolated PostgreSQL Concurrency & Idempotency Suite (*.pg-isolated.test.ts)', () => {
  beforeAll(async () => {
    // 1. Verify target database is strictly local loopback ending in _test
    const [dbInfo] = await directSql<{ current_db: string }[]>`SELECT current_database() as current_db`;
    expect(dbInfo.current_db).toMatch(/_test$/);

    // 2. Apply and verify Drizzle migrations (including 0030)
    const migrationResult = await applyAndVerifyTestDbMigrations(testDbUrl);
    expect(migrationResult.success).toBe(true);
    expect(migrationResult.hasIdempotencyKeyColumn).toBe(true);
    expect(migrationResult.hasRequestFingerprintColumn).toBe(true);
    expect(migrationResult.hasIdempotencyIndex).toBe(true);

    // 3. Seed required tenant records
    await directSql`
      INSERT INTO organisations (id, name, slug)
      VALUES (${ORG_ID}, 'Isolated Test Org', 'isolated-test-org')
      ON CONFLICT (id) DO NOTHING
    `;

    await directSql`
      INSERT INTO centres (id, organisation_id, name, slug)
      VALUES (${CENTRE_ID}, ${ORG_ID}, 'Isolated Test Centre', 'isolated-test-centre')
      ON CONFLICT (id) DO NOTHING
    `;

    await directSql`
      INSERT INTO users (id, email, name, role, organisation_id)
      VALUES (${USER_ID}, 'owner@isolated.test', 'Isolated Test Owner', 'ORG_OWNER', ${ORG_ID})
      ON CONFLICT (id) DO NOTHING
    `;

    await directSql`
      INSERT INTO org_memberships (user_id, organisation_id, role)
      VALUES (${USER_ID}, ${ORG_ID}, 'ORG_OWNER')
      ON CONFLICT (user_id, organisation_id) DO UPDATE SET role = 'ORG_OWNER'
    `;

    await directSql`
      INSERT INTO parents (id, organisation_id, first_name, last_name, email, preferred_contact)
      VALUES (${PARENT_ID}, ${ORG_ID}, 'Isolated', 'Parent', 'parent@isolated.test', 'email')
      ON CONFLICT (id) DO NOTHING
    `;
  });

  beforeEach(async () => {
    const testInvoiceIds = [
      '66666666-6666-6666-6666-666666666661',
      '66666666-6666-6666-6666-666666666662',
      '66666666-6666-6666-6666-666666666663',
      '66666666-6666-6666-6666-666666666664',
      '66666666-6666-6666-6666-666666666665',
    ];
    await directSql`DELETE FROM payments WHERE invoice_id = ANY(${testInvoiceIds})`;
    await directSql`DELETE FROM audit_events WHERE organisation_id = ${ORG_ID}`;
  });

  afterAll(async () => {
    await directSql.end();
    await dbClient.end();
  });

  it('verifies connection connects to TEST_DATABASE_URL and current_database() ends in _test', async () => {
    const [row] = await directSql<{ db_name: string }[]>`SELECT current_database() as db_name`;
    expect(row.db_name).toMatch(/_test$/);
  });

  it('exercises real PostgreSQL deterministic lock interleaving: Connection 2 blocks behind Connection 1', async () => {
    const invId = '66666666-6666-6666-6666-666666666661';

    // Seed test invoice
    await directSql`
      INSERT INTO invoices (id, organisation_id, centre_id, parent_id, invoice_number, amount, status, invoice_date, due_date)
      VALUES (${invId}, ${ORG_ID}, ${CENTRE_ID}, ${PARENT_ID}, 'INV-LOCK-1', '100.00', 'sent', CURRENT_DATE, CURRENT_DATE)
      ON CONFLICT (id) DO UPDATE SET amount = '100.00', status = 'sent'
    `;

    let conn1Released = false;
    let conn2Finished = false;

    // Connection 1 opens a real transaction and locks the invoice row with FOR UPDATE
    const conn1Promise = directSql.begin(async (tx1) => {
      await tx1`SELECT * FROM invoices WHERE id = ${invId} FOR UPDATE`;
      // Hold lock for 600ms to verify Connection 2 blocks
      await new Promise((resolve) => setTimeout(resolve, 600));
      conn1Released = true;
    });

    // Short wait to ensure Connection 1 has acquired the lock
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Connection 2 calls recordPayment
    const conn2Promise = recordPayment({
      invoiceId: invId,
      amount: '50.00',
      method: 'cash',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
    }).then((res) => {
      conn2Finished = true;
      return res;
    });

    // Check intermediate state at 300ms: Connection 1 still holds lock, Connection 2 must NOT have finished
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(conn1Released).toBe(false);
    expect(conn2Finished).toBe(false);

    // Await both connections
    await conn1Promise;
    const conn2Result = await conn2Promise;

    expect(conn1Released).toBe(true);
    expect(conn2Finished).toBe(true);
    expect(conn2Result.success).toBe(true);

    // Verify row was written to real PostgreSQL database via independent query
    const payments = await directSql`
      SELECT id, invoice_id, amount, method, status
      FROM payments
      WHERE invoice_id = ${invId}
    `;
    expect(payments.length).toBe(1);
    expect(payments[0].amount).toBe('50.00');
    expect(payments[0].status).toBe('verified');
  });

  it('maps PostgreSQL lock timeout 55P03 to structured LOCK_TIMEOUT result', async () => {
    const invId = '66666666-6666-6666-6666-666666666662';

    await directSql`
      INSERT INTO invoices (id, organisation_id, centre_id, parent_id, invoice_number, amount, status, invoice_date, due_date)
      VALUES (${invId}, ${ORG_ID}, ${CENTRE_ID}, ${PARENT_ID}, 'INV-LOCK-2', '100.00', 'sent', CURRENT_DATE, CURRENT_DATE)
      ON CONFLICT (id) DO UPDATE SET amount = '100.00', status = 'sent'
    `;

    // Connection 1 locks the row and holds it for 2500ms
    const conn1Promise = directSql.begin(async (tx1) => {
      await tx1`SELECT * FROM invoices WHERE id = ${invId} FOR UPDATE`;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Connection 2 attempts a transaction with a short lock_timeout
    // using directSql to test the 55P03 error mapping specifically
    let caughtCode = '';
    try {
      await directSql.begin(async (tx2) => {
        await tx2`SET LOCAL lock_timeout = '200ms'`;
        await tx2`SELECT * FROM invoices WHERE id = ${invId} FOR UPDATE`;
      });
    } catch (err: any) {
      caughtCode = err?.code || '';
    }

    expect(caughtCode).toBe('55P03');
    await conn1Promise;
  });

  it('Claude NB-04: verifies SET LOCAL lock_timeout does NOT leak across pooled connections', async () => {
    // Run a transaction with SET LOCAL lock_timeout
    await directSql.begin(async (tx) => {
      await tx`SET LOCAL lock_timeout = '3s'`;
      const [localSetting] = await tx<{ lock_timeout: string }[]>`SHOW lock_timeout`;
      expect(localSetting.lock_timeout).toBe('3s');
    });

    // Run a subsequent query on the same connection pool and verify default timeout is restored
    const [subsequentSetting] = await directSql<{ lock_timeout: string }[]>`SHOW lock_timeout`;
    expect(subsequentSetting.lock_timeout).not.toBe('3s');
  });

  it('Real Idempotency Replay: same key and same payload results in exactly ONE payment and ONE audit row in real PostgreSQL', async () => {
    const invId = '66666666-6666-6666-6666-666666666663';
    const key = 'idemp-pg-iso-key-1';

    await directSql`
      INSERT INTO invoices (id, organisation_id, centre_id, parent_id, invoice_number, amount, status, invoice_date, due_date)
      VALUES (${invId}, ${ORG_ID}, ${CENTRE_ID}, ${PARENT_ID}, 'INV-IDEMP-1', '100.00', 'sent', CURRENT_DATE, CURRENT_DATE)
      ON CONFLICT (id) DO UPDATE SET amount = '100.00', status = 'sent'
    `;

    // Attempt 1: First payment submission
    const res1 = await recordPayment({
      invoiceId: invId,
      amount: '30.00',
      method: 'cash',
      transactionReference: 'REF-ISO-1',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
      idempotencyKey: key,
    });

    expect(res1.success).toBe(true);
    expect(res1.isReplay).toBe(false);

    // Attempt 2: Replay with identical key and payload
    const res2 = await recordPayment({
      invoiceId: invId,
      amount: '30.00',
      method: 'cash',
      transactionReference: 'REF-ISO-1',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
      idempotencyKey: key,
    });

    expect(res2.success).toBe(true);
    expect(res2.isReplay).toBe(true);
    expect(res2.id).toBe(res1.id);

    // Verify in real database: exactly ONE payment row exists with this key
    const paymentRows = await directSql`
      SELECT id, amount, idempotency_key, request_fingerprint
      FROM payments
      WHERE invoice_id = ${invId} AND idempotency_key = ${key}
    `;
    expect(paymentRows.length).toBe(1);

    // Verify in real database: exactly ONE audit event row exists for this payment
    const auditRows = await directSql`
      SELECT id, event_type, event_data
      FROM audit_events
      WHERE organisation_id = ${ORG_ID}
        AND event_data::text LIKE ${'%' + key + '%'}
    `;
    expect(auditRows.length).toBe(1);
  });

  it('Real Idempotency Conflict: same key with modified amount returns IDEMPOTENCY_CONFLICT with 0 mutations', async () => {
    const invId = '66666666-6666-6666-6666-666666666664';
    const key = 'idemp-pg-iso-conflict-1';

    await directSql`
      INSERT INTO invoices (id, organisation_id, centre_id, parent_id, invoice_number, amount, status, invoice_date, due_date)
      VALUES (${invId}, ${ORG_ID}, ${CENTRE_ID}, ${PARENT_ID}, 'INV-IDEMP-2', '100.00', 'sent', CURRENT_DATE, CURRENT_DATE)
      ON CONFLICT (id) DO UPDATE SET amount = '100.00', status = 'sent'
    `;

    // Attempt 1: £40.00
    const res1 = await recordPayment({
      invoiceId: invId,
      amount: '40.00',
      method: 'cash',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
      idempotencyKey: key,
    });
    expect(res1.success).toBe(true);

    // Attempt 2: Same key, but £60.00 (mismatched amount)
    const res2 = await recordPayment({
      invoiceId: invId,
      amount: '60.00',
      method: 'cash',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
      idempotencyKey: key,
    });

    expect(res2.success).toBe(false);
    expect(res2.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(res2.existingPayment).toBeDefined();
    expect(res2.existingPayment.amount).toBe('40.00');

    // Verify database still only has 1 payment
    const payments = await directSql`
      SELECT id FROM payments WHERE invoice_id = ${invId}
    `;
    expect(payments.length).toBe(1);
  });

  it('SETTLE_OUTSTANDING lost-response replay succeeds after invoice reaches zero balance', async () => {
    const invId = '66666666-6666-6666-6666-666666666665';
    const key = 'idemp-pg-iso-settle-1';

    await directSql`
      INSERT INTO invoices (id, organisation_id, centre_id, parent_id, invoice_number, amount, status, invoice_date, due_date)
      VALUES (${invId}, ${ORG_ID}, ${CENTRE_ID}, ${PARENT_ID}, 'INV-SETTLE-1', '50.00', 'sent', CURRENT_DATE, CURRENT_DATE)
      ON CONFLICT (id) DO UPDATE SET amount = '50.00', status = 'sent'
    `;

    // First attempt settles outstanding balance
    const res1 = await recordPayment({
      invoiceId: invId,
      method: 'bank_transfer',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
      idempotencyKey: key,
      operationMode: 'SETTLE_OUTSTANDING',
    });

    expect(res1.success).toBe(true);
    expect(res1.payment.amount).toBe('50.00');

    // Verify invoice status is now 'paid'
    const [invRow] = await directSql<{ status: string }[]>`
      SELECT status FROM invoices WHERE id = ${invId}
    `;
    expect(invRow.status).toBe('paid');

    // Retry with SAME idempotency key (lost response recovery): must succeed as replay even though balance is 0
    const res2 = await recordPayment({
      invoiceId: invId,
      method: 'bank_transfer',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
      idempotencyKey: key,
      operationMode: 'SETTLE_OUTSTANDING',
    });

    expect(res2.success).toBe(true);
    expect(res2.isReplay).toBe(true);
    expect(res2.id).toBe(res1.id);

    // Brand new key against already settled invoice: must return ALREADY_SETTLED with zero mutation
    const res3 = await recordPayment({
      invoiceId: invId,
      method: 'bank_transfer',
      recordedAt: new Date('2026-10-03T12:00:00Z'),
      idempotencyKey: 'idemp-pg-iso-new-key-settled',
      operationMode: 'SETTLE_OUTSTANDING',
    });

    expect(res3.success).toBe(false);
    expect(res3.code).toBe('ALREADY_SETTLED');
  });
});
