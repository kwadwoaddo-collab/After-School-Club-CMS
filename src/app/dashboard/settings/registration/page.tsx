'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Save, ArrowLeft, ExternalLink } from 'lucide-react';

export default function RegistrationTermsSettingsPage() {
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
            setTimeout(() => setSaved(false), 3000);
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6">
            {/* Back link */}
            <Link href="/dashboard/settings" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm transition-colors mb-8">
                <ArrowLeft className="w-4 h-4" /> Back to Settings
            </Link>

            <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Registration Terms &amp; Conditions</h1>
                        <p className="text-slate-500 text-sm mt-1">Displayed on your public student registration form</p>
                    </div>
                </div>
                {orgSlug && (
                    <a
                        href={`/register/${orgSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors text-sm"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-blue-800 text-sm font-semibold">Tip</p>
                            <p className="text-blue-700 text-sm mt-0.5">
                                Parents will see these T&Cs on Step 6 of the registration form before they submit.
                                Write clear policies covering fees, absence, notice period, and conduct.
                            </p>
                        </div>
                    </div>

                    {/* Textarea */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Terms &amp; Conditions Text
                        </label>
                        <textarea
                            id="registration-terms"
                            value={terms}
                            onChange={e => setTerms(e.target.value)}
                            placeholder={`e.g.\n\nFEES\nAll fees are due 1 month in advance. Late payment may result in loss of place.\n\nABSENCE\nFees are not refunded for absent sessions unless 48 hours notice is given.\n\nNOTICE PERIOD\nOne month's written notice is required to withdraw your child from the programme.`}
                            rows={20}
                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-sm font-mono resize-none leading-relaxed"
                        />
                        <p className="text-slate-400 text-xs mt-2 text-right">{terms.length} characters</p>
                    </div>

                    {/* Save / error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
                    )}

                    <div className="flex items-center justify-between">
                        {saved ? (
                            <span className="text-green-600 text-sm flex items-center gap-2">
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
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
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
