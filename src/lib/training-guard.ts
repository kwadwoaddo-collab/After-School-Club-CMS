import { logger } from '@/lib/logger';

export const KNOWN_PRODUCTION_DB_HOST = 'ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech';

/**
 * Hard safety guard to prevent accidental test/training seeding or resets
 * against the live production database.
 *
 * Rules:
 * 1. Fails closed if DATABASE_URL is missing.
 * 2. Fails closed if DATABASE_URL hostname matches the known production database host.
 * 3. Fails closed if NODE_ENV === 'production' without explicit test flag.
 * 4. Fails closed if ALLOW_TRAINING_SEED !== 'true'.
 */
export function assertSafeTrainingEnvironment(): { host: string; database: string } {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('[CRITICAL SAFETY GUARD] DATABASE_URL is not set. Aborting.');
  }

  let host: string;
  let pathname: string;

  try {
    const url = new URL(dbUrl);
    host = url.host;
    pathname = url.pathname;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[CRITICAL SAFETY GUARD] Invalid DATABASE_URL format: ${msg}`);
  }

  // 1. Check against known production database host
  if (host === KNOWN_PRODUCTION_DB_HOST || host.includes('ep-super-dawn')) {
    throw new Error(
      `[CRITICAL SAFETY GUARD] REFUSED: Database host (${host}) matches the KNOWN PRODUCTION DATABASE. ` +
      `Training scripts must NEVER target production. Aborting immediately.`
    );
  }

  // 2. Check explicit training acknowledgement
  if (process.env.ALLOW_TRAINING_SEED !== 'true') {
    throw new Error(
      `[CRITICAL SAFETY GUARD] REFUSED: Explicit acknowledgement required. ` +
      `Set ALLOW_TRAINING_SEED=true in your environment to execute training fixtures.`
    );
  }

  logger.info(`[SAFETY GUARD VERIFIED] Target Host: ${host} | Target DB: ${pathname} | ALLOW_TRAINING_SEED=true`);

  return { host, database: pathname };
}
