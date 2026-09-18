import postgres from 'postgres';
import { FinanceInvariantsSection, InvariantResult, StatusLevel, FindingSeverity } from '../types';
import { createStableFingerprint, redactText } from '../lib/redact';

interface RawFinding {
  fingerprint: string;
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  context?: Record<string, unknown>;
}

export interface FinanceCheckResult {
  section: FinanceInvariantsSection;
  findings: RawFinding[];
}

export async function runFinanceInvariantChecks(
  databaseUrl?: string
): Promise<FinanceCheckResult> {
  const findings: RawFinding[] = [];
  const connectionString = databaseUrl || process.env.DATABASE_URL;

  if (!connectionString) {
    const fp = createStableFingerprint('FIN_SKIPPED_NO_URL', 'no_database_url');
    findings.push({
      fingerprint: fp,
      code: 'FIN_SKIPPED_NO_URL',
      severity: 'WARNING',
      title: 'Finance invariant checks skipped',
      description: 'DATABASE_URL not configured. Financial invariant validation was not executed.'
    });

    return {
      section: {
        status: 'WARNING',
        invariants: [],
        notes: 'DATABASE_URL not configured. Finance checks skipped.'
      },
      findings
    };
  }

  const sql = postgres(connectionString, {
    max: 2,
    idle_timeout: 5,
    connect_timeout: 10,
    connection: {
      default_transaction_read_only: true,
      statement_timeout: 15000
    },
    ssl: 'require'
  });

  const invariants: InvariantResult[] = [];

  try {
    // INV-1: Orphan Payments
    const q1 = await sql<{ count: string }[]>`
      SELECT count(*)::text as count
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE i.id IS NULL
    `;
    const orphanPayments = parseInt(q1[0]?.count || '0', 10);
    const inv1Passed = orphanPayments === 0;
    invariants.push({
      name: 'INV-1: No Orphan Payments',
      passed: inv1Passed,
      discrepanciesCount: orphanPayments,
      details: inv1Passed ? 'All payments reference existing invoices' : `${orphanPayments} orphan payment(s) detected`
    });
    if (!inv1Passed) {
      findings.push({
        fingerprint: createStableFingerprint('FIN_ORPHAN_PAYMENTS', 'inv1'),
        code: 'FIN_ORPHAN_PAYMENTS',
        severity: 'ACTION_REQUIRED',
        title: 'Financial Invariant Violation: Orphan Payments Detected',
        description: `Found ${orphanPayments} payment record(s) referencing non-existent invoices.`,
        context: { orphanCount: orphanPayments }
      });
    }

    // INV-2: Orphan Parent Credits
    const q2 = await sql<{ count: string }[]>`
      SELECT count(*)::text as count
      FROM parent_credits pc
      LEFT JOIN parents p ON pc.parent_id = p.id
      WHERE p.id IS NULL
    `;
    const orphanCredits = parseInt(q2[0]?.count || '0', 10);
    const inv2Passed = orphanCredits === 0;
    invariants.push({
      name: 'INV-2: No Orphan Parent Credits',
      passed: inv2Passed,
      discrepanciesCount: orphanCredits,
      details: inv2Passed ? 'All credits reference existing parents' : `${orphanCredits} orphan credit(s) detected`
    });
    if (!inv2Passed) {
      findings.push({
        fingerprint: createStableFingerprint('FIN_ORPHAN_CREDITS', 'inv2'),
        code: 'FIN_ORPHAN_CREDITS',
        severity: 'ACTION_REQUIRED',
        title: 'Financial Invariant Violation: Orphan Parent Credits Detected',
        description: `Found ${orphanCredits} credit record(s) referencing non-existent parents.`,
        context: { orphanCount: orphanCredits }
      });
    }

    // INV-3: Paid Invoice Settlement (verified payments match or exceed amount)
    const q3 = await sql<{ count: string }[]>`
      SELECT count(*)::text as count
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, COALESCE(SUM(amount), 0) as verified_total
        FROM payments
        WHERE status::text = 'verified'
        GROUP BY invoice_id
      ) p ON i.id = p.invoice_id
      WHERE i.status::text = 'paid' AND COALESCE(p.verified_total, 0) < i.amount
    `;
    const underpaidPaidInvoices = parseInt(q3[0]?.count || '0', 10);
    const inv3Passed = underpaidPaidInvoices === 0;
    invariants.push({
      name: 'INV-3: Paid Invoice Balance Integrity',
      passed: inv3Passed,
      discrepanciesCount: underpaidPaidInvoices,
      details: inv3Passed ? 'All paid invoices are fully settled by verified payments' : `${underpaidPaidInvoices} paid invoice(s) have verified payments < invoice amount`
    });
    if (!inv3Passed) {
      findings.push({
        fingerprint: createStableFingerprint('FIN_UNDERPAID_INVOICES', 'inv3'),
        code: 'FIN_UNDERPAID_INVOICES',
        severity: 'ACTION_REQUIRED',
        title: 'Financial Invariant Violation: Underpaid Paid Invoices',
        description: `Found ${underpaidPaidInvoices} invoice(s) marked 'paid' whose verified payments do not cover the invoice amount.`,
        context: { discrepancyCount: underpaidPaidInvoices }
      });
    }

    // INV-4: Non-Negative Amounts (invoices, payments, credits)
    const q4a = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM invoices WHERE amount < 0`;
    const q4b = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM payments WHERE amount < 0`;
    const q4c = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM parent_credits WHERE amount < 0`;
    const negativeAmounts =
      parseInt(q4a[0]?.count || '0', 10) +
      parseInt(q4b[0]?.count || '0', 10) +
      parseInt(q4c[0]?.count || '0', 10);
    const inv4Passed = negativeAmounts === 0;
    invariants.push({
      name: 'INV-4: Non-Negative Financial Values',
      passed: inv4Passed,
      discrepanciesCount: negativeAmounts,
      details: inv4Passed ? 'No negative values in invoices, payments, or credits' : `${negativeAmounts} negative monetary row(s) detected`
    });
    if (!inv4Passed) {
      findings.push({
        fingerprint: createStableFingerprint('FIN_NEGATIVE_AMOUNTS', 'inv4'),
        code: 'FIN_NEGATIVE_AMOUNTS',
        severity: 'ACTION_REQUIRED',
        title: 'Financial Invariant Violation: Negative Amounts Detected',
        description: `Found ${negativeAmounts} record(s) with negative monetary values.`,
        context: { negativeCount: negativeAmounts }
      });
    }

    // INV-5: Terminal State Immutability (Void invoices must have NO active verified payments)
    const q5 = await sql<{ count: string }[]>`
      SELECT count(*)::text as count
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      WHERE i.status::text = 'void' AND p.status::text = 'verified'
    `;
    const verifiedOnVoid = parseInt(q5[0]?.count || '0', 10);
    const inv5Passed = verifiedOnVoid === 0;
    invariants.push({
      name: 'INV-5: Terminal State Immutability',
      passed: inv5Passed,
      discrepanciesCount: verifiedOnVoid,
      details: inv5Passed ? 'No void invoices have active verified payments' : `${verifiedOnVoid} verified payment(s) active on void invoice(s)`
    });
    if (!inv5Passed) {
      findings.push({
        fingerprint: createStableFingerprint('FIN_VOID_WITH_VERIFIED', 'inv5'),
        code: 'FIN_VOID_WITH_VERIFIED',
        severity: 'ACTION_REQUIRED',
        title: 'Financial Invariant Violation: Verified Payments on Void Invoices',
        description: `Found ${verifiedOnVoid} verified payment(s) linked to void invoices.`,
        context: { violationCount: verifiedOnVoid }
      });
    }

    // INV-6: Reversal Audit Consistency (Reversed payments have reversed_at and reversal_reason)
    const q6 = await sql<{ count: string }[]>`
      SELECT count(*)::text as count
      FROM payments
      WHERE status::text = 'reversed' AND (reversed_at IS NULL OR reversal_reason IS NULL OR TRIM(reversal_reason) = '')
    `;
    const incompleteReversals = parseInt(q6[0]?.count || '0', 10);
    const inv6Passed = incompleteReversals === 0;
    invariants.push({
      name: 'INV-6: Payment Reversal Audit Completeness',
      passed: inv6Passed,
      discrepanciesCount: incompleteReversals,
      details: inv6Passed ? 'All reversed payments have valid reversal timestamps and reasons' : `${incompleteReversals} reversed payment(s) missing timestamp or reason`
    });
    if (!inv6Passed) {
      findings.push({
        fingerprint: createStableFingerprint('FIN_INCOMPLETE_REVERSALS', 'inv6'),
        code: 'FIN_INCOMPLETE_REVERSALS',
        severity: 'ACTION_REQUIRED',
        title: 'Financial Invariant Violation: Incomplete Payment Reversal Audit Data',
        description: `Found ${incompleteReversals} reversed payment(s) missing required audit timestamp or reason.`,
        context: { incompleteCount: incompleteReversals }
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const safeMsg = redactText(msg);
    findings.push({
      fingerprint: createStableFingerprint('FIN_INVARIANT_EXEC_ERROR', 'exec'),
      code: 'FIN_INVARIANT_EXEC_ERROR',
      severity: 'ACTION_REQUIRED',
      title: 'Financial Invariants Execution Error',
      description: `Failed to query financial invariants: ${safeMsg}`,
      context: { error: safeMsg }
    });
  } finally {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      // ignore
    }
  }

  const failedInvariants = invariants.filter((i) => !i.passed).length;
  const sectionStatus: StatusLevel = failedInvariants > 0 ? 'ACTION_REQUIRED' : 'HEALTHY';

  return {
    section: {
      status: sectionStatus,
      invariants,
      notes: `${invariants.length} financial invariants evaluated: ${invariants.length - failedInvariants} passed, ${failedInvariants} failed.`
    },
    findings
  };
}
