'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
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
import { getParents, getChildrenByParent, createInvoice, createLegacyFamilyAndInvoice, createAdHocInvoice } from '../actions';
import { useRouter } from 'next/navigation';

interface CreateInvoiceModalProps {
    centres: any[];
    onClose: () => void;
}

type Step = 'select-parent' | 'legacy-onboarding' | 'adhoc-invoice' | 'invoice-details';

export default function CreateInvoiceModal({ centres, onClose }: CreateInvoiceModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('select-parent');
    const { toast } = useToast();
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

    // Ad-Hoc Invoice State
    const [adhocChildName, setAdhocChildName] = useState('');
    const [adhocUseExistingParent, setAdhocUseExistingParent] = useState(true);
    const [adhocParentSearch, setAdhocParentSearch] = useState('');
    const [adhocParentResults, setAdhocParentResults] = useState<any[]>([]);
    const [adhocSelectedParent, setAdhocSelectedParent] = useState<any>(null);
    const [adhocNewParent, setAdhocNewParent] = useState({ firstName: '', lastName: '', email: '', phone: '' });

    // Invoice Details State
    const [invoiceData, setInvoiceData] = useState(() => ({
        amount: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        billingPeriodStart: '',
        billingPeriodEnd: '',
        notes: '',
        centreId: centres[0]?.id || ''
    }));

    // Search parents effect (main select-parent step)
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

    // Search parents effect (ad-hoc step)
    useEffect(() => {
        if (adhocParentSearch.length < 2) {
            setAdhocParentResults([]);
            return;
        }
        const debounce = setTimeout(async () => {
            try {
                const res = await getParents(adhocParentSearch);
                setAdhocParentResults(res);
            } catch { /* ignore */ }
        }, 300);
        return () => clearTimeout(debounce);
    }, [adhocParentSearch]);

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

    // Selected Parent change effect
    useEffect(() => {
        if (selectedParent) {
            fetchChildren(selectedParent.id, targetChildId);
        }
    }, [selectedParent, targetChildId]);

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
                toast({ title: 'Success', message: 'Invoice created successfully', variant: 'success' });
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
                toast({ title: 'Success', message: 'Family onboarded and invoice created', variant: 'success' });
            } else if (step === 'adhoc-invoice' || (step === 'invoice-details' && !selectedParent && adhocChildName)) {
                // Ad-Hoc Invoice — child not in system
                await createAdHocInvoice({
                    parentId: adhocUseExistingParent ? adhocSelectedParent?.id : undefined,
                    newParent: !adhocUseExistingParent ? adhocNewParent : undefined,
                    childName: adhocChildName,
                    amount: invoiceData.amount,
                    invoiceDate: new Date(invoiceData.invoiceDate),
                    dueDate: new Date(invoiceData.dueDate),
                    billingPeriodStart: invoiceData.billingPeriodStart ? new Date(invoiceData.billingPeriodStart) : undefined,
                    billingPeriodEnd: invoiceData.billingPeriodEnd ? new Date(invoiceData.billingPeriodEnd) : undefined,
                    notes: invoiceData.notes,
                    centreId: invoiceData.centreId
                });
                toast({ title: 'Success', message: 'Ad-hoc invoice created', variant: 'success' });
            }
            router.refresh();
            onClose();
        } catch (err) {
            console.error(err);
            toast({ title: 'Error', message: 'Failed to create invoice', variant: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-card border border-border rounded-[48px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative">
                
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all z-10">
                    <X className="w-5 h-5" />
                </button>

                {/* Progress Header */}
                <div className="p-10 pb-6 border-b border-border ring-1 ring-white/5 bg-secondary/40/50">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <Receipt className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-foreground tracking-tight">Generate Invoice</h2>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                {step === 'select-parent' && 'Step 1: Parent Selection'}
                                {step === 'legacy-onboarding' && 'Legacy Onboarding'}
                                {step === 'adhoc-invoice' && 'Ad-Hoc Invoice'}
                                {step === 'invoice-details' && 'Step 2: Billing Details'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
                    
                    {step === 'select-parent' && (
                        <div className="space-y-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Search by Child Name or Parent Name..."
                                    value={parentSearch}
                                    onChange={(e) => setParentSearch(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                                {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />}
                            </div>

                            <div className="space-y-2">
                                {searchResults.map(parent => (
                                    <div key={parent.id} className="space-y-2">
                                        <button 
                                            onClick={() => handleSelectParent(parent)}
                                            className="w-full flex items-center justify-between p-4 bg-secondary/60 border border-border rounded-2xl hover:bg-primary/10 hover:border-primary/30 transition-all text-left group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center font-bold text-primary">
                                                    {parent.firstName[0]}{parent.lastName[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-foreground">
                                                        {parent.firstName} {parent.lastName}
                                                        <span className="text-[10px] text-primary/70 font-black ml-2 uppercase tracking-widest">(Parent)</span>
                                                    </p>
                                                    <p className="text-xs text-muted-foreground line-clamp-1">{parent.email || 'No email'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-all" />
                                        </button>
                                        
                                        {parent.children?.map((child: any) => (
                                            <button
                                                key={child.id}
                                                onClick={() => handleSelectParent(parent, child.id)}
                                                className="ml-8 w-[calc(100%-2rem)] flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-primary/5 hover:border-primary/20 transition-all text-left group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-secondary/40 flex items-center justify-center text-muted-foreground border border-border">
                                                        <Baby className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-foreground text-sm">{child.firstName} {child.lastName}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] uppercase font-black tracking-widest text-primary/70 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">Select Child for Invoice</span>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ))}
                                {parentSearch.length >= 2 && searchResults.length === 0 && !isLoading && (
                                    <div className="text-center py-8 bg-secondary/60 rounded-2xl border border-dashed border-border">
                                        <p className="text-sm font-bold text-muted-foreground">No existing parents found.</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-border space-y-3">
                                <button 
                                    onClick={() => setStep('legacy-onboarding')}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-secondary/40 border border-primary/20 rounded-2xl text-primary font-black uppercase tracking-widest text-xs hover:bg-primary/5 transition-all"
                                >
                                    <UserPlus className="w-4 h-4" /> Create New Family
                                </button>
                                <button 
                                    onClick={() => setStep('adhoc-invoice')}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-secondary/40 border border-border rounded-2xl text-muted-foreground font-black uppercase tracking-widest text-xs hover:bg-secondary/60 hover:text-foreground transition-all"
                                >
                                    <Baby className="w-4 h-4" /> Ad-Hoc Invoice (child not in system)
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
                            <div className="bg-secondary/60 rounded-3xl p-6 border border-border space-y-4">
                                <h3 className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">
                                    <Contact className="w-4 h-4" /> Parent Details
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">First Name</label>
                                        <input 
                                            type="text"
                                            value={legacyParent.firstName}
                                            onChange={(e) => setLegacyParent({...legacyParent, firstName: e.target.value})}
                                            className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Last Name</label>
                                        <input 
                                            type="text"
                                            value={legacyParent.lastName}
                                            onChange={(e) => setLegacyParent({...legacyParent, lastName: e.target.value})}
                                            className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Email</label>
                                        <input 
                                            type="email"
                                            value={legacyParent.email}
                                            onChange={(e) => setLegacyParent({...legacyParent, email: e.target.value})}
                                            className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Phone</label>
                                        <input 
                                            type="text"
                                            value={legacyParent.phone}
                                            onChange={(e) => setLegacyParent({...legacyParent, phone: e.target.value})}
                                            className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Legacy Children Form */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                                        <Baby className="w-4 h-4" /> Children
                                    </h3>
                                    <button onClick={handleAddLegacyChild} className="text-xs font-black text-primary hover:text-blue-400 flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Add Sibling
                                    </button>
                                </div>
                                {legacyChildren.map((child, idx) => (
                                    <div key={idx} className="bg-secondary/40 border border-border rounded-2xl p-6 relative group/child">
                                        {legacyChildren.length > 1 && (
                                            <button onClick={() => handleRemoveLegacyChild(idx)} className="absolute top-4 right-4 text-rose-500 opacity-0 group-hover/child:opacity-100 transition-opacity p-2 hover:bg-rose-500/10 rounded-lg">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">First Name</label>
                                                <input 
                                                    type="text"
                                                    value={child.firstName}
                                                    onChange={(e) => {
                                                        const newC = [...legacyChildren];
                                                        newC[idx].firstName = e.target.value;
                                                        setLegacyChildren(newC);
                                                    }}
                                                    className="w-full p-3 bg-card border border-border rounded-xl text-foreground font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Last Name</label>
                                                <input 
                                                    type="text"
                                                    value={child.lastName}
                                                    onChange={(e) => {
                                                        const newC = [...legacyChildren];
                                                        newC[idx].lastName = e.target.value;
                                                        setLegacyChildren(newC);
                                                    }}
                                                    className="w-full p-3 bg-card border border-border rounded-xl text-foreground font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Year</label>
                                                <select 
                                                    value={child.schoolYear}
                                                    onChange={(e) => {
                                                        const newC = [...legacyChildren];
                                                        newC[idx].schoolYear = e.target.value;
                                                        setLegacyChildren(newC);
                                                    }}
                                                    className="w-full p-3 bg-card border border-border rounded-xl text-foreground font-bold"
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
                            <div className="pt-8 border-t border-border">
                                <button 
                                    onClick={() => setStep('invoice-details')}
                                    disabled={!legacyParent.firstName || legacyChildren.some(c => !c.firstName)}
                                    className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                                >
                                    Proceed to Billing
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'adhoc-invoice' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => setStep('select-parent')} className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>

                            {/* Info banner */}
                            <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                                <Baby className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-300 font-semibold leading-relaxed">
                                    The child's name will be printed on the invoice PDF but <strong>no record will be created</strong> in the children table. Use this for trial sessions, one-offs, or children not yet registered.
                                </p>
                            </div>

                            {/* Child Name */}
                            <div className="bg-secondary/60 rounded-3xl p-6 border border-border space-y-4">
                                <h3 className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                                    <Baby className="w-4 h-4" /> Child Details
                                </h3>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Child's Full Name</label>
                                    <input
                                        type="text"
                                        value={adhocChildName}
                                        onChange={(e) => setAdhocChildName(e.target.value)}
                                        placeholder="e.g. Jamie Smith"
                                        className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Parent Section */}
                            <div className="bg-secondary/60 rounded-3xl p-6 border border-border space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">
                                        <Contact className="w-4 h-4" /> Parent / Guardian
                                    </h3>
                                    <div className="flex items-center gap-1 bg-card rounded-xl p-1">
                                        <button
                                            onClick={() => { setAdhocUseExistingParent(true); setAdhocSelectedParent(null); }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                                adhocUseExistingParent ? 'bg-primary text-foreground' : 'text-muted-foreground'
                                            }`}
                                        >
                                            Search Existing
                                        </button>
                                        <button
                                            onClick={() => setAdhocUseExistingParent(false)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                                                !adhocUseExistingParent ? 'bg-primary text-foreground' : 'text-muted-foreground'
                                            }`}
                                        >
                                            New Parent
                                        </button>
                                    </div>
                                </div>

                                {adhocUseExistingParent ? (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Search parent name or email..."
                                                value={adhocParentSearch}
                                                onChange={(e) => { setAdhocParentSearch(e.target.value); setAdhocSelectedParent(null); }}
                                                className="w-full pl-10 pr-4 py-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                                            />
                                        </div>
                                        {adhocSelectedParent ? (
                                            <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-xl">
                                                <div>
                                                    <p className="font-bold text-foreground text-sm">{adhocSelectedParent.firstName} {adhocSelectedParent.lastName}</p>
                                                    <p className="text-xs text-muted-foreground">{adhocSelectedParent.email || 'No email'}</p>
                                                </div>
                                                <button onClick={() => { setAdhocSelectedParent(null); setAdhocParentSearch(''); }} className="text-muted-foreground hover:text-foreground">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : adhocParentResults.length > 0 && (
                                            <div className="space-y-1 max-h-40 overflow-y-auto">
                                                {adhocParentResults.map((p: any) => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => { setAdhocSelectedParent(p); setAdhocParentSearch(''); setAdhocParentResults([]); }}
                                                        className="w-full flex items-center gap-3 p-3 bg-secondary/40 border border-border rounded-xl hover:bg-primary/10 hover:border-primary/30 transition-all text-left"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center font-bold text-primary text-xs">
                                                            {p.firstName[0]}{p.lastName[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-foreground text-sm">{p.firstName} {p.lastName}</p>
                                                            <p className="text-xs text-muted-foreground">{p.email || 'No email'}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">First Name *</label>
                                            <input type="text" value={adhocNewParent.firstName} onChange={(e) => setAdhocNewParent({...adhocNewParent, firstName: e.target.value})} className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Last Name</label>
                                            <input type="text" value={adhocNewParent.lastName} onChange={(e) => setAdhocNewParent({...adhocNewParent, lastName: e.target.value})} className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Email</label>
                                            <input type="email" value={adhocNewParent.email} onChange={(e) => setAdhocNewParent({...adhocNewParent, email: e.target.value})} className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Phone</label>
                                            <input type="tel" value={adhocNewParent.phone} onChange={(e) => setAdhocNewParent({...adhocNewParent, phone: e.target.value})} className="w-full p-3 bg-secondary/40 border border-border rounded-xl text-foreground font-bold" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-border">
                                <button
                                    onClick={() => setStep('invoice-details')}
                                    disabled={
                                        !adhocChildName.trim() ||
                                        (adhocUseExistingParent && !adhocSelectedParent) ||
                                        (!adhocUseExistingParent && !adhocNewParent.firstName.trim())
                                    }
                                    className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
                                >
                                    Proceed to Billing
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'invoice-details' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <button onClick={() => setStep(selectedParent ? 'select-parent' : adhocChildName ? 'adhoc-invoice' : 'legacy-onboarding')} className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
                                <ArrowLeft className="w-4 h-4" /> Back
                            </button>

                            {/* Sibling Detection for Existing Parent */}
                            {selectedParent && (
                                <div className="p-6 bg-secondary/60 border border-border rounded-[32px] space-y-4">
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">
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
                                                    : 'bg-secondary/60 border-border text-muted-foreground'
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
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Centre</label>
                                    <select 
                                        value={invoiceData.centreId}
                                        onChange={(e) => setInvoiceData({...invoiceData, centreId: e.target.value})}
                                        className="w-full p-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-bold"
                                    >
                                        {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {(() => {
                                        const selectedChildren = availableChildren.filter(c => selectedChildIds.includes(c.id));
                                        const selectedCentres = Array.from(new Set(selectedChildren.map(c => c.centreId).filter(Boolean)));
                                        if (selectedCentres.length > 1) {
                                            return (
                                                <p className="text-xs font-semibold text-amber-500 mt-1">
                                                    ⚠️ Selected children attend different centres. Please select which centre's invoice template/bank details to use for the combined bill.
                                                </p>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <div className="col-span-2 md:col-span-1 space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Amount (£)</label>
                                    <input 
                                        type="number"
                                        placeholder="0.00"
                                        value={invoiceData.amount}
                                        onChange={(e) => setInvoiceData({...invoiceData, amount: e.target.value})}
                                        className="w-full p-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-black text-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Invoice Date</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.invoiceDate}
                                        onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                                        className="w-full p-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Due Date</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.dueDate}
                                        onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                                        className="w-full p-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-bold"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Period From</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.billingPeriodStart}
                                        onChange={(e) => setInvoiceData({...invoiceData, billingPeriodStart: e.target.value})}
                                        className="w-full p-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Period To</label>
                                    <input 
                                        type="date"
                                        value={invoiceData.billingPeriodEnd}
                                        onChange={(e) => setInvoiceData({...invoiceData, billingPeriodEnd: e.target.value})}
                                        className="w-full p-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-medium"
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Notes / Description (Visible on PDF)</label>
                                    <textarea 
                                        rows={3}
                                        value={invoiceData.notes}
                                        onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                                        className="w-full p-4 bg-secondary/40 border border-border rounded-2xl text-foreground font-medium scrollbar-hide"
                                        placeholder="Enter any additional details..."
                                    />
                                </div>
                            </div>

                            {/* Action Row */}
                            <div className="pt-8 border-t border-border">
                                <button 
                                    onClick={handleSaveInvoice}
                                    disabled={!invoiceData.amount || isSaving || (selectedParent && selectedChildIds.length === 0)}
                                    className="w-full py-5 bg-primary text-white font-black uppercase tracking-[0.2em] rounded-3xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-3"
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
