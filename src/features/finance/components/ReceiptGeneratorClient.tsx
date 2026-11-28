'use client';
import { WhatsAppCopyActions } from '@/components/whatsapp/WhatsAppCopyActions';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, Check, Info, FileText, Coins, CreditCard, Landmark, Sparkles } from 'lucide-react';
import { normaliseServiceType, serviceTypeLabel, type ServiceType } from '../service-type';

interface Child {
    id: string;
    firstName: string;
    lastName: string;
    schoolYear: string;
    centreId?: string | null;
    serviceType?: ServiceType | null;
    parent: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        deletedAt?: string | Date | null;
    };
}

interface Centre {
    id: string;
    name: string;
    address?: string | null;
    ofstedId?: string | null;
    managerName?: string | null;
    billingPhone?: string | null;
    billingEmail?: string | null;
}

interface InitialPayment {
    id: string;
    amount: string | number;
    method?: string | null;
    recordedAt?: string | Date | null;
    receiptNo?: string | null;
    parentId?: string | null;
    parentName?: string | null;
    childId?: string | null;
    studentName?: string | null;
    centreId?: string | null;
    centreName?: string | null;
    invoiceNumber?: string | null;
    description?: string | null;
    serviceType?: ServiceType | null;
}

interface Props {
    organisation: {
        id: string;
        name: string;
        slug: string;
    };
    centres: Centre[];
    children: unknown[];
    paymentId?: string;
    stableReceiptNo?: string;
    initialPayment?: InitialPayment | null;
    initialCentreId?: string;
    initialChildId?: string;
}

function mapMethodLabel(method?: string | null): 'Cash' | 'Card' | 'Bank Transfer' | 'Childcare Vouchers' {
    switch (method) {
        case 'cash':
        case 'Cash':
            return 'Cash';
        case 'stripe':
        case 'card':
        case 'Card':
            return 'Card';
        case 'bank_transfer':
        case 'gocardless':
        case 'Bank Transfer':
            return 'Bank Transfer';
        case 'voucher':
        case 'tax_free_childcare':
        case 'Childcare Vouchers':
            return 'Childcare Vouchers';
        default:
            return 'Cash';
    }
}

