import postgres from 'postgres';
import { DatabaseHealthSection, ScaleSnapshotSection, StatusLevel, FindingSeverity, TableScale } from '../types';
import { createStableFingerprint, redactText } from '../lib/redact';

interface RawFinding {
  fingerprint: string;
  code: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  context?: Record<string, unknown>;
}

export interface DatabaseCheckResult {
  dbSection: DatabaseHealthSection;
  scaleSection: ScaleSnapshotSection;
  findings: RawFinding[];
}

export async function runDatabaseHealthAndScaleChecks(
  databaseUrl?: string
): Promise<DatabaseCheckResult> {
  const findings: RawFinding[] = [];
  const connectionString = databaseUrl || process.env.DATABASE_URL;

  if (!connectionString) {
    const fp = createStableFingerprint('DB_SKIPPED_NO_URL', 'no_database_url');
    findings.push({
      fingerprint: fp,
      code: 'DB_SKIPPED_NO_URL',
      severity: 'WARNING',
      title: 'Database checks skipped',
      description: 'DATABASE_URL not configured in environment. Database connectivity checks were not executed.'
    });

    return {
      dbSection: {
        status: 'WARNING',
        connectionPoolOk: false,
        connectionLatencyMs: 0,
        notes: 'DATABASE_URL not configured. Database health checks skipped.'
      },
      scaleSection: {
        status: 'WARNING',
        tables: [],
        maintPerf1TriggerRecommendation: 'DEFER',
        notes: 'DATABASE_URL not configured. Scale snapshot skipped.'
      },
      findings
    };
  }

  // Create strictly read-only, small connection pool with 15s statement timeout
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

  let connectionPoolOk = false;
  let connectionLatencyMs = 0;
  let databaseSizeMb = 0;
  let activeConnections = 0;
  const tables: TableScale[] = [];
  let maintPerf1TriggerRecommendation: 'DEFER' | 'SCHEDULE' | 'IMMEDIATE' = 'DEFER';

  try {
    // 1. Connection Ping & Latency
    const startPing = Date.now();
    await sql`SELECT 1 as ping`;
    connectionLatencyMs = Date.now() - startPing;
    connectionPoolOk = true;

    if (connectionLatencyMs > 1000) {
      const fp = createStableFingerprint('DB_HIGH_LATENCY', 'ping');
      findings.push({
        fingerprint: fp,
        code: 'DB_HIGH_LATENCY',
        severity: connectionLatencyMs > 3000 ? 'ACTION_REQUIRED' : 'WARNING',
        title: 'High database ping latency',
        description: `Ping query took ${connectionLatencyMs}ms (threshold: 1000ms).`,
        context: { latencyMs: connectionLatencyMs }
      });
    }

    // 2. Active connections & Database Size
    try {
      const actRes = await sql<{ count: string }[]>`
        SELECT count(*)::text as count FROM pg_stat_activity WHERE datname = current_database()
      `;
      activeConnections = parseInt(actRes[0]?.count || '0', 10);
    } catch {
      // Some serverless environments restrict pg_stat_activity
    }

    try {
      const sizeRes = await sql<{ db_bytes: string }[]>`
        SELECT pg_database_size(current_database())::text as db_bytes
      `;
      const bytes = parseInt(sizeRes[0]?.db_bytes || '0', 10);
      databaseSizeMb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
    } catch {
      // Non-fatal if permission denied
    }

    // 3. Table Scale Row Counts
    const targetTables = ['invoices', 'payments', 'bookings', 'audit_events', 'users'];
    for (const tbl of targetTables) {
      try {
        let count = 0;
        if (tbl === 'invoices') {
          const res = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM invoices`;
          count = parseInt(res[0]?.count || '0', 10);
        } else if (tbl === 'payments') {
          const res = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM payments`;
          count = parseInt(res[0]?.count || '0', 10);
        } else if (tbl === 'bookings') {
          const res = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM bookings`;
          count = parseInt(res[0]?.count || '0', 10);
        } else if (tbl === 'audit_events') {
          const res = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM audit_events`;
          count = parseInt(res[0]?.count || '0', 10);
        } else if (tbl === 'users') {
          const res = await sql<{ count: string }[]>`SELECT count(*)::text as count FROM users`;
          count = parseInt(res[0]?.count || '0', 10);
        }

        let status: 'NORMAL' | 'APPROACHING_LIMIT' | 'THRESHOLD_EXCEEDED' = 'NORMAL';
        if (
          (tbl === 'invoices' && count > 5000) ||
          (tbl === 'payments' && count > 5000) ||
          (tbl === 'bookings' && count > 10000) ||
          (tbl === 'audit_events' && count > 50000)
        ) {
          status = 'THRESHOLD_EXCEEDED';
        } else if (
          (tbl === 'invoices' && count > 3000) ||
          (tbl === 'payments' && count > 3000) ||
          (tbl === 'bookings' && count > 5000) ||
          (tbl === 'audit_events' && count > 25000)
        ) {
          status = 'APPROACHING_LIMIT';
        }

        tables.push({ tableName: tbl, rowCount: count, status });
      } catch (tableErr: unknown) {
        // Table might not exist or error reading
        tables.push({ tableName: tbl, rowCount: -1, status: 'NORMAL' });
      }
    }

    // 4. MAINT-PERF-1 Trigger Recommendation
    const hasExceeded = tables.some((t) => t.status === 'THRESHOLD_EXCEEDED');
    const hasApproaching = tables.some((t) => t.status === 'APPROACHING_LIMIT');

    if (hasExceeded || databaseSizeMb > 500) {
      maintPerf1TriggerRecommendation = 'IMMEDIATE';
      const fp = createStableFingerprint('SCALE_MAINT_PERF_1_TRIGGER', 'immediate');
      findings.push({
        fingerprint: fp,
        code: 'SCALE_MAINT_PERF_1_TRIGGER',
        severity: 'ACTION_REQUIRED',
        title: 'MAINT-PERF-1 Trigger Condition Met: High Table Volume',
        description: 'One or more tables exceed the critical scale threshold. Immediate scheduling of index/query tuning recommended.',
        context: { tables, databaseSizeMb }
      });
    } else if (hasApproaching || databaseSizeMb > 250) {
      maintPerf1TriggerRecommendation = 'SCHEDULE';
      const fp = createStableFingerprint('SCALE_MAINT_PERF_1_APPROACHING', 'schedule');
      findings.push({
        fingerprint: fp,
        code: 'SCALE_MAINT_PERF_1_APPROACHING',
        severity: 'WARNING',
        title: 'MAINT-PERF-1 Approaching Trigger: Table Volume Growth',
        description: 'Table volume is approaching limits. Schedule MAINT-PERF-1 in next cycle.',
        context: { tables, databaseSizeMb }
      });
    } else {
      maintPerf1TriggerRecommendation = 'DEFER';
    }
  } catch (err: unknown) {
    connectionPoolOk = false;
    const msg = err instanceof Error ? err.message : String(err);
    const safeMsg = redactText(msg);

    const fp = createStableFingerprint('DB_CONNECTION_FAILURE', 'connect');
    findings.push({
      fingerprint: fp,
      code: 'DB_CONNECTION_FAILURE',
      severity: 'ACTION_REQUIRED',
      title: 'Database connection failed',
      description: `Failed to connect to database: ${safeMsg}`,
      context: { error: safeMsg }
    });
  } finally {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      // ignore close errors
    }
  }

  const dbStatus: StatusLevel = connectionPoolOk
    ? findings.some((f) => f.severity === 'ACTION_REQUIRED' && f.code.startsWith('DB_'))
      ? 'ACTION_REQUIRED'
      : findings.some((f) => f.severity === 'WARNING' && f.code.startsWith('DB_'))
      ? 'WARNING'
      : 'HEALTHY'
    : 'ACTION_REQUIRED';

  const scaleStatus: StatusLevel = maintPerf1TriggerRecommendation === 'IMMEDIATE'
    ? 'ACTION_REQUIRED'
    : maintPerf1TriggerRecommendation === 'SCHEDULE'
    ? 'WARNING'
    : 'HEALTHY';

  return {
    dbSection: {
      status: dbStatus,
      connectionPoolOk,
      connectionLatencyMs,
      databaseSizeMb: databaseSizeMb > 0 ? databaseSizeMb : undefined,
      activeConnections: activeConnections > 0 ? activeConnections : undefined,
      notes: `Connection latency ${connectionLatencyMs}ms. Size: ${databaseSizeMb}MB. Active: ${activeConnections}.`
    },
    scaleSection: {
      status: scaleStatus,
      tables,
      maintPerf1TriggerRecommendation,
      notes: `MAINT-PERF-1 Recommendation: ${maintPerf1TriggerRecommendation}.`
    },
    findings
  };
}
