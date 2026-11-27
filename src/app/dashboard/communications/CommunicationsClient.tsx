'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Send, Users, History, AlertCircle, Loader2, X, MessageSquare, MessageCircle, CheckCircle, Clock, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import {
    sendBroadcast,
    createWhatsAppBroadcast,
    markWhatsAppDeliverySent,
    getBroadcasts,
    getParentsForCentre,
    getClassesForCentre,
    getBroadcastDeliveryStats,
} from '@/features/communications/actions';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useDialogFocusTrap } from '@/components/ui/useDialogFocusTrap';
import {
    isWhatsAppCapablePhone,
    buildWhatsAppUrl,
    buildBroadcastWhatsAppMessage,
    buildCommunityWhatsAppCopy,
    formatWhatsAppRecipientDisplay,
} from '@/lib/whatsapp';
import { copyTextToClipboard } from '@/lib/clipboard';
import { WhatsAppCopyActions } from '@/components/whatsapp/WhatsAppCopyActions';

const sendMessages: Record<string, string> = {
    'Unauthorized': 'Your access could not be confirmed. Sign in again before sending.',
    'Unauthorized: only Owner/Manager may send broadcasts': 'Only an owner or manager can send broadcasts. Ask your manager for help.',
    'Unauthorized: No access to this centre': 'You do not have access to send for this centre. Ask your manager to check your centre access.',
    'Please select a specific centre before preparing a WhatsApp queue.': 'Please select a specific centre from the sidebar before preparing a WhatsApp queue.',
    'No eligible recipients with communications consent and valid email address found': 'No parents in this selection have both permission to receive messages and a usable email address. Check the recipient selection and parent records.',
    'No eligible recipients with communications consent and valid phone number found': 'No parents in this selection have both permission to receive messages and a valid WhatsApp phone number. Check the recipient selection and parent phone numbers.',
};

type Broadcast = Awaited<ReturnType<typeof getBroadcasts>>[number];
type Parent = Awaited<ReturnType<typeof getParentsForCentre>>[number];
type ClubSession = Awaited<ReturnType<typeof getClassesForCentre>>[number];
type DeliveryDetails = NonNullable<Awaited<ReturnType<typeof getBroadcastDeliveryStats>>>;

function getStatusBadge(b: Broadcast) {
    const status = b.status || (b.failureCount > 0 ? (b.successCount > 0 ? 'PARTIALLY_FAILED' : 'FAILED') : 'COMPLETED');
    switch (status) {
        case 'WHATSAPP_QUEUE':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <MessageCircle className="w-3 h-3" /> WhatsApp Queue
                </span>
            );
        case 'QUEUED':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Clock className="w-3 h-3" /> Queued
                </span>
            );
        case 'PROCESSING':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-info-soft text-accent border border-accent/20">
                    <Loader2 className="w-3 h-3 animate-spin" /> Sending
                </span>
            );
        case 'COMPLETED':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle className="w-3 h-3" /> Sent
                </span>
            );
        case 'PARTIALLY_FAILED':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    <AlertCircle className="w-3 h-3" /> Partially Failed
                </span>
            );
        case 'FAILED':
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="w-3 h-3" /> Failed
                </span>
            );
        default:
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary text-muted-foreground">
                    Status unavailable
                </span>
            );
    }
}

