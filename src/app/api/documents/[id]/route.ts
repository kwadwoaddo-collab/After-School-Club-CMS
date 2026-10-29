import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { centreDocuments, centres } from '@/db/schema';
import { getApiSession } from '@/lib/session';
import { getUserRoleForCentre } from '@/lib/permissions';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getApiSession();
    if (!session) return NextResponse.json({ error: 'Sign in to access documents.' }, { status: 401 });
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    // Resolve metadata first: do not fetch bytes until centre access is established.
    const [metadata] = await db.select({ centreId: centreDocuments.centreId }).from(centreDocuments).where(and(eq(centreDocuments.id, id), eq(centreDocuments.organisationId, session.user.organisationId!), isNull(centreDocuments.removedAt)));
    if (!metadata) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    const centre = await db.query.centres.findFirst({ where: and(eq(centres.id, metadata.centreId), eq(centres.organisationId, session.user.organisationId!)), columns: { id: true } });
    const role = await getUserRoleForCentre(session.user.id, metadata.centreId);
    if (!centre || !role) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    const [document] = await db.select({ content: centreDocuments.content, filename: centreDocuments.originalFilename, sizeBytes: centreDocuments.sizeBytes }).from(centreDocuments).where(and(eq(centreDocuments.id, id), eq(centreDocuments.organisationId, session.user.organisationId!), eq(centreDocuments.centreId, metadata.centreId), isNull(centreDocuments.removedAt)));
    if (!document) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    const disposition = request.nextUrl.searchParams.get('view') === '1' ? 'inline' : 'attachment';
    return new Response(new Uint8Array(document.content), { headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(document.sizeBytes),
        'Content-Disposition': `${disposition}; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(document.filename).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'self'",
        'Referrer-Policy': 'no-referrer',
    } });
}
