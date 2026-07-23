'use client';

import { useState, useEffect } from 'react';
import { Send, Users, History, AlertCircle, Loader2 } from 'lucide-react';
import { sendBroadcast, getBroadcasts, getParentsForCentre } from '@/features/communications/actions';

type Broadcast = any;
type Parent = any;

export default function CommunicationsClient({ organisationId, centreId }: { organisationId: string; centreId: string }) {
    const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [parents, setParents] = useState<Parent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; count: number; sent: number; failed: number } | null>(null);

    useEffect(() => {
        loadData();
    }, [centreId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [bData, pData] = await Promise.all([
                getBroadcasts(centreId),
                getParentsForCentre(centreId)
            ]);
            setBroadcasts(bData.reverse());
            setParents(pData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !message) return;

        setIsSending(true);
        setSendResult(null);
        try {
            const audienceParentIds = parents.map(p => p.id);
            const result = await sendBroadcast({
                organisationId,
                centreId,
                audienceParentIds,
                subject,
                message
            });
            setSendResult(result);
            if (result.success) {
                setSubject('');
                setMessage('');
                loadData();
            }
        } catch (error) {
            console.error('Failed to send broadcast:', error);
        } finally {
            setIsSending(false);
        }
    };

    const consentedCount = parents.filter(p => p.communicationsConsent).length;

    return (
        <div className="space-y-6">
            <div className="inline-flex bg-secondary/60 p-1 rounded-2xl gap-1">
                <button
                    onClick={() => setActiveTab('compose')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'compose' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Send className="w-4 h-4" />
                    Compose
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <History className="w-4 h-4" />
                    History &amp; Audit Log
                </button>
            </div>

            {activeTab === 'compose' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
                        <h2 className="text-xl font-bold text-foreground mb-6">Compose Message</h2>
                        
                        {sendResult && (
                            <div className="mb-6 p-4 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
                                Successfully queued message to {sendResult.count} parents ({sendResult.sent} sent, {sendResult.failed} failed).
                            </div>
                        )}

                        <form onSubmit={handleSend} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Subject</label>
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="e.g. Important Update: Centre Closure Tomorrow"
                                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Message Body</label>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={8}
                                    placeholder="Type your message here..."
                                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-y"
                                    required
                                />
                            </div>
                            <div className="flex justify-end pt-4 border-t border-border">
                                <button
                                    type="submit"
                                    disabled={isSending || isLoading || consentedCount === 0}
                                    className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Send Broadcast
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Audience Size</h3>
                                    <p className="text-xs text-muted-foreground">Currently targeting All Parents</p>
                                </div>
                            </div>
                            <div className="text-3xl font-black text-foreground mb-2">
                                {isLoading ? '-' : consentedCount} <span className="text-base font-semibold text-muted-foreground">recipients</span>
                            </div>
                            <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-xl flex gap-2">
                                <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                                <span>Note: {parents.length - consentedCount} parents are excluded because they have opted out of communications.</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-secondary/40 border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Date Sent</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Subject</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Delivered</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Failed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading history...</td>
                                </tr>
                            ) : broadcasts.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground italic">No broadcasts sent yet.</td>
                                </tr>
                            ) : (
                                broadcasts.map((b) => (
                                    <tr key={b.id} className="hover:bg-secondary/20 transition-colors">
                                        <td className="px-6 py-4 font-medium">{new Date(b.createdAt).toLocaleString('en-GB')}</td>
                                        <td className="px-6 py-4 font-semibold text-foreground max-w-xs truncate">{b.subject}</td>
                                        <td className="px-6 py-4 text-success font-bold">{b.successCount}</td>
                                        <td className="px-6 py-4">
                                            {b.failureCount > 0 ? (
                                                <span className="text-destructive font-bold">{b.failureCount}</span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
