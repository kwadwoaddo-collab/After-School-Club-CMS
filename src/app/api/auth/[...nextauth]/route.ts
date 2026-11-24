import { NextRequest, NextResponse } from 'next/server';
import { handlers } from '@/lib/auth';
import { authRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';

export const { GET } = handlers;

const RATE_LIMITED_AUTH_POST_SUFFIXES = [
  '/callback/credentials',
  '/callback/inviteToken',
  '/signin/email',
  '/signin/nodemailer',
] as const;

function isRateLimitedAuthPost(pathname: string): boolean {
  return RATE_LIMITED_AUTH_POST_SUFFIXES.some((suffix) => pathname.endsWith(suffix));
}

export async function POST(req: NextRequest): Promise<Response> {
  if (isRateLimitedAuthPost(req.nextUrl.pathname)) {
    const ip = getClientIP(req);
    const rl = await checkRateLimit(authRateLimit, `nextauth:ip:${ip}`, {
      localLimit: 10,
      localWindowMs: 60_000,
    });

    if (!rl.success) {
      const retryAfter = String(rl.retryAfter ?? 60);
      const loginErrorUrl = new URL(
        '/login?error=RateLimited&code=rate_limited',
        req.url
      ).toString();

      // NextAuth v5 client signIn(..., { redirect: false }) sends X-Auth-Return-Redirect: 1
      // and calls new URL(data.url) unconditionally on JSON responses.
      if (req.headers.get('x-auth-return-redirect') === '1') {
        return NextResponse.json(
          { url: loginErrorUrl },
          {
            status: 429,
            headers: { 'Retry-After': retryAfter },
          }
        );
      }

      return NextResponse.redirect(loginErrorUrl, {
        status: 303,
        headers: { 'Retry-After': retryAfter },
      });
    }
  }

  return handlers.POST(req);
}
