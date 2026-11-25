import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { CONTRACT_TITLE, contractSections, formatPounds, joinChildNames, type ContractValues } from './template';

const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111827', lineHeight: 1.4 },
    provider: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
    title: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginTop: 2, marginBottom: 6 },
    center: { textAlign: 'center', fontSize: 9, color: '#374151' },
    fields: { marginTop: 10, marginBottom: 4, padding: 8, borderWidth: 1, borderColor: '#d1d5db' },
    fieldRow: { flexDirection: 'row', marginBottom: 2 },
    fieldLabel: { width: 120, fontFamily: 'Helvetica-Bold' },
    fieldValue: { flex: 1 },
    heading: { marginTop: 8, fontSize: 11, fontFamily: 'Helvetica-Bold' },
    bullet: { flexDirection: 'row', marginTop: 1 },
    dot: { width: 10 },
    sig: { marginTop: 14, borderTopWidth: 1, borderColor: '#9ca3af', paddingTop: 8 },
    sigRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, minHeight: 36 },
    sigLabel: { width: 130, fontFamily: 'Helvetica-Bold' },
    sigValue: { flex: 1, fontFamily: 'Times-Italic', fontSize: 14 },
    sigImage: { height: 36, objectFit: 'contain', objectPosition: 'left' },
    sigDate: { width: 110, textAlign: 'right' },
    audit: { marginTop: 8, fontSize: 7, color: '#6b7280' },
});

export interface SignatureBlock {
    signerName: string;
    kind: 'drawn' | 'typed';
    /** PNG data URL when drawn; the typed name when typed */
    data: string;
    signedDate: string;
    signedAtIso: string;
}

export function ContractPdf({ values, templateVersion, signature, contractId }: { values: ContractValues; templateVersion: string; signature?: SignatureBlock; contractId?: string }) {
    const { provider } = values;
    return (
        <Document title={`${CONTRACT_TITLE} — ${values.parentName}`} author={provider.providerName}>
            <Page size="A4" style={styles.page} wrap>
                <Text style={styles.provider}>{provider.providerName}</Text>
                <Text style={styles.title}>{CONTRACT_TITLE}</Text>
                <Text style={styles.center}>Provider: {provider.providerName}</Text>
                <Text style={styles.center}>{provider.address}</Text>
                <Text style={styles.center}>Tel: {provider.phone}{provider.website ? ` | Web: ${provider.website}` : ''}</Text>
                <Text style={styles.center}>Ofsted Registration No: {provider.ofstedRegNo} | Approved Body: Ofsted</Text>
                <View style={styles.fields}>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Parent/Guardian Name:</Text><Text style={styles.fieldValue}>{values.parentName}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Child(ren):</Text><Text style={styles.fieldValue}>{joinChildNames(values.childNames)}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Start Date:</Text><Text style={styles.fieldValue}>{values.startDate}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Monthly Cost:</Text><Text style={styles.fieldValue}>{formatPounds(values.amountPence)}</Text></View>
                    <View style={styles.fieldRow}><Text style={styles.fieldLabel}>Payment Frequency:</Text><Text style={styles.fieldValue}>Monthly</Text></View>
                </View>
                {contractSections(provider.providerName).map(section => (
                    <View key={section.heading} wrap={false}>
                        <Text style={styles.heading}>{section.heading}</Text>
                        {section.intro ? <Text>{section.intro}</Text> : null}
                        {section.items.map(item => (
                            <View key={item} style={styles.bullet}><Text style={styles.dot}>•</Text><Text style={{ flex: 1 }}>{item}</Text></View>
                        ))}
                        {section.note ? <Text style={{ marginTop: 2 }}>{section.note}</Text> : null}
                    </View>
                ))}
                <View style={styles.sig} wrap={false}>
                    <Text style={styles.heading}>Agreement</Text>
                    <View style={styles.sigRow}>
                        <Text style={styles.sigLabel}>Provider Signature:</Text>
                        {values.signatureImage
                            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                            ? <Image src={values.signatureImage} style={[styles.sigImage, { flex: 1 }]} />
                            : <Text style={styles.sigValue}>{provider.signatoryName}</Text>}
                        <Text style={styles.sigDate}>Date: {values.providerSignedDate}</Text>
                    </View>
                    <Text style={{ marginBottom: 8 }}>{provider.signatoryName}{provider.signatoryRole ? `, ${provider.signatoryRole}` : ''} for {provider.providerName}</Text>
                    <View style={styles.sigRow}>
                        <Text style={styles.sigLabel}>Parent/Guardian Signature:</Text>
                        {signature ? (signature.kind === 'drawn'
                            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
                            ? <Image src={signature.data} style={[styles.sigImage, { flex: 1 }]} />
                            : <Text style={styles.sigValue}>{signature.data}</Text>) : <Text style={styles.sigValue}> </Text>}
                        <Text style={styles.sigDate}>Date: {signature ? signature.signedDate : ''}</Text>
                    </View>
                    {signature ? <Text>Signed by {signature.signerName}</Text> : null}
                    {signature ? <Text style={styles.audit}>Electronically signed {signature.signedAtIso} · template {templateVersion}{contractId ? ` · ref ${contractId}` : ''}</Text> : null}
                </View>
            </Page>
        </Document>
    );
}
