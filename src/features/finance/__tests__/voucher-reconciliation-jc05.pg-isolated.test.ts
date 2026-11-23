import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { assertTestDatabaseUrl } from './helpers/test-db-guard';
import { applyAndVerifyTestDbMigrations } from './helpers/test-db-migrator';
import { reconcilePayment } from '@/features/billing/actions/reconcile-payment';
import { submitVoucherPayment } from '@/app/portal/billing/actions';
import { client as dbClient } from '@/db';

const testDbUrl = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const sql = postgres(testDbUrl, { max: 5, ssl: false });

const ORG_ID = randomUUID();
const OTHER_ORG_ID = randomUUID();
const CENTRE_ID = randomUUID();
const OTHER_CENTRE_ID = randomUUID();
const STAFF_USER_ID = randomUUID();
const PARENT_ID = randomUUID();
const OTHER_PARENT_ID = randomUUID();

const sessionState = vi.hoisted(() => ({
  user: {
    id: '',
    role: 'ORG_OWNER' as string,
    organisationId: '',
  },
}));

const parentAuthState = vi.hoisted(() => ({
  parent: null as null | {
    id: string;
    organisationId: string;
    firstName: string;
    lastName: string;
    email: string;
  },
}));

vi.mock('@/lib/session', () => ({
  requireTenantSession: vi.fn(async () => ({
    user: sessionState.user,
  })),
  getTypedSession: vi.fn(async () => ({
    user: sessionState.user,
  })),
}));

vi.mock('@/lib/parent-auth', () => ({
  getCurrentParent: vi.fn(async () => parentAuthState.parent),
}));

const createdInvoiceIds: string[] = [];

async function seedInvoice(params: {
  amount: string;
  status?: 'sent' | 'partially_paid' | 'paid' | 'void';
  orgId?: string;
  centreId?: string;
  parentId?: string;
}): Promise<string> {
  const invoiceId = randomUUID();
  const invoiceNumber = `INV-JC05-${invoiceId.slice(0, 8).toUpperCase()}`;
  const orgId = params.orgId ?? ORG_ID;
  const centreId = params.centreId ?? CENTRE_ID;
  const parentId = params.parentId ?? PARENT_ID;
  const status = params.status ?? 'sent';

  await sql`
    INSERT INTO invoices (id, organisation_id, centre_id, parent_id, invoice_number, amount, status, invoice_date, due_date)
    VALUES (${invoiceId}, ${orgId}, ${centreId}, ${parentId}, ${invoiceNumber}, ${params.amount}, ${status}, CURRENT_DATE, CURRENT_DATE)
  `;
  createdInvoiceIds.push(invoiceId);
  return invoiceId;
}

