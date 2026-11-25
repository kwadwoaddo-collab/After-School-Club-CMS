import { NextResponse } from 'next/server';
import { db } from '@/db';
import { parents } from '@/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { signParentToken } from '@/lib/parent-auth';
import { hashToken } from '@/lib/magic-link';

const TOKEN_SHAPE_REGEX = /^[A-Za-z0-9._-]{8,256}$/;

const NO_STORE_HEADERS: Record<string, string> = {
    'Cache-Control': 'no-store, max-age=0',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
};

function isValidTokenShape(token: string | null | undefined): token is string {
    return typeof token === 'string' && TOKEN_SHAPE_REGEX.test(token);
}

function sanitizePortalRedirect(candidate: string | null | undefined): string {
    if (!candidate || typeof candidate !== 'string') return '/portal';
    const trimmed = candidate.trim();
    if (
        !trimmed.startsWith('/portal') ||
        trimmed.startsWith('//') ||
        trimmed.includes('\\') ||
        /[\r\n]/.test(trimmed)
    ) {
        return '/portal';
    }
    if (trimmed === '/portal' || trimmed.startsWith('/portal/') || trimmed.startsWith('/portal?')) {
        return trimmed;
    }
    return '/portal';
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderConfirmationHtml(token: string, redirectTarget: string): string {
    const safeToken = escapeHtml(token);
    const safeRedirect = escapeHtml(redirectTarget);

    return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Confirm Sign In — Parent Portal</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #F4F5F6;
      --surface: #FFFFFF;
      --border: #E2E4E9;
      --text: #0F172A;
      --muted: #475569;
      --accent: #0F766E;
      --accent-hover: #115E59;
      --on-accent: #FFFFFF;
      --ring: #0D9488;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0E0E0F;
        --surface: #151618;
        --border: #26282C;
        --text: #F4F5F6;
        --muted: #A1A8B3;
        --accent: #0F766E;
        --accent-hover: #0D9488;
        --on-accent: #FFFFFF;
        --ring: #2DD4BF;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      line-height: 1.5;
    }
    main {
      width: 100%;
      max-width: 420px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 24px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 24px;
      font-size: 0.9375rem;
      color: var(--muted);
    }
    button {
      width: 100%;
      min-height: 44px;
      padding: 12px 16px;
      border: none;
      border-radius: 10px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 150ms ease;
    }
    button:hover { background: var(--accent-hover); }
    button:focus-visible, a:focus-visible {
      outline: 2px solid var(--ring);
      outline-offset: 2px;
    }
    .secondary {
      margin-top: 16px;
      text-align: center;
    }
    .secondary a {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 4px 8px;
      font-size: 0.875rem;
      color: var(--muted);
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <main>
    <h1>Confirm Sign In</h1>
    <p>Select the button below to complete signing in to your Parent Portal.</p>
    <form method="POST" action="/portal/verify">
      <input type="hidden" name="token" value="${safeToken}" />
      <input type="hidden" name="redirect" value="${safeRedirect}" />
      <button type="submit">Confirm Sign In</button>
    </form>
    <div class="secondary">
      <a href="/portal/login">Need a fresh sign-in link?</a>
    </div>
  </main>
</body>
</html>`;
}

/**
 * HEAD /portal/verify
 * Email link scanners (SafeLinks, Mimecast, Proofpoint) often issue HEAD/GET prefetches.
 * Never mutate or consume `magicLinkToken` on HEAD.
 */
export async function HEAD(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    if (!isValidTokenShape(token)) {
        return new Response(null, { status: 400, headers: NO_STORE_HEADERS });
    }
    return new Response(null, { status: 200, headers: NO_STORE_HEADERS });
}

/**
 * GET /portal/verify?token=...
 * Validates token presence/shape WITHOUT consuming `magicLinkToken`, rendering an
 * accessible confirmation form that submits via POST. This prevents email security
 * scanners from burning single-use magic links before the parent clicks them.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const redirectParam = searchParams.get('redirect');

    if (!isValidTokenShape(token)) {
        return NextResponse.redirect(new URL('/portal/login?error=InvalidToken', request.url), {
            status: 303,
            headers: NO_STORE_HEADERS,
        });
    }

    const safeRedirect = sanitizePortalRedirect(redirectParam);
    const html = renderConfirmationHtml(token, safeRedirect);

    return new Response(html, {
        status: 200,
        headers: {
            ...NO_STORE_HEADERS,
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}

/**
 * POST /portal/verify
 * Atomically verifies and consumes the single-use hashed `magicLinkToken`,
 * issues the signed `parent_session` cookie, and redirects (`303 See Other`) to `/portal`.
 */
export async function POST(request: Request) {
    let rawToken: string | null = null;
    let rawRedirect: string | null = null;

    try {
        const contentType = request.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            const body = (await request.json()) as { token?: unknown; redirect?: unknown };
            rawToken = typeof body.token === 'string' ? body.token : null;
            rawRedirect = typeof body.redirect === 'string' ? body.redirect : null;
        } else {
            const formData = await request.formData();
            const tokenEntry = formData.get('token');
            const redirectEntry = formData.get('redirect');
            rawToken = typeof tokenEntry === 'string' ? tokenEntry : null;
            rawRedirect = typeof redirectEntry === 'string' ? redirectEntry : null;
        }
    } catch {
        return NextResponse.redirect(new URL('/portal/login?error=InvalidToken', request.url), {
            status: 303,
            headers: NO_STORE_HEADERS,
        });
    }

    if (!isValidTokenShape(rawToken)) {
        return NextResponse.redirect(new URL('/portal/login?error=InvalidToken', request.url), {
            status: 303,
            headers: NO_STORE_HEADERS,
        });
    }

    const safeRedirect = sanitizePortalRedirect(rawRedirect);
    const hashedToken = hashToken(rawToken);

    // Atomically match AND clear the single-use token so concurrent replays cannot both succeed.
    const consumedRows = await db
        .update(parents)
        .set({ magicLinkToken: null, magicLinkExpiresAt: null })
        .where(
            and(
                eq(parents.magicLinkToken, hashedToken),
                gt(parents.magicLinkExpiresAt, new Date()),
                isNull(parents.deletedAt),
            ),
        )
        .returning({ id: parents.id });

    const parent = consumedRows[0] ?? null;

    if (!parent) {
        return NextResponse.redirect(new URL('/portal/login?error=ExpiredOrInvalid', request.url), {
            status: 303,
            headers: NO_STORE_HEADERS,
        });
    }

    const sessionToken = await signParentToken(parent.id);
    const response = NextResponse.redirect(new URL(safeRedirect, request.url), {
        status: 303,
        headers: NO_STORE_HEADERS,
    });

    response.cookies.set('parent_session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
    });

    return response;
}
