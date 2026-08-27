import { logger } from '@/lib/logger';

export const APPROVED_TRAINING_DB_HOST = 'ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech';
export const KNOWN_PRODUCTION_DB_HOST = 'ep-super-dawn-abuicpc2-pooler.eu-west-2.aws.neon.tech';
export const REQUIRED_TRAINING_ENVIRONMENT = 'oakridge';

/**
 * Strict allowlist-based safety guard for synthetic training seed and reset tooling.
 *
 * Rules (Fail Closed):
 * 1. Missing or malformed DATABASE_URL throws.
 * 2. Missing or invalid ALLOW_TRAINING_SEED (must be 'true') throws.
 * 3. Missing or invalid TRAINING_ENVIRONMENT (must be 'oakridge') throws.
 * 4. Primary Allowlist: parsed DATABASE_URL hostname MUST strictly equal APPROVED_TRAINING_DB_HOST.
 * 5. Defense-in-Depth: explicitly blocks known production hostnames.
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

  // 1. Explicit acknowledgment flag
  if (process.env.ALLOW_TRAINING_SEED !== 'true') {
    throw new Error(
      `[CRITICAL SAFETY GUARD] REFUSED: Explicit acknowledgement required. ` +
      `Set ALLOW_TRAINING_SEED=true in your environment to execute training fixtures.`
    );
  }

  // 2. Explicit training environment marker
  if (process.env.TRAINING_ENVIRONMENT !== REQUIRED_TRAINING_ENVIRONMENT) {
    throw new Error(
      `[CRITICAL SAFETY GUARD] REFUSED: Invalid or missing TRAINING_ENVIRONMENT marker. ` +
      `Expected '${REQUIRED_TRAINING_ENVIRONMENT}', got '${process.env.TRAINING_ENVIRONMENT || 'undefined'}'.`
    );
  }

  // 3. Defense-in-depth: Rejection of known production database host
  if (host === KNOWN_PRODUCTION_DB_HOST || host.includes('ep-super-dawn')) {
    throw new Error(
      `[CRITICAL SAFETY GUARD] REFUSED: Target host (${host}) is the KNOWN PRODUCTION DATABASE. ` +
      `Training scripts must NEVER target production. Aborting immediately.`
    );
  }

  // 4. Primary Safety Mechanism: Strict Allowlist Check
  if (host !== APPROVED_TRAINING_DB_HOST) {
    throw new Error(
      `[CRITICAL SAFETY GUARD] REFUSED: Target host (${host}) is NOT on the approved training host allowlist. ` +
      `Approved host: ${APPROVED_TRAINING_DB_HOST}. Aborting immediately.`
    );
  }

  logger.info(
    `[SAFETY GUARD VERIFIED] Target Host: ${host} | Target DB: ${pathname} | ` +
    `ALLOW_TRAINING_SEED=true | TRAINING_ENVIRONMENT=${REQUIRED_TRAINING_ENVIRONMENT}`
  );

  return { host, database: pathname };
}
