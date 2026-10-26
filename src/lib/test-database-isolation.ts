/** Unit tests must mock the DB. Real integration tests opt into disposable local _test databases only. */
export function assertTestDatabaseIsolation(env: { VITEST?: string; NODE_ENV?: string; DATABASE_URL?: string; TEST_ALLOW_INSECURE_TLS?: string }) {
    if (!env.VITEST && env.NODE_ENV !== 'test') return;
    let allowed = false;
    try {
        const url = new URL(env.DATABASE_URL || '');
        allowed = ['postgres:', 'postgresql:'].includes(url.protocol) && ['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname)
            && /^\/[A-Za-z0-9_-]+_test$/.test(url.pathname) && env.TEST_ALLOW_INSECURE_TLS === 'true';
    } catch { /* A missing or malformed connection is not an isolated test database. */ }
    if (!allowed) throw new Error('Database access blocked in tests. Mock the database or explicitly use a disposable loopback database ending in _test with TEST_ALLOW_INSECURE_TLS=true.');
}