export default function ReceiptGeneratorClient({ organisation, centres, children: rawChildren, stableReceiptNo, initialPayment, initialCentreId, initialChildId }: Props) {
    const children = rawChildren as Child[];
    // Generate random receipt number
    const generateReceiptNumber = () => {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `MANUAL-${result}`; // clear it's a manual reference
    };

    const initialDateStr = initialPayment?.recordedAt
        ? (typeof initialPayment.recordedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(initialPayment.recordedAt)
            ? initialPayment.recordedAt
            : new Date(initialPayment.recordedAt).toISOString().split('T')[0])
        : '';

    const [receiptNo, setReceiptNo] = useState(initialPayment?.receiptNo || stableReceiptNo || '');
    const [date, setDate] = useState(initialDateStr);
    const [selectedChildId, setSelectedChildId] = useState(initialPayment?.childId || initialChildId || '');
    const [parentName, setParentName] = useState(initialPayment?.parentName || '');
    const [studentName, setStudentName] = useState(initialPayment?.studentName || '');
    const [amount, setAmount] = useState(
        initialPayment?.amount !== undefined && initialPayment?.amount !== null
            ? Number(initialPayment.amount).toFixed(2)
            : '120.00'
    );
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Childcare Vouchers'>(
        initialPayment?.method ? mapMethodLabel(initialPayment.method) : 'Cash'
    );
    const [selectedCentreId, setSelectedCentreId] = useState(initialPayment?.centreId || initialCentreId || centres[0]?.id || '');
    const [serviceType, setServiceType] = useState<ServiceType>(normaliseServiceType(initialPayment?.serviceType));
    const [description, setDescription] = useState(
        initialPayment?.description ||
        (initialPayment?.invoiceNumber ? `Payment for Invoice ${initialPayment.invoiceNumber}` : 'Weekly Club Sessions')
    );

    // Set initial values
    useEffect(() => {
        if (initialPayment) {
            setReceiptNo(initialPayment.receiptNo || stableReceiptNo || generateReceiptNumber());
            if (initialPayment.recordedAt) {
                const parsedDate = typeof initialPayment.recordedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(initialPayment.recordedAt)
                    ? initialPayment.recordedAt
                    : new Date(initialPayment.recordedAt).toISOString().split('T')[0];
                setDate(parsedDate);
            } else {
                setDate(new Date().toISOString().split('T')[0]);
            }
            if (initialPayment.childId) setSelectedChildId(initialPayment.childId);
            if (initialPayment.parentName) setParentName(initialPayment.parentName);
            if (initialPayment.studentName) setStudentName(initialPayment.studentName);
            if (initialPayment.amount !== undefined && initialPayment.amount !== null) {
                setAmount(Number(initialPayment.amount).toFixed(2));
            }
            if (initialPayment.method) {
                setPaymentMethod(mapMethodLabel(initialPayment.method));
            }
            if (initialPayment.centreId) {
                setSelectedCentreId(initialPayment.centreId);
            }
            setServiceType(normaliseServiceType(initialPayment.serviceType));
            if (initialPayment.description) {
                setDescription(initialPayment.description);
            } else if (initialPayment.invoiceNumber) {
                setDescription(`Payment for Invoice ${initialPayment.invoiceNumber}`);
            }
            return;
        }
        setReceiptNo(stableReceiptNo || generateReceiptNumber());
        setDate(new Date().toISOString().split('T')[0]);
    }, [stableReceiptNo, initialPayment]);

    // Handle student selection
    
    const handleStudentChange = useCallback((childId: string) => {
        setSelectedChildId(childId);
        if (childId === '') {
            setStudentName('');
            setParentName('');
            return;
        }

        const child = children.find(c => c.id === childId) as Child | undefined;
        if (child) {
            setStudentName(`${child.firstName} ${child.lastName}`);
            setParentName(`${child.parent.firstName} ${child.parent.lastName}`);
            if (child.centreId) {
                setSelectedCentreId(child.centreId);
            }
            setServiceType(normaliseServiceType(child.serviceType));
        }
    }, [children]);

    const initialisedChildRef = useRef(false);

    useEffect(() => {
        if (!initialPayment && initialChildId && !initialisedChildRef.current) {
            initialisedChildRef.current = true;
            handleStudentChange(initialChildId);
        }
    }, [initialPayment, initialChildId, handleStudentChange]);

    const selectedCentre = centres.find(c => c.id === selectedCentreId);
    const selectedCentreName =
        selectedCentre?.name ||
        initialPayment?.centreName ||
        organisation.name ||
        'Main Centre';

    const contactLineParts = [
        serviceType !== 'tuition' && selectedCentre?.ofstedId ? `Ofsted: ${selectedCentre.ofstedId}` : null,
        selectedCentre?.billingPhone ? `Tel: ${selectedCentre.billingPhone}` : null,
        selectedCentre?.billingEmail || null,
    ].filter(Boolean);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            {/* Form Column - Hidden during printing */}
            <div className="lg:col-span-5 space-y-6 no-print">
                <div className="bg-card border border-border rounded-3xl p-6 shadow-xl space-y-6">
                    <div>
                        <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            Receipt Details
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Fill in details below to customize the official receipt.
                        </p>
                    </div>

                    {/* Receipt Number & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-no" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Receipt No</label>
                            <input
                                id="receipt-no"
                                type="text"
                                value={receiptNo}
                                onChange={(e) => setReceiptNo(e.target.value.toUpperCase())}
                                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-date" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Payment Date</label>
                            <input
                                id="receipt-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                    </div>

                    {/* Student Selector */}
                    <div className="space-y-1.5">
                        <label htmlFor="receipt-student-select" className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Select Student (Optional)</label>
                        <select
                            id="receipt-student-select"
                            value={selectedChildId}
                            onChange={(e) => handleStudentChange(e.target.value)}
                            className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                        >
                            <option value="" className="bg-card text-muted-foreground">-- Select an existing student --</option>
                            {children.map(child => (
                                <option key={child.id} value={child.id} className="bg-card text-foreground">
                                    {child.firstName} {child.lastName} (Yr {child.schoolYear} · {child.parent.firstName} {child.parent.lastName})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Manual Override Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-parent-name" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Parent / Payer Name</label>
                            <input
                                id="receipt-parent-name"
                                type="text"
                                value={parentName}
                                onChange={(e) => setParentName(e.target.value)}
                                placeholder="Payer Full Name"
                                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-student-name" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Student Full Name</label>
                            <input
                                id="receipt-student-name"
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="Student Full Name"
                                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                    </div>

                    {/* Amount & Method */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-amount" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount Paid (£)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                                <input
                                    id="receipt-amount"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    className="w-full h-11 pl-7 pr-3 rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground text-base sm:text-sm tabular-nums focus:outline-none focus:border-accent transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-payment-method" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Method</label>
                            <select
                                id="receipt-payment-method"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value as any)}
                                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                            >
                                <option value="Cash" className="bg-card">Cash</option>
                                <option value="Card" className="bg-card">Debit/Credit Card</option>
                                <option value="Bank Transfer" className="bg-card">Bank Transfer</option>
                                {serviceType !== 'tuition' && (
                                    <option value="Childcare Vouchers" className="bg-card">Childcare Vouchers</option>
                                )}
                            </select>
                        </div>
                    </div>

                    {/* Centre & Service Type Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-club-centre" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Club Centre</label>
                            <select
                                id="receipt-club-centre"
                                value={selectedCentreId}
                                onChange={(e) => setSelectedCentreId(e.target.value)}
                                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                            >
                                {centres.map(c => (
                                    <option key={c.id} value={c.id} className="bg-card">{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label htmlFor="receipt-service-type" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Service Type</label>
                            <select
                                id="receipt-service-type"
                                value={serviceType}
                                onChange={(e) => setServiceType(normaliseServiceType(e.target.value))}
                                className="w-full h-11 px-3 rounded-xl bg-secondary/40 border border-border text-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors"
                            >
                                <option value="childcare" className="bg-card">Childcare</option>
                                <option value="tuition" className="bg-card">Tuition</option>
                            </select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label htmlFor="receipt-description" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Description / Notes</label>
                        <textarea
                            id="receipt-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="e.g. Booking deposit, Weekly club tuition fee..."
                            className="w-full p-3 rounded-xl bg-secondary/40 border border-border text-foreground placeholder:text-muted-foreground text-base sm:text-sm focus:outline-none focus:border-accent transition-colors resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => {
                                setReceiptNo(generateReceiptNumber());
                            }}
                            className="flex-1 h-11 rounded-2xl bg-surface border border-border hover:bg-secondary/60 text-foreground text-xs font-bold transition-all"
                        >
                            Reset / Regenerate
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Column */}
            <div className="lg:col-span-7 flex flex-col items-center w-full">
                {/* Print Control Header (no-print) */}
                <div className="w-full max-w-xl flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-accent" />
                        Fits exactly on standard A4/letter paper.
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                            const selectedChild = children.find(c => c.id === selectedChildId);
                            const pPhone = selectedChild?.parent?.phone;
                            const pFirst = parentName.trim().split(' ')[0] || selectedChild?.parent?.firstName || 'Parent';
                            const msg = `Hi ${pFirst}, your payment receipt (${receiptNo || 'RCP-PAID'}) for £${Number(amount || 0).toFixed(2)} from ${selectedCentreName} is ready. Thank you for your payment!`;
                            return Boolean(pPhone) && !selectedChild?.parent?.deletedAt ? (
                                <WhatsAppCopyActions
                                    phone={pPhone}
                                    message={msg}
                                    recipientName={parentName || 'Parent'}
                                    variant="pill"
                                />
                            ) : null;
                        })()}
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-on-accent text-xs font-bold rounded-xl hover:opacity-90 transition-all shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            Print / Save PDF
                        </button>
                    </div>
                </div>

                {/* Printable Receipt Card */}
                <div 
                    id="receipt-print-area"
                    className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 shadow-lg relative text-slate-900 overflow-hidden print-layout"
                    style={{
                        minHeight: '620px',
                    }}
                >
                    {/* Watermark paid background */}
                    <div className="absolute right-8 top-28 opacity-[0.06] select-none pointer-events-none transform rotate-12 text-center border-8 border-emerald-600 p-4 rounded-3xl font-black text-6xl text-emerald-600 tracking-wider">
                        OFFICIAL<br />PAID
                    </div>

                    {/* Visual Stamp Aura for print header */}
                    <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-slate-100 to-transparent pointer-events-none rounded-bl-[128px]" />

                    {/* Receipt Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-100">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center">
                                    {selectedCentreName.slice(0, 2).toUpperCase()}
                                </div>
                                <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">{selectedCentreName}</h2>
                            </div>
                            {selectedCentre?.address && (
                                <p className="text-[10px] text-slate-500 font-semibold mt-1 whitespace-pre-line">{selectedCentre.address}</p>
                            )}
                            {contactLineParts.length > 0 && (
                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-1">
                                    {contactLineParts.join(' · ')}
                                </p>
                            )}
                        </div>
                        <div className="sm:text-right">
                            <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Official Receipt</h3>
                            <p className="text-xs font-bold text-slate-500 mt-1">NO: <span className="font-mono text-slate-900">{receiptNo || 'RCP-XXXXXX'}</span></p>
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="py-8 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Date</span>
                                <span className="text-xs font-bold text-slate-900">{date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Payment Method</span>
                                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    {paymentMethod === 'Cash' && <Coins className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                                    {paymentMethod === 'Card' && <CreditCard className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                                    {paymentMethod === 'Bank Transfer' && <Landmark className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
                                    {paymentMethod === 'Childcare Vouchers' && <FileText className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />}
                                    {paymentMethod}
                                </span>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2.5">
                                <span className="text-xs text-slate-500 font-medium">Received From (Payer)</span>
                                <span className="text-xs font-bold text-slate-900">{parentName || 'Manual Parent Name'}</span>
                            </div>
                            {studentName && (
                                <div className="flex justify-between items-center py-2.5 border-t border-slate-50">
                                    <span className="text-xs text-slate-500 font-medium">For Student</span>
                                    <span className="text-xs font-bold text-slate-900">{studentName}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center py-2.5 border-t border-slate-50">
                                <span className="text-xs text-slate-500 font-medium">Type of Service</span>
                                <span className="text-xs font-bold text-slate-900">{serviceTypeLabel(serviceType)}</span>
                            </div>
                            <div className="flex justify-between items-start py-2.5 border-t border-slate-50">
                                <span className="text-xs text-slate-500 font-medium pt-0.5">Description / Memo</span>
                                <span className="text-xs text-slate-700 font-semibold max-w-[280px] text-right leading-relaxed">{description || 'Weekly club tutoring session fees'}</span>
                            </div>
                        </div>

                        {/* Amount Box */}
                        <div className="bg-slate-50 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 border border-slate-100">
                            <div>
                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Total Amount Received</span>
                                <span className="text-xs text-slate-500 italic mt-0.5 block leading-tight">Paid in Full</span>
                            </div>
                            <div className="text-3xl font-black text-slate-900 tracking-tight tabular-nums">
                                £{Number(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    {/* Stamp and Signatures */}
                    <div className="grid grid-cols-2 gap-8 pt-10 border-t border-slate-100 mt-6">
                        <div className="space-y-2">
                            <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Verified Status</span>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                                <Check className="w-3 h-3" /> OFFICIAL PAID
                            </div>
                        </div>
                        <div className="space-y-4 text-right">
                            <div className="h-10 flex items-end justify-end">
                                <span className="font-serif italic text-base text-slate-600 opacity-75 tracking-wider">{selectedCentre?.managerName || 'Centre Manager'}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-1.5">
                                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block">Authorised Signature ({selectedCentreName})</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Global CSS rules specific to this page container printing (only applies inside iframe/receipt-generator) */}
            <style jsx global>{`
                @media print {
                    /* Hide everything that isn't the receipt */
                    body * {
                        visibility: hidden;
                    }
                    #receipt-print-area, #receipt-print-area * {
                        visibility: visible;
                    }
                    /* Position print area absolute at top left */
                    #receipt-print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100% !important;
                        max-width: 100% !important;
                        border: 0 !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        padding: 24px !important;
                        background: white !important;
                        color: black !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
