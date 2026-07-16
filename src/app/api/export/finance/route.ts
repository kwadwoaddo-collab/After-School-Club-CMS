import { auth } from '@/lib/auth';
import { db } from '@/db';
import { invoices, payments } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/export/finance?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns a CSV of invoices + payments for the given date range.
 * Includes: date, student name, parent name, invoice amount,
 * paid amount, outstanding, status, payment method.
 *
 * Auth: session required. Role must be ORG_OWNER or MANAGER.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const role = (session.user as any).role as string;
        if (role !== 'ORG_OWNER' && role !== 'MANAGER') {
            return new NextResponse('Forbidden: insufficient permissions', { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');

        // Default: current month
        const now = new Date();
        const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        const defaultTo = now;

        const fromDate = fromParam ? new Date(fromParam) : defaultFrom;
        const toDate = toParam ? new Date(toParam) : defaultTo;

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return new NextResponse('Invalid date parameters', { status: 400 });
        }

        // Set time boundaries
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);

        const orgId = session.user.organisationId;

        // Query invoices in date range for this organisation
        const invoiceRows = await db.query.invoices.findMany({
            where: and(
                eq(invoices.organisationId, orgId),
                gte(invoices.invoiceDate, fromDate),
                lte(invoices.invoiceDate, toDate)
            ),
            orderBy: [desc(invoices.invoiceDate)],
            with: {
                parent: true,
                child: true,
                payments: true,
            },
        });

        // Helper: wrap a value in double-quotes, escaping inner quotes
        const esc = (val: string | null | undefined) =>
            `"${String(val ?? '').replace(/"/g, '""')}"`;

        const headers = [
            'Invoice Number',
            'Invoice Date',
            'Student Name',
            'Parent Name',
            'Invoice Amount (£)',
            'Paid Amount (£)',
            'Outstanding (£)',
            'Status',
            'Payment Method(s)',
        ];

        const rows = invoiceRows.map(inv => {
            const invoiceAmount = Number(inv.amount) || 0;

            let paidAmount = 0;
            const methods = new Set<string>();
            for (const p of (inv.payments ?? [])) {
                if (p.status !== 'failed') {
                    paidAmount += Number(p.amount) || 0;
                    methods.add(p.method);
                }
            }

            const outstanding = Math.max(0, invoiceAmount - paidAmount);
            const parentName = inv.parent
                ? `${inv.parent.firstName} ${inv.parent.lastName}`
                : '';
            const studentName = inv.child
                ? `${inv.child.firstName} ${inv.child.lastName}`
                : (inv.coveredChildrenJson && Array.isArray(inv.coveredChildrenJson)
                    ? (inv.coveredChildrenJson as any[]).map(c => c.name || c.childName || '').filter(Boolean).join('; ')
                    : '');
            const invoiceDateStr = new Date(inv.invoiceDate).toISOString().split('T')[0];
            const paymentMethodStr = Array.from(methods).join('; ');

            return [
                esc(inv.invoiceNumber),
                esc(invoiceDateStr),
                esc(studentName),
                esc(parentName),
                invoiceAmount.toFixed(2),
                paidAmount.toFixed(2),
                outstanding.toFixed(2),
                esc(inv.status),
                esc(paymentMethodStr),
            ].join(',');
        });

        const csvContent = [headers.map(esc).join(','), ...rows].join('\n');

        const fromStr = fromDate.toISOString().split('T')[0];
        const toStr = toDate.toISOString().split('T')[0];

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="finance-${fromStr}-to-${toStr}.csv"`,
            },
        });
    } catch (error) {
        console.error('[GET /api/export/finance]', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
