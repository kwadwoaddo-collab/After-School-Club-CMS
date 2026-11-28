'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { FileText, Save, ExternalLink } from 'lucide-react';
 
export default function RegistrationTermsForm({ initialTerms, orgSlug }: { initialTerms: string, orgSlug: string }) {
    const [terms, setTerms] = useState(initialTerms);
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const savingRef = useRef(false);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setTerms(initialTerms);
    }, [initialTerms]);

    useEffect(() => {
        return () => {
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        };
    }, []);
 
    const handleSave = async () => {
        if (savingRef.current || saving) return;
        savingRef.current = true;
        setSaving(true); setSaved(false); setError('');
        try {
            const res = await fetch('/api/settings/registration-terms', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationTerms: terms }),
            });
            if (!res.ok) throw new Error('Failed to save');
            setSaved(true);
            toast({ title: 'Success', message: 'Registration terms & conditions saved successfully!', variant: 'success' });
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
            savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
        } catch {
            const errMsg = 'Failed to save terms. Please try again.';
            setError(errMsg);
            toast({ title: 'Error', message: errMsg, variant: 'error' });
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
 
    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">

 
            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent-soft border border-border flex items-center justify-center">
                        <FileText className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text">Registration Terms &amp; Conditions</h1>
                        <p className="text-text-muted text-sm mt-1">Displayed on your public student registration form</p>
                    </div>
                </div>
                {orgSlug && (
                    <a
                        href={`/register/${orgSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 min-h-11 sm:min-h-10 px-4 py-2 bg-secondary hover:bg-secondary/80 border border-border text-text rounded-md transition-colors text-sm"
                    >
                        <ExternalLink className="w-4 h-4" /> Preview form
                    </a>
                )}
            </div>
 
            <div className="space-y-5">
                    {/* Info banner */}
                    <div className="bg-accent-soft border border-accent/20 rounded-xl p-4 flex gap-3">
                        <FileText className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-accent font-semibold text-sm">Tip</p>
                            <p className="text-text-muted text-sm mt-0.5">
                                Parents will see these T&Cs on Step 6 of the registration form before they submit.
                                Write clear policies covering fees, absence, notice period, and conduct.
                            </p>
                        </div>
                    </div>
 
                    {/* Textarea */}
                    <div>
                        <label htmlFor="registration-terms" className="block text-sm font-bold text-text mb-2">
                            Terms &amp; Conditions Text
                        </label>
                        <textarea
                            id="registration-terms"
                            value={terms}
                            onChange={e => setTerms(e.target.value)}
                            placeholder={`e.g.\n\nFEES\nAll fees are due 1 month in advance. Late payment may result in loss of place.\n\nABSENCE\nFees are not refunded for absent sessions unless 48 hours notice is given.\n\nNOTICE PERIOD\nOne month's written notice is required to withdraw your child from the programme.`}
                            rows={20}
                            className="w-full px-4 py-3 rounded-md bg-secondary/60 border border-border text-text placeholder-[#8c909f]/40 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-sm font-mono resize-none leading-relaxed transition-all"
                        />
                        <p className="text-text-muted text-xs mt-2 text-right">{terms.length} characters</p>
                    </div>
 
                    {/* Save / error */}
                    {error && (
                        <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-semibold text-sm">{error}</div>
                    )}
 
                    <div className="flex items-center justify-between">
                        {saved ? (
                            <span className="text-success text-sm flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Saved successfully
                            </span>
                        ) : <div />}
                        <button
                            id="save-registration-terms"
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-2 min-h-11 sm:min-h-10 px-5 py-2.5 bg-accent text-on-accent text-sm font-semibold rounded-md hover:bg-accent-hover transition-colors shadow-xs disabled:opacity-50 disabled:bg-secondary"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving…' : 'Save Terms'}
                        </button>
                    </div>
                </div>
        </div>
    );
}
