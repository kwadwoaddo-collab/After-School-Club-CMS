'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface DownloadButtonProps {
    orgName: string;
    centreName: string | null;
    centreAddress?: string | null;
    centrePhone?: string | null;
    centreEmail?: string | null;
    ofstedId?: string | null;
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
    registeredChildren: {
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
    const [isGenerating, setIsGenerating] = useState(false);

    const primaryParent = props.parents[0];
    const lastName = primaryParent?.lastName.toLowerCase() || 'parent';
    const firstName = primaryParent?.firstName.toLowerCase() || 'contact';
    const fileName = `registration-${lastName}-${firstName}.pdf`.replace(/\s+/g, '-');

    const handleDownload = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        try {
            const [{ pdf }, { RegistrationTemplate }] = await Promise.all([
                import('@react-pdf/renderer'),
                import('@/features/registration/components/RegistrationTemplate'),
            ]);
            const blob = await pdf(
                <RegistrationTemplate
                    orgName={props.centreName || props.orgName}
                    centreName={props.centreName}
                    centreAddress={props.centreAddress}
                    centrePhone={props.centrePhone}
                    centreEmail={props.centreEmail}
                    ofstedId={props.ofstedId}
                    startDate={props.startDate}
                    submittedAt={props.submittedAt}
                    parents={props.parents}
                    registeredChildren={props.registeredChildren}
                    emergencyContact={props.emergencyContact}
                    funding={props.funding}
                    specialNeeds={props.specialNeeds}
                    parentSignature={props.parentSignature}
                />
            ).toBlob();

            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            logger.error('Failed to generate registration PDF:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:opacity-90 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-primary/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
            {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Download className="w-4 h-4" />
            )}
            {isGenerating ? 'Preparing...' : 'Download PDF'}
        </button>
    );
}
