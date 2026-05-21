import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 9,
        color: '#334155',
        fontFamily: 'Helvetica',
        position: 'relative',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        borderBottom: 1,
        borderBottomColor: '#cbd5e1',
        paddingBottom: 15,
    },
    orgTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 4,
    },
    docSubtitle: {
        fontSize: 9,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerRight: {
        textAlign: 'right',
    },
    headerInfoRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 2,
    },
    headerInfoLabel: {
        color: '#64748b',
        width: 80,
    },
    headerInfoValue: {
        fontWeight: 'bold',
        color: '#1e293b',
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1e3a8a', // Dark blue branding
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        borderBottom: 1,
        borderBottomColor: '#cbd5e1',
        paddingBottom: 3,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    col: {
        flexDirection: 'column',
        marginBottom: 8,
    },
    col12: { width: '100%' },
    col6: { width: '50%' },
    col4: { width: '33.3%' },
    label: {
        fontSize: 8,
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 2,
        fontWeight: 'bold',
    },
    value: {
        fontSize: 9,
        color: '#1e293b',
        lineHeight: 1.2,
    },
    parentCard: {
        border: 1,
        borderColor: '#e2e8f0',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#f8fafc',
    },
    childCard: {
        border: 1,
        borderColor: '#e2e8f0',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#f8fafc',
    },
    sessionTagList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
    },
    sessionTag: {
        backgroundColor: '#e0f2fe',
        color: '#0369a1',
        fontSize: 7.5,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginRight: 4,
        marginBottom: 4,
        border: 1,
        borderColor: '#bae6fd',
    },
    noSessionsText: {
        fontSize: 8.5,
        color: '#64748b',
        fontStyle: 'italic',
        marginTop: 4,
    },
    notesBox: {
        backgroundColor: '#fffbeb',
        borderLeft: 3,
        borderLeftColor: '#f59e0b',
        padding: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    notesText: {
        fontSize: 8.5,
        color: '#92400e',
        lineHeight: 1.3,
    },
    footer: {
        position: 'absolute',
        bottom: 25,
        left: 40,
        right: 40,
        borderTop: 1,
        borderTopColor: '#e2e8f0',
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#94a3b8',
        fontSize: 7.5,
    },
});

interface ChildData {
    firstName: string;
    lastName: string;
    dateOfBirth: string | Date;
    schoolYear: string;
    sessions: string[];
}

interface ParentData {
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string;
    email?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postcode?: string;
}

interface EmergencyContactData {
    name: string;
    relationship: string;
    phone: string;
}

interface FundingData {
    type: string;
    other?: string;
}

interface SpecialNeedsData {
    has: boolean;
    details?: string;
}

export interface RegistrationTemplateProps {
    orgName: string;
    centreName?: string | null;
    startDate?: string | Date | null;
    children: ChildData[];
    parents: ParentData[];
    emergencyContact: EmergencyContactData;
    funding: FundingData;
    specialNeeds: SpecialNeedsData;
    submittedAt?: Date | string;
}

const fundingLabelMap: Record<string, string> = {
    tax_free_childcare: 'Tax-Free Childcare',
    childcare_vouchers: 'Childcare Vouchers',
    universal_credit: 'Universal Credit',
    student_finance: 'Student Finance (CCG)',
    self_funded: 'Self-Funded',
    other: 'Other',
};

