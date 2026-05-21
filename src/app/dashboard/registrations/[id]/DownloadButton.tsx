'use client';

import { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { RegistrationTemplate } from '@/features/registration/components/RegistrationTemplate';
import { Download, Loader2 } from 'lucide-react';

interface DownloadButtonProps {
    orgName: string;
    centreName: string | null;
    startDate: string | Date | null;
    submittedAt: string | Date;
    parents: {
        firstName: string;
        lastName: string;
        relationship: string;
        phone: string;
        email?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        postcode?: string;
    }[];
    children: {
        firstName: string;
        lastName: string;
        dateOfBirth: string | Date;
        schoolYear: string;
        sessions: string[];
    }[];
    emergencyContact: {
        name: string;
        relationship: string;
        phone: string;
    };
    funding: {
        type: string;
        other?: string;
    };
    specialNeeds: {
        has: boolean;
        details?: string;
    };
    parentSignature?: string | null;
}

export default function DownloadButton(props: DownloadButtonProps) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return (
            <button
                disabled
                className="flex items-center gap-2 px-4 py-2.5 bg-white/5 text-white/50 border border-white/10 rounded-xl text-sm font-semibold cursor-not-allowed"
            >
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading PDF...
            </button>
        );
    }

    const primaryParent = props.parents[0];
    const lastName = primaryParent?.lastName.toLowerCase() || 'parent';
    const firstName = primaryParent?.firstName.toLowerCase() || 'contact';
    const fileName = `registration-${lastName}-${firstName}.pdf`.replace(/\s+/g, '-');

    return (
        <PDFDownloadLink
            document={
                <RegistrationTemplate
                    orgName={props.orgName}
                    centreName={props.centreName}
                    startDate={props.startDate}
                    submittedAt={props.submittedAt}
                    parents={props.parents}
                    children={props.children}
                    emergencyContact={props.emergencyContact}
                    funding={props.funding}
                    specialNeeds={props.specialNeeds}
                    parentSignature={props.parentSignature}
                />
            }
            fileName={fileName}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:opacity-90 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-primary/20 cursor-pointer"
        >
            {({ loading }) => (
                <>
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Download className="w-4 h-4" />
                    )}
                    {loading ? 'Preparing...' : 'Download PDF'}
                </>
            )}
        </PDFDownloadLink>
    );
}
