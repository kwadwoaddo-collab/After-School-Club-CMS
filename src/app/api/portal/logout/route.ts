import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Reject GET logout requests to prevent forced-logout CSRF via `<img src="/api/portal/logout">`
 * or `<Link>` prefetching. Session termination requires an explicit POST form submission.
 */
export async function GET() {
    return NextResponse.json(
        { error: 'Method Not Allowed' },
        {
            status: 405,
            headers: {
                Allow: 'POST',
                'Cache-Control': 'no-store',
            },
        }
    );
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    cookieStore.delete('parent_session');
    const loginUrl = new URL('/portal/login', request.nextUrl.origin);
    // 303 See Other ensures browser follows POST -> GET /portal/login instead of re-POSTing (307 -> 405)
    const response = NextResponse.redirect(loginUrl, 303);
    response.headers.set('Cache-Control', 'no-store');
    return response;
}
