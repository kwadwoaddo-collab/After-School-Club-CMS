'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    CreditCard,
    History,
    ChevronRight,
    Mail,
    Phone,
    MapPin,
    Baby,
    AlertCircle,
    Edit2,
    Loader2,
    Check,
    X,
    LayoutGrid,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui/utils';
import { InvoiceTable } from '@/features/finance/components/FinanceDashboardClient';
import { useToast } from '@/components/ui/ToastProvider';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

interface ParentProfileClientProps {
    parent: any;
    invoices: unknown[];
    stats: {
        totalOwed: number;
        totalPaid: number;
        outstanding: number;
    };
    isOwner?: boolean;
}

type TabId = 'overview' | 'finance';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'finance', label: 'Finance / Ledger', icon: CreditCard },
];

function SubPanel({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('rounded-md border border-border-subtle bg-page p-4', className)}>{children}</div>;
}

export default function ParentProfileClient({ parent, invoices, stats, isOwner }: ParentProfileClientProps) {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const router = useRouter();
    const { toast } = useToast();
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [isSavingContact, setIsSavingContact] = useState(false);
    const [contactForm, setContactForm] = useState({
        firstName: parent.firstName ?? '',
        lastName: parent.lastName ?? '',
        email: parent.email ?? '',
        phone: parent.phone ?? '',
        addressLine1: parent.addressLine1 ?? '',
        city: parent.city ?? '',
        postcode: parent.postcode ?? '',
    });

    const handleSaveContact = async () => {
        setIsSavingContact(true);
        try {
            const res = await fetch(`/api/parents/${parent.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: contactForm.firstName || undefined,
                    lastName: contactForm.lastName || undefined,
                    email: contactForm.email || null,
                    phone: contactForm.phone || null,
                    addressLine1: contactForm.addressLine1 || null,
                    city: contactForm.city || null,
                    postcode: contactForm.postcode || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update');
            setIsEditingContact(false);
            toast({ title: 'Contact updated', message: 'Parent details saved successfully.', variant: 'success' });
            router.refresh();
        } catch (err) {
            toast({ title: 'Update failed', message: (err instanceof Error ? err.message : String(err)) || 'Please try again.', variant: 'error' });
        } finally {
            setIsSavingContact(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex border-b border-border gap-1">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-2.5 text-small-body font-medium border-b-2 -mb-px transition-colors',
                            activeTab === id
                                ? 'border-accent text-text'
                                : 'border-transparent text-text-muted hover:text-text'
                        )}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>

            {/* ── Tab panels ──────────────────────────────────────────────── */}
            <Card>
                <div className="p-5 sm:p-6">

                {/* Overview tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Left column — contact + children */}
                        <div className="lg:col-span-2 space-y-4">

                            {/* Contact details (editable) */}
                            <SubPanel>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-label text-text-muted">Contact details</p>
                                    {!isEditingContact ? (
                                        <button
                                            onClick={() => setIsEditingContact(true)}
                                            className="inline-flex items-center gap-1 text-metadata font-medium text-accent hover:text-accent-hover transition-colors"
                                        >
                                            <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setIsEditingContact(false)}
                                                className="inline-flex items-center gap-1 text-metadata font-medium text-text-muted hover:text-text transition-colors"
                                            >
                                                <X className="w-3 h-3" /> Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveContact}
                                                disabled={isSavingContact}
                                                className="inline-flex items-center gap-1 text-metadata font-medium text-success hover:opacity-80 transition-colors disabled:opacity-50"
                                            >
                                                {isSavingContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                Save
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {isEditingContact ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">First name</label>
                                                <input
                                                    type="text"
                                                    value={contactForm.firstName}
                                                    onChange={e => setContactForm(f => ({ ...f, firstName: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">Last name</label>
                                                <input
                                                    type="text"
                                                    value={contactForm.lastName}
                                                    onChange={e => setContactForm(f => ({ ...f, lastName: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    value={contactForm.email}
                                                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">Phone</label>
                                                <input
                                                    type="tel"
                                                    value={contactForm.phone}
                                                    onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-label text-text-muted block mb-1">Address</label>
                                            <input
                                                type="text"
                                                value={contactForm.addressLine1}
                                                onChange={e => setContactForm(f => ({ ...f, addressLine1: e.target.value }))}
                                                placeholder="Street address"
                                                className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">City</label>
                                                <input
                                                    type="text"
                                                    value={contactForm.city}
                                                    onChange={e => setContactForm(f => ({ ...f, city: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-label text-text-muted block mb-1">Postcode</label>
                                                <input
                                                    type="text"
                                                    value={contactForm.postcode}
                                                    onChange={e => setContactForm(f => ({ ...f, postcode: e.target.value }))}
                                                    className="w-full h-9 px-3 bg-surface border border-border rounded-sm text-small-body font-medium text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // Stacked label-above-value rows (not a justify-between row) —
                                    // matches StudentProfile's InfoRow pattern. A justify-between
                                    // row was tried here first but collided a long email address
                                    // against its label at 375px; stacking is robust at any width
                                    // and reuses the pattern Students already established.
                                    <div className="space-y-0">
                                        <div className="flex items-start gap-3 py-3 border-b border-border-subtle">
                                            <Mail className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-label text-text-muted">Email</p>
                                                <p className="text-small-body font-medium text-text mt-0.5 break-words">{parent.email || 'Not provided'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 py-3 border-b border-border-subtle">
                                            <Phone className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-label text-text-muted">Phone</p>
                                                <p className="text-small-body font-medium text-text mt-0.5">{parent.phone || 'Not provided'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 py-3">
                                            <MapPin className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-label text-text-muted">Billing address</p>
                                                <p className="text-small-body font-medium text-text mt-0.5 break-words">
                                                    {parent.addressLine1 ? `${parent.addressLine1}, ${parent.city || ''} ${parent.postcode || ''}` : 'No address on file'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </SubPanel>

                            {/* Associated children */}
                            <div>
                                <p className="text-label text-text-muted mb-2">Associated children</p>
                                {parent.children && parent.children.length > 0 ? (
                                    <SubPanel className="p-0 divide-y divide-border-subtle overflow-hidden">
                                        {parent.children.map((child: any) => (
                                            <Link
                                                key={child.id}
                                                href={`/dashboard/students/${child.id}`}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-success-soft text-success flex items-center justify-center flex-shrink-0">
                                                        <Baby className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-small-body font-medium text-text">{child.firstName} {child.lastName}</p>
                                                        <p className="text-metadata">{child.schoolYear ? `Year ${child.schoolYear}` : 'Year not set'}</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                                            </Link>
                                        ))}
                                    </SubPanel>
                                ) : (
                                    <EmptyState
                                        icon={<Baby className="w-6 h-6" />}
                                        title="No children linked yet"
                                        description="Children appear here once they're registered or added under this family."
                                        className="m-0 py-8"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Right column — financial summary */}
                        <div className="space-y-4">
                            <SubPanel className="text-center">
                                <p className="text-label text-text-muted mb-2">Current balance</p>
                                <p className={cn('text-page-title', stats.outstanding > 0 ? 'text-danger' : 'text-success')}>
                                    £{stats.outstanding.toFixed(2)}
                                </p>
                                <p className="text-metadata mt-1 mb-4">Outstanding amount</p>
                                <button
                                    onClick={() => setActiveTab('finance')}
                                    className="w-full py-2 px-3 bg-accent text-white rounded-sm text-small-body font-medium hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-1.5"
                                >
                                    View full ledger <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </SubPanel>

                            <SubPanel className="space-y-0">
                                <div className="flex items-center justify-between py-2 border-b border-border-subtle">
                                    <span className="text-metadata">Total invoiced</span>
                                    <span className="text-small-body font-medium text-text">£{stats.totalOwed.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-metadata">Total paid</span>
                                    <span className="text-small-body font-medium text-success">£{stats.totalPaid.toFixed(2)}</span>
                                </div>
                            </SubPanel>
                        </div>
                    </div>
                )}

                {/* Finance / Ledger tab */}
                {activeTab === 'finance' && (
                    <div className="space-y-4">
                        {/* Stats strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <SubPanel className="flex items-center justify-between">
                                <div>
                                    <p className="text-label text-text-muted">Total family billing</p>
                                    <p className="text-financial-total text-text mt-0.5">£{stats.totalOwed.toFixed(2)}</p>
                                </div>
                                <CreditCard className="w-6 h-6 text-text-muted" />
                            </SubPanel>
                            <SubPanel className="flex items-center justify-between">
                                <div>
                                    <p className="text-label text-text-muted">Paid to date</p>
                                    <p className="text-financial-total text-success mt-0.5">£{stats.totalPaid.toFixed(2)}</p>
                                </div>
                                <History className="w-6 h-6 text-success" />
                            </SubPanel>
                            <div className={cn(
                                'rounded-md border p-4 flex items-center justify-between',
                                stats.outstanding > 0 ? 'bg-danger-soft border-danger/30' : 'bg-success-soft border-success/30'
                            )}>
                                <div>
                                    <p className={cn('text-label', stats.outstanding > 0 ? 'text-danger' : 'text-success')}>Amount due</p>
                                    <p className={cn('text-financial-total mt-0.5', stats.outstanding > 0 ? 'text-danger' : 'text-success')}>£{stats.outstanding.toFixed(2)}</p>
                                </div>
                                <AlertCircle className={cn('w-6 h-6', stats.outstanding > 0 ? 'text-danger' : 'text-success')} />
                            </div>
                        </div>

                        {/* Full ledger table */}
                        <div className="rounded-md border border-border-subtle overflow-hidden">
                            <div className="px-4 py-3 border-b border-border-subtle bg-page">
                                <p className="text-label text-text-muted">Transaction history</p>
                                <p className="text-metadata mt-0.5">Consolidated family invoices and payments</p>
                            </div>
                            <InvoiceTable invoices={invoices} isOwner={isOwner} />
                        </div>
                    </div>
                )}
                </div>
            </Card>
        </div>
    );
}
