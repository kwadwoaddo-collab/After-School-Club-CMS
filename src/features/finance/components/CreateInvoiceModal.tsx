'use client';

import { useState } from 'react';
import { X, User, Calendar, CreditCard, ChevronDown, Loader2 } from 'lucide-react';
import { createManualInvoice } from '../actions';
import { useToast } from '@/components/ui/ToastProvider';

interface Child {
    id: string;
    firstName: string;
    lastName: string;
    parent: {
        firstName: string;
        lastName: string;
    };
}

interface CreateInvoiceModalProps {
    students: Child[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateInvoiceModal({ students, onClose, onSuccess }: CreateInvoiceModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    
    const [formData, setFormData] = useState({
        childId: '',
        amount: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        billingPeriodStart: '',
        billingPeriodEnd: '',
        notes: ''
    });

    const [search, setSearch] = useState('');
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);

    const filteredStudents = students.filter(s => 
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        `${s.parent.firstName} ${s.parent.lastName}`.toLowerCase().includes(search.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.childId || !formData.amount) {
            toast('Please fill in required fields', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await createManualInvoice({
                childId: formData.childId,
                amount: parseFloat(formData.amount),
                invoiceDate: new Date(formData.invoiceDate),
                dueDate: new Date(formData.dueDate),
                billingPeriodStart: formData.billingPeriodStart ? new Date(formData.billingPeriodStart) : undefined,
                billingPeriodEnd: formData.billingPeriodEnd ? new Date(formData.billingPeriodEnd) : undefined,
                notes: formData.notes
            });
            toast('Invoice created successfully', 'success');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast(error.message || 'Failed to create invoice', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-surface-container-highest border border-outline-variant/20 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-high/50">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Create Manual Invoice</h2>
                        <p className="text-on-surface-variant text-sm font-medium">Generate a new billing record for a student</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-on-surface-variant hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Student Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            <User className="w-3.5 h-3.5" /> Select Student <span className="text-primary">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by student or parent name..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setShowStudentDropdown(true);
                                }}
                                onFocus={() => setShowStudentDropdown(true)}
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                            
                            {showStudentDropdown && search && (
                                <div className="absolute z-10 w-full mt-2 bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden animate-in slide-in-from-top-2">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({ ...formData, childId: s.id });
                                                    setSearch(`${s.firstName} ${s.lastName}`);
                                                    setShowStudentDropdown(false);
                                                }}
                                                className="w-full px-5 py-3 text-left hover:bg-primary/10 transition-colors flex items-center justify-between group"
                                            >
                                                <div>
                                                    <div className="text-white font-bold">{s.firstName} {s.lastName}</div>
                                                    <div className="text-xs text-on-surface-variant">Parent: {s.parent.firstName} {s.parent.lastName}</div>
                                                </div>
                                                <div className="w-6 h-6 rounded-lg bg-surface-container-low flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-5 py-4 text-on-surface-variant text-sm">No students found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Amount */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                                <CreditCard className="w-3.5 h-3.5" /> Amount (£) <span className="text-primary">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>

                        {/* Invoice Date */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> Invoice Date
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.invoiceDate}
                                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Billing Period Start */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> Period From
                            </label>
                            <input
                                type="date"
                                value={formData.billingPeriodStart}
                                onChange={(e) => setFormData({ ...formData, billingPeriodStart: e.target.value })}
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>

                        {/* Billing Period End */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> Period To
                            </label>
                            <input
                                type="date"
                                value={formData.billingPeriodEnd}
                                onChange={(e) => setFormData({ ...formData, billingPeriodEnd: e.target.value })}
                                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                            Notes
                        </label>
                        <textarea
                            placeholder="Add internal notes or invoice descriptions..."
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium resize-none"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-outline-variant/10 bg-surface-container-high/50 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 bg-white/5 border border-outline-variant/20 rounded-2xl text-sm font-bold text-white hover:bg-white/10 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.childId || !formData.amount}
                        className="px-8 py-3 bg-primary rounded-2xl text-sm font-bold text-white hover:bg-blue-600 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : 'Create Invoice'}
                    </button>
                </div>
            </div>
        </div>
    );
}
