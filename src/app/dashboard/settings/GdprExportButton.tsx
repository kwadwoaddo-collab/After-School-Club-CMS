'use client';

import { useState } from 'react';
import { exportOrganisationData } from './gdpr.actions';
import { Download, Loader2, ShieldCheck } from 'lucide-react';

export default function GdprExportButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleExport = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await exportOrganisationData();
            if (!result.ok || !result.json) {
                setError(result.error || 'Export failed.');
                return;
            }
            const blob = new Blob([result.json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#1a1d23] rounded-2xl border border-[#424754]/15 p-6">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#adc6ff]/10 border border-[#adc6ff]/20 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-[#adc6ff]" />
                </div>
                <div className="flex-1">
                    <h3 className="text-white font-bold text-sm">GDPR Data Export</h3>
                    <p className="text-[#8c909f] text-xs mt-1">
                        Download all personal data stored by your organisation (parents, students, registrations, bookings)
                        as a JSON file. Use this to fulfil Subject Access Requests.
                    </p>
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                </div>
                <button
                    onClick={handleExport}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#2a2a2a] border border-[#424754]/30 text-[#e5e2e1] hover:bg-[#353535] rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex-shrink-0"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {loading ? 'Exporting...' : 'Export Data'}
                </button>
            </div>
        </div>
    );
}
