'use client';

import { useState } from 'react';
import { exportOrganisationData } from './gdpr.actions';
import { Download, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';

export default function GdprExportButton() {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleExport = async () => {
        setLoading(true);
        try {
            const result = await exportOrganisationData();
            if (!result.ok || !result.json) {
                const errMsg = result.error || 'Export failed.';
                toast({ title: 'Export failed', message: errMsg, variant: 'error' });
                return;
            }
            const blob = new Blob([result.json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast({ title: 'Export ready', message: 'GDPR data export downloaded successfully.', variant: 'success' });
        } catch {
            toast({ title: 'Export failed', message: 'Something went wrong. Please try again.', variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-foreground font-bold text-sm">GDPR Data Export</h3>
                    <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                        Download all personal data stored by your organisation (parents, students, registrations, bookings)
                        as a JSON file. Use this to fulfil Subject Access Requests.
                    </p>
                </div>
                <button
                    onClick={handleExport}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border text-foreground hover:bg-secondary/80 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex-shrink-0"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {loading ? 'Exporting…' : 'Export Data'}
                </button>
            </div>
        </div>
    );
}
