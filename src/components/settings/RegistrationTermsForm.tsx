'use client';
 
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Save, ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
 
export default function RegistrationTermsForm() {
    const [terms, setTerms] = useState('');
    const [orgSlug, setOrgSlug] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
 
    useEffect(() => {
        fetch('/api/settings/registration-terms')
            .then(r => r.json())
            .then(data => {
                setTerms(data.registrationTerms ?? '');
                setOrgSlug(data.slug ?? '');
                setLoading(false);
            })
            .catch(() => { setLoading(false); setError('Failed to load settings.'); });
    }, []);
 
    const handleSave = async () => {
        setSaving(true); setSaved(false); setError('');
        try {
            const res = await fetch('/api/settings/registration-terms', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationTerms: terms }),
            });
            if (!res.ok) throw new Error('Failed to save');
            setSaved(true);
            toast.success('Registration terms & conditions saved successfully!');
            setTimeout(() => setSaved(false), 3000);
        } catch {
            const errMsg = 'Failed to save terms. Please try again.';
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setSaving(false);
        }
    };
 
    return (
        <div className="max-w-3xl mx-auto p-6 space-y-8 animate-in fade-in duration-700">

 
            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Registration Terms &amp; Conditions</h1>
                        <p className="text-muted-foreground text-sm mt-1">Displayed on your public student registration form</p>
                    </div>
                </div>
                {orgSlug && (
                    <a
                        href={`/register/${orgSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-[#353535] border border-border text-foreground rounded-2xl transition-all text-sm hover:scale-[1.01] active:scale-[0.99]"
                    >
                        <ExternalLink className="w-4 h-4" /> Preview form
                    </a>
                )}
            </div>
 
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Info banner */}
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 flex gap-3">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-primary font-bold text-sm">Tip</p>
                            <p className="text-muted-foreground text-sm mt-0.5">
                                Parents will see these T&Cs on Step 6 of the registration form before they submit.
                                Write clear policies covering fees, absence, notice period, and conduct.
                            </p>
                        </div>
                    </div>
 
                    {/* Textarea */}
                    <div>
                        <label className="block text-sm font-bold text-foreground mb-2">
                            Terms &amp; Conditions Text
                        </label>
                        <textarea
                            id="registration-terms"
                            value={terms}
                            onChange={e => setTerms(e.target.value)}
                            placeholder={`e.g.\n\nFEES\nAll fees are due 1 month in advance. Late payment may result in loss of place.\n\nABSENCE\nFees are not refunded for absent sessions unless 48 hours notice is given.\n\nNOTICE PERIOD\nOne month's written notice is required to withdraw your child from the programme.`}
                            rows={20}
                            className="w-full px-4 py-3 rounded-2xl bg-secondary/60 border border-border text-foreground placeholder-[#8c909f]/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-mono resize-none leading-relaxed transition-all"
                        />
                        <p className="text-muted-foreground text-xs mt-2 text-right">{terms.length} characters</p>
                    </div>
 
                    {/* Save / error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 font-bold text-sm">{error}</div>
                    )}
 
                    <div className="flex items-center justify-between">
                        {saved ? (
                            <span className="text-emerald-600 text-sm flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Saved successfully
                            </span>
                        ) : <div />}
                        <button
                            id="save-registration-terms"
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-3 bg-primary text-foreground text-sm font-bold rounded-2xl hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:bg-secondary"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving…' : 'Save Terms'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
