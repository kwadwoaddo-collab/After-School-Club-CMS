import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const DEV_GUARD = (req: NextRequest) => {
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return null;
};

export async function GET(request: NextRequest) {
    const blocked = DEV_GUARD(request);
    if (blocked) return blocked;

    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (!user) {
        return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
        exists: true,
        email: user.email,
        role: user.role,
        hasPassword: !!user.passwordHash,
        passwordHashLength: user.passwordHash?.length || 0,
        organisationId: user.organisationId,
        createdAt: user.createdAt,
    });
}

export async function POST(request: NextRequest) {
    const blocked = DEV_GUARD(request);
    if (blocked) return blocked;

    const { email, password } = await request.json();

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    });

    if (!user || !user.passwordHash) {
        return NextResponse.json({ valid: false, reason: 'User not found or no password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    return NextResponse.json({
        valid: isValid,
        passwordLength: password.length,
        hashLength: user.passwordHash.length,
    });
}
