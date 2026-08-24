'use client';

import { useState } from 'react';
import { Loader2, RefreshCw, Key, Database, CheckCircle2 } from 'lucide-react';
import { triggerWondeSync } from '@/features/wonde/actions';

type WondeSyncResult = Awaited<ReturnType<typeof triggerWondeSync>>;

export default function WondeSettingsClient({ orgName, lastSync }: { orgName: string; lastSync: Date | null }) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<WondeSyncResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Milestone 3J Defect 5: The Wonde API key has no DB persistence mechanism
    // (no column in the schema). Removed hardcoded test key. Token management
    // UI is kept but marked non-functional until a persistence path is built.
    // The sync action (triggerWondeSync) is unaffected and remains active.

    const handleSync = async () => {
        setIsSyncing(true);
        setError(null);
        setSyncResult(null);

        try {
            const results = await triggerWondeSync();
            setSyncResult(results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to sync with Wonde');
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <Key className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">API Configuration</h2>
                            <p className="text-sm text-muted-foreground">Configure your Wonde school connection</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">School ID / Access Token</label>
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">Coming Soon</span>
                            </div>
                            <input
                                type="password"
                                placeholder="API token management coming soon"
                                disabled
                                className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm outline-none font-mono opacity-50 cursor-not-allowed"
                            />
                            <p className="text-xs text-muted-foreground mt-2">Token storage and rotation will be available in a future update.</p>
                        </div>
                        <button
                            disabled
                            title="Token management coming soon"
                            className="px-5 py-2.5 bg-secondary text-foreground font-bold rounded-xl text-sm border border-border opacity-50 cursor-not-allowed"
                        >
                            Update Token
                        </button>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <Database className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Manual Sync</h2>
                                <p className="text-sm text-muted-foreground">Pull the latest students from your MIS</p>
                            </div>
                        </div>
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Sync Now
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {syncResult && (
                        <div className="p-5 rounded-2xl bg-success/10 border border-success/20 animate-in fade-in zoom-in-95">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-5 h-5 text-success" />
                                <h3 className="font-bold text-success">Sync Completed Successfully</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-success/80 font-medium ml-7">
                                <li>• {syncResult.createdStudents} new students created</li>
                                <li>• {syncResult.matchedStudents} existing students matched</li>
                                <li>• {syncResult.createdContacts} new parent contacts created</li>
                                <li>• {syncResult.matchedContacts} existing parent contacts matched</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                    <h3 className="font-bold text-foreground mb-4">Integration Status</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <span className="px-2 py-1 bg-success/10 text-success text-xs font-bold rounded-full border border-success/20">Connected</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-sm text-muted-foreground">Organisation</span>
                            <span className="text-sm font-semibold">{orgName}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-muted-foreground">Last Sync</span>
                            <span className="text-sm font-semibold">
                                {lastSync ? new Date(lastSync).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
