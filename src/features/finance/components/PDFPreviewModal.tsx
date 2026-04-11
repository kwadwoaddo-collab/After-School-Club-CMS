import ReactDom from 'react-dom';
import { X, Eye, Download } from 'lucide-react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { useEffect, useState } from 'react';

interface PDFPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfContent: React.ReactElement;
    title: string;
    fileName: string;
}

export default function PDFPreviewModal({ isOpen, onClose, pdfContent, title, fileName }: PDFPreviewModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== 'undefined' && window.document.body) {
            if (isOpen) {
                window.document.body.style.overflow = 'hidden';
            } else {
                window.document.body.style.overflow = 'unset';
            }
        }
        return () => { 
            if (typeof window !== 'undefined' && window.document.body) {
                window.document.body.style.overflow = 'unset'; 
            }
        };
    }, [isOpen]);

    if (!isOpen || !mounted || typeof window === 'undefined' || !window.document.body) return null;

    return ReactDom.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-5xl h-[90vh] bg-surface-container rounded-2xl border border-outline-variant/20 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-bottom border-outline-variant/10 bg-surface">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Eye className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-on-surface">{title}</h3>
                            <p className="text-xs text-on-surface-variant font-mono">{fileName}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <PDFDownloadLink
                            document={pdfContent}
                            fileName={fileName}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary rounded-lg text-xs font-bold text-on-primary hover:bg-primary/90 transition-all"
                        >
                            {({ loading }) => (
                                <>
                                    <Download className="w-3 h-3" />
                                    {loading ? 'Preparing...' : 'Download'}
                                </>
                            )}
                        </PDFDownloadLink>
                        
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-surface-container-highest rounded-lg transition-colors text-on-surface-variant"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* PDF Content */}
                <div className="flex-1 bg-slate-800 p-2 sm:p-4">
                    <PDFViewer width="100%" height="100%" showToolbar={false} style={{ borderRadius: '8px', border: 'none' }}>
                        {pdfContent}
                    </PDFViewer>
                </div>
            </div>
        </div>,
        window.document.body
    );
}
