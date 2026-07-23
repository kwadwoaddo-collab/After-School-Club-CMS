'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';
import { createIncident, getCentreChildren } from '@/features/incidents/actions';
import SignatureCanvas from 'react-signature-canvas';

type NewIncidentModalProps = {
    centreId: string;
    onClose: () => void;
    onSuccess: () => void;
};

export default function NewIncidentModal({ centreId, onClose, onSuccess }: NewIncidentModalProps) {
    const [children, setChildren] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [childId, setChildId] = useState('');
    const [type, setType] = useState<'accident' | 'incident' | 'medication' | 'safeguarding'>('accident');
    const [description, setDescription] = useState('');
    const [treatment, setTreatment] = useState('');
    const [witnesses, setWitnesses] = useState('');
    const sigPad = useRef<SignatureCanvas>(null);

    useEffect(() => {
        setIsLoading(true);
        getCentreChildren(centreId).then(data => {
            setChildren(data);
            setIsLoading(false);
        }).catch(err => {
            console.error(err);
            setIsLoading(false);
        });
    }, [centreId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!childId) return setError('Please select a child');
        if (!description) return setError('Please provide a description');
        if (sigPad.current?.isEmpty()) return setError('Staff signature is required');

        setIsSubmitting(true);
        try {
            const signature = sigPad.current?.toDataURL() || undefined;
            await createIncident({
                centreId,
                childId,
                type,
                date: new Date(),
                description,
                treatment,
                witnesses,
                staffSignature: signature
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Failed to submit incident');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border flex justify-between items-center bg-secondary/20">
                    <h2 className="text-xl font-bold text-foreground">Log New Record</h2>
                    <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <form id="incident-form" onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Child</label>
                            {isLoading ? (
                                <div className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
                            ) : (
                                <select 
                                    value={childId}
                                    onChange={e => setChildId(e.target.value)}
                                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                >
                                    <option value="">Select a child...</option>
                                    {children.map(c => (
                                        <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Record Type</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['accident', 'incident', 'medication', 'safeguarding'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setType(t as any)}
                                        className={`px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wide border transition-all ${
                                            type === t 
                                            ? (t === 'safeguarding' ? 'bg-destructive text-white border-destructive' : 'bg-primary text-white border-primary')
                                            : 'bg-card text-muted-foreground border-border hover:border-primary/30'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description / Details</label>
                            <textarea 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                                placeholder="Describe what happened..."
                            />
                        </div>

                        {(type === 'accident' || type === 'medication') && (
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Treatment Given</label>
                                <textarea 
                                    value={treatment}
                                    onChange={e => setTreatment(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                                    placeholder="e.g. Cold compress applied"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Witnesses (Staff or Students)</label>
                            <input 
                                type="text"
                                value={witnesses}
                                onChange={e => setWitnesses(e.target.value)}
                                className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                placeholder="Names of any witnesses"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Staff Signature</label>
                                <button type="button" onClick={() => sigPad.current?.clear()} className="text-xs text-primary font-bold hover:underline">Clear</button>
                            </div>
                            <div className="border border-border rounded-xl bg-card overflow-hidden">
                                <SignatureCanvas 
                                    ref={sigPad}
                                    penColor="black"
                                    canvasProps={{ className: 'w-full h-32' }}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-border bg-secondary/10 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-secondary transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        form="incident-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Submit Record
                    </button>
                </div>
            </div>
        </div>
    );
}
