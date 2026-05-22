'use client';

import { useState, useEffect } from 'react';
import { 
    X, 
    Search, 
    Plus, 
    Trash2, 
    Calendar, 
    UserPlus, 
    ChevronRight, 
    ArrowLeft,
    Check,
    Contact,
    Baby,
    Receipt,
    Loader2,
    Clock
} from 'lucide-react';
import { getParents, getChildrenByParent, createInvoice, createLegacyFamilyAndInvoice } from '../actions';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

interface CreateInvoiceModalProps {
    centres: any[];
    onClose: () => void;
}

type Step = 'select-parent' | 'legacy-onboarding' | 'invoice-details';

export default function CreateInvoiceModal({ centres, onClose }: CreateInvoiceModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('select-parent');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Parent Selection State
    const [parentSearch, setParentSearch] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedParent, setSelectedParent] = useState<any>(null);
    const [targetChildId, setTargetChildId] = useState<string | null>(null);
    const [availableChildren, setAvailableChildren] = useState<any[]>([]);
    const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);

    // Legacy Onboarding State
    const [legacyParent, setLegacyParent] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });
    const [legacyChildren, setLegacyChildren] = useState<any[]>([
        { firstName: '', lastName: '', schoolYear: '' }
    ]);

    // Invoice Details State
    const [invoiceData, setInvoiceData] = useState({
        amount: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        billingPeriodStart: '',
        billingPeriodEnd: '',
        notes: '',
        centreId: centres[0]?.id || ''
    });

    // Search parents effect
    useEffect(() => {
        if (parentSearch.length < 2) {
            setSearchResults([]);
            return;
        }

        const debounce = setTimeout(async () => {
            setIsLoading(true);
            try {
                const parents = await getParents(parentSearch);
                setSearchResults(parents);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounce);
    }, [parentSearch]);

    // Selected Parent change effect
    useEffect(() => {
        if (selectedParent) {
            fetchChildren(selectedParent.id, targetChildId);
        }
    }, [selectedParent]);

    const fetchChildren = async (parentId: string, targetId: string | null = null) => {
        setIsLoading(true);
        try {
            const children = await getChildrenByParent(parentId);
            setAvailableChildren(children);
            
            if (targetId) {
                setSelectedChildIds([targetId]);
                const c = children.find((ch: any) => ch.id === targetId);
                if (c?.centreId) {
                    setInvoiceData(prev => ({...prev, centreId: c.centreId}));
                }
            } else {
                setSelectedChildIds(children.map((c: any) => c.id));
                if (children[0]?.centreId) {
                    setInvoiceData(prev => ({...prev, centreId: children[0].centreId}));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectParent = (parent: any, childId: string | null = null) => {
        setSelectedParent(parent);
        setTargetChildId(childId);
        setStep('invoice-details');
    };

    const handleAddLegacyChild = () => {
        setLegacyChildren([...legacyChildren, { firstName: '', lastName: '', schoolYear: '' }]);
    };

    const handleRemoveLegacyChild = (index: number) => {
        if (legacyChildren.length === 1) return;
        setLegacyChildren(legacyChildren.filter((_, i) => i !== index));
    };

    const handleSaveInvoice = async () => {
        setIsSaving(true);
        try {
            if (step === 'invoice-details' && selectedParent) {
                // Existing Parent
                await createInvoice({
                    parentId: selectedParent.id,
                    childIds: selectedChildIds,
                    amount: invoiceData.amount,
                    invoiceDate: new Date(invoiceData.invoiceDate),
                    dueDate: new Date(invoiceData.dueDate),
                    billingPeriodStart: invoiceData.billingPeriodStart ? new Date(invoiceData.billingPeriodStart) : undefined,
                    billingPeriodEnd: invoiceData.billingPeriodEnd ? new Date(invoiceData.billingPeriodEnd) : undefined,
                    notes: invoiceData.notes,
                    centreId: invoiceData.centreId
                });
                toast.success('Invoice created successfully');
            } else if (step === 'legacy-onboarding') {
                // New Family + Invoice
                await createLegacyFamilyAndInvoice({
                    parent: legacyParent,
                    children: legacyChildren,
                    invoice: {
                        amount: invoiceData.amount,
                        invoiceDate: new Date(invoiceData.invoiceDate),
                        dueDate: new Date(invoiceData.dueDate),
                        billingPeriodStart: invoiceData.billingPeriodStart ? new Date(invoiceData.billingPeriodStart) : undefined,
                        billingPeriodEnd: invoiceData.billingPeriodEnd ? new Date(invoiceData.billingPeriodEnd) : undefined,
                        notes: invoiceData.notes,
                        centreId: invoiceData.centreId
                    }
                });
                toast.success('Family onboarded and invoice created');
            }
            router.refresh();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('Failed to create invoice');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-surface-container-high border border-outline-variant/10 rounded-[48px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant hover:text-white hover:bg-white/10 transition-all z-10">
                    <X className="w-5 h-5" />
                </button>

                {/* Progress Header */}
                <div className="p-10 pb-6 border-b border-outline-variant/5 ring-1 ring-white/5 bg-surface-container-low/50">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <Receipt className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-tight">Generate Invoice</h2>
                            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                                {step === 'select-parent' && 'Step 1: Parent Selection'}
                                {step === 'legacy-onboarding' && 'Legacy Onboarding'}
                                {step === 'invoice-details' && 'Step 2: Billing Details'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
                    
                    {step === 'select-parent' && (
                        <div className="space-y-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Search by Child Name or Parent Name..."
                                    value={parentSearch}
                                    onChange={(e) => setParentSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                                {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
                            </div>

                            <div className="space-y-2">
                                {searchResults.map(parent => (
                                    <div key={parent.id} className="space-y-2">
                                        <button 
                                            onClick={() => handleSelectParent(parent)}
                                            className="w-full flex items-center justify-between p-4 bg-white/5 border border-outline-variant/5 rounded-2xl hover:bg-primary/10 hover:border-primary/30 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center font-bold text-primary">
                                                    {parent.firstName[0]}{parent.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white">
                                                        {parent.firstName} {parent.lastName}
                                                        <span className="text-[10px] text-primary/70 font-black ml-2 uppercase tracking-widest">(Parent)</span>
                                                    </p>
                                                    <p className="text-xs text-on-surface-variant line-clamp-1">{parent.email || 'No email'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-all" />
                                        </button>
                                        
                                        {parent.children?.map((child: any) => (
                                            <button
                                                key={child.id}
                                                onClick={() => handleSelectParent(parent, child.id)}
                                                className="ml-8 w-[calc(100%-2rem)] flex items-center justify-between p-3 bg-surface-container-high border border-outline-variant/5 rounded-xl hover:bg-primary/5 hover:border-primary/20 transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant border border-outline-variant/10">
                                                        <Baby className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-sm">{child.firstName} {child.lastName}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-black tracking-widest text-primary/70 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">Select Child for Invoice</span>
                                                    <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-all" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                                {parentSearch.length >= 2 && searchResults.length === 0 && !isLoading && (
                                    <div className="text-center py-8 bg-white/5 rounded-2xl border border-dashed border-outline-variant/20">
                                        <p className="text-sm font-bold text-on-surface-variant">No existing parents found.</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-outline-variant/5">
                                <button 
                                    onClick={() => setStep('legacy-onboarding')}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-surface-container-low border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest text-xs hover:bg-primary/5 transition-all"
                                >
                                    <UserPlus className="w-4 h-4" /> Create New Family
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'legacy-onboarding' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => setStep('select-parent')} className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
                                <ArrowLeft className="w-4 h-4" /> Back to Search
                            </button>

                            {/* Legacy Parent Form */}
                            <div className="bg-white/5 rounded-3xl p-6 border border-outline-variant/5 space-y-4">
                                <h3 className="flex items-center gap-2 text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">
                                    <Contact className="w-4 h-4" /> Parent Details
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">First Name</label>
                                        <input 
                                            type="text"
                                            value={legacyParent.firstName}
                                            onChange={(e) => setLegacyParent({...legacyParent, firstName: e.target.value})}
                                            className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl text-white font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Last Name</label>
                                        <input 
                                            type="text"
                                            value={legacyParent.lastName}
                                            onChange={(e) => setLegacyParent({...legacyParent, lastName: e.target.value})}
                                            className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl text-white font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Email</label>
                                        <input 
                                            type="email"
                                            value={legacyParent.email}
                                            onChange={(e) => setLegacyParent({...legacyParent, email: e.target.value})}
                                            className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl text-white font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Phone</label>
                                        <input 
                                            type="text"
                                            value={legacyParent.phone}
                                            onChange={(e) => setLegacyParent({...legacyParent, phone: e.target.value})}
                                            className="w-full p-3 bg-surface-container-low border border-outline-variant/10 rounded-xl text-white font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Legacy Children Form */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="flex items-center gap-2 text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">
                                        <Baby className="w-4 h-4" /> Children
                                    </h3>
                                    <button onClick={handleAddLegacyChild} className="text-xs font-black text-primary hover:text-blue-400 flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Add Sibling
                                    </button>
                                </div>
                                {legacyChildren.map((child, idx) => (
                                    <div key={idx} className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6 relative group/child">
                                        {legacyChildren.length > 1 && (
                                            <button onClick={() => handleRemoveLegacyChild(idx)} className="absolute top-4 right-4 text-error opacity-0 group-hover/child:opacity-100 transition-opacity p-2 hover:bg-error/10 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">First Name</label>
                                                <input 
                                                    type="text"
                                                    value={child.firstName}
                                                    onChange={(e) => {
                                                        const newC = [...legacyChildren];
                                                        newC[idx].firstName = e.target.value;
                                                        setLegacyChildren(newC);
                                                    }}
                                                    className="w-full p-3 bg-surface-container-high border border-outline-variant/5 rounded-xl text-white font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Last Name</label>
                                                <input 
                                                    type="text"
                                                    value={child.lastName}
                                                    onChange={(e) => {
                                                        const newC = [...legacyChildren];
                                                        newC[idx].lastName = e.target.value;
                                                        setLegacyChildren(newC);
                                                    }}
                                                    className="w-full p-3 bg-surface-container-high border border-outline-variant/5 rounded-xl text-white font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Year</label>
                                                <select 
                                                    value={child.schoolYear}
                                                    onChange={(e) => {
                                                        const newC = [...legacyChildren];
                                                        newC[idx].schoolYear = e.target.value;
                                                        setLegacyChildren(newC);
                                                    }}
                                                    className="w-full p-3 bg-surface-container-high border border-outline-variant/5 rounded-xl text-white font-bold"
                                                >
                                                    <option value="">Select year...</option>
                                                    <option value="Reception">Reception</option>
                                                    {Array.from({length: 13}, (_, i) => (
                                                        <option key={i+1} value={`Y${i+1}`}>Y{i+1}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Billing details within legacy onboarding */}
                            <div className="pt-8 border-t border-outline-variant/10">
                                <button 
                                    onClick={() => setStep('invoice-details')}
                                    disabled={!legacyParent.firstName || legacyChildren.some(c => !c.firstName)}
                                    className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all shadow-xl shadow-primary/20"
                                >
                                    Proceed to Billing
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'invoice-details' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => setStep(selectedParent ? 'select-parent' : 'legacy-onboarding')} className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>

                            {/* Sibling Detection for Existing Parent */}
                            {selectedParent && (
                                <div className="p-6 bg-white/5 border border-outline-variant/5 rounded-[32px] space-y-4">
                                    <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-widest">
                                        Select Children for this Invoice
                                    </h3>
                                    <div className="flex flex-wrap gap-3">
                                        {availableChildren.map(child => (
                                            <button 
                                                key={child.id}
                                                onClick={() => {
                                                    if (selectedChildIds.includes(child.id)) {
                                                        setSelectedChildIds(selectedChildIds.filter(id => id !== child.id));
                                                    } else {
                                                        setSelectedChildIds([...selectedChildIds, child.id]);
                                                        if (child.centreId) {
                                                            setInvoiceData(prev => ({...prev, centreId: child.centreId}));
                                                        }
                                                    }
                                                }}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-all ${
                                                    selectedChildIds.includes(child.id)
                                                    ? 'bg-primary/20 border-primary text-primary'
                                                    : 'bg-white/5 border-outline-variant/10 text-on-surface-variant'
                                                }`}
                                            >
                                                {selectedChildIds.includes(child.id) && <Check className="w-3 h-3" />}
                                                {child.firstName} {child.lastName}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Main Invoice Fields */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2 md:col-span-1 space-y-2">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Centre</label>
                                    <select 
                                        value={invoiceData.centreId}
                                        onChange={(e) => setInvoiceData({...invoiceData, centreId: e.target.value})}
                                        className="w-full p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-bold"
                                    >
                                        {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 md:col-span-1 space-y-2">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Amount (£)</label>
                                    <input 
                                        type="number"
                                        placeholder="0.00"
                                        value={invoiceData.amount}
                                        onChange={(e) => setInvoiceData({...invoiceData, amount: e.target.value})}
                                        className="w-full p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-black text-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Invoice Date</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.invoiceDate}
                                        onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                                        className="w-full p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Due Date</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.dueDate}
                                        onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                                        className="w-full p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-bold"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Period From</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.billingPeriodStart}
                                        onChange={(e) => setInvoiceData({...invoiceData, billingPeriodStart: e.target.value})}
                                        className="w-full p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Period To</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.billingPeriodEnd}
                                        onChange={(e) => setInvoiceData({...invoiceData, billingPeriodEnd: e.target.value})}
                                        className="w-full p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-medium"
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Notes / Description (Visible on PDF)</label>
                                    <textarea 
                                        rows={3}
                                        value={invoiceData.notes}
                                        onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                                        className="w-full p-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-white font-medium scrollbar-hide"
                                        placeholder="Enter any additional details..."
                                    />
                                </div>
                            </div>

                            {/* Action Row */}
                            <div className="pt-8 border-t border-outline-variant/5">
                                <button 
                                    onClick={handleSaveInvoice}
                                    disabled={!invoiceData.amount || isSaving || (selectedParent && selectedChildIds.length === 0)}
                                    className="w-full py-5 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-3xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-3"
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Generate & Record Invoice</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
