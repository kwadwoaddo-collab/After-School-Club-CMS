'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { createIncident, getCentreChildren } from '@/features/incidents/actions';
import SignatureCanvas from 'react-signature-canvas';
import { logger } from '@/lib/logger';

type NewIncidentModalProps = {
    centreId: string;
    onClose: () => void;
    onSuccess: () => void;
};

const INCIDENT_TYPES = ['accident', 'incident', 'medication', 'safeguarding'] as const;

const TYPE_LABELS: Record<typeof INCIDENT_TYPES[number], string> = {
    accident:      'Accident',
    incident:      'Incident',
    medication:    'Medication',
    safeguarding:  'Safeguarding',
};

export default function NewIncidentModal({ centreId, onClose, onSuccess }: NewIncidentModalProps) {
    const [centreChildren, setCentreChildren] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [childId, setChildId] = useState('');
    const [type, setType] = useState<typeof INCIDENT_TYPES[number]>('accident');
    const [description, setDescription] = useState('');
    const [treatment, setTreatment] = useState('');
    const [witnesses, setWitnesses] = useState('');
    const sigPad = useRef<SignatureCanvas>(null);

    useEffect(() => {
        setIsLoading(true);
        getCentreChildren(centreId)
            .then(data => { setCentreChildren(data); setIsLoading(false); })
            .catch(err => {
                logger.error('Failed to load centre children', err);
                setIsLoading(false);
            });
    }, [centreId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!childId)                        return setError('Please select a child');
        if (!description.trim())             return setError('Please provide a description');
        if (sigPad.current?.isEmpty())       return setError('Staff signature is required');

        setIsSubmitting(true);
        try {
            const signature = sigPad.current?.toDataURL() || undefined;
            await createIncident({
                centreId,
                childId,
                type,
                date: new Date(),
                description: description.trim(),
                treatment: treatment.trim() || undefined,
                witnesses: witnesses.trim() || undefined,
                staffSignature: signature,
            });
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit incident');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-modal-title"
        >
            <div className="bg-surface border border-border w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-popover)] flex flex-col max-h-[92dvh] sm:max-h-[88dvh]">
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <h2 id="incident-modal-title" className="text-base font-bold text-text">
                        Log Incident Record
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1.5 hover:bg-page rounded-md transition-colors text-text-muted hover:text-text"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1">
                    {error && (
                        <div className="mb-5 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                            {error}
                        </div>
                    )}

                    <form id="incident-form" onSubmit={handleSubmit} className="space-y-5">
                        {/* Child */}
                        <div>
                            <label htmlFor="incident-child" className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                Child *
                            </label>
                            {isLoading ? (
                                <div className="h-10 bg-page border border-border rounded-lg animate-pulse" />
                            ) : (
                                <select
                                    id="incident-child"
                                    value={childId}
                                    onChange={e => setChildId(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all"
                                >
                                    <option value="">Select a child…</option>
                                    {centreChildren.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.firstName} {c.lastName}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {!isLoading && centreChildren.length === 0 && (
                                <p className="mt-1.5 text-xs text-text-muted">
                                    No registered children found at this centre.
                                </p>
                            )}
                        </div>

                        {/* Incident Type */}
                        <div>
                            <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                Record Type *
                            </span>
                            <div className="grid grid-cols-2 gap-2">
                                {INCIDENT_TYPES.map(t => {
                                    const isSafeguarding = t === 'safeguarding';
                                    const isSelected = type === t;
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            id={`incident-type-${t}`}
                                            onClick={() => setType(t)}
                                            className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                                                isSelected
                                                    ? isSafeguarding
                                                        ? 'bg-destructive text-white border-destructive shadow-sm'
                                                        : 'bg-accent text-white border-accent shadow-sm'
                                                    : 'bg-surface text-text-secondary border-border hover:border-accent/30 hover:text-text'
                                            }`}
                                        >
                                            {TYPE_LABELS[t]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label htmlFor="incident-description" className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                Description / Details *
                            </label>
                            <textarea
                                id="incident-description"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={4}
                                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all resize-none"
                                placeholder="Describe what happened, where, and when…"
                            />
                        </div>

                        {/* Treatment (conditional on accident / medication) */}
                        {(type === 'accident' || type === 'medication') && (
                            <div>
                                <label htmlFor="incident-treatment" className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                    Treatment Given
                                </label>
                                <textarea
                                    id="incident-treatment"
                                    value={treatment}
                                    onChange={e => setTreatment(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all resize-none"
                                    placeholder="e.g. Cold compress applied, parent notified"
                                />
                            </div>
                        )}

                        {/* Witnesses */}
                        <div>
                            <label htmlFor="incident-witnesses" className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                                Witnesses (staff or students)
                            </label>
                            <input
                                id="incident-witnesses"
                                type="text"
                                value={witnesses}
                                onChange={e => setWitnesses(e.target.value)}
                                className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all"
                                placeholder="Names of any witnesses"
                            />
                        </div>

                        {/* Staff Signature */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                                    Staff Signature *
                                </span>
                                <button
                                    type="button"
                                    onClick={() => sigPad.current?.clear()}
                                    className="text-xs text-accent font-semibold hover:underline"
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="border border-border rounded-lg bg-white overflow-hidden">
                                <SignatureCanvas
                                    ref={sigPad}
                                    penColor="#1a1a1a"
                                    canvasProps={{ className: 'w-full h-28', 'aria-label': 'Staff signature pad' }}
                                />
                            </div>
                            <p className="mt-1 text-xs text-text-muted">Draw your signature above using mouse or touch.</p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border flex justify-end gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-lg font-semibold text-sm text-text-secondary hover:bg-page transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        form="incident-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 bg-accent text-white font-semibold text-sm rounded-lg hover:bg-accent/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        Submit Record
                    </button>
                </div>
            </div>
        </div>
    );
}
