import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    cookieStore.delete('parent_session');
    // Redirect to portal login page
    const loginUrl = new URL('/portal/login', request.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    cookieStore.delete('parent_session');
    const loginUrl = new URL('/portal/login', request.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
}
