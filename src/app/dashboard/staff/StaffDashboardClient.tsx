'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users, Mail, Shield, Building2, Trash2, ChevronDown,
    Clock, CheckCircle2, XCircle, UserCog, Loader2, Crown
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import { format } from 'date-fns';

const ROLE_LABELS: Record<string, string> = {
    ORG_OWNER: 'Owner',
    MANAGER: 'Manager',
    FRONT_DESK: 'Front Desk',
    TUTOR: 'Tutor',
};

const ROLE_COLORS: Record<string, string> = {
    ORG_OWNER: 'bg-primary/10 text-primary border-primary/20',
    MANAGER: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    FRONT_DESK: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    TUTOR: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
};

interface StaffMember {
    id: string;
    displayName: string;
    email: string;
    role: string;
    createdAt: Date;
    centres: { centreId: string; centreName: string }[];
}

interface PendingInvite {
    id: string;
    email: string;
    role: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
}

interface OrgCentre {
    id: string;
    name: string;
}

interface Props {
    staff: StaffMember[];
    pendingInvites: PendingInvite[];
    orgCentres: OrgCentre[];
    currentUserId: string;
}

export default function StaffDashboardClient({ staff, pendingInvites, orgCentres, currentUserId }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

    const handleRoleChange = async (userId: string, newRole: string) => {
        setUpdatingRoleId(userId);
        try {
            const res = await fetch(`/api/staff/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update role');
            toast({ title: 'Role updated', message: `Role changed to ${ROLE_LABELS[newRole] ?? newRole}.`, variant: 'success' });
            startTransition(() => router.refresh());
        } catch (err: any) {
            toast({ title: 'Error', message: err.message, variant: 'error' });
        } finally {
            setUpdatingRoleId(null);
        }
    };

    const handleRemove = async (userId: string) => {
        try {
            const res = await fetch(`/api/staff/${userId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to remove staff');
            toast({ title: 'Staff removed', message: 'The staff member has been removed from your organisation.', variant: 'success' });
            setConfirmRemoveId(null);
            startTransition(() => router.refresh());
        } catch (err: any) {
            toast({ title: 'Error', message: err.message, variant: 'error' });
        }
    };

    const handleRevokeInvite = async (inviteId: string) => {
        try {
            const res = await fetch(`/api/staff/invites/${inviteId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to revoke invite');
            toast({ title: 'Invite revoked', message: 'The pending invite has been cancelled.', variant: 'success' });
            startTransition(() => router.refresh());
        } catch (err: any) {
            toast({ title: 'Error', message: err.message, variant: 'error' });
        }
    };

    return (
        <div className="space-y-8">
            {/* Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR'] as const).map(role => {
                    const count = staff.filter(s => s.role === role).length;
                    return (
                        <div key={role} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border text-xs font-black ${ROLE_COLORS[role]}`}>
                                {count}
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{ROLE_LABELS[role]}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Staff List */}
            <div className="bg-card border border-border rounded-3xl overflow-hidden">
                <div className="px-6 py-5 border-b border-border flex items-center gap-3">
                    <Users className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Team Members</h2>
                    <span className="ml-auto text-xs text-muted-foreground font-semibold">{staff.length} total</span>
                </div>

                <div className="divide-y divide-border">
                    {staff.map(member => {
                        const isCurrentUser = member.id === currentUserId;
                        const isOwner = member.role === 'ORG_OWNER';
                        const isExpanded = expandedId === member.id;
                        const isConfirmingRemove = confirmRemoveId === member.id;

                        return (
                            <div key={member.id} className="group">
                                <div
                                    className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : member.id)}
                                >
                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm border ${ROLE_COLORS[member.role] ?? 'bg-secondary text-foreground border-border'}`}>
                                        {member.displayName.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-bold text-foreground text-sm truncate">{member.displayName}</p>
                                            {isCurrentUser && (
                                                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">You</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                    </div>

                                    {/* Role badge */}
                                    <span className={`hidden sm:inline-flex text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border ${ROLE_COLORS[member.role] ?? 'bg-secondary border-border text-muted-foreground'}`}>
                                        {ROLE_LABELS[member.role] ?? member.role}
                                    </span>

                                    {/* Centre count */}
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Building2 className="w-3.5 h-3.5" />
                                        <span>{isOwner ? 'All' : member.centres.length}</span>
                                    </div>

                                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Expanded panel */}
                                {isExpanded && (
                                    <div className="px-6 pb-5 pt-1 bg-secondary/20 border-t border-border space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Role control */}
                                            {!isCurrentUser && (
                                                <div>
                                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Change Role</label>
                                                    <div className="relative">
                                                        <select
                                                            defaultValue={member.role}
                                                            disabled={updatingRoleId === member.id}
                                                            onChange={e => handleRoleChange(member.id, e.target.value)}
                                                            className="w-full px-3 py-2.5 bg-card border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
                                                        >
                                                            <option value="ORG_OWNER">Owner</option>
                                                            <option value="MANAGER">Manager</option>
                                                            <option value="FRONT_DESK">Front Desk</option>
                                                            <option value="TUTOR">Tutor</option>
                                                        </select>
                                                        {updatingRoleId === member.id && (
                                                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Centre assignments */}
                                            <div>
                                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Centre Access</label>
                                                {isOwner ? (
                                                    <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                                                        <Crown className="w-3.5 h-3.5 text-primary" /> Access to all centres
                                                    </p>
                                                ) : member.centres.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {member.centres.map(c => (
                                                            <span key={c.centreId} className="text-[10px] font-bold bg-secondary text-foreground border border-border px-2 py-1 rounded-lg">
                                                                {c.centreName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground font-medium">No centres assigned</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Joined date */}
                                        <p className="text-[10px] text-muted-foreground font-semibold">
                                            Joined {format(new Date(member.createdAt), 'd MMM yyyy')}
                                        </p>

                                        {/* Remove */}
                                        {!isCurrentUser && !isOwner && (
                                            <div>
                                                {isConfirmingRemove ? (
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-rose-500 font-bold">Remove this staff member?</span>
                                                        <button
                                                            onClick={() => handleRemove(member.id)}
                                                            className="text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1.5 rounded-xl transition-colors"
                                                        >
                                                            Confirm Remove
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmRemoveId(null)}
                                                            className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmRemoveId(member.id)}
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Remove from organisation
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
                <div className="bg-card border border-border rounded-3xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-border flex items-center gap-3">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Pending Invites</h2>
                        <span className="ml-auto text-xs text-muted-foreground font-semibold">{pendingInvites.length}</span>
                    </div>
                    <div className="divide-y divide-border">
                        {pendingInvites.map(invite => {
                            const isExpired = new Date(invite.expiresAt) < new Date();
                            return (
                                <div key={invite.id} className="flex items-center gap-4 px-6 py-4">
                                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
                                        <Mail className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-foreground truncate">{invite.email}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {ROLE_LABELS[invite.role] ?? invite.role} · Sent {format(new Date(invite.createdAt), 'd MMM yyyy')}
                                        </p>
                                    </div>
                                    {isExpired ? (
                                        <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl uppercase tracking-widest">Expired</span>
                                    ) : (
                                        <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl uppercase tracking-widest">Pending</span>
                                    )}
                                    <button
                                        onClick={() => handleRevokeInvite(invite.id)}
                                        className="text-xs font-bold text-muted-foreground hover:text-rose-500 transition-colors"
                                        title="Revoke invite"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
