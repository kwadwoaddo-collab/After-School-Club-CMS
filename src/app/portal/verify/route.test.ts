import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

const mockReturning = vi.fn();
const mockWhere = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWhere }));

vi.mock('@/db', () => ({
  db: {
    update: vi.fn(() => ({ set: mockSet })),
  },
}));

vi.mock('@/lib/parent-auth', () => ({
  signParentToken: vi.fn().mockResolvedValue('signed-parent-jwt-token'),
}));

import { db } from '@/db';
import { hashToken } from '@/lib/magic-link';
import { signParentToken } from '@/lib/parent-auth';
import { HEAD, GET, POST } from './route';

const VALID_TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('/portal/verify single-use magic-link protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HEAD /portal/verify (email scanner prefetch)', () => {
    it('returns 200 with no-store headers and NEVER touches the database', async () => {
      const req = new Request(`https://app.sprintscaleit.co.uk/portal/verify?token=${VALID_TOKEN}`, {
        method: 'HEAD',
      });

      const res = await HEAD(req);
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('returns 400 when token is missing or malformed without touching the database', async () => {
      const req = new Request('https://app.sprintscaleit.co.uk/portal/verify', { method: 'HEAD' });
      const res = await HEAD(req);
      expect(res.status).toBe(400);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('GET /portal/verify (non-mutating confirmation screen)', () => {
    it('redirects 303 to /portal/login?error=InvalidToken when token is missing or malformed', async () => {
      for (const badUrl of [
        'https://app.sprintscaleit.co.uk/portal/verify',
        'https://app.sprintscaleit.co.uk/portal/verify?token=short',
        'https://app.sprintscaleit.co.uk/portal/verify?token=bad<script>token',
      ]) {
        const res = await GET(new Request(badUrl));
        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toBe(
          'https://app.sprintscaleit.co.uk/portal/login?error=InvalidToken',
        );
        expect(db.update).not.toHaveBeenCalled();
      }
    });

    it('renders accessible HTML confirmation form without consuming magicLinkToken or setting cookie', async () => {
      const req = new Request(
        `https://app.sprintscaleit.co.uk/portal/verify?token=${VALID_TOKEN}&redirect=//evil.example.com`,
      );

      const res = await GET(req);
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(res.headers.get('set-cookie')).toBeNull();
      expect(db.update).not.toHaveBeenCalled();

      expect(html).toContain('<main>');
      expect(html).toContain('<form method="POST" action="/portal/verify">');
      expect(html).toContain(`name="token" value="${VALID_TOKEN}"`);
      // Open-redirect attempt must be sanitised to /portal
      expect(html).toContain('name="redirect" value="/portal"');
      expect(html).not.toContain('evil.example.com');
      expect(html).toContain('Confirm Sign In');
    });
  });

  describe('POST /portal/verify (atomic single-use consumption)', () => {
    it('atomically clears magicLinkToken, sets httpOnly parent_session cookie, and redirects 303 to /portal', async () => {
      mockReturning.mockResolvedValueOnce([{ id: 'parent-uuid-1' }]);

      const form = new FormData();
      form.append('token', VALID_TOKEN);
      form.append('redirect', '/portal/billing');

      const req = new Request('https://app.sprintscaleit.co.uk/portal/verify', {
        method: 'POST',
        body: form,
      });

      const res = await POST(req);

      expect(db.update).toHaveBeenCalledOnce();
      expect(mockSet).toHaveBeenCalledWith({
        magicLinkToken: null,
        magicLinkExpiresAt: null,
      });

      // Token is hashed before lookup — raw token never sent to SQL
      const whereClause = (mockWhere.mock.calls as unknown[][])[0][0] as SQL;
      const compiled = new PgDialect().sqlToQuery(whereClause);
      expect(compiled.params).toContain(hashToken(VALID_TOKEN));
      expect(compiled.params).not.toContain(VALID_TOKEN);

      expect(signParentToken).toHaveBeenCalledWith('parent-uuid-1');
      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe('https://app.sprintscaleit.co.uk/portal/billing');

      const setCookie = res.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain('parent_session=signed-parent-jwt-token');
      expect(setCookie.toLowerCase()).toContain('httponly');
      expect(setCookie.toLowerCase()).toContain('samesite=lax');
    });

    it('survives GET prefetch followed by POST click, then rejects second POST replay with ExpiredOrInvalid', async () => {
      // 1. Scanner GET prefetch — zero DB writes
      const getRes = await GET(
        new Request(`https://app.sprintscaleit.co.uk/portal/verify?token=${VALID_TOKEN}`),
      );
      expect(getRes.status).toBe(200);
      expect(db.update).not.toHaveBeenCalled();

      // 2. Parent clicks Confirm Sign In — atomic UPDATE returns row
      mockReturning.mockResolvedValueOnce([{ id: 'parent-uuid-1' }]);
      const firstForm = new FormData();
      firstForm.append('token', VALID_TOKEN);
      const firstPost = await POST(
        new Request('https://app.sprintscaleit.co.uk/portal/verify', {
          method: 'POST',
          body: firstForm,
        }),
      );
      expect(firstPost.status).toBe(303);
      expect(firstPost.headers.get('location')).toBe('https://app.sprintscaleit.co.uk/portal');

      // 3. Replay POST with the same token — atomic UPDATE matches 0 rows
      mockReturning.mockResolvedValueOnce([]);
      const replayForm = new FormData();
      replayForm.append('token', VALID_TOKEN);
      const replayPost = await POST(
        new Request('https://app.sprintscaleit.co.uk/portal/verify', {
          method: 'POST',
          body: replayForm,
        }),
      );
      expect(replayPost.status).toBe(303);
      expect(replayPost.headers.get('location')).toBe(
        'https://app.sprintscaleit.co.uk/portal/login?error=ExpiredOrInvalid',
      );
      expect(replayPost.headers.get('set-cookie')).toBeNull();
    });
  });
});
