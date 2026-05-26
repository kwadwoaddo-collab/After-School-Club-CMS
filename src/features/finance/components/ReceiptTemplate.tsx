import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        color: '#334155',
        fontFamily: 'Helvetica',
        position: 'relative',
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
    col1: { flex: 2 },
    col2: { flex: 1 },
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
    managerInfo: {
        marginTop: 40,
        fontSize: 8,
        color: '#64748b',
    }
});

interface ReceiptTemplateProps {
    invoice: any;
    organisationName?: string;
}

export const ReceiptTemplate = ({ invoice, organisationName }: ReceiptTemplateProps) => {
    const { child, centre, invoiceNumber, payments } = invoice;
    // parent is a top-level relation on the invoice, not nested under child
    const parent = invoice.parent || (child as any)?.parent || null;
    // Parse address into lines for multi-line display
    const addressLines: string[] = centre?.address ? centre.address.split('\n').map((l: string) => l.trim()).filter(Boolean) : [];
    
    // Sort payments by date desc (latest first)
    const sortedPayments = [...(payments ?? [])].sort((a: any, b: any) => 
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );

    const totalPaid = (payments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const invoiceAmount = Number(invoice.amount);
    const remainingBalance = Math.max(0, invoiceAmount - totalPaid);

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
                            <Text style={styles.infoLabel}>RECEIPT DATE:</Text>
                            <Text style={styles.infoValue}>{format(new Date(), 'dd/MM/yyyy')}</Text>
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
                        {child && (
                            <Text style={{ fontWeight: 'bold' }}>Child: {child.firstName} {child.lastName}</Text>
                        )}
                        <Text>Original Invoice: £{invoiceAmount.toFixed(2)}</Text>
                        <Text>Total Paid: £{totalPaid.toFixed(2)}</Text>
                        <Text>Status: {totalPaid >= invoiceAmount ? 'FULLY PAID' : totalPaid > 0 ? 'PARTIALLY PAID' : 'UNPAID'}</Text>
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
                            <Text style={styles.col1}>{format(new Date(p.recordedAt), 'dd MMMM yyyy')}</Text>
                            <Text style={styles.col2}>{p.method?.replace(/_/g, ' ')?.toUpperCase() || 'N/A'}</Text>
                            <Text style={styles.col3}>£{Number(p.amount).toFixed(2)}</Text>
                        </View>
                    ))}
                    {sortedPayments.length === 0 && (
                        <View style={styles.tableRow}>
                            <Text style={{ flex: 1, textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>No payments recorded yet.</Text>
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

                {/* Manager Name */}
                <View style={styles.managerInfo}>
                    <Text>Manager: {centre?.managerName || '—'}</Text>
                    <Text style={{ marginTop: 2, color: '#94a3b8' }}>Thank you for your payment!</Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.footerLeft}>
                        <Text style={{ fontWeight: 'bold', color: '#ffffff', fontSize: 9 }}>{organisationName || centre?.name || 'CENTRE'}</Text>
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

