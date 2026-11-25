/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ChevronLeft, Building2, Calendar, CreditCard, Plus, Trash2, Save, AlertTriangle, Loader2, CheckCircle2, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { updateCentreAction } from './actions';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';

interface SessionSlot {
    name: string;
    startTime: string;
    endTime: string;
    price: number;
    capacity: number;
    daysActive: string[];
}

interface CentreFormValues {
    name: string;
    address: string;
    ofstedId: string;
    managerName: string;
    billingPhone: string;
    billingEmail: string;
    sessionSlots: SessionSlot[];
    // Billing
    bankName: string;
    sortCode: string;
    accountNo: string;
    feeSelfFinance: number | null;
    feeAssistedFinance: number | null;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const DEFAULT_SESSION_SLOTS: SessionSlot[] = [
    { name: 'Breakfast Club', startTime: '07:30', endTime: '09:00', price: 5, capacity: 30, daysActive: WEEKDAYS },
    { name: 'After School', startTime: '15:30', endTime: '18:00', price: 12, capacity: 30, daysActive: WEEKDAYS },
];

const inputCls = 'w-full h-11 px-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface';

function parseSessionSlots(raw: unknown): SessionSlot[] {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        logger.error('Failed to parse session slots', e);
        return [];
    }
}

function buildCentreFormValues(centre: any): CentreFormValues {
    const parsedSessions = parseSessionSlots(centre?.sessionSlots);
    return {
        name: centre?.name || '',
        address: centre?.address || '',
        ofstedId: centre?.ofstedId || '',
        managerName: centre?.managerName || '',
        billingPhone: centre?.billingPhone || '',
        billingEmail: centre?.billingEmail || '',
        sessionSlots: parsedSessions.length > 0 ? parsedSessions : DEFAULT_SESSION_SLOTS,
        bankName: centre?.bankName || '',
        sortCode: centre?.sortCode || '',
        accountNo: centre?.accountNo || '',
        feeSelfFinance: centre?.feeSelfFinance ?? null,
        feeAssistedFinance: centre?.feeAssistedFinance ?? null,
    };
}

function mapFriendlyCentreError(error: unknown): string {
    const raw = error instanceof Error ? error.message.trim() : '';
    if (!raw || raw === 'INTERNAL_SERVER_ERROR' || /^internal server error$/i.test(raw)) {
        return 'Unable to save centre settings right now. Please check your entries and try again.';
    }
    return raw;
}

