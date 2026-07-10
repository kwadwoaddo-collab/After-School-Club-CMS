import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { billingStylesBase } from './billingPdfStyles';

const styles = StyleSheet.create({
    ...billingStylesBase,
    col1: { flex: 2 },
    col2: { flex: 1 },
    col3: { flex: 1, textAlign: 'right' },
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