describe('JC-05 Voucher & TFC Reconciliation Ledger Safety (*.pg-isolated.test.ts)', () => {
  beforeAll(async () => {
    const [dbInfo] = await sql<{ current_db: string }[]>`SELECT current_database() AS current_db`;
    expect(dbInfo.current_db).toMatch(/_test$/);

    const migrationResult = await applyAndVerifyTestDbMigrations(testDbUrl);
    expect(migrationResult.success).toBe(true);

    sessionState.user.id = STAFF_USER_ID;
    sessionState.user.organisationId = ORG_ID;
    sessionState.user.role = 'ORG_OWNER';

    parentAuthState.parent = {
      id: PARENT_ID,
      organisationId: ORG_ID,
      firstName: 'Voucher',
      lastName: 'Parent',
      email: `parent-${PARENT_ID}@isolated.test`,
    };

    await sql`
      INSERT INTO organisations (id, name, slug)
      VALUES
        (${ORG_ID}, 'JC-05 Primary Org', ${`jc05-org-${ORG_ID.slice(0, 8)}`}),
        (${OTHER_ORG_ID}, 'JC-05 Other Org', ${`jc05-other-${OTHER_ORG_ID.slice(0, 8)}`})
    `;

    await sql`
      INSERT INTO centres (id, organisation_id, name, slug)
      VALUES
        (${CENTRE_ID}, ${ORG_ID}, 'JC-05 Primary Centre', ${`jc05-centre-${CENTRE_ID.slice(0, 8)}`}),
        (${OTHER_CENTRE_ID}, ${OTHER_ORG_ID}, 'JC-05 Other Centre', ${`jc05-other-c-${OTHER_CENTRE_ID.slice(0, 8)}`})
    `;

    await sql`
      INSERT INTO users (id, email, name, role, organisation_id)
      VALUES (${STAFF_USER_ID}, ${`staff-${STAFF_USER_ID}@isolated.test`}, 'JC-05 Staff Owner', 'ORG_OWNER', ${ORG_ID})
    `;

    await sql`
      INSERT INTO org_memberships (user_id, organisation_id, role)
      VALUES (${STAFF_USER_ID}, ${ORG_ID}, 'ORG_OWNER')
    `;

    await sql`
      INSERT INTO parents (id, organisation_id, first_name, last_name, email, preferred_contact)
      VALUES
        (${PARENT_ID}, ${ORG_ID}, 'Voucher', 'Parent', ${`parent-${PARENT_ID}@isolated.test`}, 'email'),
        (${OTHER_PARENT_ID}, ${OTHER_ORG_ID}, 'Other', 'Parent', ${`other-${OTHER_PARENT_ID}@isolated.test`}, 'email')
    `;
  });

  beforeEach(async () => {
    sessionState.user.id = STAFF_USER_ID;
    sessionState.user.organisationId = ORG_ID;
    sessionState.user.role = 'ORG_OWNER';
    await sql`DELETE FROM audit_events WHERE organisation_id IN (${ORG_ID}, ${OTHER_ORG_ID})`;
  });

  afterAll(async () => {
    await sql`DELETE FROM audit_events WHERE organisation_id IN (${ORG_ID}, ${OTHER_ORG_ID})`;
    if (createdInvoiceIds.length > 0) {
      await sql`DELETE FROM payments WHERE invoice_id = ANY(${createdInvoiceIds})`;
      await sql`DELETE FROM invoices WHERE id = ANY(${createdInvoiceIds})`;
    }
    await sql`DELETE FROM parents WHERE id IN (${PARENT_ID}, ${OTHER_PARENT_ID})`;
    await sql`DELETE FROM org_memberships WHERE user_id = ${STAFF_USER_ID}`;
    await sql`DELETE FROM users WHERE id = ${STAFF_USER_ID}`;
    await sql`DELETE FROM centres WHERE id IN (${CENTRE_ID}, ${OTHER_CENTRE_ID})`;
    await sql`DELETE FROM organisations WHERE id IN (${ORG_ID}, ${OTHER_ORG_ID})`;
    await sql.end();
    await dbClient.end();
  });

  it('promotes parent-logged pending voucher to verified in-place (1 payment row total) and transitions invoice to paid / partially_paid', async () => {
    // 1. Full settlement promotion -> invoice transitions sent -> paid
    const fullInvoiceId = await seedInvoice({ amount: '120.00', status: 'sent' });
    const submitFull = await submitVoucherPayment(fullInvoiceId, 120, 'EDENRED-FULL-001');
    expect(submitFull).toEqual({ success: true });

    const [beforePromotion] = await sql<{ id: string; status: string; amount: string }[]>`
      SELECT id, status, amount FROM payments WHERE invoice_id = ${fullInvoiceId}
    `;
    expect(beforePromotion.status).toBe('pending');
    expect(beforePromotion.amount).toBe('120.00');

    const reconcileFull = await reconcilePayment({
      invoiceId: fullInvoiceId,
      amount: 120,
      method: 'voucher',
      reference: 'EDENRED-FULL-001',
    });
    expect(reconcileFull).toEqual({ success: true });

    const fullPayments = await sql<{ id: string; status: string; amount: string; method: string }[]>`
      SELECT id, status, amount, method FROM payments WHERE invoice_id = ${fullInvoiceId}
    `;
    expect(fullPayments).toHaveLength(1);
    expect(fullPayments[0].id).toBe(beforePromotion.id);
    expect(fullPayments[0].status).toBe('verified');
    expect(fullPayments[0].amount).toBe('120.00');

    const [fullInvAfter] = await sql<{ status: string }[]>`
      SELECT status FROM invoices WHERE id = ${fullInvoiceId}
    `;
    expect(fullInvAfter.status).toBe('paid');

    const auditRows = await sql<{ event_type: string; event_data: string }[]>`
      SELECT event_type, event_data FROM audit_events WHERE organisation_id = ${ORG_ID}
    `;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].event_type).toBe('payment_verified');
    expect(JSON.parse(auditRows[0].event_data)).toMatchObject({
      paymentId: beforePromotion.id,
      invoiceId: fullInvoiceId,
      amount: '120.00',
      promotedFromPending: true,
    });

    // 2. Partial settlement promotion -> invoice transitions sent -> partially_paid
    const partialInvoiceId = await seedInvoice({ amount: '150.00', status: 'sent' });
    const submitPartial = await submitVoucherPayment(partialInvoiceId, 60, 'TFC-PARTIAL-002');
    expect(submitPartial).toEqual({ success: true });

    const reconcilePartial = await reconcilePayment({
      invoiceId: partialInvoiceId,
      amount: 60,
      method: 'tax_free_childcare',
      reference: 'TFC-PARTIAL-002',
    });
    expect(reconcilePartial).toEqual({ success: true });

    const partialPayments = await sql<{ id: string; status: string; amount: string; method: string }[]>`
      SELECT id, status, amount, method FROM payments WHERE invoice_id = ${partialInvoiceId}
    `;
    expect(partialPayments).toHaveLength(1);
    expect(partialPayments[0].status).toBe('verified');
    expect(partialPayments[0].amount).toBe('60.00');
    expect(partialPayments[0].method).toBe('tax_free_childcare');

    const [partialInvAfter] = await sql<{ status: string }[]>`
      SELECT status FROM invoices WHERE id = ${partialInvoiceId}
    `;
    expect(partialInvAfter.status).toBe('partially_paid');
  });

  it('handles repeat reconcilePayment calls idempotently (still 1 payment row, no double-credit)', async () => {
    const invoiceId = await seedInvoice({ amount: '95.50', status: 'sent' });
    await submitVoucherPayment(invoiceId, 95.5, 'TFC-IDEMP-9550');

    // First call promotes pending -> verified and marks invoice paid
    const first = await reconcilePayment({
      invoiceId,
      amount: 95.5,
      method: 'tax_free_childcare',
      reference: 'TFC-IDEMP-9550',
    });
    expect(first).toEqual({ success: true });

    // Second call (replay after invoice is already 'paid') returns idempotent success with zero mutations
    const second = await reconcilePayment({
      invoiceId,
      amount: 95.5,
      method: 'tax_free_childcare',
      reference: 'TFC-IDEMP-9550',
    });
    expect(second).toEqual({ success: true });

    const rows = await sql<{ id: string; status: string; amount: string }[]>`
      SELECT id, status, amount FROM payments WHERE invoice_id = ${invoiceId}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('verified');
    expect(rows[0].amount).toBe('95.50');

    const audits = await sql<{ id: string }[]>`
      SELECT id FROM audit_events WHERE organisation_id = ${ORG_ID}
    `;
    expect(audits).toHaveLength(1);
  });

  it('rejects amount mismatch between pending voucher and reconcilePayment cleanly with zero ledger mutation', async () => {
    const invoiceId = await seedInvoice({ amount: '200.00', status: 'sent' });
    await submitVoucherPayment(invoiceId, 125.25, 'SODEXO-MISMATCH-01');

    const mismatchRes = await reconcilePayment({
      invoiceId,
      amount: 100.0,
      method: 'voucher',
      reference: 'SODEXO-MISMATCH-01',
    });

    expect(mismatchRes.success).toBe(false);
    expect(mismatchRes.error).toBe(
      'Pending payment reference "SODEXO-MISMATCH-01" was logged for £125.25, which does not match reconciled amount £100.00. Review or adjust on the invoice first.'
    );

    // Verify zero mutation: still 1 pending row for £125.25, invoice still 'sent', 0 audit events
    const rows = await sql<{ status: string; amount: string }[]>`
      SELECT status, amount FROM payments WHERE invoice_id = ${invoiceId}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].amount).toBe('125.25');

    const [inv] = await sql<{ status: string }[]>`
      SELECT status FROM invoices WHERE id = ${invoiceId}
    `;
    expect(inv.status).toBe('sent');

    const audits = await sql<{ id: string }[]>`
      SELECT id FROM audit_events WHERE organisation_id = ${ORG_ID}
    `;
    expect(audits).toHaveLength(0);
  });

  it('ignores reversed payment rows with the same reference (no false idempotency hit or block)', async () => {
    const invoiceId = await seedInvoice({ amount: '80.00', status: 'sent' });

    // Seed a prior reversed payment carrying the same transaction_reference
    const reversedPaymentId = randomUUID();
    await sql`
      INSERT INTO payments (id, invoice_id, amount, method, status, transaction_reference, reversal_reason, reversed_at)
      VALUES (${reversedPaymentId}, ${invoiceId}, '80.00', 'voucher', 'reversed', 'CARE4-REUSED-REF', 'Entered against wrong date', now())
    `;

    // Reconcile fresh payment (or re-submitted pending voucher) with the same reference
    await submitVoucherPayment(invoiceId, 80, 'CARE4-REUSED-REF');

    const res = await reconcilePayment({
      invoiceId,
      amount: 80,
      method: 'voucher',
      reference: 'CARE4-REUSED-REF',
    });
    expect(res).toEqual({ success: true });

    const allRows = await sql<{ id: string; status: string; reversed_at: Date | null }[]>`
      SELECT id, status, reversed_at FROM payments WHERE invoice_id = ${invoiceId} ORDER BY created_at ASC
    `;
    expect(allRows).toHaveLength(2);
    const reversedRow = allRows.find((r) => r.id === reversedPaymentId)!;
    const activeRow = allRows.find((r) => r.id !== reversedPaymentId)!;
    expect(reversedRow.status).toBe('reversed');
    expect(reversedRow.reversed_at).not.toBeNull();
    expect(activeRow.status).toBe('verified');
    expect(activeRow.reversed_at).toBeNull();

    const [inv] = await sql<{ status: string }[]>`
      SELECT status FROM invoices WHERE id = ${invoiceId}
    `;
    expect(inv.status).toBe('paid');
  });

  it('enforces cross-tenant invoice guard before reference lookup and serializes concurrent pending promotions via FOR UPDATE', async () => {
    // 1. Cross-tenant guard: another org's invoice with an existing verified reference must return 'Invoice not found'
    const otherOrgInvoiceId = await seedInvoice({
      amount: '70.00',
      status: 'paid',
      orgId: OTHER_ORG_ID,
      centreId: OTHER_CENTRE_ID,
      parentId: OTHER_PARENT_ID,
    });
    await sql`
      INSERT INTO payments (id, invoice_id, amount, method, status, transaction_reference)
      VALUES (${randomUUID()}, ${otherOrgInvoiceId}, '70.00', 'voucher', 'verified', 'OTHER-ORG-SECRET-REF')
    `;

    const crossTenantAttempt = await reconcilePayment({
      invoiceId: otherOrgInvoiceId,
      amount: 70,
      method: 'voucher',
      reference: 'OTHER-ORG-SECRET-REF',
    });
    expect(crossTenantAttempt).toEqual({ success: false, error: 'Invoice not found' });

    // 2. Concurrent promotion of the same pending voucher row serializes under invoice FOR UPDATE lock
    const concurrentInvId = await seedInvoice({ amount: '110.00', status: 'sent' });
    await submitVoucherPayment(concurrentInvId, 110, 'CONC-VOUCH-110');

    const [r1, r2] = await Promise.all([
      reconcilePayment({
        invoiceId: concurrentInvId,
        amount: 110,
        method: 'voucher',
        reference: 'CONC-VOUCH-110',
      }),
      reconcilePayment({
        invoiceId: concurrentInvId,
        amount: 110,
        method: 'voucher',
        reference: 'CONC-VOUCH-110',
      }),
    ]);

    expect(r1).toEqual({ success: true });
    expect(r2).toEqual({ success: true });

    const paymentRows = await sql<{ id: string; status: string }[]>`
      SELECT id, status FROM payments WHERE invoice_id = ${concurrentInvId}
    `;
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0].status).toBe('verified');

    const auditRows = await sql<{ id: string }[]>`
      SELECT id FROM audit_events WHERE organisation_id = ${ORG_ID}
    `;
    expect(auditRows).toHaveLength(1);
  });
});
