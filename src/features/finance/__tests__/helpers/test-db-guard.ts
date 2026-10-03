/**
 * Guard utility for isolated PostgreSQL test database verification.
 * Enforces strict security boundaries:
 * - Host must be a loopback host (localhost, 127.0.0.1, ::1)
 * - Database name must end in '_test'
 * - Explicit TEST_ALLOW_INSECURE_TLS === 'true' flag required
 * - Strictly forbids fallback to normal DATABASE_URL or remote databases
 */

export function validateTestDatabaseUrl(urlStr: string | undefined): {
  valid: boolean;
  error?: string;
  url?: string;
} {
  if (!urlStr) {
    return {
      valid: false,
      error: 'TEST_DATABASE_URL is not set. An isolated PostgreSQL test database ending in _test is required.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return {
      valid: false,
      error: 'TEST_DATABASE_URL is not a valid URL.',
    };
  }

  const hostname = parsed.hostname;
  const loopbackHosts = ['localhost', '127.0.0.1', '::1'];
  const isLoopback = loopbackHosts.includes(hostname);

  if (!isLoopback) {
    return {
      valid: false,
      error: `TEST_DATABASE_URL host '${hostname}' is not a permitted loopback host (localhost, 127.0.0.1, ::1). Remote hosts are strictly forbidden.`,
    };
  }

  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    return {
      valid: false,
      error: `TEST_DATABASE_URL database name '${dbName}' must end in '_test' for test isolation.`,
    };
  }

  if (process.env.TEST_ALLOW_INSECURE_TLS !== 'true') {
    return {
      valid: false,
      error: 'TEST_ALLOW_INSECURE_TLS must be explicitly set to "true" to allow connection to the local test database.',
    };
  }

  return { valid: true, url: urlStr };
}

export function assertTestDatabaseUrl(urlStr: string | undefined): string {
  const result = validateTestDatabaseUrl(urlStr);
  if (!result.valid || !result.url) {
    throw new Error(`[test-db-guard] Security violation: ${result.error}`);
  }
  return result.url;
}
