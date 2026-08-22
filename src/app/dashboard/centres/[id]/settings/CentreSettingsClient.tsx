/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Building2, Calendar, CreditCard, Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { updateCentreAction } from './actions';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

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

    const { register, control, handleSubmit, formState: { isDirty } } = useForm<CentreFormValues>({
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
            router.refresh();
        } catch (error) {
            logger.error('Failed to update centre', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="pb-24 animate-in fade-in duration-700">
            {/* Header & Tabs */}
            <div className="mb-8 space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/centres" className="p-2 bg-secondary rounded-full hover:bg-secondary/80 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black text-foreground tracking-tight">{centre.name}</h1>
                        <p className="text-sm font-medium text-muted-foreground mt-1">Centre Settings Hub</p>
                    </div>
                </div>

                <div className="flex bg-secondary/50 p-1 rounded-2xl w-fit">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'general' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Building2 className="w-4 h-4" /> General
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('sessions')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'sessions' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Calendar className="w-4 h-4" /> Sessions
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('billing')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'billing' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <CreditCard className="w-4 h-4" /> Billing
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm">
                
                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="space-y-6 max-w-2xl">
                        <div>
                            <h2 className="text-lg font-black text-foreground mb-4">Identity & Compliance</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Centre Name</label>
                                    <input
                                        {...register('name', { required: true })}
                                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        placeholder="e.g. Sydenham Primary School"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Full Address</label>
                                    <textarea
                                        {...register('address')}
                                        rows={3}
                                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                                        placeholder="Enter physical location..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Ofsted Registration ID</label>
                                    <input
                                        {...register('ofstedId')}
                                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        placeholder="e.g. EY123456"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* SESSIONS TAB */}
                {activeTab === 'sessions' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-black text-foreground">Session Builder</h2>
                                <p className="text-sm text-muted-foreground mt-1">Configure chronological time blocks and capacities.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => append({ name: 'New Session', startTime: '12:00', endTime: '13:00', price: 10, capacity: 30, daysActive: WEEKDAYS })}
                                className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-all active:scale-95"
                            >
                                <Plus className="w-4 h-4" /> Add Session
                            </button>
                        </div>

                        <div className="space-y-4">
                            {fields.map((field, index) => (
                                <div key={field.id} className="relative p-5 bg-secondary/30 border border-border rounded-2xl group hover:border-primary/30 transition-colors">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                        
                                        {/* Times */}
                                        <div className="md:col-span-3 flex items-center gap-2">
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Start</label>
                                                <input
                                                    type="time"
                                                    {...register(`sessionSlots.${index}.startTime` as const, { required: true })}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                />
                                            </div>
                                            <span className="text-muted-foreground mt-4">-</span>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">End</label>
                                                <input
                                                    type="time"
                                                    {...register(`sessionSlots.${index}.endTime` as const, { required: true })}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                />
                                            </div>
                                        </div>

                                        {/* Details */}
                                        <div className="md:col-span-4">
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Session Name</label>
                                            <input
                                                {...register(`sessionSlots.${index}.name` as const, { required: true })}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                placeholder="e.g. Breakfast Club"
                                            />
                                        </div>
                                        
                                        {/* Price & Capacity */}
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Price (£)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                {...register(`sessionSlots.${index}.price` as const, { required: true, valueAsNumber: true })}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Capacity</label>
                                            <input
                                                type="number"
                                                {...register(`sessionSlots.${index}.capacity` as const, { required: true, valueAsNumber: true })}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            />
                                        </div>

                                        {/* Delete */}
                                        <div className="md:col-span-1 flex items-end justify-end pb-1">
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                title="Delete Session"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Days */}
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-2">Active Days</label>
                                        <div className="flex flex-wrap gap-2">
                                            {WEEKDAYS.map(day => (
                                                <label key={day} className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        value={day}
                                                        {...register(`sessionSlots.${index}.daysActive` as const)}
                                                        className="w-3.5 h-3.5 rounded text-primary focus:ring-primary/50"
                                                    />
                                                    <span className="text-xs font-bold text-foreground">{day}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {fields.length === 0 && (
                                <div className="text-center py-12 bg-secondary/20 rounded-2xl border border-dashed border-border">
                                    <p className="text-muted-foreground font-medium">No sessions configured.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* BILLING TAB */}
                {activeTab === 'billing' && (
                    <div className="space-y-6 max-w-2xl">
                        <div>
                            <h2 className="text-lg font-black text-foreground mb-4">Financial Configuration</h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Self-Finance Fee (£)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            {...register('feeSelfFinance', { valueAsNumber: true })}
                                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Assisted Finance Fee (£)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            {...register('feeAssistedFinance', { valueAsNumber: true })}
                                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        />
                                    </div>
                                </div>
                                <hr className="border-border my-6" />
                                <h3 className="text-sm font-bold text-foreground mb-4">Bank Details</h3>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Bank Name</label>
                                    <input
                                        {...register('bankName')}
                                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                        placeholder="e.g. Barclays"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Sort Code</label>
                                        <input
                                            {...register('sortCode')}
                                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                            placeholder="12-34-56"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Account Number</label>
                                        <input
                                            {...register('accountNo')}
                                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                            placeholder="12345678"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky Action Bar */}
            {isDirty && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-4 flex items-center gap-6 pr-6">
                        <div className="px-2">
                            <p className="text-sm font-bold text-foreground">Unsaved Changes</p>
                            <p className="text-xs text-muted-foreground">Don't forget to save your edits</p>
                        </div>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <span className="animate-pulse">Saving...</span>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
}
