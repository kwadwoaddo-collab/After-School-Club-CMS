'use client';

import { useState, useEffect, useTransition } from 'react';
import { CreditCard, ArrowLeft, Download, Send, Clock, CheckCircle2, AlertCircle, Trash2, Ban, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import RecordPaymentModal from './RecordPaymentModal';
import PaymentHistoryList from './PaymentHistoryList';
import { useRouter } from 'next/navigation';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { InvoiceTemplate } from './InvoiceTemplate';
import { ReceiptTemplate } from './ReceiptTemplate';
import PDFPreviewModal from './PDFPreviewModal';
import ConfirmActionModal from './ConfirmActionModal';
import { deleteInvoice, voidInvoice } from '../actions';

interface InvoiceDetailsClientProps {
    invoice: any;
    organisationName: string;
}

export default function InvoiceDetailsClient({ invoice, organisationName }: InvoiceDetailsClientProps) {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [previewType, setPreviewType] = useState<'invoice' | 'receipt' | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'delete' | 'void' | null>(null);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    useEffect(() => {
        setIsClient(true);
    }, []);

    const hasPayments = invoice.payments?.length > 0;

    const totalPaid = invoice.payments.reduce((sum: number, p: any) => p.status === 'verified' ? sum + Number(p.amount) : sum, 0);
    const remainingBalance = Number(invoice.amount) - totalPaid;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-xs font-bold ring-1 ring-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> PAID</span>;
            case 'partially_paid':
                return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-xs font-bold ring-1 ring-amber-500/20"><Clock className="w-3.5 h-3.5" /> PARTIALLY PAID</span>;
            case 'sent':
                return <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-bold ring-1 ring-blue-500/20"><Send className="w-3.5 h-3.5" /> SENT</span>;
            case 'void':
                return <span className="flex items-center gap-1.5 px-3 py-1 bg-neutral-500/10 text-neutral-400 rounded-full text-xs font-bold ring-1 ring-neutral-500/20 line-through"><Ban className="w-3.5 h-3.5" /> VOID</span>;
            default:
                return <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-500/10 text-muted-foreground rounded-full text-xs font-bold ring-1 ring-slate-500/20"><AlertCircle className="w-3.5 h-3.5" /> {status.toUpperCase()}</span>;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Navigation & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <Link 
                    href="/dashboard/finance"
                    className="flex items-center gap-2 text-foreground-variant hover:text-foreground transition-colors font-bold group"
                >
                    <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    Back to Ledger
                </Link>
                <div className="flex items-center gap-3">
                    {isClient ? (
                        <div className="flex items-center gap-2">
                            {/* Invoice Buttons */}
                            <div className="flex items-center rounded-xl overflow-hidden border border-border">
                                <button 
                                    onClick={() => setPreviewType('invoice')}
                                    className="flex items-center gap-2 px-3 py-2 bg-surface-container-high text-xs font-bold text-foreground hover:bg-surface-container-highest transition-all border-r border-border"
                                >
                                    <Eye className="w-3.5 h-3.5" /> Preview
                                </button>
                                <PDFDownloadLink
                                    document={<InvoiceTemplate invoice={invoice} organisationName={organisationName} />}
                                    fileName={`Invoice-${invoice.invoiceNumber}.pdf`}
                                    className="flex items-center gap-2 px-3 py-2 bg-surface-container-high text-xs font-bold text-foreground hover:bg-surface-container-highest transition-all"
                                >
                                    {({ loading }) => (
                                        <>
                                            <Download className="w-3.5 h-3.5 text-primary" />
                                            {loading ? '...' : 'PDF'}
                                        </>
                                    )}
                                </PDFDownloadLink>
                            </div>
                            
                            {/* Receipt Buttons */}
                            {invoice.payments.length > 0 && (
                                <div className="flex items-center rounded-xl overflow-hidden border border-emerald-500/20">
                                    <button 
                                        onClick={() => setPreviewType('receipt')}
                                        className="flex items-center gap-2 px-3 py-2 bg-surface-container-high text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 transition-all border-r border-emerald-500/10"
                                    >
                                        <Eye className="w-3.5 h-3.5" /> Receipt
                                    </button>
                                    <PDFDownloadLink
                                        document={<ReceiptTemplate invoice={invoice} organisationName={organisationName} />}
                                        fileName={`Receipt-${invoice.invoiceNumber}.pdf`}
                                        className="flex items-center gap-2 px-3 py-2 bg-surface-container-high text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 transition-all"
                                    >
                                        {({ loading }) => (
                                            <>
                                                <Download className="w-3.5 h-3.5" />
                                                {loading ? '...' : 'PDF'}
                                            </>
                                        )}
                                    </PDFDownloadLink>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-high border border-border rounded-xl text-sm font-bold text-muted-foreground opacity-50">
                            <Download className="w-4 h-4" /> Loading...
                        </div>
                    )}
                    {remainingBalance > 0 && (
                        <button 
                            disabled={isPending}
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary rounded-xl text-sm font-bold text-foreground hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 glow-btn disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CreditCard className="w-4 h-4" /> Record Payment
                        </button>
                    )}
                    {invoice.status !== 'void' && (
                        <button 
                            type="button"
                            disabled={isPending}
                            onClick={() => setConfirmAction('void')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm font-bold text-amber-600 hover:bg-amber-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Ban className="w-4 h-4" /> Void
                        </button>
                    )}
                    {invoice.status !== 'paid' && (
                        <button 
                            type="button"
                            disabled={isPending}
                            onClick={() => setConfirmAction('delete')}
                            className="flex items-center gap-2 px-5 py-2.5 bg-error/10 border border-error/20 rounded-xl text-sm font-bold text-error hover:bg-error/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Details */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Invoice Card */}
                    <div className="bg-surface-container-high border border-border rounded-[40px] p-8 md:p-12 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] -mr-32 -mt-32" />
                        
                        <div className="relative flex flex-col md:flex-row justify-between gap-8 mb-12">
                            <div>
                                <div className="text-primary font-black tracking-widest text-xs uppercase mb-2">Invoice Details</div>
                                <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">{invoice.invoiceNumber}</h1>
                                {getStatusBadge(invoice.status)}
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="text-foreground-variant font-black tracking-widest text-xs uppercase mb-2">Total Amount</div>
                                <div className="text-5xl font-black text-foreground">£{Number(invoice.amount).toFixed(2)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12 border-y border-border py-10">
                            <div>
                                <p className="text-xs font-black text-foreground-variant uppercase tracking-widest mb-1">Issue Date</p>
                                <p className="text-sm font-bold text-foreground">{format(new Date(invoice.invoiceDate), 'MMM d, yyyy')}</p>
                            </div>
                            <div>
                                <p className="text-xs font-black text-foreground-variant uppercase tracking-widest mb-1">Due Date</p>
                                <p className="text-sm font-bold text-foreground">{format(new Date(invoice.dueDate), 'MMM d, yyyy')}</p>
                            </div>
                            <div>
                                <p className="text-xs font-black text-foreground-variant uppercase tracking-widest mb-1">Billing Start</p>
                                <p className="text-sm font-bold text-foreground">{invoice.billingPeriodStart ? format(new Date(invoice.billingPeriodStart), 'MMM d, yyyy') : '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-black text-foreground-variant uppercase tracking-widest mb-1">Billing End</p>
                                <p className="text-sm font-bold text-foreground">{invoice.billingPeriodEnd ? format(new Date(invoice.billingPeriodEnd), 'MMM d, yyyy') : '-'}</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 space-y-4">
                                <h3 className="text-xs font-black text-foreground-variant uppercase tracking-widest">Student Information</h3>
                                <div className="bg-secondary/60 rounded-3xl p-6 border border-border">
                                    <div className="text-lg font-black text-foreground">{invoice.child.firstName} {invoice.child.lastName}</div>
                                    <div className="text-sm font-medium text-foreground-variant">{invoice.centre.name}</div>
                                </div>
                            </div>
                            <div className="flex-1 space-y-4">
                                <h3 className="text-xs font-black text-foreground-variant uppercase tracking-widest">Notes</h3>
                                <div className="bg-secondary/60 rounded-3xl p-6 border border-border min-h-[100px]">
                                    <p className="text-sm text-foreground-variant leading-relaxed">
                                        {invoice.notes || 'No notes provided for this invoice.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment History Section */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-foreground px-2">Payment Reconciliation Ledger</h3>
                        <PaymentHistoryList payments={invoice.payments} />
                    </div>
                </div>

                {/* Sidebar Summary */}
                <div className="space-y-6">
                    <div className="bg-surface-container-highest border border-border rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[60px]" />
                        
                        <h3 className="text-xl font-black text-foreground mb-8">Summary</h3>
                        
                        <div className="space-y-6">
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span className="text-foreground-variant">Total Billed</span>
                                <span className="text-foreground">£{Number(invoice.amount).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-bold">
                                <span className="text-foreground-variant">Total Paid</span>
                                <span className="text-emerald-600">£{totalPaid.toFixed(2)}</span>
                            </div>
                            <div className="h-px bg-outline-variant/10 my-6" />
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs font-black text-foreground-variant uppercase tracking-widest mb-1">Balance Remaining</p>
                                    <h4 className={`text-3xl font-black ${remainingBalance <= 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                                        £{remainingBalance.toFixed(2)}
                                    </h4>
                                </div>
                                {remainingBalance <= 0 && (
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                    </div>
                                )}
                            </div>
                        </div>

                        {remainingBalance > 0 && (
                            <button 
                                disabled={isPending}
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="w-full mt-10 py-4 bg-primary rounded-2xl text-sm font-black text-foreground hover:bg-blue-600 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Record Received Payment
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isPaymentModalOpen && (
                <RecordPaymentModal 
                    invoiceId={invoice.id}
                    invoiceNumber={invoice.invoiceNumber}
                    remainingBalance={remainingBalance}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onSuccess={() => {
                        startTransition(() => {
                            router.refresh();
                        });
                    }}
                />
            )}

            <ConfirmActionModal
                isOpen={confirmAction !== null}
                onClose={() => setConfirmAction(null)}
                variant={confirmAction ?? 'delete'}
                invoiceNumber={invoice.invoiceNumber}
                hasPayments={hasPayments}
                onConfirm={async () => {
                    startTransition(async () => {
                        if (confirmAction === 'delete') {
                            await deleteInvoice(invoice.id);
                            router.push('/dashboard/finance');
                        } else {
                            await voidInvoice(invoice.id);
                            router.refresh();
                        }
                    });
                }}
            />

            <PDFPreviewModal
                isOpen={previewType !== null}
                onClose={() => setPreviewType(null)}
                title={previewType === 'invoice' ? 'Invoice Preview' : 'Receipt Preview'}
                fileName={previewType === 'invoice' ? `Invoice-${invoice.invoiceNumber}.pdf` : `Receipt-${invoice.invoiceNumber}.pdf`}
                pdfContent={
                    previewType === 'invoice' ? (
                        <InvoiceTemplate invoice={invoice} organisationName={organisationName} />
                    ) : (
                        <ReceiptTemplate invoice={invoice} organisationName={organisationName} />
                    )
                }
            />

            {/* Transition Blocker Overlay */}
            {isPending && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-[250] animate-in fade-in duration-150">
                    <div className="flex items-center gap-3 bg-surface-container-high border border-border px-6 py-4 rounded-2xl text-base font-bold text-foreground shadow-2xl animate-in zoom-in-95 duration-150">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        Updating Invoice...
                    </div>
                </div>
            )}
        </div>
    );
}
