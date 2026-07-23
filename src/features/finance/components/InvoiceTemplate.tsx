/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { billingStylesBase } from './billingPdfStyles';

const styles = StyleSheet.create({
    ...billingStylesBase,
    col1: { flex: 4 },
    col3: { flex: 1, textAlign: 'right' },
    bankDetails: {
        marginTop: 40,
        padding: 15,
        backgroundColor: '#f8fafc',
        borderRadius: 4,
        borderLeft: 3,
        borderLeftColor: '#1e40af', // HASC Blue
    },
});

interface InvoiceTemplateProps {
    invoice: any;
    organisationName?: string;
}

export const InvoiceTemplate = ({ invoice, organisationName }: InvoiceTemplateProps) => {
    const { parent, child, centre, amount, invoiceNumber, invoiceDate, dueDate, billingPeriodStart, billingPeriodEnd, notes, childDisplayName, status, payments } = invoice;
    const safeFormatDate = (date: any, formatStr: string) => {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return format(d, formatStr);
    };

    // Parse address into lines for multi-line display
    const addressLines: string[] = centre?.address ? centre.address.split('\n').map((l: string) => l.trim()).filter(Boolean) : [];
    // Fallback to child.parent if parent relation is missing (legacy support)
    const activeParent = parent || (child && (child as any).parent);
    // Show child name from record or from the ad-hoc free-text field
    const displayChildName = child
        ? `${child.firstName} ${child.lastName}`
        : (childDisplayName || null);

    const displayNotes = notes && 
        !notes.trim().startsWith('Monthly tuition') && 
        !notes.trim().startsWith('After School Club Childcare Services')
        ? notes.trim()
        : '';

    const verifiedPayments = (payments ?? []).filter((p: any) => p.status === 'verified');
    const totalPaid = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const balanceRemaining = Math.max(0, Number(amount) - totalPaid);

    return (
        <Document title={`Invoice-${invoiceNumber}`}>
            <Page size="A4" style={styles.page}>
                {/* Watermark */}
                <Text style={styles.watermark}>
                    {status === 'paid' ? 'PAID' : (centre?.name?.toUpperCase() || 'HEATHWAY')}
                </Text>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.subtitle}>Child care services</Text>
                        <Text style={styles.title}>INVOICE</Text>
                        <Text style={{ fontSize: 8, color: '#64748b', marginTop: 4 }}>
                            Ofsted / Ref No: {centre?.ofstedId || 'N/A'}
                        </Text>
                    </View>
                    <View style={styles.invoiceInfo}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>INVOICE NO:</Text>
                            <Text style={styles.infoValue}>{invoiceNumber}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>DATE:</Text>
                            <Text style={styles.infoValue}>{safeFormatDate(invoiceDate, 'dd/MM/yyyy')}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>DUE DATE:</Text>
                            <Text style={styles.infoValue}>{safeFormatDate(dueDate, 'dd/MM/yyyy')}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>STATUS:</Text>
                            <Text style={[
                                styles.infoValue,
                                {
                                    color: status === 'paid' ? '#10b981' : 
                                           status === 'partially_paid' ? '#d97706' : 
                                           status === 'void' ? '#dc2626' : '#2563eb',
                                    fontWeight: 'bold'
                                }
                            ]}>{(status || 'draft').toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Addresses */}
                <View style={styles.section}>
                    <View style={styles.billedTo}>
                        <Text style={styles.sectionTitle}>Billed To</Text>
                        <Text style={{ fontWeight: 'bold' }}>{activeParent?.firstName} {activeParent?.lastName}</Text>
                        {activeParent?.addressLine1 && <Text>{activeParent?.addressLine1}</Text>}
                        {activeParent?.addressLine2 && <Text>{activeParent?.addressLine2}</Text>}
                        {activeParent?.city && <Text>{activeParent?.city}, {activeParent?.postcode}</Text>}
                        {!activeParent?.addressLine1 && <Text>Contact: {activeParent?.email || activeParent?.phone || 'N/A'}</Text>}
                    </View>
                    <View style={styles.period}>
                        <Text style={styles.sectionTitle}>Period Description</Text>
                        <Text style={{ fontWeight: 'bold' }}>Reference: {invoiceNumber}</Text>
                        {displayChildName && <Text>Child: {displayChildName}</Text>}
                        <Text>Period: {safeFormatDate(billingPeriodStart, 'dd/MM/yyyy')} – {safeFormatDate(billingPeriodEnd, 'dd/MM/yyyy')}</Text>
                        <Text>Centre: {centre?.name || 'HASC Centre'}</Text>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.col1}>Description</Text>
                        <Text style={styles.col3}>Total</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.col1}>Childcare services</Text>
                        <Text style={styles.col3}>£{Number(amount).toFixed(2)}</Text>
                    </View>
                    {displayNotes ? (
                        <View style={styles.tableRow}>
                            <Text style={[styles.col1, { color: '#64748b', fontSize: 8 }]}>Note: {displayNotes}</Text>
                            <Text style={styles.col3}></Text>
                        </View>
                    ) : null}
                </View>


                {/* Grand Total */}
                <View style={styles.totals}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text>Subtotal</Text>
                            <Text>£{Number(amount).toFixed(2)}</Text>
                        </View>
                        {totalPaid > 0 && (
                            <View style={styles.totalRow}>
                                <Text>Payments Received</Text>
                                <Text style={{ color: '#10b981' }}>-£{Number(totalPaid).toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={[styles.totalRow, styles.grandTotal]}>
                            <Text>Balance Outstanding</Text>
                            <Text>£{Number(balanceRemaining).toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Payments Table / Box */}
                {verifiedPayments.length > 0 && (
                    <View style={{ marginTop: 15, padding: 12, backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: '#10b981', borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0f766e', marginBottom: 5 }}>PAYMENTS RECEIVED</Text>
                        {verifiedPayments.map((p: any, idx: number) => (
                            <View key={p.id || idx} style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, color: '#475569', marginTop: 3 }}>
                                <Text>Payment recorded on {safeFormatDate(p.recordedAt, 'dd/MM/yyyy')} via {p.method?.replace(/_/g, ' ')?.toUpperCase()}</Text>
                                <Text style={{ fontWeight: 'bold', color: '#10b981' }}>£{Number(p.amount).toFixed(2)}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Bank Details */}
                <View style={styles.bankDetails}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 5 }}>PAYMENT INFORMATION</Text>
                    <Text style={{ fontSize: 8, color: '#64748b' }}>Please pay via bank transfer using the invoice number or child's name as payment reference:</Text>
                    <View style={{ marginTop: 5, marginBottom: 5 }}>
                        <Text>Account Name: {centre?.bankName || 'N/A'}</Text>
                        <Text>Sort Code: {centre?.sortCode || 'N/A'}</Text>
                        <Text>Account No: {centre?.accountNo || 'N/A'}</Text>
                        <Text>Reference: {invoiceNumber} or child's name</Text>
                    </View>
                    <Text style={{ fontSize: 8, color: '#64748b', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 5, marginTop: 5 }}>
                        Cash payments can also be made directly at the centre.
                    </Text>
                    <Text style={{ fontSize: 8, color: '#64748b', paddingTop: 3 }}>
                        Registered by Ofsted · Registration Number: {centre?.ofstedId || '—'}
                    </Text>
                </View>

                {/* Manager Name */}
                <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 8, color: '#64748b' }}>Manager: {centre?.managerName || '—'}</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.footerLeft}>
                        <Text style={{ fontWeight: 'bold', color: '#ffffff', fontSize: 9 }}>{organisationName || centre?.name || 'HASC CENTRE'}</Text>
                        {addressLines.map((line: string, i: number) => (
                            <Text key={i} style={{ color: '#ffffff', fontSize: 7, marginTop: 1 }}>{line}</Text>
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
