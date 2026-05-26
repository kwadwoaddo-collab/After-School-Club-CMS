import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

// Register fonts if needed - placeholder for custom branding
// Font.register({ family: 'Inter', src: '...' });

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        color: '#334155',
        fontFamily: 'Helvetica',
        position: 'relative',
        backgroundColor: '#ffffff',
    },
    watermark: {
        position: 'absolute',
        top: 300,
        left: 50,
        fontSize: 80,
        color: '#e2e8f0',
        transform: 'rotate(-45deg)',
        opacity: 0.3,
        zIndex: -1,
        width: 600,
        textAlign: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 40,
        borderBottom: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'extrabold',
        color: '#1e293b',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 10,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    invoiceInfo: {
        textAlign: 'right',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 3,
    },
    infoLabel: {
        color: '#64748b',
        width: 80,
    },
    infoValue: {
        fontWeight: 'bold',
        width: 100,
    },
    section: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 10,
        borderBottom: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 4,
    },
    billedTo: {
        width: '45%',
    },
    period: {
        width: '45%',
    },
    table: {
        marginTop: 20,
        marginBottom: 40,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f8fafc',
        borderBottom: 1,
        borderBottomColor: '#e2e8f0',
        padding: 8,
        fontWeight: 'bold',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: 1,
        borderBottomColor: '#f1f5f9',
        padding: 8,
    },
    col1: { flex: 3 },
    col2: { flex: 1, textAlign: 'right' },
    col3: { flex: 1, textAlign: 'right' },
    totals: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
    },
    totalsBox: {
        width: 200,
        borderTop: 2,
        borderTopColor: '#1e293b',
        paddingTop: 10,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    grandTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
        marginTop: 5,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: 75,
        backgroundColor: '#1e40af', // HASC Blue
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 12,
        color: 'white',
        fontSize: 8,
    },
    footerLeft: {
        flexDirection: 'column',
    },
    footerRight: {
        textAlign: 'right',
    },
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
    const { parent, child, centre, amount, invoiceNumber, invoiceDate, dueDate, billingPeriodStart, billingPeriodEnd, notes, childDisplayName } = invoice;
    // Parse address into lines for multi-line display
    const addressLines: string[] = centre?.address ? centre.address.split('\n').map((l: string) => l.trim()).filter(Boolean) : [];
    // Fallback to child.parent if parent relation is missing (legacy support)
    const activeParent = parent || (child && (child as any).parent);
    // Show child name from record or from the ad-hoc free-text field
    const displayChildName = child
        ? `${child.firstName} ${child.lastName}`
        : (childDisplayName || null);

    return (
        <Document title={`Invoice-${invoiceNumber}`}>
            <Page size="A4" style={styles.page}>
                {/* Watermark */}
                <Text style={styles.watermark}>{centre?.name?.toUpperCase() || 'HEATHWAY'}</Text>

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
                            <Text style={styles.infoValue}>{format(new Date(invoiceDate), 'dd/MM/yyyy')}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>DUE DATE:</Text>
                            <Text style={styles.infoValue}>{format(new Date(dueDate), 'dd/MM/yyyy')}</Text>
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
                        <Text>Period: {billingPeriodStart ? format(new Date(billingPeriodStart), 'MMM d') : '-'} to {billingPeriodEnd ? format(new Date(billingPeriodEnd), 'MMM d, yyyy') : '-'}</Text>
                        <Text>Centre: {centre?.name || 'HASC Centre'}</Text>
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={styles.col1}>Description</Text>
                        <Text style={styles.col2}>Rate</Text>
                        <Text style={styles.col3}>Total</Text>
                    </View>
                    <View style={styles.tableRow}>
                        <Text style={styles.col1}>After School Club Childcare Services</Text>
                        <Text style={styles.col2}>£{Number(amount).toFixed(2)}</Text>
                        <Text style={styles.col3}>£{Number(amount).toFixed(2)}</Text>
                    </View>
                    {notes && (
                        <View style={styles.tableRow}>
                            <Text style={[styles.col1, { color: '#64748b', fontSize: 8 }]}>Note: {notes}</Text>
                            <Text style={styles.col2}></Text>
                            <Text style={styles.col3}></Text>
                        </View>
                    )}
                </View>


                {/* Grand Total */}
                <View style={styles.totals}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text>Subtotal</Text>
                            <Text>£{Number(amount).toFixed(2)}</Text>
                        </View>
                        <View style={styles.totalRow}>
                            <Text>Tax (0%)</Text>
                            <Text>£0.00</Text>
                        </View>
                        <View style={[styles.totalRow, styles.grandTotal]}>
                            <Text>Total Amount Due</Text>
                            <Text>£{Number(amount).toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Bank Details */}
                <View style={styles.bankDetails}>
                    <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 5 }}>PAYMENT INFORMATION</Text>
                    <Text style={{ fontSize: 8, color: '#64748b' }}>Please pay via bank transfer to the following account:</Text>
                    <View style={{ marginTop: 5 }}>
                        <Text>Account Name: {centre?.bankName || 'N/A'}</Text>
                        <Text>Sort Code: {centre?.sortCode || 'N/A'}</Text>
                        <Text>Account No: {centre?.accountNo || 'N/A'}</Text>
                        <Text>Reference: {invoiceNumber}</Text>
                    </View>
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
