import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { assertTestDatabaseUrl } from './test-db-guard';

export interface MigrationVerificationResult {
  success: boolean;
  database: string;
  hasIdempotencyKeyColumn: boolean;
  hasRequestFingerprintColumn: boolean;
  hasIdempotencyIndex: boolean;
}

export async function applyAndVerifyTestDbMigrations(
  testDbUrl: string = process.env.TEST_DATABASE_URL!
): Promise<MigrationVerificationResult> {
  const verifiedUrl = assertTestDatabaseUrl(testDbUrl);
  const sql = postgres(verifiedUrl, { max: 1, ssl: false });

  try {
    const [currentDb] = await sql`SELECT current_database() as name`;

    // Apply migration 0030 directly
    const migrationPath = path.resolve(process.cwd(), 'drizzle/0030_payments_idempotency.sql');
    if (fs.existsSync(migrationPath)) {
      const ddl = fs.readFileSync(migrationPath, 'utf8');
      const statements = ddl
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await sql.unsafe(statement);
      }
    }

    // Verify columns exist on payments table
    const columns = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'payments'
        AND column_name IN ('idempotency_key', 'request_fingerprint')
    `;

    const colNames = columns.map((c) => c.column_name);
    const hasIdempotencyKeyColumn = colNames.includes('idempotency_key');
    const hasRequestFingerprintColumn = colNames.includes('request_fingerprint');

    // Verify index exists
    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'payments'
        AND indexname = 'payments_invoice_idempotency_uniq'
    `;
    const hasIdempotencyIndex = indexes.length > 0;

    const success = hasIdempotencyKeyColumn && hasRequestFingerprintColumn && hasIdempotencyIndex;

    return {
      success,
      database: currentDb.name,
      hasIdempotencyKeyColumn,
      hasRequestFingerprintColumn,
      hasIdempotencyIndex,
    };
  } finally {
    await sql.end();
  }
}
