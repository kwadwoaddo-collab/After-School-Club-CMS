'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateCentreBilling } from './actions';
import {
    Building2, CreditCard, Phone, Mail, User, Hash,
    Save, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck,
    MapPin, CalendarDays
} from 'lucide-react';
import Link from 'next/link';

interface CentreBillingFormProps {
    centre: {
        id: string;
        name: string;
        bankName: string | null;
        sortCode: string | null;
        accountNo: string | null;
        ofstedId: string | null;
        managerName: string | null;
        billingPhone: string | null;
        billingEmail: string | null;
        address: string | null;
        // approvalDate: string | null; // Restore after running migration 0007
    };
}

export default function CentreBillingForm({ centre }: CentreBillingFormProps) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        bankName: centre.bankName ?? '',
        sortCode: centre.sortCode ?? '',
        accountNo: centre.accountNo ?? '',
        ofstedId: centre.ofstedId ?? '',
        managerName: centre.managerName ?? '',
        billingPhone: centre.billingPhone ?? '',
        billingEmail: centre.billingEmail ?? '',
        address: centre.address ?? '',
        // approvalDate: centre.approvalDate ?? '', // Restore after running migration 0007
    });

    const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
        setSaved(false);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSaved(false);
        try {
            await updateCentreBilling({ centreId: centre.id, ...form });
            setSaved(true);
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputClass = `
        w-full px-4 py-3 rounded-2xl text-sm font-medium text-white
        bg-card/5 border border-white/10
        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40
        placeholder:text-white/20 transition-all
    `;

    const labelClass = 'text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-2';

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/centres"
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-card/5 border border-white/10 text-on-surface-variant hover:text-white hover:bg-card/10 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Billing Settings</h1>
                    <p className="text-sm text-on-surface-variant mt-0.5">{centre.name}</p>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-4 bg-primary/5 border border-primary/20 rounded-3xl p-5">
                <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <p className="text-sm font-bold text-white">These details appear on all invoices and receipts</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                        Address, bank details, Ofsted/reference number, approval date, manager name, and contact info are printed on every PDF generated for this centre.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Centre Address */}
                <div className="glassmorphic-card rounded-[32px] p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-violet-500/10 rounded-2xl flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Centre Address</h2>
                            <p className="text-xs text-on-surface-variant">Printed in the invoice footer and header</p>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>
                            <MapPin className="w-3.5 h-3.5" /> Full Address
                        </label>
                        <textarea
                            value={form.address}
                            onChange={set('address')}
                            placeholder={`e.g. Sydenham After School Club\n105 Sydenham Road\nLondon\nSE26 5UA`}
                            rows={4}
                            className={inputClass + ' resize-none'}
                        />
                        <p className="text-xs text-on-surface-variant mt-1.5 px-1">Enter each line on a new line — name, street, city, postcode.</p>
                    </div>
                </div>

                {/* Bank Details */}
                <div className="glassmorphic-card rounded-[32px] p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Bank Details</h2>
                            <p className="text-xs text-on-surface-variant">Printed in the payment information section of invoices</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className={labelClass}>
                                <Building2 className="w-3.5 h-3.5" /> Account Name
                            </label>
                            <input
                                type="text"
                                value={form.bankName}
                                onChange={set('bankName')}
                                placeholder="e.g. SYDENHAM AFTER SCHOOL CLUB LTD"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>
                                <Hash className="w-3.5 h-3.5" /> Sort Code
                            </label>
                            <input
                                type="text"
                                value={form.sortCode}
                                onChange={set('sortCode')}
                                placeholder="e.g. 20-00-00"
                                className={inputClass}
                                maxLength={8}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>
                                <Hash className="w-3.5 h-3.5" /> Account Number
                            </label>
                            <input
                                type="text"
                                value={form.accountNo}
                                onChange={set('accountNo')}
                                placeholder="e.g. 12345678"
                                className={inputClass}
                                maxLength={8}
                            />
                        </div>
                    </div>
                </div>

                {/* Centre Identity */}
                <div className="glassmorphic-card rounded-[32px] p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Centre Identity</h2>
                            <p className="text-xs text-on-surface-variant">Official registration and management info</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>
                                <Hash className="w-3.5 h-3.5" /> Ofsted / Setting Reference No.
                            </label>
                            <input
                                type="text"
                                value={form.ofstedId}
                                onChange={set('ofstedId')}
                                placeholder="e.g. 2854827"
                                className={inputClass}
                            />
                        </div>
                        {/* Approval Date field — restore after running migration 0007:
                        <div>
                            <label className={labelClass}>
                                <CalendarDays className="w-3.5 h-3.5" /> Approval Date
                            </label>
                            <input
                                type="text"
                                value={form.approvalDate}
                                onChange={set('approvalDate')}
                                placeholder="e.g. 3 September 2025"
                                className={inputClass}
                            />
                        </div>
                        */}
                        <div>
                            <label className={labelClass}>
                                <User className="w-3.5 h-3.5" /> Manager Name
                            </label>
                            <input
                                type="text"
                                value={form.managerName}
                                onChange={set('managerName')}
                                placeholder="e.g. Jane Smith"
                                className={inputClass}
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="glassmorphic-card rounded-[32px] p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-accent-cyan/10 rounded-2xl flex items-center justify-center">
                            <Phone className="w-5 h-5 text-accent-cyan" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-white">Billing Contact</h2>
                            <p className="text-xs text-on-surface-variant">Shown in the footer of all invoices and receipts</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>
                                <Phone className="w-3.5 h-3.5" /> Billing Phone
                            </label>
                            <input
                                type="tel"
                                value={form.billingPhone}
                                onChange={set('billingPhone')}
                                placeholder="e.g. 07931 173699"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>
                                <Mail className="w-3.5 h-3.5" /> Billing Email
                            </label>
                            <input
                                type="email"
                                value={form.billingEmail}
                                onChange={set('billingEmail')}
                                placeholder="e.g. billing@centre.co.uk"
                                className={inputClass}
                            />
                        </div>
                    </div>
                </div>

                {/* Error / Success */}
                {error && (
                    <div className="flex items-center gap-3 bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <p className="text-sm font-bold text-rose-500">{error}</p>
                    </div>
                )}

                {saved && (
                    <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 animate-in fade-in duration-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <p className="text-sm font-bold text-emerald-400">Billing settings saved — all new PDFs will use these details.</p>
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-primary/30 disabled:opacity-60"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Billing Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
}
