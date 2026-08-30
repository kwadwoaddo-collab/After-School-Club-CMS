/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { ChevronLeft, Building2, Calendar, CreditCard, Plus, Trash2, Save, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { updateCentreAction } from './actions';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
    sessionSlots: SessionSlot[];
    // Billing
    bankName: string;
    sortCode: string;
    accountNo: string;
    feeSelfFinance: number | null;
    feeAssistedFinance: number | null;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const inputCls = 'w-full h-9 px-3 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface';

export default function CentreSettingsClient({ centre }: { centre: any }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'general' | 'sessions' | 'billing'>('general');
    const [isSaving, setIsSaving] = useState(false);

    let parsedSessions: SessionSlot[] = [];
    if (centre.sessionSlots) {
        try {
            parsedSessions = typeof centre.sessionSlots === 'string' ? JSON.parse(centre.sessionSlots) : centre.sessionSlots;
        } catch (e) {
            logger.error('Failed to parse session slots', e);
        }
    }

    const { register, control, handleSubmit, reset, formState: { isDirty } } = useForm<CentreFormValues>({
        mode: 'onChange',
        defaultValues: {
            name: centre.name || '',
            address: centre.address || '',
            ofstedId: centre.ofstedId || '',
            sessionSlots: parsedSessions.length > 0 ? parsedSessions : [
                { name: 'Breakfast Club', startTime: '07:30', endTime: '09:00', price: 5, capacity: 30, daysActive: WEEKDAYS },
                { name: 'After School', startTime: '15:30', endTime: '18:00', price: 12, capacity: 30, daysActive: WEEKDAYS }
            ],
            bankName: centre.bankName || '',
            sortCode: centre.sortCode || '',
            accountNo: centre.accountNo || '',
            feeSelfFinance: centre.feeSelfFinance || null,
            feeAssistedFinance: centre.feeAssistedFinance || null,
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'sessionSlots'
    });

    const onSubmit = async (data: CentreFormValues) => {
        setIsSaving(true);
        try {
            await updateCentreAction(centre.id, data);
            reset(data);
            router.refresh();
        } catch (error) {
            logger.error('Failed to update centre', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl mx-auto pb-24 space-y-5">
            {/* Header & Tabs */}
            <Link
                href="/dashboard/centres"
                className="inline-flex items-center gap-1.5 text-small-body font-medium text-text-secondary hover:text-text transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
                Back to centres
            </Link>

            <div>
                <h1 className="text-page-title text-text">{centre.name}</h1>
                <p className="text-small-body text-text-secondary mt-1">Centre settings</p>
            </div>

            <div className="flex bg-page p-1 rounded-md w-full sm:w-fit border border-border-subtle">
                <button
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-1.5 rounded-sm text-xs sm:text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    <Building2 className="w-3.5 h-3.5" /> General
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('sessions')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-1.5 rounded-sm text-xs sm:text-sm font-medium transition-colors ${activeTab === 'sessions' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    <Calendar className="w-3.5 h-3.5" /> Sessions
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 sm:px-5 py-1.5 rounded-sm text-xs sm:text-sm font-medium transition-colors ${activeTab === 'billing' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    <CreditCard className="w-3.5 h-3.5" /> Billing
                </button>
            </div>

            {/* Tab Content */}
            <Card>
                <div className="p-5 sm:p-6">

                    {/* GENERAL TAB */}
                    <div className={activeTab === 'general' ? 'space-y-5 max-w-2xl' : 'hidden'}>
                        <h2 className="text-card-heading text-text">Identity &amp; compliance</h2>
                        <div>
                            <label className="block text-label text-text-muted mb-1.5">Centre name</label>
                            <input
                                {...register('name', { required: true })}
                                className={inputCls}
                                placeholder="e.g. Sydenham Primary School"
                            />
                        </div>
                        <div>
                            <label className="block text-label text-text-muted mb-1.5">Full address</label>
                            <textarea
                                {...register('address')}
                                rows={3}
                                className={`${inputCls} h-auto py-2`}
                                placeholder="Enter physical location…"
                            />
                        </div>
                        <div>
                            <label className="block text-label text-text-muted mb-1.5">Ofsted registration ID</label>
                            <input
                                {...register('ofstedId')}
                                className={`${inputCls} font-mono`}
                                placeholder="e.g. EY123456"
                            />
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
                                    {/* Times — own row; native time inputs need real width for
                                        locale-formatted "HH:MM AM/PM" and were clipping when
                                        squeezed into the grid below alongside every other field. */}
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-36">
                                            <label className="block text-label text-text-muted mb-1">Start</label>
                                            <input
                                                type="time"
                                                {...register(`sessionSlots.${index}.startTime` as const, { required: true })}
                                                className={`${inputCls} font-mono`}
                                            />
                                        </div>
                                        <span className="text-text-muted mt-4">–</span>
                                        <div className="w-36">
                                            <label className="block text-label text-text-muted mb-1">End</label>
                                            <input
                                                type="time"
                                                {...register(`sessionSlots.${index}.endTime` as const, { required: true })}
                                                className={`${inputCls} font-mono`}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        {/* Details */}
                                        <div className="md:col-span-6">
                                            <label className="block text-label text-text-muted mb-1">Session name</label>
                                            <input
                                                {...register(`sessionSlots.${index}.name` as const, { required: true })}
                                                className={inputCls}
                                                placeholder="e.g. Breakfast Club"
                                            />
                                        </div>

                                        {/* Price & Capacity */}
                                        <div className="md:col-span-2">
                                            <label className="block text-label text-text-muted mb-1">Price (£)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                {...register(`sessionSlots.${index}.price` as const, { required: true, valueAsNumber: true })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-label text-text-muted mb-1">Capacity</label>
                                            <input
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
                                                className="p-1.5 text-text-muted hover:text-danger hover:bg-danger-soft rounded-sm transition-colors"
                                                title="Delete session"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Days */}
                                    <div className="mt-4 pt-4 border-t border-border-subtle">
                                        <label className="block text-label text-text-muted mb-2">Active days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {WEEKDAYS.map(day => (
                                                <label key={day} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-sm cursor-pointer hover:border-accent transition-colors">
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-label text-text-muted mb-1.5">Self-finance fee (£)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    {...register('feeSelfFinance', { valueAsNumber: true })}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className="block text-label text-text-muted mb-1.5">Assisted finance fee (£)</label>
                                <input
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
                                    <label className="block text-label text-text-muted mb-1.5">Bank name</label>
                                    <input
                                        {...register('bankName')}
                                        className={inputCls}
                                        placeholder="e.g. Barclays"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-label text-text-muted mb-1.5">Sort code</label>
                                        <input
                                            {...register('sortCode')}
                                            className={inputCls}
                                            placeholder="12-34-56"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-label text-text-muted mb-1.5">Account number</label>
                                        <input
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

            {/* Sticky action bar — mirrors StaffProfileForm's "Unsaved changes" bar */}
            {isDirty && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-surface border border-border shadow-[var(--shadow-popover)] rounded-lg p-4 flex items-center justify-between z-40 gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                            <p className="text-small-body font-medium text-text">Unsaved changes</p>
                            <p className="text-metadata">Don&apos;t forget to save your edits.</p>
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
