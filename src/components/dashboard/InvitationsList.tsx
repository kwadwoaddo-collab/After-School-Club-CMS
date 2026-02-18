'use client';

import { useState } from 'react';
import { Mail, Clock, CheckCircle2, XCircle, Trash2, AlertTriangle } from 'lucide-react';
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
        ORG_OWNER: 'bg-purple-100 text-purple-700 border-purple-200',
        MANAGER: 'bg-blue-100 text-blue-700 border-blue-200',
        FRONT_DESK: 'bg-green-100 text-green-700 border-green-200',
        TUTOR: 'bg-amber-100 text-amber-700 border-amber-200',
    };
    return styles[role] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const statusConfig = {
    accepted: {
        label: 'Accepted',
        Icon: CheckCircle2,
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconClass: 'text-emerald-500',
    },
    pending: {
        label: 'Pending',
        Icon: Clock,
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        iconClass: 'text-amber-500',
    },
    expired: {
        label: 'Expired',
        Icon: XCircle,
        classes: 'bg-red-50 text-red-600 border-red-200',
        iconClass: 'text-red-400',
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
        <div className="glass-card rounded-[32px] overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5 text-slate-600" />
                        <h2 className="text-lg font-bold text-slate-900">
                            Invitations ({items.length})
                        </h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Track all staff invitations you've sent</p>
                </div>
                {expiredCount > 0 && (
                    <button
                        onClick={handleClearExpired}
                        disabled={clearingExpired}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        {clearingExpired ? 'Clearing...' : `Clear ${expiredCount} expired`}
                    </button>
                )}
            </div>

            {/* List */}
            <div className="divide-y divide-slate-100">
                {items.map((invite) => {
                    const status = getStatus(invite);
                    const cfg = statusConfig[status];
                    const { Icon } = cfg;
                    const isConfirming = confirmId === invite.id;
                    const isDeleting = deletingId === invite.id;

                    return (
                        <div key={invite.id} className="px-8 py-5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between gap-4">
                                {/* Left: info */}
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">{invite.email}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadge(invite.role)}`}>
                                                {invite.role.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                Sent {new Date(invite.createdAt).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                })}
                                            </span>
                                            {status === 'accepted' && invite.usedAt && (
                                                <span className="text-xs text-slate-400">
                                                    · Accepted {new Date(invite.usedAt).toLocaleDateString('en-GB', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}
                                                </span>
                                            )}
                                            {status === 'pending' && (
                                                <span className="text-xs text-slate-400">
                                                    · Expires {new Date(invite.expiresAt).toLocaleDateString('en-GB', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}
                                                </span>
                                            )}
                                            {status === 'expired' && (
                                                <span className="text-xs text-red-400">
                                                    · Expired {new Date(invite.expiresAt).toLocaleDateString('en-GB', {
                                                        day: 'numeric', month: 'short', year: 'numeric',
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: status + delete */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.classes}`}>
                                        <Icon className={`w-3.5 h-3.5 ${cfg.iconClass}`} />
                                        {cfg.label}
                                    </div>

                                    {/* Delete / Confirm */}
                                    {isConfirming ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                Remove?
                                            </span>
                                            <button
                                                onClick={() => handleDelete(invite.id)}
                                                disabled={isDeleting}
                                                className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                                            >
                                                {isDeleting ? '...' : 'Yes, delete'}
                                            </button>
                                            <button
                                                onClick={() => setConfirmId(null)}
                                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmId(invite.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
        </div>
    );
}
