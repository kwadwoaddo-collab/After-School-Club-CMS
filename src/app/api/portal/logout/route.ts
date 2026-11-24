import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function clearSessionAndRedirect(request: NextRequest) {
    const cookieStore = await cookies();
    cookieStore.delete('parent_session');
    const loginUrl = new URL('/portal/login', request.nextUrl.origin);
    // 303 See Other ensures browser follows POST -> GET /portal/login instead of re-POSTing (307 -> 405)
    return NextResponse.redirect(loginUrl, 303);
}

export async function GET(request: NextRequest) {
    return clearSessionAndRedirect(request);
}

export async function POST(request: NextRequest) {
    return clearSessionAndRedirect(request);
}
