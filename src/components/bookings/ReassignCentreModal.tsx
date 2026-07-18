'use client';

import { useState } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

interface ReassignCentreModalProps {
    bookingId: string;
    currentCentreId: string;
    centres: { id: string; name: string }[];
    onClose: () => void;
    onSuccess?: (newCentreId: string) => void;
}

export default function ReassignCentreModal({ bookingId, currentCentreId, centres, onClose, onSuccess }: ReassignCentreModalProps) {
    const [selectedCentreId, setSelectedCentreId] = useState(currentCentreId || '');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const availableCentres = centres.filter(c => c.id !== currentCentreId);

    const handleSave = async () => {
        if (!selectedCentreId || selectedCentreId === currentCentreId) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/bookings/${bookingId}/centre`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ centreId: selectedCentreId }),
            });

            if (response.ok) {
                toast('Booking reassigned successfully.', 'success');
                if (onSuccess) {
                    onSuccess(selectedCentreId);
                } else {
                    router.refresh();
                }
                onClose();
            } else {
                const data = await response.json();
                toast(data.error || 'Failed to reassign centre.', 'error');
            }
        } catch {
            toast('An error occurred. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-secondary border border-outline-variant/10 rounded-[32px] shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
                            <MapPin className="w-7 h-7 text-indigo-400" />
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-foreground mb-2">Reassign Centre</h3>
                    <p className="text-sm text-slate-400 mb-6 font-medium">
                        Move this booking to a different centre. Only centres you have access to are shown.
                    </p>

                    {availableCentres.length === 0 ? (
                        <div className="bg-amber-500/10 text-amber-400 p-4 rounded-2xl text-sm mb-6 border border-amber-500/20 font-medium">
                            You don't have access to any other centres to reassign this booking to.
                        </div>
                    ) : (
                        <div className="mb-8">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                New Centre
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedCentreId}
                                    onChange={(e) => setSelectedCentreId(e.target.value)}
                                    className="w-full px-4 py-3 bg-secondary border border-border rounded-2xl text-foreground font-medium focus:ring-2 focus:ring-primary/20 appearance-none outline-none"
                                >
                                    <option value="" disabled className="bg-secondary">Select a new centre</option>
                                    <optgroup label="Current Centre" className="bg-secondary">
                                        <option value={currentCentreId} disabled>
                                            {centres.find(c => c.id === currentCentreId)?.name || 'Unknown'} (Current)
                                        </option>
                                    </optgroup>
                                    <optgroup label="Available Centres" className="bg-secondary">
                                        {availableCentres.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </optgroup>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 px-4 py-3 bg-secondary hover:bg-secondary/80 rounded-2xl text-sm font-semibold text-foreground transition-all shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !selectedCentreId || selectedCentreId === currentCentreId || availableCentres.length === 0}
                            className="flex-1 px-4 py-3 bg-primary hover:bg-primary/90 rounded-2xl text-sm font-bold text-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-primary/20 glow-btn"
                        >
                            {isSaving ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...</> : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
