import { format } from 'date-fns';

export function safeFormatDate(date: unknown, formatStr: string): string {
    if (!date) return '-';
    const d = new Date(date as string | number | Date);
    if (isNaN(d.getTime())) return '-';
    return format(d, formatStr);
}

export function buildCentreAddressLines(address?: string | null): string[] {
    return address ? address.split('\n').map((l: string) => l.trim()).filter(Boolean) : [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCoveredChildNames(invoice: any): string[] {
    const json = invoice?.coveredChildrenJson;
    if (json && Array.isArray(json) && json.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return json.map((c: any) => c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()).filter(Boolean);
    }
    if (invoice?.child) return [`${invoice.child.firstName} ${invoice.child.lastName}`];
    if (invoice?.childDisplayName) return [invoice.childDisplayName];
    return [];
}

export const billingStylesBase = {
    page: {
        padding: 40,
        fontSize: 10,
        color: '#334155',
        fontFamily: 'Helvetica',
        position: 'relative' as const,
        backgroundColor: '#ffffff',
    },
    watermark: {
        position: 'absolute' as const,
        top: 300,
        left: 50,
        fontSize: 48,
        color: '#e2e8f0',
        transform: 'rotate(-45deg)',
        opacity: 0.3,
        zIndex: -1,
        width: 520,
        textAlign: 'center' as const,
    },
    header: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 40,
        borderBottom: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'extrabold' as const,
        color: '#1e293b',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 10,
        color: '#64748b',
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
    },
    invoiceInfo: {
        textAlign: 'right' as const,
    },
    infoRow: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-end' as const,
        marginBottom: 3,
    },
    infoLabel: {
        color: '#64748b',
        width: 80,
    },
    infoValue: {
        fontWeight: 'bold' as const,
        width: 100,
    },
    section: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold' as const,
        color: '#64748b',
        textTransform: 'uppercase' as const,
        marginBottom: 10,
        borderBottom: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 4,
    },
    billedTo: {
        width: '45%' as const,
    },
    period: {
        width: '45%' as const,
    },
    table: {
        marginTop: 20,
        marginBottom: 40,
    },
    tableHeader: {
        flexDirection: 'row' as const,
        backgroundColor: '#f8fafc',
        borderBottom: 1,
        borderBottomColor: '#e2e8f0',
        padding: 8,
        fontWeight: 'bold' as const,
    },
    tableRow: {
        flexDirection: 'row' as const,
        borderBottom: 1,
        borderBottomColor: '#f1f5f9',
        padding: 8,
    },
    totals: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-end' as const,
        marginTop: 20,
    },
    totalsBox: {
        width: 200,
        borderTop: 2,
        borderTopColor: '#1e293b',
        paddingTop: 10,
    },
    totalRow: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 5,
    },
    grandTotal: {
        fontSize: 14,
        fontWeight: 'bold' as const,
        color: '#1e293b',
        marginTop: 5,
    },
    footer: {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: 75,
        backgroundColor: '#1e40af', // Primary Blue
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 40,
        paddingVertical: 12,
        color: 'white',
        fontSize: 8,
    },
    footerLeft: {
        flexDirection: 'column' as const,
    },
    footerRight: {
        textAlign: 'right' as const,
    },
};
