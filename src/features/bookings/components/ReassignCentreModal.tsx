'use client';

import { useState } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { Button } from '@/components/ui/Button';

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
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={e => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassign-centre-title"
        >
            <div className="relative w-full max-w-md bg-surface border border-border rounded-lg shadow-[var(--shadow-popover)] overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-accent-soft">
                            <MapPin className="w-5 h-5 text-accent" />
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-page transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <h3 id="reassign-centre-title" className="text-section-title text-text mb-1.5">Reassign Centre</h3>
                    <p className="text-small-body text-text-secondary mb-5">
                        Move this booking to a different centre. Only centres you have access to are shown.
                    </p>

                    {availableCentres.length === 0 ? (
                        <div className="bg-warning-soft text-warning p-3 rounded-md text-small-body mb-6 border border-warning/20">
                            You don&apos;t have access to any other centres to reassign this booking to.
                        </div>
                    ) : (
                        <div className="mb-6">
                            <label htmlFor="reassign-centre-select" className="block text-label text-text-muted mb-2">
                                New Centre
                            </label>
                            <select
                                id="reassign-centre-select"
                                value={selectedCentreId}
                                onChange={(e) => setSelectedCentreId(e.target.value)}
                                className="w-full h-9 px-3 rounded-sm border border-border bg-surface text-text text-small-body focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent"
                            >
                                <option value="" disabled>Select a new centre</option>
                                <optgroup label="Current Centre">
                                    <option value={currentCentreId} disabled>
                                        {centres.find(c => c.id === currentCentreId)?.name || 'Unknown'} (Current)
                                    </option>
                                </optgroup>
                                <optgroup label="Available Centres">
                                    {availableCentres.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={handleSave}
                            disabled={isSaving || !selectedCentreId || selectedCentreId === currentCentreId || availableCentres.length === 0}
                        >
                            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
