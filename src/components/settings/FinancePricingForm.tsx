'use client';

import { useState, useEffect } from 'react';
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
            router.refresh(); // triggers a server refresh to get updated data
            
            // Hide success message after 3 seconds
            setTimeout(() => {
                setSuccess(false);
            }, 3000);
            
        } catch (err) {
            console.error('Save error:', err);
            setError(err instanceof Error ? err.message : 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    if (centres.length === 0) {
        return (
            <div className="glass-card rounded-3xl p-8 text-center bg-white/50 backdrop-blur-md border border-slate-200 shadow-xl">
                <p className="text-slate-500">No centres found. Please add a centre first.</p>
            </div>
        );
    }

    return (
        <div className="glass-card rounded-3xl p-8 !bg-[#1a1c23]/80 !border-[#2a2d35] shadow-xl">
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
            
            {success && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">Pricing updated successfully!</p>
                </div>
            )}

            <div className="space-y-6">
                <div>
                    <label className="text-sm font-bold text-white mb-2 block">Select Centre</label>
                    <select
                        value={selectedCentreId}
                        onChange={(e) => handleCentreChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm appearance-none"
                        disabled={saving}
                    >
                        {centres.map(centre => (
                            <option key={centre.id} value={centre.id}>
                                {centre.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm font-bold text-white mb-2 block">Standard Fee (Self-Finance) (£)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={feeSelfFinance}
                                onChange={(e) => setFeeSelfFinance(e.target.value)}
                                className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                placeholder="0.00"
                                disabled={saving}
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2">The standard rate for self-funded students.</p>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-white mb-2 block">Assisted Finance Fee (£)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">£</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={feeAssistedFinance}
                                onChange={(e) => setFeeAssistedFinance(e.target.value)}
                                className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                placeholder="0.00"
                                disabled={saving}
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2">The rate applied when using Tax-Free Childcare, Vouchers, etc.</p>
                    </div>
                </div>

                <div className="h-px bg-[#2a2d35] my-6" />

                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-white">Bank Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-bold text-white mb-2 block">Bank Name</label>
                            <input
                                type="text"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                placeholder="Lloyds Bank"
                                disabled={saving}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-white mb-2 block">Sort Code</label>
                                <input
                                    type="text"
                                    value={sortCode}
                                    onChange={(e) => setSortCode(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                    placeholder="00-00-00"
                                    disabled={saving}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-bold text-white mb-2 block">Account No</label>
                                <input
                                    type="text"
                                    value={accountNo}
                                    onChange={(e) => setAccountNo(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                    placeholder="12345678"
                                    disabled={saving}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-[#2a2d35] my-6" />

                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-white">Management & Regulatory</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-bold text-white mb-2 block">Manager Name</label>
                            <input
                                type="text"
                                value={managerName}
                                onChange={(e) => setManagerName(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                placeholder="Full Name"
                                disabled={saving}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-white mb-2 block">Ofsted ID</label>
                            <input
                                type="text"
                                value={ofstedId}
                                onChange={(e) => setOfstedId(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                placeholder="EY123456"
                                disabled={saving}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-sm font-bold text-white mb-2 block">Billing Phone</label>
                            <input
                                type="tel"
                                value={billingPhone}
                                onChange={(e) => setBillingPhone(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                placeholder="020 1234 5678"
                                disabled={saving}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-white mb-2 block">Billing Email</label>
                            <input
                                type="email"
                                value={billingEmail}
                                onChange={(e) => setBillingEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                                placeholder="info@sydenhamclub.com"
                                disabled={saving}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-white mb-2 block">Signature URL (Image)</label>
                        <input
                            type="text"
                            value={signatureUrl}
                            onChange={(e) => setSignatureUrl(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                            placeholder="https://example.com/signature.png"
                            disabled={saving}
                        />
                        <p className="text-xs text-slate-400 mt-2">This signature will appear on generated invoices.</p>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-sm font-bold rounded-2xl hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Pricing'}
                    </button>
                </div>
            </div>
        </div>
    );
}