export default function CommunicationsClient({
    centreId,
    centreName,
    requireConfirmation,
    initialData,
}: {
    centreId: string;
    centreName?: string | null;
    requireConfirmation?: boolean;
    initialData?: {
        broadcasts: Broadcast[];
        parents: Parent[];
        classes: ClubSession[];
    };
}) {
    const shouldConfirm = requireConfirmation ?? (typeof process === 'undefined' || !process.env.VITEST);
    const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');
    const [composeChannel, setComposeChannel] = useState<'email' | 'whatsapp'>('email');
    const [copiedCommunity, setCopiedCommunity] = useState(false);
    const [copyCommunityFailed, setCopyCommunityFailed] = useState(false);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>(
        initialData ? [...initialData.broadcasts].reverse() : []
    );
    const [parents, setParents] = useState<Parent[]>(initialData?.parents ?? []);
    const [classes, setClasses] = useState<ClubSession[]>(initialData?.classes ?? []);
    const [selectedClassId, setSelectedClassId] = useState<string>('all');
    const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
    const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isLoading, setIsLoading] = useState(!initialData);
    const skipFirstLoadRef = useRef(Boolean(initialData));
    const initialCentreIdRef = useRef(centreId);
    const prevCentreIdRef = useRef(centreId);
    const broadcastDrawerRef = useRef<HTMLDivElement>(null);
    const [loadError, setLoadError] = useState(false);
    const [detailsError, setDetailsError] = useState(false);
    const [handoffError, setHandoffError] = useState<string | null>(null);
    const [sendUnknown, setSendUnknown] = useState(false);
    const sendInFlight = useRef(false);
    const loadRequest = useRef(0);
    const detailsRequest = useRef(0);

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; count: number; sent: number; failed: number; status?: string; error?: string; channel?: 'email' | 'whatsapp' } | null>(null);

    useDialogFocusTrap(Boolean(selectedBroadcast), broadcastDrawerRef, () => setSelectedBroadcast(null));

    useEffect(() => {
        if (initialData && prevCentreIdRef.current === centreId) {
            setBroadcasts([...initialData.broadcasts].reverse());
            setParents(initialData.parents);
            setClasses(initialData.classes);
        }
    }, [initialData, centreId]);

    const loadData = useCallback(async () => {
        const request = ++loadRequest.current;
        setIsLoading(true);
        setLoadError(false);
        try {
            const [bData, pData, cData] = await Promise.all([
                getBroadcasts(centreId),
                getParentsForCentre(centreId, selectedClassId),
                getClassesForCentre(centreId)
            ]);
            if (request !== loadRequest.current) return;
            setBroadcasts([...bData].reverse());
            setParents(pData);
            setClasses(cData);
        } catch {
            if (request === loadRequest.current) setLoadError(true);
        } finally {
            if (request === loadRequest.current) setIsLoading(false);
        }
    }, [centreId, selectedClassId]);

    useEffect(() => {
        if (prevCentreIdRef.current !== centreId) {
            prevCentreIdRef.current = centreId;
            setSelectedBroadcast(null);
            setSendResult(null);
            setSendUnknown(false);
            setHandoffError(null);
            if (selectedClassId !== 'all') {
                setSelectedClassId('all');
                return;
            }
        }
        if (
            skipFirstLoadRef.current &&
            centreId === initialCentreIdRef.current &&
            selectedClassId === 'all'
        ) {
            skipFirstLoadRef.current = false;
            return;
        }
        skipFirstLoadRef.current = false;
        void loadData();
    }, [centreId, selectedClassId, loadData]);

    const handleSelectBroadcast = async (b: Broadcast) => {
        const request = ++detailsRequest.current;
        setSelectedBroadcast(b);
        setDetailsError(false);
        setHandoffError(null);
        setDeliveryDetails(null);
        setIsLoadingDetails(true);
        try {
            const details = await getBroadcastDeliveryStats(b.id);
            if (request !== detailsRequest.current) return;
            setDeliveryDetails(details);
            setDetailsError(!details);
        } catch {
            if (request === detailsRequest.current) setDetailsError(true);
        } finally {
            if (request === detailsRequest.current) setIsLoadingDetails(false);
        }
    };

    const executeSend = async () => {
        if (!subject || !message || sendInFlight.current || sendUnknown || isLoading || loadError) return;

        const audienceParentIds = parents.filter(p => p.communicationsConsent).map(p => p.id);
        if (audienceParentIds.length === 0) return;

        sendInFlight.current = true;
        setIsSending(true);
        setShowConfirmModal(false);
        setSendResult(null);
        try {
            const result = await sendBroadcast({
                centreId,
                audienceParentIds,
                subject,
                message
            });
            setSendResult({ ...result, channel: 'email' });
            if (!result.success && !Object.hasOwn(sendMessages, result.error || '')) setSendUnknown(true);
            if (result.success) {
                setSubject('');
                setMessage('');
                loadData();
            }
        } catch {
            setSendUnknown(true);
        } finally {
            sendInFlight.current = false;
            setIsSending(false);
        }
    };

    const executeWhatsAppQueue = async () => {
        if (!subject || !message || sendInFlight.current || sendUnknown || isLoading || loadError) return;

        const audienceParentIds = parents
            .filter(p => p.communicationsConsent && isWhatsAppCapablePhone((p as { phone?: string | null }).phone))
            .map(p => p.id);
        if (audienceParentIds.length === 0) return;

        sendInFlight.current = true;
        setIsSending(true);
        setSendResult(null);
        setHandoffError(null);
        try {
            const result = await createWhatsAppBroadcast({
                centreId,
                audienceParentIds,
                subject,
                message,
            });
            setSendResult({ ...result, channel: 'whatsapp' });
            if (!result.success && !Object.hasOwn(sendMessages, result.error || '')) {
                setSendUnknown(true);
                return;
            }
            if (result.success && 'broadcast' in result && result.broadcast) {
                setSubject('');
                setMessage('');
                setSelectedBroadcast(result.broadcast);
                setDetailsError(false);
                setIsLoadingDetails(false);
                setDeliveryDetails({
                    broadcast: result.broadcast,
                    deliveries: result.deliveries || [],
                });
                void loadData();
            }
        } catch {
            setSendUnknown(true);
        } finally {
            sendInFlight.current = false;
            setIsSending(false);
        }
    };

    const handleCopyCommunityAnnouncement = async () => {
        if (!subject.trim() || !message.trim()) return;
        const text = buildCommunityWhatsAppCopy({
            subject,
            message,
            centreName,
        });
        const ok = await copyTextToClipboard(text);
        if (ok) {
            setCopyCommunityFailed(false);
            setCopiedCommunity(true);
            setTimeout(() => setCopiedCommunity(false), 2500);
        } else {
            setCopiedCommunity(false);
            setCopyCommunityFailed(true);
        }
    };

    const handleMarkWhatsAppOpened = (deliveryId: string) => {
        if (!deliveryDetails) return;
        const target = deliveryDetails.deliveries.find((d) => d.id === deliveryId);
        if (!target || target.status === 'SENT') return;

        const previousDetails = deliveryDetails;
        const previousBroadcast = deliveryDetails.broadcast;
        setHandoffError(null);

        const updatedDeliveries = deliveryDetails.deliveries.map((d) =>
            d.id === deliveryId ? { ...d, status: 'SENT', sentAt: new Date() } : d
        );
        const nextSuccess = updatedDeliveries.filter((d) => d.status === 'SENT').length;
        const nextStatus = nextSuccess >= (deliveryDetails.broadcast.recipientCount || updatedDeliveries.length)
            ? 'COMPLETED'
            : deliveryDetails.broadcast.status;
        const updatedBroadcast = { ...deliveryDetails.broadcast, successCount: nextSuccess, status: nextStatus };

        setDeliveryDetails({ broadcast: updatedBroadcast, deliveries: updatedDeliveries });
        setSelectedBroadcast((curr) => (curr && curr.id === updatedBroadcast.id ? updatedBroadcast : curr));
        setBroadcasts((list) => list.map((b) => (b.id === updatedBroadcast.id ? updatedBroadcast : b)));

        const rollbackOptimisticHandoff = (errorMessage: string) => {
            setHandoffError(errorMessage);
            setDeliveryDetails((curr) => {
                if (!curr || curr.broadcast.id !== previousBroadcast.id) return curr;
                const revertedDeliveries = curr.deliveries.map((d) =>
                    d.id === deliveryId ? target : d
                );
                const revertedSuccess = revertedDeliveries.filter((d) => d.status === 'SENT').length;
                const revertedStatus = revertedSuccess >= (curr.broadcast.recipientCount || revertedDeliveries.length)
                    ? 'COMPLETED'
                    : previousBroadcast.status;
                const revertedBroadcast = { ...curr.broadcast, successCount: revertedSuccess, status: revertedStatus };
                setSelectedBroadcast((sel) => (sel && sel.id === revertedBroadcast.id ? revertedBroadcast : sel));
                setBroadcasts((list) => list.map((b) => (b.id === revertedBroadcast.id ? revertedBroadcast : b)));
                return { broadcast: revertedBroadcast, deliveries: revertedDeliveries };
            });
            void previousDetails;
        };

        void markWhatsAppDeliverySent(deliveryId)
            .then((res) => {
                if (!res?.success) {
                    rollbackOptimisticHandoff(
                        sendMessages[res?.error || ''] || 'Could not record WhatsApp handoff in the audit log. Please refresh and try again.'
                    );
                }
            })
            .catch(() => {
                rollbackOptimisticHandoff('Could not record WhatsApp handoff in the audit log. Please refresh and try again.');
            });
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !message || sendInFlight.current || sendUnknown || isLoading || loadError) return;

        if (composeChannel === 'whatsapp') {
            void executeWhatsAppQueue();
            return;
        }

        const audienceParentIds = parents.filter(p => p.communicationsConsent).map(p => p.id);
        if (audienceParentIds.length === 0) return;

        if (shouldConfirm) {
            setShowConfirmModal(true);
        } else {
            void executeSend();
        }
    };

    const consentedParents = parents.filter(p => p.communicationsConsent);
    const consentedCount = consentedParents.length;
    const whatsappParents = consentedParents.filter(p => isWhatsAppCapablePhone((p as { phone?: string | null }).phone));
    const whatsappCount = whatsappParents.length;
    const missingPhoneCount = consentedCount - whatsappCount;
    const activeRecipientCount = composeChannel === 'whatsapp' ? whatsappCount : consentedCount;

    return (
        <div className="space-y-6">
            <ConfirmModal
                isOpen={showConfirmModal}
                title="Confirm Broadcast Send"
                message={`Are you sure you want to send "${subject}" to ${consentedCount} consented ${consentedCount === 1 ? 'recipient' : 'recipients'}?`}
                confirmText={`Send to ${consentedCount} ${consentedCount === 1 ? 'Parent' : 'Parents'}`}
                cancelText="Cancel"
                onConfirm={() => { void executeSend(); }}
                onCancel={() => setShowConfirmModal(false)}
            />
            <div className="inline-flex flex-wrap bg-secondary/60 p-1 rounded-2xl gap-1">
                <button
                    type="button"
                    aria-pressed={activeTab === 'compose'}
                    onClick={() => setActiveTab('compose')}
                    className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'compose' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Send className="w-4 h-4" />
                    Compose
                </button>
                <button
                    type="button"
                    aria-pressed={activeTab === 'history'}
                    onClick={() => setActiveTab('history')}
                    className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <History className="w-4 h-4" />
                    History &amp; Audit Log
                </button>
            </div>

            {loadError && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p>We couldn’t load recipients and message history. Sending is paused until these details can be checked. Your draft is still here.</p>
                <button type="button" onClick={() => void loadData()} className="mt-2 min-h-10 font-semibold underline">Try loading again</button>
            </div>}
            {sendUnknown && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
                <p>The send outcome could not be confirmed. Your message may already be queued. Do not send it again until you have checked History &amp; Audit Log. If it is still unclear, ask your manager to check delivery before retrying.</p>
                <button type="button" onClick={() => { setActiveTab('history'); void loadData(); }} className="mt-2 min-h-10 font-semibold underline">Check message history</button>
            </div>}

            {activeTab === 'compose' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">Compose Message</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Choose automated email or zero-cost WhatsApp assisted handoff
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {centreName && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                        Sending for: {centreName}
                                    </span>
                                )}
                                <div className="inline-flex bg-secondary/60 p-1 rounded-xl gap-1" role="group" aria-label="Delivery channel">
                                    <button
                                        type="button"
                                        aria-pressed={composeChannel === 'email'}
                                        onClick={() => { setComposeChannel('email'); setSendResult(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            composeChannel === 'email'
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                                        Email
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={composeChannel === 'whatsapp'}
                                        onClick={() => { setComposeChannel('whatsapp'); setSendResult(null); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            composeChannel === 'whatsapp'
                                                ? 'bg-emerald-700 text-white shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                        WhatsApp (Free)
                                    </button>
                                </div>
                            </div>
                        </div>

                        {sendResult && sendResult.success && sendResult.channel !== 'whatsapp' && (
                            <div className="mb-6 p-4 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium">
                                Successfully queued message to {sendResult.count} parents. Delivery is being processed securely in the background.
                            </div>
                        )}
                        {sendResult && sendResult.success && sendResult.channel === 'whatsapp' && (
                            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-sm font-medium">
                                Prepared WhatsApp queue for {sendResult.count} consented {sendResult.count === 1 ? 'parent' : 'parents'}. Open each chat in the Launch Queue drawer to send from your club WhatsApp at £0 cost.
                            </div>
                        )}
                        {sendResult && !sendResult.success && !sendUnknown && (
                            <div role="alert" className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {sendMessages[sendResult.error || ''] || 'Check message history before sending again.'}
                            </div>
                        )}

                        {composeChannel === 'whatsapp' && (
                            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-xs text-foreground">
                                <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                                <div>
                                    <p className="font-bold text-emerald-800 dark:text-emerald-300">UK GDPR Privacy Tip — £0 Forever WhatsApp</p>
                                    <p className="text-muted-foreground mt-0.5">
                                        Use <strong>Copy for WhatsApp Community</strong> to paste into a WhatsApp Community Announcement group (where parent phone numbers remain hidden from other parents), or use <strong>Prepare 1-to-1 WhatsApp Queue</strong> for individual personalised chats.
                                    </p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSend} className="space-y-5">
                            <div>
                                <label htmlFor="broadcast-subject" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Subject</label>
                                <input
                                    id="broadcast-subject"
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="e.g. Important Update: Centre Closure Tomorrow"
                                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="broadcast-message" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Message Body</label>
                                <textarea
                                    id="broadcast-message"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={8}
                                    placeholder="Type your message here..."
                                    className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-y"
                                    required
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border">
                                {composeChannel === 'whatsapp' ? (
                                    <>
                                        <button
                                            type="button"
                                            disabled={!subject.trim() || !message.trim()}
                                            onClick={() => void handleCopyCommunityAnnouncement()}
                                            className="px-5 py-3 bg-secondary hover:bg-secondary/80 text-foreground font-bold rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {copiedCommunity ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                                            {copiedCommunity ? 'Copied for Community!' : 'Copy for WhatsApp Community'}
                                        </button>
                                        <span className="sr-only" aria-live="polite">
                                            {copiedCommunity ? 'Announcement copied for WhatsApp Community' : ''}
                                        </span>
                                        {copyCommunityFailed && (
                                            <p role="alert" className="w-full text-right text-xs font-medium text-destructive">
                                                Couldn&apos;t copy automatically. Select the subject and message above and copy them manually (Ctrl/Cmd+C).
                                            </p>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={isSending || isLoading || loadError || sendUnknown || whatsappCount === 0}
                                            className="px-6 py-3 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                                            Prepare 1-to-1 WhatsApp Queue
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={isSending || isLoading || loadError || sendUnknown || consentedCount === 0}
                                        className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Send Broadcast
                                    </button>
                                )}
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
                                <label htmlFor="broadcast-target-class" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Class</label>
                                <select
                                    id="broadcast-target-class"
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full px-4 py-3 bg-secondary/30 border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
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
                                    {isLoading || loadError ? '—' : activeRecipientCount}{' '}
                                    <span className="text-sm font-semibold text-muted-foreground">
                                        {composeChannel === 'whatsapp' ? 'WhatsApp recipients' : 'recipients'}
                                    </span>
                                </div>
                                {composeChannel === 'whatsapp' && missingPhoneCount > 0 && (
                                    <p className="text-xs text-muted-foreground flex gap-1.5 mt-3 pt-3 border-t border-border/50">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>{missingPhoneCount} consented parent{missingPhoneCount > 1 ? 's' : ''} have no valid mobile number recorded.</span>
                                    </p>
                                )}
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
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm text-left">
                        <thead className="bg-secondary/40 border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Date</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Subject</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Status</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Intended</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Sent</th>
                                <th className="px-6 py-4 font-bold text-muted-foreground uppercase text-xs tracking-wider">Failed</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading history...</td>
                                </tr>
                            ) : loadError ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Message history could not be loaded. Use Try loading again above.</td></tr>
                            ) : broadcasts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-6">
                                        <div className="bg-surface border border-border rounded-xl p-12 text-center flex flex-col items-center gap-4">
                                          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                                            <MessageSquare className="w-8 h-8 text-primary" />
                                          </div>
                                          <div>
                                            <p className="text-lg font-black text-foreground">No messages yet</p>
                                            <p className="text-sm text-muted-foreground mt-1">Send your first broadcast to parents and staff</p>
                                          </div>
                                          <button onClick={() => setActiveTab('compose')} className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity">
                                            Compose Message
                                          </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                broadcasts.map((b) => (
                                    <tr key={b.id} onClick={() => handleSelectBroadcast(b)} className="hover:bg-secondary/20 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4 font-medium">{new Date(b.createdAt).toLocaleString('en-GB')}</td>
                                        <td className="px-6 py-4 font-semibold text-foreground max-w-xs truncate"><button type="button" onClick={(e) => { e.stopPropagation(); void handleSelectBroadcast(b); }} className="text-left max-w-full truncate hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-sm">{b.subject}</button></td>
                                        <td className="px-6 py-4">{getStatusBadge(b)}</td>
                                        <td className="px-6 py-4 font-medium text-foreground">{b.recipientCount}</td>
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
                </div>
            )}

            {/* Slide-out History / WhatsApp Launch Queue Drawer */}
            {selectedBroadcast && (
                <div
                    className="fixed inset-0 z-50 flex justify-end"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="broadcast-details-title"
                >
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setSelectedBroadcast(null)}
                    />
                    <div ref={broadcastDrawerRef} tabIndex={-1} className="relative w-full max-w-lg bg-card shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300 border-l border-border">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <div>
                                <h2 id="broadcast-details-title" className="text-lg font-bold text-foreground">
                                    {selectedBroadcast.status === 'WHATSAPP_QUEUE' ? 'WhatsApp Launch Queue' : 'Broadcast Details'}
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {selectedBroadcast.status === 'WHATSAPP_QUEUE'
                                        ? 'Copy each message and paste it into WhatsApp Web, or use Open in WhatsApp (this can reload an open WhatsApp Web tab). Only Open in WhatsApp marks a parent as handled.'
                                        : 'Delivery audit and recipient ledger'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedBroadcast(null)}
                                aria-label="Close broadcast details"
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 hover:bg-secondary/80 rounded-full transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Subject</label>
                                    <div className="font-semibold text-foreground text-lg">{selectedBroadcast.subject}</div>
                                    <div className="text-xs text-muted-foreground mt-1">Queued on {new Date(selectedBroadcast.createdAt).toLocaleString('en-GB')}</div>
                                </div>
                                <div className="shrink-0 pt-1">
                                    {getStatusBadge(selectedBroadcast)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-secondary/40 border border-border p-3 rounded-2xl text-center">
                                    <div className="text-xl font-black text-foreground">{selectedBroadcast.recipientCount}</div>
                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Total</div>
                                </div>
                                <div className="bg-success/10 border border-success/20 p-3 rounded-2xl text-center">
                                    <div className="text-xl font-black text-success">{selectedBroadcast.successCount}</div>
                                    <div className="text-[10px] font-bold text-success/80 uppercase tracking-wider mt-1">Sent</div>
                                </div>
                                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-2xl text-center">
                                    <div className="text-xl font-black text-destructive">{selectedBroadcast.failureCount}</div>
                                    <div className="text-[10px] font-bold text-destructive/80 uppercase tracking-wider mt-1">Failed</div>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-center">
                                    <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                                        {Math.max(0, (selectedBroadcast.recipientCount || 0) - (selectedBroadcast.successCount || 0) - (selectedBroadcast.failureCount || 0))}
                                    </div>
                                    <div className="text-[10px] font-bold text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider mt-1">Pending</div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Message Content</label>
                                <div className="bg-secondary/30 border border-border p-5 rounded-2xl text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                                    {selectedBroadcast.message}
                                </div>
                            </div>

                            {/* Recipient Deliveries Ledger */}
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Delivery Ledger</label>
                                {handoffError && (
                                    <div role="alert" className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                        <span>{handoffError}</span>
                                    </div>
                                )}
                                {isLoadingDetails ? (
                                    <div className="p-4 text-center text-xs text-muted-foreground">Loading delivery status...</div>
                                ) : detailsError ? (
                                    <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
                                        <p>We couldn’t load delivery details. This does not mean the message failed to send.</p>
                                        <button type="button" onClick={() => void handleSelectBroadcast(selectedBroadcast)} className="mt-2 min-h-10 font-semibold underline">Try loading delivery details again</button>
                                    </div>
                                ) : deliveryDetails && deliveryDetails.deliveries.length > 0 ? (
                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                        {deliveryDetails.deliveries.map((d) => {
                                            const isWhatsAppRow = d.channel === 'whatsapp' || String(d.recipientEmail || '').startsWith('whatsapp:');
                                            const rawPhoneFromRecipient = String(d.recipientEmail || '').startsWith('whatsapp:')
                                                ? String(d.recipientEmail).slice('whatsapp:'.length)
                                                : null;
                                            const firstNameOnly = d.recipientName ? d.recipientName.split(' ')[0] : null;
                                            const rowWhatsAppMessage = isWhatsAppRow
                                                ? buildBroadcastWhatsAppMessage({
                                                      firstName: firstNameOnly,
                                                      subject: selectedBroadcast.subject,
                                                      message: selectedBroadcast.message,
                                                      centreName,
                                                  })
                                                : null;
                                            const rowWhatsAppUrl = rowWhatsAppMessage
                                                ? buildWhatsAppUrl(rawPhoneFromRecipient, rowWhatsAppMessage)
                                                : null;

                                            return (
                                                <div key={d.id} className="p-3 bg-secondary/20 border border-border rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
                                                    <div className="truncate max-w-[200px]">
                                                        {d.parentId ? (
                                                            <Link
                                                                href={`/dashboard/parents/${d.parentId}`}
                                                                className="font-semibold text-foreground hover:text-primary hover:underline transition-colors block truncate"
                                                            >
                                                                {d.recipientName || 'Parent'}
                                                            </Link>
                                                        ) : (
                                                            <div className="font-semibold text-foreground truncate">{d.recipientName || 'Parent'}</div>
                                                        )}
                                                        <div className="text-[11px] text-muted-foreground truncate">
                                                            {formatWhatsAppRecipientDisplay(d.recipientEmail)}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {rowWhatsAppUrl && (
                                                            <>
                                                            {/* Copy never marks the delivery as sent; only opening the chat does (existing behaviour). */}
<WhatsAppCopyActions phone={rawPhoneFromRecipient} message={rowWhatsAppMessage} recipientName={d.recipientName} variant="pill" />
                                                            <a
                                                                href={rowWhatsAppUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={() => handleMarkWhatsAppOpened(d.id)}
                                                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                                                                    d.status === 'SENT'
                                                                        ? 'bg-secondary text-muted-foreground hover:text-foreground'
                                                                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                                                                }`}
                                                            >
                                                                <MessageCircle className="w-3 h-3" aria-hidden="true" />
                                                                {d.status === 'SENT' ? 'Re-open' : 'Open in WhatsApp'}
                                                                <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                                                            </a>
                                                            </>
                                                        )}
                                                        <div className="text-right">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                                d.status === 'SENT' ? 'bg-success/10 text-success' :
                                                                d.status === 'FAILED' ? 'bg-destructive/10 text-destructive' :
                                                                'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                            }`}>
                                                                {d.status === 'AWAITING_HANDOFF' ? 'READY' : d.status}
                                                            </span>
                                                            {d.lastError && (
                                                                <p className="mt-1 max-w-[200px] text-xs text-destructive">Delivery needs checking. Review the parent’s email address and ask your manager to check delivery before sending again.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                                        No individual delivery records found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
