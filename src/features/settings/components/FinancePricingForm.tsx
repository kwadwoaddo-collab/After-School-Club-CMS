'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Centre {
    id: string;
    name: string;
    feeSelfFinance: number | null;
    feeAssistedFinance: number | null;
    bankName: string | null;
    sortCode: string | null;
    accountNo: string | null;
    ofstedId: string | null;
    managerName: string | null;
    billingPhone: string | null;
    billingEmail: string | null;
    signatureUrl: string | null;
}

interface FinancePricingFormProps {
    centres: Centre[];
}

export default function FinancePricingForm({ centres }: FinancePricingFormProps) {
    const router = useRouter();
    const [selectedCentreId, setSelectedCentreId] = useState<string>(centres[0]?.id || '');
    const { toast } = useToast();
    
    // Find selected centre data
    const selectedCentre = centres.find(c => c.id === selectedCentreId);
    
    const [feeSelfFinance, setFeeSelfFinance] = useState<string>(selectedCentre?.feeSelfFinance?.toString() || '');
    const [feeAssistedFinance, setFeeAssistedFinance] = useState<string>(selectedCentre?.feeAssistedFinance?.toString() || '');
    
    // Billing Details
    const [bankName, setBankName] = useState<string>(selectedCentre?.bankName || '');
    const [sortCode, setSortCode] = useState<string>(selectedCentre?.sortCode || '');
    const [accountNo, setAccountNo] = useState<string>(selectedCentre?.accountNo || '');
    const [ofstedId, setOfstedId] = useState<string>(selectedCentre?.ofstedId || '');
    const [managerName, setManagerName] = useState<string>(selectedCentre?.managerName || '');
    const [billingPhone, setBillingPhone] = useState<string>(selectedCentre?.billingPhone || '');
    const [billingEmail, setBillingEmail] = useState<string>(selectedCentre?.billingEmail || '');
    const [signatureUrl, setSignatureUrl] = useState<string>(selectedCentre?.signatureUrl || '');
    
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    // Update local state when centres prop changes (e.g. after refresh)
    useEffect(() => {
        const centre = centres.find(c => c.id === selectedCentreId) || centres[0];
        if (centre) {
            setFeeSelfFinance(centre.feeSelfFinance?.toString() || '');
            setFeeAssistedFinance(centre.feeAssistedFinance?.toString() || '');
            setBankName(centre.bankName || '');
            setSortCode(centre.sortCode || '');
            setAccountNo(centre.accountNo || '');
            setOfstedId(centre.ofstedId || '');
            setManagerName(centre.managerName || '');
            setBillingPhone(centre.billingPhone || '');
            setBillingEmail(centre.billingEmail || '');
            setSignatureUrl(centre.signatureUrl || '');
        }
    }, [centres, selectedCentreId]);

    // Update local state when centre changes physically
    const handleCentreChange = (id: string) => {
        setSelectedCentreId(id);
        const centre = centres.find(c => c.id === id);
        setFeeSelfFinance(centre?.feeSelfFinance?.toString() || '');
        setFeeAssistedFinance(centre?.feeAssistedFinance?.toString() || '');
        setBankName(centre?.bankName || '');
        setSortCode(centre?.sortCode || '');
        setAccountNo(centre?.accountNo || '');
        setOfstedId(centre?.ofstedId || '');
        setManagerName(centre?.managerName || '');
        setBillingPhone(centre?.billingPhone || '');
        setBillingEmail(centre?.billingEmail || '');
        setSignatureUrl(centre?.signatureUrl || '');
        setError(null);
        setSuccess(false);
    };

    const handleSave = async () => {
        if (!selectedCentreId) return;
        
        setSaving(true);
        setError(null);
        setSuccess(false);
 
        try {
            const response = await fetch(`/api/centres/${selectedCentreId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    feeSelfFinance: feeSelfFinance === '' ? null : parseFloat(feeSelfFinance), 
                    feeAssistedFinance: feeAssistedFinance === '' ? null : parseFloat(feeAssistedFinance),
                    bankName,
                    sortCode,
                    accountNo,
                    ofstedId,
                    managerName,
                    billingPhone,
                    billingEmail,
                    signatureUrl
                }),
            });
 
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update pricing');
            }
 
            setSuccess(true);
            toast({ title: 'Success', message: 'Pricing & Billing settings saved successfully!', variant: 'success' });
            router.refresh(); // triggers a server refresh to get updated data
            
            // Hide success message after 3 seconds
            setTimeout(() => {
                setSuccess(false);
            }, 3000);
            
        } catch (err) {
            logger.error('Save error:', err);
            const errMsg = err instanceof Error ? err.message : 'Failed to save changes';
            setError(errMsg);
            toast({ title: 'Error', message: errMsg, variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (centres.length === 0) {
        return (
            <div className="bg-surface border border-border rounded-xl p-8 text-center shadow-xs">
                <p className="text-text-muted">No centres found. Please add a centre first.</p>
            </div>
        );
    }

    return (
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 flex flex-col gap-6 shadow-xs">
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
            
            {success && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-xl flex items-start gap-3 text-success animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">Pricing updated successfully!</p>
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <label htmlFor="finance-centre-select" className="text-sm font-bold text-text mb-2 block">Select Centre</label>
                    <div className="relative">
                        <select
                            id="finance-centre-select"
                            value={selectedCentreId}
                            onChange={(e) => handleCentreChange(e.target.value)}
                            className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs appearance-none"
                            disabled={saving}
                        >
                            {centres.map(centre => (
                                <option key={centre.id} value={centre.id} className="bg-secondary text-text">
                                    {centre.name}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-text-muted">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="fee-self-finance" className="text-sm font-bold text-text mb-2 block">Standard Fee (Self-Finance)</label>
                        <div className="flex rounded-md border border-border overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent transition-all">
                            <span className="flex items-center px-4 bg-secondary/40 border-r border-border text-text-muted font-semibold text-sm select-none">£</span>
                            <input
                                id="fee-self-finance"
                                type="number"
                                step="0.01"
                                min="0"
                                value={feeSelfFinance}
                                onChange={(e) => setFeeSelfFinance(e.target.value)}
                                className="flex-1 px-4 py-2.5 min-h-11 sm:min-h-10 bg-page text-text text-sm tabular-nums focus:outline-none placeholder:text-text-muted"
                                placeholder="0.00"
                                disabled={saving}
                            />
                        </div>
                        <p className="text-xs text-text-muted mt-2">The standard rate for self-funded students.</p>
                    </div>

                    <div>
                        <label htmlFor="fee-assisted-finance" className="text-sm font-bold text-text mb-2 block">Assisted Finance Fee</label>
                        <div className="flex rounded-md border border-border overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-accent/20 focus-within:border-accent transition-all">
                            <span className="flex items-center px-4 bg-secondary/40 border-r border-border text-text-muted font-semibold text-sm select-none">£</span>
                            <input
                                id="fee-assisted-finance"
                                type="number"
                                step="0.01"
                                min="0"
                                value={feeAssistedFinance}
                                onChange={(e) => setFeeAssistedFinance(e.target.value)}
                                className="flex-1 px-4 py-2.5 min-h-11 sm:min-h-10 bg-page text-text text-sm tabular-nums focus:outline-none placeholder:text-text-muted"
                                placeholder="0.00"
                                disabled={saving}
                            />
                        </div>
                        <p className="text-xs text-text-muted mt-2">The rate applied when using Tax-Free Childcare, Vouchers, etc.</p>
                    </div>
                </div>

                <div className="h-px bg-secondary my-2" />

                <div className="space-y-6">
                    {/* Milestone 3J: Added "Sensitive" indicator matching Centres Settings billing treatment */}
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-text">Bank Details</h3>
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">Sensitive</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="bank-name" className="text-sm font-bold text-text mb-2 block">Bank Name</label>
                            <input
                                id="bank-name"
                                type="text"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                                placeholder="Lloyds Bank"
                                disabled={saving}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="sort-code" className="text-sm font-bold text-text mb-2 block">Sort Code</label>
                                <input
                                    id="sort-code"
                                    type="text"
                                    value={sortCode}
                                    onChange={(e) => setSortCode(e.target.value)}
                                    className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                                    placeholder="00-00-00"
                                    disabled={saving}
                                />
                            </div>
                            <div>
                                <label htmlFor="account-no" className="text-sm font-bold text-text mb-2 block">Account No</label>
                                <input
                                    id="account-no"
                                    type="text"
                                    value={accountNo}
                                    onChange={(e) => setAccountNo(e.target.value)}
                                    className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                                    placeholder="12345678"
                                    disabled={saving}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-secondary my-2" />

                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-text">Management & Regulatory</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="manager-name" className="text-sm font-bold text-text mb-2 block">Manager Name</label>
                            <input
                                id="manager-name"
                                type="text"
                                value={managerName}
                                onChange={(e) => setManagerName(e.target.value)}
                                className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                                placeholder="Full Name"
                                disabled={saving}
                            />
                        </div>
                        <div>
                            <label htmlFor="ofsted-id" className="text-sm font-bold text-text mb-2 block">Ofsted ID</label>
                            <input
                                id="ofsted-id"
                                type="text"
                                value={ofstedId}
                                onChange={(e) => setOfstedId(e.target.value)}
                                className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                                placeholder="EY123456"
                                disabled={saving}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="billing-phone" className="text-sm font-bold text-text mb-2 block">Billing Phone</label>
                            <input
                                id="billing-phone"
                                type="tel"
                                value={billingPhone}
                                onChange={(e) => setBillingPhone(e.target.value)}
                                className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                                placeholder="020 1234 5678"
                                disabled={saving}
                            />
                        </div>
                        <div>
                            <label htmlFor="billing-email" className="text-sm font-bold text-text mb-2 block">Billing Email</label>
                            <input
                                id="billing-email"
                                type="email"
                                value={billingEmail}
                                onChange={(e) => setBillingEmail(e.target.value)}
                                className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                                placeholder="info@sydenhamclub.com"
                                disabled={saving}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="signature-url" className="text-sm font-bold text-text mb-2 block">Signature URL (Image)</label>
                        <input
                            id="signature-url"
                            type="text"
                            value={signatureUrl}
                            onChange={(e) => setSignatureUrl(e.target.value)}
                            className="w-full px-4 py-2.5 min-h-11 sm:min-h-10 bg-secondary/60 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-xs"
                            placeholder="https://example.com/signature.png"
                            disabled={saving}
                        />
                        <p className="text-xs text-text-muted mt-2">This signature will appear on generated invoices.</p>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 min-h-11 sm:min-h-10 bg-accent hover:bg-accent-hover active:bg-accent/80 text-on-accent text-sm font-semibold rounded-md transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Pricing'}
                    </button>
                </div>
            </div>
        </div>
    );
}
