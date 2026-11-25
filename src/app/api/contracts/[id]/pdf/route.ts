import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditEvents, contractPdfs, contracts } from '@/db/schema';
import { getApiSession } from '@/lib/session';
import { getUserAccessibleCentreIds } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/** Staff-only download of a signed contract. Owner/Manager with access to the contract's centre. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const session = await getApiSession();
    if (!session?.user?.organisationId) return NextResponse.json({ error: 'Sign in to access contracts.' }, { status: 401 });
    const { id } = await context.params;
    const notFound = () => NextResponse.json({ error: 'Contract not found.' }, { status: 404 });
    if (!z.string().uuid().safeParse(id).success) return notFound();
    const orgId = session.user.organisationId;
    const [meta] = await db.select({ centreId: contracts.centreId, status: contracts.status }).from(contracts).where(and(eq(contracts.id, id), eq(contracts.organisationId, orgId)));
    if (!meta || meta.status !== 'signed') return notFound();
    if (!['ORG_OWNER', 'MANAGER'].includes(session.user.role)) return notFound();
    if (session.user.role !== 'ORG_OWNER' && !(await getUserAccessibleCentreIds(session.user.id)).includes(meta.centreId)) return notFound();
    const [pdf] = await db.select({ content: contractPdfs.content, sizeBytes: contractPdfs.sizeBytes }).from(contractPdfs).where(eq(contractPdfs.contractId, id));
    if (!pdf) return notFound();
    await db.insert(auditEvents).values({ organisationId: orgId, userId: session.user.id, eventType: 'contract_downloaded', eventData: JSON.stringify({ contractId: id }) });
    return new Response(new Uint8Array(pdf.content), { headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.sizeBytes),
        'Content-Disposition': 'attachment; filename="signed-contract.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'self'",
        'Referrer-Policy': 'no-referrer',
    } });
}
