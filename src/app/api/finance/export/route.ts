import { auth } from '@/lib/auth';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.organisationId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Only ORG_OWNER should export
        if ((session.user as any).role !== 'ORG_OWNER') {
            return new NextResponse('Forbidden', { status: 403 });
        }

        const allInvoices = await db.query.invoices.findMany({
            where: eq(invoices.organisationId, session.user.organisationId),
            orderBy: [desc(invoices.createdAt)],
            with: {
                parent: true,
                child: true,
                centre: true,
                payments: true
            }
        });

        const csvRows = [];
        // Headers:
        csvRows.push([
            'Invoice Number',
            'Parent Name',
            'Child Name',
            'Amount',
            'Paid Amount',
            'Balance',
            'Status',
            'Payment Method',
            'Invoice Date',
            'Payment Date',
            'Centre'
        ].join(','));

        for (const inv of allInvoices) {
            const parentName = inv.parent ? `${inv.parent.firstName} ${inv.parent.lastName}` : '';
            const childName = inv.child 
                ? `${inv.child.firstName} ${inv.child.lastName}` 
                : (inv.coveredChildrenJson && Array.isArray(inv.coveredChildrenJson)
                    ? (inv.coveredChildrenJson as any[]).map(c => c.name || c.childName || '').filter(Boolean).join('; ')
                    : '');
            const amount = Number(inv.amount) || 0;

            let paidAmount = 0;
            const methods = new Set<string>();
            const paymentDates: string[] = [];

            if (inv.payments && inv.payments.length > 0) {
                for (const p of inv.payments) {
                    paidAmount += Number(p.amount) || 0;
                    methods.add(p.method);
                    paymentDates.push(new Date(p.recordedAt).toISOString().split('T')[0]);
                }
            }

            const balance = amount - paidAmount;
            const status = inv.status;
            const paymentMethod = Array.from(methods).join('; ');
            const invoiceDate = new Date(inv.invoiceDate).toISOString().split('T')[0];
            const paymentDateStr = paymentDates.join('; ');
            const centreName = inv.centre?.name || '';

            const escapeCSV = (str: string) => `"${String(str).replace(/"/g, '""')}"`;

            csvRows.push([
                escapeCSV(inv.invoiceNumber),
                escapeCSV(parentName),
                escapeCSV(childName),
                amount.toFixed(2),
                paidAmount.toFixed(2),
                balance.toFixed(2),
                escapeCSV(status),
                escapeCSV(paymentMethod),
                escapeCSV(invoiceDate),
                escapeCSV(paymentDateStr),
                escapeCSV(centreName)
            ].join(','));
        }

        const csvContent = csvRows.join('\n');

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="finance_ledger_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });
    } catch (error) {
        console.error('[GET /api/finance/export]', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
