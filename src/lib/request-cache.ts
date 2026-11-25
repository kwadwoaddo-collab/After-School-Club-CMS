import { cache } from 'react';

/**
 * Request-scoped memoization helper backed by `React.cache()`.
 *
 * Within a Next.js App Router RSC render, `React.cache()` binds to Next.js's
 * per-request `AsyncLocalStorage` cache dispatcher so repeated read-only auth
 * and centre-scope lookups across layouts, pages, and Server Components share
 * a single database query per request. Every new HTTP request starts with an
 * empty cache — never module-global or cross-request — preserving immediate
 * organisation suspension and staff membership revocation.
 *
 * Under Vitest (`process.env.VITEST`), memoization is bypassed by default so
 * unit suites reusing identical mock IDs (`'org-1'`, `'user-1'`) across `it()`
 * blocks never suffer cross-test mock bleed. Dedicated RSC cache tests opt in
 * via `process.env.ENABLE_REQUEST_CACHE_IN_TEST = 'true'`.
 */
export function requestCache<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>
): (...args: Args) => Promise<Result> {
  const cached = cache(fn);
  return (...args: Args) => {
    if (process.env.VITEST && process.env.ENABLE_REQUEST_CACHE_IN_TEST !== 'true') {
      return fn(...args);
    }
    return cached(...args);
  };
}
