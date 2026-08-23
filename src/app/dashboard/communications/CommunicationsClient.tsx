'use client';

import { useState, useEffect, useCallback } from 'react';
import { Send, Users, History, AlertCircle, Loader2, X, MessageSquare } from 'lucide-react';
import { sendBroadcast, getBroadcasts, getParentsForCentre, getClassesForCentre } from '@/features/communications/actions';
import { logger } from '@/lib/logger';

type Broadcast = Awaited<ReturnType<typeof getBroadcasts>>[number];
type Parent = Awaited<ReturnType<typeof getParentsForCentre>>[number];
type ClubSession = Awaited<ReturnType<typeof getClassesForCentre>>[number];

export default function CommunicationsClient({ centreId }: { centreId: string }) {
    const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [parents, setParents] = useState<Parent[]>([]);
    const [classes, setClasses] = useState<ClubSession[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; count: number; sent: number; failed: number; error?: string } | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [bData, pData, cData] = await Promise.all([
                getBroadcasts(centreId),
                getParentsForCentre(centreId, selectedClassId),
                getClassesForCentre(centreId)
            ]);
            setBroadcasts(bData.reverse());
            setParents(pData);
            setClasses(cData);
        } catch (error) {
            logger.error('Failed to load data', error);
        } finally {
            setIsLoading(false);
        }
    }, [centreId, selectedClassId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !message) return;

        const audienceParentIds = parents.filter(p => p.communicationsConsent).map(p => p.id);
        if (audienceParentIds.length === 0) return;

        setIsSending(true);
        setSendResult(null);
        try {
            const result = await sendBroadcast({
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
            logger.error('Failed to send broadcast', error);
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
                        
                        {sendResult && sendResult.success && (
                            <div className="mb-6 p-4 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
                                Successfully queued message to {sendResult.count} parents.
                            </div>
                        )}
                        {sendResult && !sendResult.success && (
                            <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {sendResult.error || 'Could not send this broadcast.'}
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
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Recipient Picker</h3>
                                    <p className="text-xs text-muted-foreground">Select target audience</p>
                                </div>
                            </div>
                            
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Class</label>
                                <select 
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full px-4 py-3 bg-secondary/30 border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                                >
                                    <option value="all">All Parents</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {String(c.type).replace('_', ' ')} - {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.weekday]} ({c.startTime})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                                <div className="text-3xl font-black text-foreground mb-1">
                                    {isLoading ? '-' : consentedCount} <span className="text-sm font-semibold text-muted-foreground">recipients</span>
                                </div>
                                {parents.length - consentedCount > 0 && (
                                    <p className="text-xs text-muted-foreground flex gap-1.5 mt-3 pt-3 border-t border-border/50">
                                        <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                                        <span>{parents.length - consentedCount} parent{parents.length - consentedCount > 1 ? 's' : ''} excluded due to GDPR opt-out.</span>
                                    </p>
                                )}
                            </div>
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
                                    <td colSpan={4} className="p-6">
                                        <div className="glassmorphic-card rounded-3xl p-12 text-center flex flex-col items-center gap-4">
                                          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                            <MessageSquare className="w-8 h-8 text-primary" />
                                          </div>
                                          <div>
                                            <p className="text-lg font-black text-foreground">No messages yet</p>
                                            <p className="text-sm text-muted-foreground mt-1">Send your first broadcast to parents and staff</p>
                                          </div>
                                          <button onClick={() => setActiveTab('compose')} className="px-6 py-3 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity">
                                            Compose Message
                                          </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                broadcasts.map((b) => (
                                    <tr key={b.id} onClick={() => setSelectedBroadcast(b)} className="hover:bg-secondary/20 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4 font-medium">{new Date(b.createdAt).toLocaleString('en-GB')}</td>
                                        <td className="px-6 py-4 font-semibold text-foreground max-w-xs truncate group-hover:text-primary transition-colors">{b.subject}</td>
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

            {/* Slide-out History Drawer */}
            {selectedBroadcast && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
                        onClick={() => setSelectedBroadcast(null)} 
                    />
                    <div className="relative w-full max-w-md bg-card shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300 border-l border-border">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-lg font-bold text-foreground">Broadcast Details</h2>
                            <button 
                                onClick={() => setSelectedBroadcast(null)}
                                className="p-2 hover:bg-secondary/80 rounded-full transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Subject</label>
                                <div className="font-semibold text-foreground text-lg">{selectedBroadcast.subject}</div>
                                <div className="text-sm text-muted-foreground mt-1">Sent on {new Date(selectedBroadcast.createdAt).toLocaleString('en-GB')}</div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-success/10 border border-success/20 p-4 rounded-2xl">
                                    <div className="text-2xl font-black text-success">{selectedBroadcast.successCount}</div>
                                    <div className="text-xs font-bold text-success/80 uppercase tracking-wider mt-1">Delivered</div>
                                </div>
                                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl">
                                    <div className="text-2xl font-black text-destructive">{selectedBroadcast.failureCount}</div>
                                    <div className="text-xs font-bold text-destructive/80 uppercase tracking-wider mt-1">Failed</div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Message Content</label>
                                <div className="bg-secondary/30 border border-border p-5 rounded-2xl text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                                    {selectedBroadcast.message}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
