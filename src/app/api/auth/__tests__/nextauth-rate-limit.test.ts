import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _resetLocalRateLimitStore } from '@/lib/rate-limit';

const mockHandlersPost = vi.fn(async (_req?: NextRequest) => {
  void _req;
  return new Response(JSON.stringify({ url: 'http://localhost/dashboard' }), { status: 200 });
});
const mockHandlersGet = vi.fn(async (_req?: NextRequest) => {
  void _req;
  return new Response(JSON.stringify({}), { status: 200 });
});

vi.mock('@/lib/auth', () => ({
  handlers: {
    GET: (req: NextRequest) => mockHandlersGet(req),
    POST: (req: NextRequest) => mockHandlersPost(req),
  },
}));

describe('NextAuth Sign-In Rate Limiting (PR-04 / SEC-F-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetLocalRateLimitStore();
  });

  it('allows up to 10 POSTs to /api/auth/callback/credentials and returns X-Auth-Return-Redirect JSON on attempt #11', async () => {
    const { POST } = await import('@/app/api/auth/[...nextauth]/route');

    for (let i = 0; i < 10; i++) {
      const req = new NextRequest('http://localhost/api/auth/callback/credentials', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.10',
          'x-auth-return-redirect': '1',
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }

    expect(mockHandlersPost).toHaveBeenCalledTimes(10);

    const req11 = new NextRequest('http://localhost/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.10',
        'x-auth-return-redirect': '1',
      },
    });
    const res11 = await POST(req11);
    expect(res11.status).toBe(429);
    expect(res11.headers.get('retry-after')).toBeTruthy();

    const body = await res11.json();
    // NextAuth v5 client signIn(..., { redirect: false }) unconditionally calls new URL(data.url)
    const parsed = new URL(body.url);
    expect(parsed.pathname).toBe('/login');
    expect(parsed.searchParams.get('error')).toBe('RateLimited');
    expect(parsed.searchParams.get('code')).toBe('rate_limited');
    expect(mockHandlersPost).toHaveBeenCalledTimes(10);
  });

  it('returns 303 redirect to /login?error=RateLimited when X-Auth-Return-Redirect is absent', async () => {
    const { POST } = await import('@/app/api/auth/[...nextauth]/route');

    for (let i = 0; i < 10; i++) {
      await POST(
        new NextRequest('http://localhost/api/auth/signin/email', {
          method: 'POST',
          headers: { 'x-forwarded-for': '203.0.113.20' },
        })
      );
    }

    const res11 = await POST(
      new NextRequest('http://localhost/api/auth/signin/email', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.20' },
      })
    );
    expect(res11.status).toBe(303);
    expect(res11.headers.get('location')).toContain('/login?error=RateLimited&code=rate_limited');
  });

  it('does not rate-limit POST /api/auth/signout or GET /api/auth/session', async () => {
    const { POST } = await import('@/app/api/auth/[...nextauth]/route');

    for (let i = 0; i < 15; i++) {
      const res = await POST(
        new NextRequest('http://localhost/api/auth/signout', {
          method: 'POST',
          headers: { 'x-forwarded-for': '203.0.113.30' },
        })
      );
      expect(res.status).toBe(200);
    }
    expect(mockHandlersPost).toHaveBeenCalledTimes(15);
  });
});
