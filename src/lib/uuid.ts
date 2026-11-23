/**
 * Shared UUID format validator for route and query parameters.
 *
 * Accepts standard 8-4-4-4-12 hex UUIDs (matching PostgreSQL's `uuid` input parser,
 * including UUIDv4, UUIDv7, and deterministic test UUIDs) while rejecting slugs,
 * sentinel strings like `'none'` or `'unauthorized_centre_id'`, and malformed IDs
 * before they can trigger PostgreSQL `22P02` syntax errors.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
    return typeof value === 'string' && UUID_RE.test(value);
}
