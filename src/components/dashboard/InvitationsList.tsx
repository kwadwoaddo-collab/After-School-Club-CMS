'use client';

import { useState } from 'react';
import { Mail, Clock, CheckCircle2, XCircle, Trash2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Invite = {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
    expiresAt: Date;
    usedAt: Date | null;
};

type Status = 'accepted' | 'pending' | 'expired';

const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
        ORG_OWNER: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        MANAGER: 'bg-primary/10 text-primary border-primary/20',
        FRONT_DESK: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        TUTOR: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    };
    return styles[role] || 'bg-secondary text-muted-foreground border-border';
};

const statusConfig = {
    accepted: {
        label: 'Accepted',
        Icon: CheckCircle2,
        classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    pending: {
        label: 'Pending',
        Icon: Clock,
        classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        iconClass: 'text-amber-700 dark:text-amber-400',
    },
    expired: {
        label: 'Expired',
        Icon: XCircle,
        classes: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        iconClass: 'text-red-600 dark:text-red-400',
    },
};

function getStatus(invite: Invite): Status {
    if (invite.usedAt) return 'accepted';
    if (new Date() > new Date(invite.expiresAt)) return 'expired';
    return 'pending';
}

export default function InvitationsList({ invitations }: { invitations: Invite[] }) {
    const router = useRouter();
    const [items, setItems] = useState(invitations);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [clearingExpired, setClearingExpired] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    const expiredCount = items.filter(i => getStatus(i) === 'expired').length;

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await fetch(`/api/staff/invites/${id}`, { method: 'DELETE' });
            setItems(prev => prev.filter(i => i.id !== id));
        } finally {
            setDeletingId(null);
            setConfirmId(null);
        }
    };

    const handleClearExpired = async () => {
        setClearingExpired(true);
        try {
            await fetch('/api/staff/invites/clear-expired', { method: 'DELETE' });
            setItems(prev => prev.filter(i => getStatus(i) !== 'expired'));
        } finally {
            setClearingExpired(false);
        }
    };

    if (items.length === 0) return null;

    return (
        <div className="bg-card rounded-[32px] overflow-hidden border border-border shadow-sm h-full">
            {/* Header - Clickable to toggle collapse */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="px-8 py-6 border-b border-border flex items-center justify-between hover:bg-secondary transition-colors cursor-pointer select-none"
            >
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-foreground">
                            Invitations
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary text-muted-foreground border border-border">
                            {items.length}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Track all staff invitations you've sent</p>
                </div>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {expiredCount > 0 && (
                        <button
                            onClick={handleClearExpired}
                            disabled={clearingExpired}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-colors disabled:opacity-50 active:scale-95 duration-100"
                        >
                            <Trash2 className="w-4 h-4" />
                            {clearingExpired ? 'Clearing...' : `Clear ${expiredCount} expired`}
                        </button>
                    )}
                    {isCollapsed ? (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* List - only visible when not collapsed */}
            {!isCollapsed && (
                <div className="divide-y divide-border animate-in fade-in slide-in-from-top-1 duration-150">
                {items.map((invite) => {
                    const status = getStatus(invite);
                    const cfg = statusConfig[status];
                    const { Icon } = cfg;
                    const isConfirming = confirmId === invite.id;
                    const isDeleting = deletingId === invite.id;

                    return (
                        <div key={invite.id} className="p-4 sm:px-8 sm:py-5 hover:bg-secondary/40 transition-colors group">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                {/* Left: info */}
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-foreground truncate text-base">{invite.email}</p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadge(invite.role)}`}>
                                                {invite.role.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Sent {new Date(invite.createdAt).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                })}
                                            </span>
                                            {status === 'accepted' && invite.usedAt && (
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    · <span className="text-emerald-600 dark:text-emerald-400">Accepted {new Date(invite.usedAt).toLocaleDateString('en-GB', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}</span>
                                                </span>
                                            )}
                                            {status === 'pending' && (
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    · Expires {new Date(invite.expiresAt).toLocaleDateString('en-GB', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}
                                                </span>
                                            )}
                                            {status === 'expired' && (
                                                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                                    · Expired {new Date(invite.expiresAt).toLocaleDateString('en-GB', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: status + delete */}
                                <div className="flex items-center gap-3 flex-shrink-0 self-start sm:self-auto">
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold border ${cfg.classes}`}>
                                        <Icon className={`w-3.5 h-3.5 ${cfg.iconClass}`} />
                                        {cfg.label}
                                    </div>

                                    {/* Delete / Confirm */}
                                    {isConfirming ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-bold">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                Remove?
                                            </span>
                                            <button
                                                onClick={() => handleDelete(invite.id)}
                                                disabled={isDeleting}
                                                className="px-3 py-1.5 text-xs font-bold bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                                            >
                                                {isDeleting ? '...' : 'Yes, delete'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmId(null)}
                                                className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground rounded-lg transition-colors border border-transparent hover:border-border"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmId(invite.id)}
                                            className="p-2 text-muted-foreground/60 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors border border-transparent hover:border-red-500/20"
                                            title="Delete invitation"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                </div>
            )}
        </div>
    );
}