export const RegistrationTemplate = ({
    orgName,
    centreName,
    startDate,
    children,
    parents,
    emergencyContact,
    funding,
    specialNeeds,
    submittedAt = new Date(),
}: RegistrationTemplateProps) => {
    const formattedStartDate = startDate
        ? format(new Date(startDate), 'dd MMMM yyyy')
        : 'To be confirmed';

    const formattedSubmittedDate = format(new Date(submittedAt), 'dd/MM/yyyy HH:mm');

    const getFundingLabel = (type: string, other?: string) => {
        if (type === 'other') {
            return `Other (${other || 'Not specified'})`;
        }
        return fundingLabelMap[type] || type || 'Not specified';
    };

    return (
        <Document title={`Registration-${orgName.replace(/\s+/g, '-')}`}>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.orgTitle}>{orgName}</Text>
                        <Text style={styles.docSubtitle}>Student Registration Details</Text>
                    </View>
                    <View style={styles.headerRight}>
                        {centreName && (
                            <View style={styles.headerInfoRow}>
                                <Text style={styles.headerInfoLabel}>Centre:</Text>
                                <Text style={styles.headerInfoValue}>{centreName}</Text>
                            </View>
                        )}
                        <View style={styles.headerInfoRow}>
                            <Text style={styles.headerInfoLabel}>Submitted At:</Text>
                            <Text style={styles.headerInfoValue}>{formattedSubmittedDate}</Text>
                        </View>
                    </View>
                </View>

                {/* Requested Start Date */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Requested Start Date</Text>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e293b' }}>
                        {formattedStartDate}
                    </Text>
                </View>

                {/* Parent / Carer Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Parent / Carer Details</Text>
                    {parents.map((p, idx) => (
                        <View key={idx} style={styles.parentCard}>
                            <Text style={{ fontWeight: 'bold', color: '#1e3a8a', marginBottom: 6 }}>
                                Parent/Carer {idx + 1} {idx === 0 ? '(Primary Contact)' : ''}
                            </Text>
                            <View style={styles.grid}>
                                <View style={[styles.col, styles.col4]}>
                                    <Text style={styles.label}>Name</Text>
                                    <Text style={styles.value}>{p.firstName} {p.lastName}</Text>
                                </View>
                                <View style={[styles.col, styles.col4]}>
                                    <Text style={styles.label}>Relationship</Text>
                                    <Text style={styles.value}>{p.relationship}</Text>
                                </View>
                                <View style={[styles.col, styles.col4]}>
                                    <Text style={styles.label}>Phone</Text>
                                    <Text style={styles.value}>{p.phone}</Text>
                                </View>
                            </View>
                            {p.email && (
                                <View style={[styles.grid, { marginBottom: 6 }]}>
                                    <View style={[styles.col, styles.col12]}>
                                        <Text style={styles.label}>Email Address</Text>
                                        <Text style={styles.value}>{p.email}</Text>
                                    </View>
                                </View>
                            )}
                            {p.addressLine1 && (
                                <View style={styles.grid}>
                                    <View style={[styles.col, styles.col12]}>
                                        <Text style={styles.label}>Address</Text>
                                        <Text style={styles.value}>
                                            {p.addressLine1}
                                            {p.addressLine2 ? `, ${p.addressLine2}` : ''}
                                            {p.city ? `, ${p.city}` : ''}
                                            {p.postcode ? `, ${p.postcode}` : ''}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {/* Emergency Contact */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Emergency Contact (Alternative)</Text>
                    <View style={styles.grid}>
                        <View style={[styles.col, styles.col4]}>
                            <Text style={styles.label}>Contact Name</Text>
                            <Text style={styles.value}>{emergencyContact.name || 'Not specified'}</Text>
                        </View>
                        <View style={[styles.col, styles.col4]}>
                            <Text style={styles.label}>Relationship</Text>
                            <Text style={styles.value}>{emergencyContact.relationship || 'Not specified'}</Text>
                        </View>
                        <View style={[styles.col, styles.col4]}>
                            <Text style={styles.label}>Phone Number</Text>
                            <Text style={styles.value}>{emergencyContact.phone || 'Not specified'}</Text>
                        </View>
                    </View>
                </View>

                {/* Children Details */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Registered Children</Text>
                    {children.map((c, idx) => (
                        <View key={idx} style={styles.childCard}>
                            <View style={styles.grid}>
                                <View style={[styles.col, styles.col4]}>
                                    <Text style={styles.label}>Child Name</Text>
                                    <Text style={styles.value}>{c.firstName} {c.lastName}</Text>
                                </View>
                                <View style={[styles.col, styles.col4]}>
                                    <Text style={styles.label}>Date of Birth</Text>
                                    <Text style={styles.value}>
                                        {c.dateOfBirth ? format(new Date(c.dateOfBirth), 'dd/MM/yyyy') : 'Not specified'}
                                    </Text>
                                </View>
                                <View style={[styles.col, styles.col4]}>
                                    <Text style={styles.label}>Year Group</Text>
                                    <Text style={styles.value}>{c.schoolYear}</Text>
                                </View>
                            </View>

                            <View style={{ marginTop: 4 }}>
                                <Text style={styles.label}>Preferred Sessions</Text>
                                {c.sessions && c.sessions.length > 0 ? (
                                    <View style={styles.sessionTagList}>
                                        {c.sessions.map((session, sIdx) => (
                                            <Text key={sIdx} style={styles.sessionTag}>
                                                {session}
                                            </Text>
                                        ))}
                                    </View>
                                ) : (
                                    <Text style={styles.noSessionsText}>No preferred sessions selected</Text>
                                )}
                            </View>
                        </View>
                    ))}
                </View>

                {/* Funding & Special Needs */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Funding &amp; Additional Information</Text>
                    <View style={styles.grid}>
                        <View style={[styles.col, styles.col12, { marginBottom: 10 }]}>
                            <Text style={styles.label}>Funding Method</Text>
                            <Text style={styles.value}>{getFundingLabel(funding.type, funding.other)}</Text>
                        </View>
                    </View>
                    <View style={styles.grid}>
                        <View style={[styles.col, styles.col12]}>
                            <Text style={styles.label}>Special Educational Needs / Medical Info</Text>
                            {specialNeeds.has && specialNeeds.details ? (
                                <View style={styles.notesBox}>
                                    <Text style={styles.notesText}>{specialNeeds.details}</Text>
                                </View>
                            ) : (
                                <Text style={styles.value}>No special needs or medical requirements specified.</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>{orgName} Student Registration Form</Text>
                    <Text>Powered by SprintScale &middot; support@sprintscaleit.co.uk</Text>
                </View>
            </Page>
        </Document>
    );
};
