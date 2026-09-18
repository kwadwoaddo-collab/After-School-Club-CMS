import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { assertSafeTrainingEnvironment } from '../lib/training-guard';
import { logger } from '../lib/logger';
import postgres from 'postgres';
import fs from 'fs';

async function main() {
  const { host } = assertSafeTrainingEnvironment();
  logger.info(`[TRAINING MIGRATION] Applying Category B migration to host: ${host}`);

  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString, { max: 1, ssl: 'require', connect_timeout: 10 });

  const sqlContent = fs.readFileSync('drizzle/0029_category_b_billing_scheduler.sql', 'utf8');

  try {
    await client.unsafe(sqlContent);
    logger.info('[TRAINING MIGRATION] Migration 0029 applied successfully to training DB!');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.error('[TRAINING MIGRATION] Failed:', err);
  process.exit(1);
});