export default function CentreSettingsClient({ centre, orgSlug = '' }: { centre: any; orgSlug?: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'general' | 'sessions' | 'billing'>('general');
    const [isSaving, setIsSaving] = useState(false);
    const [hasSavedDefaults, setHasSavedDefaults] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [origin, setOrigin] = useState('');
    const [copiedKey, setCopiedKey] = useState<'register' | 'book' | null>(null);
    const savingRef = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    const parsedSessions = parseSessionSlots(centre.sessionSlots);
    const hasUnsavedDefaults = (!centre.sessionSlots || parsedSessions.length === 0) && !hasSavedDefaults;

    const { register, control, handleSubmit, reset, formState: { isDirty } } = useForm<CentreFormValues>({
        mode: 'onChange',
        defaultValues: buildCentreFormValues(centre),
    });

    const syncFromCentre = useCallback(() => {
        reset(buildCentreFormValues(centre));
        setHasSavedDefaults(false);
        setFeedback(null);
    }, [centre, reset]);

    useEffect(() => {
        syncFromCentre();
    }, [centre.id, syncFromCentre]);

    const handleCopyLink = async (url: string, key: 'register' | 'book') => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedKey(key);
            toast('Link copied', 'Public centre link copied to clipboard.', 'success');
            setTimeout(() => setCopiedKey(null), 2000);
        } catch {
            toast('Copy failed', 'Could not copy link automatically.', 'error');
        }
    };

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'sessionSlots'
    });

    const onSubmit = async (data: CentreFormValues) => {
        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);
        setFeedback(null);
        try {
            await updateCentreAction(centre.id, data);
            setHasSavedDefaults(true);
            reset(data);
            setFeedback({ type: 'success', message: 'Centre settings saved successfully.' });
            toast('Centre settings saved', 'Your changes have been saved.', 'success');
            router.refresh();
        } catch (error) {
            logger.error('Failed to update centre', error);
            const message = mapFriendlyCentreError(error);
            setFeedback({ type: 'error', message });
            toast('Failed to save settings', message, 'error');
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    };

    const registerUrl = `${origin}/register/${orgSlug}/${centre.slug}`;
    const bookingUrl = `${origin}/book/${orgSlug}/${centre.slug}`;

    return (
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} className="max-w-4xl mx-auto pb-36 lg:pb-24 space-y-5">
            {/* Header & Tabs */}
            <Link
                href="/dashboard/centres"
                className="min-h-[44px] inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to centres
            </Link>

            <div>
                <h1 className="text-page-title text-text">{centre.name}</h1>
                <p className="text-small-body text-text-secondary mt-1">Centre settings</p>
            </div>

            {feedback && (
                <div
                    role={feedback.type === 'error' ? 'alert' : 'status'}
                    className={`rounded-md px-4 py-3 text-small-body font-medium flex items-center gap-2.5 border ${
                        feedback.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-700/25 text-emerald-900 dark:text-emerald-300'
                            : 'bg-danger-soft border-danger/20 text-danger'
                    }`}
                >
                    {feedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                </div>
            )}

            <div className="flex bg-page p-1 rounded-md w-full sm:w-fit border border-border-subtle" role="tablist" aria-label="Centre settings sections">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'general'}
                    onClick={() => setActiveTab('general')}
                    className={`min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-1.5 rounded-sm text-xs sm:text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    <Building2 className="w-3.5 h-3.5" /> General
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'sessions'}
                    onClick={() => setActiveTab('sessions')}
                    className={`min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-1.5 rounded-sm text-xs sm:text-sm font-medium transition-colors ${activeTab === 'sessions' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    <Calendar className="w-3.5 h-3.5" /> Sessions
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'billing'}
                    onClick={() => setActiveTab('billing')}
                    className={`min-h-[44px] flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-1.5 rounded-sm text-xs sm:text-sm font-medium transition-colors ${activeTab === 'billing' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    <CreditCard className="w-3.5 h-3.5" /> Billing
                </button>
            </div>

            {orgSlug && centre.slug && (
                <Card>
                    <div className="p-5 sm:p-6 space-y-4">
                        <div>
                            <h2 className="text-card-heading text-text">Direct Centre Links (Share with Parents)</h2>
                            <p className="text-small-body text-text-secondary mt-1">
                                Share these direct links with parents so their registration or assessment booking goes straight to {centre.name}.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-md border border-border-subtle bg-page space-y-2.5">
                                <p className="text-label text-text-muted">Centre Registration Link</p>
                                <p className="font-mono text-xs text-text break-all bg-surface px-3 py-2 rounded-sm border border-border">
                                    {registerUrl}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopyLink(registerUrl, 'register')}
                                    >
                                        {copiedKey === 'register' ? (
                                            <><Check className="w-3.5 h-3.5 text-success" /> Copied</>
                                        ) : (
                                            <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                                        )}
                                    </Button>
                                    <Link
                                        href={`/register/${orgSlug}/${centre.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-surface text-xs font-medium text-text hover:border-accent transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" /> Open
                                    </Link>
                                </div>
                            </div>

                            <div className="p-4 rounded-md border border-border-subtle bg-page space-y-2.5">
                                <p className="text-label text-text-muted">Centre Assessment / Booking Link</p>
                                <p className="font-mono text-xs text-text break-all bg-surface px-3 py-2 rounded-sm border border-border">
                                    {bookingUrl}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopyLink(bookingUrl, 'book')}
                                    >
                                        {copiedKey === 'book' ? (
                                            <><Check className="w-3.5 h-3.5 text-success" /> Copied</>
                                        ) : (
                                            <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                                        )}
                                    </Button>
                                    <Link
                                        href={`/book/${orgSlug}/${centre.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border bg-surface text-xs font-medium text-text hover:border-accent transition-colors"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" /> Open
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Tab Content */}
            <Card>
                <div className="p-5 sm:p-6">

                    {/* GENERAL TAB */}
                    <div className={activeTab === 'general' ? 'space-y-5 max-w-2xl' : 'hidden'}>
                        <h2 className="text-card-heading text-text">Identity &amp; compliance</h2>
                        <div>
                            <label htmlFor="centre-name" className="block text-label text-text-muted mb-1.5">Centre name</label>
                            <input
                                id="centre-name"
                                {...register('name', { required: true })}
                                className={inputCls}
                                placeholder="e.g. Dagenham After School Club"
                            />
                        </div>
                        <div>
                            <label htmlFor="centre-address" className="block text-label text-text-muted mb-1.5">Full address (shown on centre receipts &amp; invoices)</label>
                            <textarea
                                id="centre-address"
                                {...register('address')}
                                rows={3}
                                className={`${inputCls} h-auto py-2`}
                                placeholder="Enter physical location…"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="centre-manager-name" className="block text-label text-text-muted mb-1.5">Centre manager name</label>
                                <input
                                    id="centre-manager-name"
                                    {...register('managerName')}
                                    className={inputCls}
                                    placeholder="e.g. Margaret Ampadu"
                                />
                            </div>
                            <div>
                                <label htmlFor="centre-ofsted-id" className="block text-label text-text-muted mb-1.5">Ofsted registration ID</label>
                                <input
                                    id="centre-ofsted-id"
                                    {...register('ofstedId')}
                                    className={`${inputCls} font-mono`}
                                    placeholder="e.g. EY123456"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="centre-billing-phone" className="block text-label text-text-muted mb-1.5">Centre phone (receipts &amp; invoices)</label>
                                <input
                                    id="centre-billing-phone"
                                    type="tel"
                                    {...register('billingPhone')}
                                    className={inputCls}
                                    placeholder="e.g. 07456 490797"
                                />
                            </div>
                            <div>
                                <label htmlFor="centre-billing-email" className="block text-label text-text-muted mb-1.5">Centre email (receipts &amp; invoices)</label>
                                <input
                                    id="centre-billing-email"
                                    type="email"
                                    {...register('billingEmail')}
                                    className={inputCls}
                                    placeholder="e.g. dagenham@yourclub.co.uk"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SESSIONS TAB */}
                    <div className={activeTab === 'sessions' ? 'space-y-5' : 'hidden'}>
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <h2 className="text-card-heading text-text">Session builder</h2>
                                <p className="text-small-body text-text-secondary mt-1">Configure bookable session time blocks, pricing, and capacity.</p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => append({ name: 'New Session', startTime: '12:00', endTime: '13:00', price: 10, capacity: 30, daysActive: WEEKDAYS })}
                            >
                                <Plus className="w-3.5 h-3.5" /> Add session
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {fields.map((field, index) => (
                                <div key={field.id} className="p-4 rounded-md border border-border-subtle bg-page">
                                    {/* Times — own row; flex-wrap + flexible width avoids 360px overflow */}
                                    <div className="flex flex-wrap items-center gap-2 mb-4">
                                        <div className="flex-1 min-w-[7.5rem] sm:flex-none sm:w-36">
                                            <label htmlFor={`session-start-${index}`} className="block text-label text-text-muted mb-1">Start</label>
                                            <input
                                                id={`session-start-${index}`}
                                                type="time"
                                                {...register(`sessionSlots.${index}.startTime` as const, { required: true })}
                                                className={`${inputCls} font-mono`}
                                            />
                                        </div>
                                        <span className="text-text-muted mt-4" aria-hidden="true">–</span>
                                        <div className="flex-1 min-w-[7.5rem] sm:flex-none sm:w-36">
                                            <label htmlFor={`session-end-${index}`} className="block text-label text-text-muted mb-1">End</label>
                                            <input
                                                id={`session-end-${index}`}
                                                type="time"
                                                {...register(`sessionSlots.${index}.endTime` as const, { required: true })}
                                                className={`${inputCls} font-mono`}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        {/* Details */}
                                        <div className="md:col-span-6">
                                            <label htmlFor={`session-name-${index}`} className="block text-label text-text-muted mb-1">Session name</label>
                                            <input
                                                id={`session-name-${index}`}
                                                {...register(`sessionSlots.${index}.name` as const, { required: true })}
                                                className={inputCls}
                                                placeholder="e.g. Breakfast Club"
                                            />
                                        </div>

                                        {/* Price & Capacity */}
                                        <div className="md:col-span-2">
                                            <label htmlFor={`session-price-${index}`} className="block text-label text-text-muted mb-1">Price (£)</label>
                                            <input
                                                id={`session-price-${index}`}
                                                type="number"
                                                step="0.01"
                                                {...register(`sessionSlots.${index}.price` as const, { required: true, valueAsNumber: true })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label htmlFor={`session-capacity-${index}`} className="block text-label text-text-muted mb-1">Capacity</label>
                                            <input
                                                id={`session-capacity-${index}`}
                                                type="number"
                                                {...register(`sessionSlots.${index}.capacity` as const, { required: true, valueAsNumber: true })}
                                                className={inputCls}
                                            />
                                        </div>

                                        {/* Delete */}
                                        <div className="md:col-span-2 flex items-end justify-end pb-0.5">
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-1.5 text-text-muted hover:text-danger hover:bg-danger-soft rounded-sm transition-colors"
                                                aria-label={`Delete session ${index + 1}`}
                                                title="Delete session"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Days */}
                                    <div className="mt-4 pt-4 border-t border-border-subtle">
                                        <p className="block text-label text-text-muted mb-2">Active days</p>
                                        <div className="flex flex-wrap gap-2">
                                            {WEEKDAYS.map(day => (
                                                <label key={day} className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-sm cursor-pointer hover:border-accent transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        value={day}
                                                        {...register(`sessionSlots.${index}.daysActive` as const)}
                                                        className="w-3.5 h-3.5 accent-accent"
                                                    />
                                                    <span className="text-xs font-medium text-text">{day}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {fields.length === 0 && (
                                <div className="text-center py-10 bg-page rounded-md border border-dashed border-border-subtle">
                                    <p className="text-small-body text-text-secondary">No sessions configured.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* BILLING TAB */}
                    <div className={activeTab === 'billing' ? 'space-y-5 max-w-2xl' : 'hidden'}>
                        <h2 className="text-card-heading text-text">Financial configuration</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="fee-self-finance" className="block text-label text-text-muted mb-1.5">Self-finance fee (£)</label>
                                <input
                                    id="fee-self-finance"
                                    type="number"
                                    step="0.01"
                                    {...register('feeSelfFinance', { valueAsNumber: true })}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label htmlFor="fee-assisted-finance" className="block text-label text-text-muted mb-1.5">Assisted finance fee (£)</label>
                                <input
                                    id="fee-assisted-finance"
                                    type="number"
                                    step="0.01"
                                    {...register('feeAssistedFinance', { valueAsNumber: true })}
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border-subtle">
                            <h3 className="text-small-body font-medium text-text mb-3">Bank details</h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="centre-bank-name" className="block text-label text-text-muted mb-1.5">Bank name</label>
                                    <input
                                        id="centre-bank-name"
                                        {...register('bankName')}
                                        className={inputCls}
                                        placeholder="e.g. Barclays"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="centre-sort-code" className="block text-label text-text-muted mb-1.5">Sort code</label>
                                        <input
                                            id="centre-sort-code"
                                            {...register('sortCode')}
                                            className={inputCls}
                                            placeholder="12-34-56"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="centre-account-no" className="block text-label text-text-muted mb-1.5">Account number</label>
                                        <input
                                            id="centre-account-no"
                                            {...register('accountNo')}
                                            className={inputCls}
                                            placeholder="12345678"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Sticky action bar — clears MobileBottomNav (<lg) */}
            {(isDirty || hasUnsavedDefaults) && (
                <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] max-w-4xl bg-surface border border-border shadow-[var(--shadow-popover)] rounded-lg p-4 flex items-center justify-between z-40 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                            <p className="text-small-body font-medium text-text">
                                {isDirty ? 'Unsaved changes' : 'Default sessions ready to save'}
                            </p>
                            <p className="text-metadata">
                                {isDirty ? "Don't forget to save your edits." : 'Save to persist the default session schedule for this centre.'}
                            </p>
                        </div>
                    </div>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                        ) : (
                            <><Save className="w-4 h-4" /> Save changes</>
                        )}
                    </Button>
                </div>
            )}
        </form>
    );
}
