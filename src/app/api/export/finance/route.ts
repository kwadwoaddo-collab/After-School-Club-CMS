import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApiSession } from '@/lib/session';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm';
import { getUserAccessibleCentres } from '@/lib/permissions';
import { neutralizeCsvFormula } from '@/lib/csv-safety';
import { isValidUuid } from '@/lib/uuid';
import {
    evaluateInvoiceCollectionState,
    toLondonBusinessDate,
} from '@/features/finance/domain/invoice-collection-state';
import {
    formatPenceToDecimal,
    parseStoredDecimalToPence,
} from '@/features/finance/domain/payment-eligibility';
import { NextRequest, NextResponse } from 'next/server';

const CSV_HEADERS = [
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

/**
 * GET /api/export/finance?from=YYYY-MM-DD&to=YYYY-MM-DD&centre=<centreId>
 *
 * Returns a CSV of invoices + verified payments for the given date range.
 * Includes: invoice number, date, student name, parent name, invoice amount,
 * verified paid amount, outstanding balance (0.00 for draft/void), collection status, payment method(s).
 *
 * Auth: session required. Role must be ORG_OWNER or MANAGER.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getApiSession();
        if (!session?.user?.organisationId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const role = (session.user as any).role as string;
        if (role !== 'ORG_OWNER' && role !== 'MANAGER') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const requestedCentre = searchParams.get('centre');

        if (requestedCentre && requestedCentre !== 'all' && !isValidUuid(requestedCentre)) {
            return new NextResponse('Invalid centre ID', { status: 400 });
        }

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

        // Helper: wrap a value in double-quotes, escaping inner quotes and formula prefixes
        const esc = (val: string | null | undefined) =>
            `"${neutralizeCsvFormula(String(val ?? '')).replace(/"/g, '""')}"`;

        const fromStr = fromDate.toISOString().split('T')[0];
        const toStr = toDate.toISOString().split('T')[0];

        let centreCondition = undefined;
        if (role === 'ORG_OWNER') {
            if (requestedCentre && requestedCentre !== 'all') {
                centreCondition = eq(invoices.centreId, requestedCentre);
            }
        } else {
            const accessibleCentres = await getUserAccessibleCentres(session.user.id);
            const accessibleCentreIds = accessibleCentres.map(c => c.id);
            if (accessibleCentreIds.length === 0) {
                return new NextResponse(CSV_HEADERS.map(esc).join(','), {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/csv; charset=utf-8',
                        'Content-Disposition': `attachment; filename="finance-${fromStr}-to-${toStr}.csv"`,
                        'Cache-Control': 'private, no-store',
                    },
                });
            }
            if (requestedCentre && requestedCentre !== 'all') {
                if (!accessibleCentreIds.includes(requestedCentre)) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
                centreCondition = eq(invoices.centreId, requestedCentre);
            } else {
                centreCondition = inArray(invoices.centreId, accessibleCentreIds);
            }
        }

        // Query invoices in date range for this organisation (bounded to 5000 rows)
        const invoiceRows = await db.query.invoices.findMany({
            where: and(
                eq(invoices.organisationId, orgId),
                gte(invoices.invoiceDate, fromDate),
                lte(invoices.invoiceDate, toDate),
                centreCondition
            ),
            orderBy: [desc(invoices.invoiceDate)],
            limit: 5000,
            with: {
                parent: true,
                child: true,
                payments: true,
            },
        });

        const todayLondonIso = toLondonBusinessDate();

        const rows = invoiceRows.map(inv => {
            const invoiceAmountPence = parseStoredDecimalToPence(inv.amount);

            let paidAmountPence = 0;
            const methods = new Set<string>();
            for (const p of (inv.payments ?? [])) {
                if (p.status === 'verified' && !p.reversedAt) {
                    paidAmountPence += parseStoredDecimalToPence(p.amount);
                    if (p.method) {
                        methods.add(p.method);
                    }
                }
            }

            const outstandingPence =
                inv.status === 'draft' || inv.status === 'void'
                    ? 0
                    : Math.max(0, invoiceAmountPence - paidAmountPence);

            const collectionState = evaluateInvoiceCollectionState(inv, todayLondonIso, {
                strictPayments: false,
            });

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
                formatPenceToDecimal(invoiceAmountPence),
                formatPenceToDecimal(paidAmountPence),
                formatPenceToDecimal(outstandingPence),
                esc(collectionState.exportLabel),
                esc(paymentMethodStr),
            ].join(',');
        });

        const csvContent = [CSV_HEADERS.map(esc).join(','), ...rows].join('\n');

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="finance-${fromStr}-to-${toStr}.csv"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        logger.error('[GET /api/export/finance]', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
