/**
 * Centralised secret resolver for registration prefill JWTs (HS256).
 *
 * Security invariant (SEC-F-05 / PR-06):
 * - In production (`NODE_ENV === 'production'`), fails closed by throwing if
 *   none of `PREFILL_TOKEN_SECRET`, `AUTH_SECRET`, or `NEXTAUTH_SECRET` is set.
 * - Never falls back to a hardcoded string in production.
 */
export function getPrefillJwtSecret(): Uint8Array {
  const secret = (
    process.env.PREFILL_TOKEN_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  ).trim();

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '[prefill-token] PREFILL_TOKEN_SECRET, AUTH_SECRET, or NEXTAUTH_SECRET must be configured in production'
      );
    }
    return new TextEncoder().encode('dev-prefill-secret-do-not-use-in-prod-32b');
  }

  return new TextEncoder().encode(secret);
}
