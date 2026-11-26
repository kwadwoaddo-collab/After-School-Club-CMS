/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { billingStylesBase, safeFormatDate, buildCentreAddressLines, getCoveredChildNames } from './billingPdfStyles';
import {receiptIdentityPayment} from '../domain/payment-correction';
import { stableReceiptNumber } from '@/lib/finance/receipt-number';
import { normaliseServiceType, serviceTypeLabel } from '@/features/finance/service-type';


// Receipt-only overrides: larger type + a highlighted "key details" panel so the facts
// parents need for claims evidence (service type, assessment period, Ofsted no, payment date)
// stand out. The shared billingStylesBase is intentionally NOT changed so invoices are unaffected.
const styles = StyleSheet.create({
    ...billingStylesBase,
    page: { ...billingStylesBase.page, fontSize: 11, paddingBottom: 110 },
    header: { ...billingStylesBase.header, marginBottom: 14, paddingBottom: 10 },
    subtitle: { ...billingStylesBase.subtitle, fontSize: 11 },
    title: { ...billingStylesBase.title, fontSize: 26 },
    infoLabel: { ...billingStylesBase.infoLabel, width: 92, fontSize: 10 },
    infoValue: { ...billingStylesBase.infoValue, width: 110, fontSize: 11 },
    section: { ...billingStylesBase.section, marginBottom: 12 },
    sectionTitle: { ...billingStylesBase.sectionTitle, fontSize: 11 },
    table: { ...billingStylesBase.table, marginTop: 6, marginBottom: 10 },
    tableHeader: { ...billingStylesBase.tableHeader, fontSize: 11, padding: 7 },
    tableRow: { ...billingStylesBase.tableRow, fontSize: 12, padding: 7 },
    totals: { ...billingStylesBase.totals, marginTop: 8 },
    totalsBox: { ...billingStylesBase.totalsBox, width: 240 },
    totalRow: { ...billingStylesBase.totalRow, fontSize: 12 },
    grandTotal: { ...billingStylesBase.grandTotal, fontSize: 16 },
    footer: { ...billingStylesBase.footer, minHeight: 80, fontSize: 9 },
    col1: { flex: 2 },
    col2: { flex: 1 },
    col3: { flex: 1, textAlign: 'right' },
    keyPanel: {
        backgroundColor: '#eff6ff',
        borderWidth: 1.5,
        borderColor: '#1e40af',
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    keyPanelTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1e40af',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    keyGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    keyCell: { width: '50%', marginBottom: 8, paddingRight: 8 },
    keyLabel: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#1e40af',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    keyValue: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
    keyNote: { fontSize: 9, color: '#475569', marginTop: 2 },
    managerInfo: {
        marginTop: 8,
        fontSize: 10,
        color: '#475569',
    }
});

interface ReceiptTemplateProps {
    invoice: any;
    organisationName?: string;
}

export const ReceiptTemplate = ({ invoice, organisationName }: ReceiptTemplateProps) => {
    const { child, centre, invoiceNumber, payments, billingPeriodStart, billingPeriodEnd, status } = invoice;
    // parent is a top-level relation on the invoice, not nested under child
    const parent = invoice.parent || (child as any)?.parent || null;
    // Parse address into lines for multi-line display
    const addressLines: string[] = buildCentreAddressLines(centre?.address);

    // Build the canonical list of all children covered by this invoice.
    // coveredChildrenJson is the source of truth (supports multiple children);
    // fall back to the single child relation or free-text childDisplayName.
    const allChildNames: string[] = getCoveredChildNames(invoice);

    // Only verified payments count towards received funds
    const verifiedPayments = (payments ?? []).filter((p: any) => p.status === 'verified');

    // Sort payments by date desc (latest first)
    const sortedPayments = [...verifiedPayments].sort((a: any, b: any) => {
        const tA = a.recordedAt ? new Date(a.recordedAt).getTime() : 0;
        const tB = b.recordedAt ? new Date(b.recordedAt).getTime() : 0;
        return tB - tA;
    });

    const totalPaid = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const invoiceAmount = Number(invoice.amount);
    const remainingBalance = Math.max(0, invoiceAmount - totalPaid);

    // Category C: stable deterministic receipt number derived from the most-recently recorded
    // verified payment UUID. Falls back to 'MANUAL' if no payment IDs are available.
    // The same payment ID always produces the same RCP — matching the email receipt.
    const latestVerifiedPayment = receiptIdentityPayment(verifiedPayments) ?? null;
    const rcpNumber = latestVerifiedPayment?.id
        ? stableReceiptNumber(latestVerifiedPayment.id)
        : 'RCP-MANUAL';

    const isChildcare = normaliseServiceType(invoice.serviceType) !== 'tuition';
    const latestPaymentDate = sortedPayments.length > 0
        ? safeFormatDate(sortedPayments[0].recordedAt, 'dd MMMM yyyy')
        : '—';

    return (
        <Document title={`Receipt-${invoiceNumber}`}>
            <Page size="A4" style={styles.page}>
                {/* Watermark */}
                <Text style={styles.watermark}>{centre?.name?.toUpperCase() || 'RECEIPT'}</Text>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.subtitle}>Payment Confirmation</Text>
                        <Text style={styles.title}>RECEIPT</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e40af', marginTop: 2 }}>
                            {centre?.name || organisationName || 'CENTRE'}
                        </Text>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>INVOICE NO:</Text>
                            <Text style={styles.infoValue}>{invoiceNumber}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>RECEIPT NO:</Text>
                            <Text style={styles.infoValue}>{rcpNumber}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>RECEIPT DATE:</Text>
                            <Text style={styles.infoValue}>{safeFormatDate(new Date(), 'dd/MM/yyyy')}</Text>
                        </View>
                    </View>
                </View>

                {/* Key details — the facts needed for childcare / tuition claims evidence */}
                <View style={styles.keyPanel}>
                    <Text style={styles.keyPanelTitle}>Key Details</Text>
                    <View style={styles.keyGrid}>
                        <View style={styles.keyCell}>
                            <Text style={styles.keyLabel}>Type of Service:</Text>
                            <Text style={styles.keyValue}>{serviceTypeLabel(invoice.serviceType)}</Text>
                        </View>
                        <View style={styles.keyCell}>
                            <Text style={styles.keyLabel}>Service Period:</Text>
                            <Text style={styles.keyValue}>
                                {billingPeriodStart && billingPeriodEnd
                                    ? `${safeFormatDate(billingPeriodStart, 'dd/MM/yyyy')} – ${safeFormatDate(billingPeriodEnd, 'dd/MM/yyyy')}`
                                    : billingPeriodStart
                                        ? `From ${safeFormatDate(billingPeriodStart, 'dd/MM/yyyy')}`
                                        : '—'}
                            </Text>
                            <Text style={styles.keyNote}>Assessment period covered by this payment</Text>
                        </View>
                        {isChildcare && (
                            <View style={styles.keyCell}>
                                <Text style={styles.keyLabel}>Ofsted Registration No:</Text>
                                <Text style={styles.keyValue}>{centre?.ofstedId || '—'}</Text>
                            </View>
                        )}
                        <View style={styles.keyCell}>
                            <Text style={styles.keyLabel}>Date of Payment:</Text>
                            <Text style={styles.keyValue}>{latestPaymentDate}</Text>
                            {sortedPayments.length > 1 && (
                                <Text style={styles.keyNote}>Latest of {sortedPayments.length} payments (all listed below)</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Addresses */}
                <View style={styles.section}>
                    <View style={styles.billedTo}>
                        <Text style={styles.sectionTitle}>Customer Details</Text>
                        {parent ? (
                            <>
                                <Text style={{ fontWeight: 'bold' }}>{parent.firstName} {parent.lastName}</Text>
                                {parent.addressLine1 && <Text>{parent.addressLine1}</Text>}
                                {parent.addressLine2 && <Text>{parent.addressLine2}</Text>}
                                {(parent.city || parent.postcode) && (
                                    <Text>{[parent.city, parent.postcode].filter(Boolean).join(', ')}</Text>
                                )}
                                {!parent.addressLine1 && (parent.email || parent.phone) && (
                                    <Text>{parent.email || parent.phone}</Text>
                                )}
                            </>
                        ) : (
                            <Text style={{ color: '#64748b' }}>Parent details not available</Text>
                        )}
                    </View>
                    <View style={styles.period}>
                        <Text style={styles.sectionTitle}>Payment Summary</Text>
                        {allChildNames.length > 0 && allChildNames.map((name: string, i: number) => (
                            <Text key={i} style={{ fontWeight: 'bold' }}>
                                {allChildNames.length > 1 ? `Child ${i + 1}: ` : 'Child: '}{name}
                            </Text>
                        ))}
                        <Text>Original Invoice: {invoiceNumber}</Text>
                        <Text>Invoice Total: £{invoiceAmount.toFixed(2)}</Text>
                        <Text>Total Paid: £{totalPaid.toFixed(2)}</Text>
                        <Text style={{ fontWeight: 'bold', color: '#0f172a' }}>Status: {totalPaid >= invoiceAmount ? 'FULLY PAID' : totalPaid > 0 ? 'PARTIALLY PAID' : (status ? status.toUpperCase() : 'UNPAID')}</Text>
                    </View>
                </View>

                {/* Payments Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.col1}>Date of Payment</Text>
                        <Text style={styles.col2}>Payment Method</Text>
                        <Text style={styles.col3}>Amount Paid</Text>
                    </View>
                    {sortedPayments.map((p: any, idx: number) => (
                        <View key={p.id || idx} style={styles.tableRow}>
                            <Text style={styles.col1}>{safeFormatDate(p.recordedAt, 'dd MMMM yyyy')}</Text>
                            <Text style={styles.col2}>{p.method?.replace(/_/g, ' ')?.toUpperCase() || 'N/A'}</Text>
                            <Text style={styles.col3}>£{Number(p.amount).toFixed(2)}</Text>
                        </View>
                    ))}
                    {sortedPayments.length === 0 && (
                        <View style={styles.tableRow}>
                            <Text style={{ flex: 1, textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>No verified payments recorded yet.</Text>
                        </View>
                    )}
                </View>

                {/* Grand Total */}
                <View style={styles.totals}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text>Total Received</Text>
                            <Text style={{ fontWeight: 'bold' }}>£{totalPaid.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.totalRow, styles.grandTotal]}>
                            <Text>Balance Remaining</Text>
                            <Text>£{remainingBalance.toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Manager / Signatory */}
                <View style={styles.managerInfo}>
                    <Text style={{ fontWeight: 'bold', color: '#334155' }}>Issued by: {centre?.managerName || 'Centre Manager'}</Text>
                    <Text style={{ marginTop: 2 }}>Role: Centre Manager</Text>
                    <Text style={{ marginTop: 1, color: '#64748b' }}>{centre?.name || organisationName || ''}</Text>
                    <Text style={{ marginTop: 4, color: '#94a3b8' }}>Thank you for your payment!</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.footerLeft}>
                        <Text style={{ fontWeight: 'bold', color: '#ffffff', fontSize: 11 }}>{centre?.name || organisationName || 'CENTRE'}</Text>
                        {addressLines.map((line: string, i: number) => (
                            <Text key={i} style={{ color: '#ffffff', fontSize: 9, marginTop: 1 }}>{line}</Text>
                        ))}
                    </View>
                    <View style={styles.footerRight}>
                        <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Tel: {centre?.billingPhone || '—'}</Text>
                        {centre?.billingEmail ? <Text style={{ color: '#ffffff', marginTop: 2 }}>{centre.billingEmail}</Text> : null}
                    </View>
                </View>
            </Page>
        </Document>
    );
};

