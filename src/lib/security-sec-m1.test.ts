import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

describe('SEC-M1: Production Debug / Environment Exposure Security Suite', () => {
  describe('S1: Obsolete /auth-test route removal', () => {
    it('confirms src/app/auth-test does not exist in the codebase', () => {
      const authTestPage = path.join(process.cwd(), 'src/app/auth-test/page.tsx');
      const authTestDir = path.join(process.cwd(), 'src/app/auth-test');
      expect(fs.existsSync(authTestPage)).toBe(false);
      expect(fs.existsSync(authTestDir)).toBe(false);
    });
  });

  describe('S2: Health endpoints minimal disclosure', () => {
    it('/api/health exposes zero credentials, environment, or database metadata', async () => {
      const { GET, HEAD } = await import('@/app/api/health/route');
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ ok: true });
      expect(Object.keys(data)).toEqual(['ok']);

      const headRes = await HEAD();
      expect(headRes.status).toBe(200);
      expect(await headRes.text()).toBe('');
    });

    it('/api/health/deep exposes zero database credentials, hostnames, or error stacks on success or error', async () => {
      const { GET } = await import('@/app/api/health/deep/route');
      const res = await GET();
      expect([200, 503]).toContain(res.status);
      const data = await res.json();
      
      // Must only contain ok and database keys
      expect(Object.keys(data).sort()).toEqual(['database', 'ok'].sort());
      expect(['healthy', 'unreachable']).toContain(data.database);
      expect(typeof data.ok).toBe('boolean');

      // Assert no sensitive keys exist
      const serialized = JSON.stringify(data).toLowerCase();
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('postgres');
      expect(serialized).not.toContain('neon');
      expect(serialized).not.toContain('aws');
      expect(serialized).not.toContain('stack');
      expect(serialized).not.toContain('error');
    });
  });

  describe('S3: Cron endpoints fail-closed without valid authorization', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, CRON_SECRET: 'super-secret-cron-token' };
    });

    it('rejects unauthenticated requests across all cron routes', async () => {
      const { verifyCronAuthorization } = await import('@/lib/cron-auth');

      // 1. Missing header
      const reqMissing = new NextRequest('http://localhost:3000/api/cron/test');
      const authMissing = verifyCronAuthorization(reqMissing);
      expect(authMissing.authorized).toBe(false);
      expect(authMissing.status).toBe(401);

      // 2. Wrong scheme
      const reqWrongScheme = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: { authorization: 'Basic abc123xyz' },
      });
      const authWrongScheme = verifyCronAuthorization(reqWrongScheme);
      expect(authWrongScheme.authorized).toBe(false);
      expect(authWrongScheme.status).toBe(401);

      // 3. Incorrect token
      const reqWrongToken = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: { authorization: 'Bearer wrong-token-value' },
      });
      const authWrongToken = verifyCronAuthorization(reqWrongToken);
      expect(authWrongToken.authorized).toBe(false);
      expect(authWrongToken.status).toBe(401);

      // 4. Missing CRON_SECRET in environment
      delete process.env.CRON_SECRET;
      const reqNoSecret = new NextRequest('http://localhost:3000/api/cron/test', {
        headers: { authorization: 'Bearer super-secret-cron-token' },
      });
      const authNoSecret = verifyCronAuthorization(reqNoSecret);
      expect(authNoSecret.authorized).toBe(false);
      expect(authNoSecret.status).toBe(503);
    });

    it('/api/cron/school-year-roll sanitized error response on failure', async () => {
      const { GET } = await import('@/app/api/cron/school-year-roll/route');
      const req = new NextRequest('http://localhost:3000/api/cron/school-year-roll');
      const res = await GET(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: 'Missing authorization header' });
    });
  });

  describe('S4: Stripe webhook fails closed without signature', () => {
    it('/api/webhooks/stripe-invoice rejects requests missing stripe-signature header', async () => {
      const { POST } = await import('@/app/api/webhooks/stripe-invoice/route');
      const req = new NextRequest('http://localhost:3000/api/webhooks/stripe-invoice', {
        method: 'POST',
        body: JSON.stringify({ id: 'evt_test' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid webhook signature');
    });
  });

  describe('S5: Server secrets prohibited from client bundles', () => {
    it('verifies client files do not reference server-only environment variables', () => {
      function walkDir(dir: string): string[] {
        let results: string[] = [];
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            results = results.concat(walkDir(full));
          } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
            results.push(full);
          }
        }
        return results;
      }

      const allFiles = walkDir(path.join(process.cwd(), 'src'));
      const clientFiles = allFiles.filter(f => {
        const content = fs.readFileSync(f, 'utf8');
        return content.startsWith("'use client'") || content.startsWith('"use client"');
      });

      const serverOnlyEnvNames = [
        'DATABASE_URL',
        'POSTGRES_URL',
        'AUTH_SECRET',
        'NEXTAUTH_SECRET',
        'PARENT_SESSION_SECRET',
        'CRON_SECRET',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'RESEND_API_KEY',
        'TWILIO_AUTH_TOKEN',
      ];

      for (const file of clientFiles) {
        const content = fs.readFileSync(file, 'utf8');
        for (const envVar of serverOnlyEnvNames) {
          expect(content.includes(`process.env.${envVar}`)).toBe(false);
        }
      }
    });
  });

  describe('S6: Production routing inventory excludes diagnostic surfaces', () => {
    it('scans all app routes to confirm no diagnostic, debug, or dummy endpoints exist', () => {
      function walk(dir: string): string[] {
        let results: string[] = [];
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            results = results.concat(walk(full));
          } else if (item === 'page.tsx' || item === 'route.ts') {
            results.push(full);
          }
        }
        return results;
      }

      const appRoutes = walk(path.join(process.cwd(), 'src/app'));
      const disallowedNames = ['auth-test', 'debug', 'diagnostic', 'test-page', 'dummy'];

      for (const routePath of appRoutes) {
        const relative = path.relative(path.join(process.cwd(), 'src/app'), routePath);
        for (const disallowed of disallowedNames) {
          const segments = relative.split(path.sep);
          expect(segments.includes(disallowed)).toBe(false);
        }
      }
    });
  });
});
