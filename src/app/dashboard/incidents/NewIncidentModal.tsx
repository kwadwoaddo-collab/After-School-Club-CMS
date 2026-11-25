'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { createIncident, getCentreChildren } from '@/features/incidents/actions';
import SignatureCanvas from 'react-signature-canvas';
import { logger } from '@/lib/logger';
import { useDialogFocusTrap } from '@/components/ui/useDialogFocusTrap';

type NewIncidentModalProps = {
    centreId: string;
    userRole?: string;
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

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildTypedSignatureDataUrl(fullName: string, signedAt: Date): string {
    const cleanName = fullName.trim();
    const dateStamp = signedAt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 120;
        let ctx: CanvasRenderingContext2D | null = null;
        try {
            ctx = canvas.getContext('2d');
        } catch {
            ctx = null;
        }
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#1a1a1a';
            ctx.font = 'italic 600 28px Georgia, serif';
            ctx.fillText(cleanName, 20, 62, 440);
            ctx.fillStyle = '#52525b';
            ctx.font = '500 12px system-ui, -apple-system, sans-serif';
            ctx.fillText(`Signed electronically · ${dateStamp}`, 20, 96, 440);
            const pngUrl = canvas.toDataURL('image/png');
            if (pngUrl.startsWith('data:image/')) {
                return pngUrl;
            }
        }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120"><rect width="480" height="120" fill="#ffffff"/><text x="20" y="62" fill="#1a1a1a" font-family="Georgia, serif" font-style="italic" font-weight="600" font-size="28">${escapeXml(cleanName)}</text><text x="20" y="96" fill="#52525b" font-family="system-ui, sans-serif" font-size="12">Signed electronically · ${escapeXml(dateStamp)}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export default function NewIncidentModal({ centreId, userRole, onClose, onSuccess }: NewIncidentModalProps) {
    const [centreChildren, setCentreChildren] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [childId, setChildId] = useState('');
    const [type, setType] = useState<typeof INCIDENT_TYPES[number]>('accident');
    const [description, setDescription] = useState('');
    const [treatment, setTreatment] = useState('');
    const [witnesses, setWitnesses] = useState('');
    const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
    const [typedSignatureName, setTypedSignatureName] = useState('');
    const [typedSignatureConfirmed, setTypedSignatureConfirmed] = useState(false);

    const sigPad = useRef<SignatureCanvas>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const submitLockRef = useRef(false);

    useDialogFocusTrap(true, dialogRef, () => {
        if (!isSubmitting && !submitLockRef.current) onClose();
    });

    const canLogSafeguarding = userRole !== 'FRONT_DESK' && userRole !== 'TUTOR';
    const visibleIncidentTypes = INCIDENT_TYPES.filter(
        t => t !== 'safeguarding' || canLogSafeguarding
    );

    // Move focus into dialog on open, trap Tab/Shift+Tab, handle Escape, and restore trigger focus on close
    useEffect(() => {
        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        closeButtonRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.defaultPrevented) return;
            if (e.key === 'Escape') {
                if (submitLockRef.current) return;
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key === 'Tab' && dialogRef.current) {
                const focusable = Array.from(
                    dialogRef.current.querySelectorAll<HTMLElement>(
                        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    )
                );
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const active = document.activeElement as HTMLElement | null;

                if (e.shiftKey) {
                    if (!active || active === first || !dialogRef.current.contains(active)) {
                        e.preventDefault();
                        last.focus();
                    }
                } else if (active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus?.();
        };
    }, [onClose]);

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
        if (submitLockRef.current) return;
        setError(null);
        if (!childId)            return setError('Please select a child');
        if (!description.trim()) return setError('Please provide a description');

        const submittedAt = new Date();
        let signature: string | undefined;

        if (signatureMode === 'draw') {
            if (!sigPad.current || sigPad.current.isEmpty()) {
                return setError('Staff signature is required');
            }
            signature = sigPad.current.toDataURL() || undefined;
        } else {
            if (!typedSignatureName.trim()) {
                return setError('Please enter your full name for the staff signature');
            }
            if (!typedSignatureConfirmed) {
                return setError('Please confirm the signature declaration');
            }
            signature = buildTypedSignatureDataUrl(typedSignatureName, submittedAt);
        }

        submitLockRef.current = true;
        setIsSubmitting(true);
        try {
            await createIncident({
                centreId,
                childId,
                type,
                date: submittedAt,
                description: description.trim(),
                treatment: treatment.trim() || undefined,
                witnesses: witnesses.trim() || undefined,
                staffSignature: signature,
            });
            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit incident');
        } finally {
            submitLockRef.current = false;
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-modal-title"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSubmitting && !submitLockRef.current) {
                    onClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                className="bg-surface border border-border w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-popover)] flex flex-col max-h-[92dvh] sm:max-h-[88dvh]"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
                    <h2 id="incident-modal-title" className="text-base font-bold text-text">
                        Log Incident Record
                    </h2>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-page rounded-md transition-colors text-text-muted hover:text-text"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1">
                    {error && (
                        <div
                            role="alert"
                            className="mb-5 p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-start gap-2.5"
                        >
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
                            <span
                                id="incident-record-type-label"
                                className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5"
                            >
                                Record Type *
                            </span>
                            <div
                                role="group"
                                aria-labelledby="incident-record-type-label"
                                className="grid grid-cols-2 gap-2"
                            >
                                {visibleIncidentTypes.map(t => {
                                    const isSafeguarding = t === 'safeguarding';
                                    const isSelected = type === t;
                                    return (
                                        <button
                                            key={t}
                                            type="button"
                                            id={`incident-type-${t}`}
                                            aria-pressed={isSelected}
                                            onClick={() => setType(t)}
                                            className={`min-h-[44px] px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all ${
                                                isSelected
                                                    ? isSafeguarding
                                                        ? 'bg-danger text-on-danger border-danger shadow-sm'
                                                        : 'bg-accent text-on-accent border-accent shadow-sm'
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
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <span
                                    id="incident-signature-label"
                                    className="block text-xs font-semibold text-text-muted uppercase tracking-wider"
                                >
                                    Staff Signature *
                                </span>
                                <div
                                    role="group"
                                    aria-labelledby="incident-signature-label"
                                    className="inline-flex rounded-md border border-border bg-page p-0.5"
                                >
                                    <button
                                        type="button"
                                        aria-pressed={signatureMode === 'draw'}
                                        onClick={() => {
                                            setSignatureMode('draw');
                                            setError(null);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors ${
                                            signatureMode === 'draw'
                                                ? 'bg-surface text-text shadow-sm'
                                                : 'text-text-secondary hover:text-text'
                                        }`}
                                    >
                                        Draw signature
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={signatureMode === 'type'}
                                        onClick={() => {
                                            setSignatureMode('type');
                                            setError(null);
                                        }}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-colors ${
                                            signatureMode === 'type'
                                                ? 'bg-surface text-text shadow-sm'
                                                : 'text-text-secondary hover:text-text'
                                        }`}
                                    >
                                        Type full name
                                    </button>
                                </div>
                            </div>

                            {signatureMode === 'draw' ? (
                                <>
                                    <div className="border border-border rounded-lg bg-white overflow-hidden">
                                        <SignatureCanvas
                                            ref={sigPad}
                                            penColor="#1a1a1a"
                                            canvasProps={{ className: 'w-full h-28', 'aria-label': 'Staff signature pad' }}
                                        />
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                        <p className="text-xs text-text-muted">
                                            Draw your signature above, or switch to &ldquo;Type full name&rdquo; for keyboard access.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => sigPad.current?.clear()}
                                            className="text-xs text-accent font-semibold hover:underline"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2.5 rounded-lg border border-border bg-page p-3">
                                    <div>
                                        <label htmlFor="incident-typed-signature" className="block text-xs font-semibold text-text-secondary mb-1">
                                            Staff Full Name *
                                        </label>
                                        <input
                                            id="incident-typed-signature"
                                            type="text"
                                            value={typedSignatureName}
                                            onChange={e => setTypedSignatureName(e.target.value)}
                                            placeholder="Type your full legal name"
                                            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition-all"
                                        />
                                    </div>
                                    <label
                                        htmlFor="incident-signature-confirm"
                                        className="flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer select-none"
                                    >
                                        <input
                                            id="incident-signature-confirm"
                                            type="checkbox"
                                            checked={typedSignatureConfirmed}
                                            onChange={e => setTypedSignatureConfirmed(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent"
                                        />
                                        <span>
                                            I confirm this incident record is accurate and adopt my typed name as my electronic signature.
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-border flex justify-end gap-3 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="min-h-[44px] px-4 py-2.5 rounded-lg font-semibold text-sm text-text-secondary hover:bg-page transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        form="incident-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="min-h-[44px] px-5 py-2.5 bg-accent text-on-accent font-semibold text-sm rounded-lg hover:bg-accent/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-60"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        Submit Record
                    </button>
                </div>
            </div>
        </div>
    );
}
