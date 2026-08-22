'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateCentreBilling } from './actions';
import {
    Building2, CreditCard, Phone, Mail, User, Hash,
    Save, Loader2, CheckCircle2, AlertTriangle, ChevronLeft, ShieldCheck,
    MapPin
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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

const inputCls = 'w-full h-9 px-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface';

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
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message || 'Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const labelCls = 'flex items-center gap-1.5 text-label text-text-muted mb-1.5';

    return (
        <div className="space-y-5">
            {/* Header */}
            <Link
                href="/dashboard/centres"
                className="inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to centres
            </Link>

            <div>
                <h1 className="text-page-title text-text">Billing settings</h1>
                <p className="text-small-body text-text-secondary mt-1">{centre.name}</p>
            </div>

            {/* Info banner */}
            <Card>
                <div className="p-4 flex gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                        <ShieldCheck className="w-4 h-4" />
                    </span>
                    <div>
                        <p className="text-small-body font-medium text-text mb-0.5">These details appear on all invoices and receipts</p>
                        <p className="text-metadata leading-relaxed">
                            Address, bank details, Ofsted/reference number, approval date, manager name, and contact info are printed on every PDF generated for this centre.
                        </p>
                    </div>
                </div>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Centre Address */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2.5">
                            <MapPin className="w-4 h-4 text-text-muted" />
                            <CardTitle>Centre address</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <label className={labelCls}>
                            <MapPin className="w-3.5 h-3.5" /> Full address
                        </label>
                        <textarea
                            value={form.address}
                            onChange={set('address')}
                            placeholder={`e.g. Sydenham After School Club\n105 Sydenham Road\nLondon\nSE26 5UA`}
                            rows={4}
                            className={`${inputCls} h-auto py-2`}
                        />
                        <p className="text-metadata mt-1.5">Enter each line on a new line — name, street, city, postcode.</p>
                    </CardContent>
                </Card>

                {/* Bank Details */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2.5">
                            <CreditCard className="w-4 h-4 text-text-muted" />
                            <CardTitle>Bank details</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelCls}>
                                    <Building2 className="w-3.5 h-3.5" /> Account name
                                </label>
                                <input
                                    type="text"
                                    value={form.bankName}
                                    onChange={set('bankName')}
                                    placeholder="e.g. SYDENHAM AFTER SCHOOL CLUB LTD"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>
                                    <Hash className="w-3.5 h-3.5" /> Sort code
                                </label>
                                <input
                                    type="text"
                                    value={form.sortCode}
                                    onChange={set('sortCode')}
                                    placeholder="e.g. 20-00-00"
                                    className={inputCls}
                                    maxLength={8}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>
                                    <Hash className="w-3.5 h-3.5" /> Account number
                                </label>
                                <input
                                    type="text"
                                    value={form.accountNo}
                                    onChange={set('accountNo')}
                                    placeholder="e.g. 12345678"
                                    className={inputCls}
                                    maxLength={8}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Centre Identity */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-text-muted" />
                            <CardTitle>Centre identity</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>
                                    <Hash className="w-3.5 h-3.5" /> Ofsted / setting reference no.
                                </label>
                                <input
                                    type="text"
                                    value={form.ofstedId}
                                    onChange={set('ofstedId')}
                                    placeholder="e.g. 2854827"
                                    className={inputCls}
                                />
                            </div>
                            {/* Approval Date field — restore after running migration 0007:
                            <div>
                                <label className={labelCls}>
                                    <CalendarDays className="w-3.5 h-3.5" /> Approval Date
                                </label>
                                <input
                                    type="text"
                                    value={form.approvalDate}
                                    onChange={set('approvalDate')}
                                    placeholder="e.g. 3 September 2025"
                                    className={inputCls}
                                />
                            </div>
                            */}
                            <div>
                                <label className={labelCls}>
                                    <User className="w-3.5 h-3.5" /> Manager name
                                </label>
                                <input
                                    type="text"
                                    value={form.managerName}
                                    onChange={set('managerName')}
                                    placeholder="e.g. Jane Smith"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact Info */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2.5">
                            <Phone className="w-4 h-4 text-text-muted" />
                            <CardTitle>Billing contact</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>
                                    <Phone className="w-3.5 h-3.5" /> Billing phone
                                </label>
                                <input
                                    type="tel"
                                    value={form.billingPhone}
                                    onChange={set('billingPhone')}
                                    placeholder="e.g. 07931 173699"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>
                                    <Mail className="w-3.5 h-3.5" /> Billing email
                                </label>
                                <input
                                    type="email"
                                    value={form.billingEmail}
                                    onChange={set('billingEmail')}
                                    placeholder="e.g. billing@centre.co.uk"
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Error / Success */}
                {error && (
                    <div className="p-3 rounded-md bg-danger-soft border border-danger/20 flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                        <p className="text-small-body text-danger font-medium">{error}</p>
                    </div>
                )}

                {saved && (
                    <div className="p-3 rounded-md bg-success-soft border border-success/20 flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        <p className="text-small-body text-success font-medium">Billing settings saved — all new PDFs will use these details.</p>
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                        ) : saved ? (
                            <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save billing settings</>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
