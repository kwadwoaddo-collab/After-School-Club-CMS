'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users, Mail, Shield, Building2, Trash2, ChevronDown,
    Clock, CheckCircle2, XCircle, UserCog, Loader2, Crown, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { ROLE_LABELS, ROLE_COLORS, ROLE_AVATAR_COLORS } from '@/lib/staff-constants';

interface StaffMember {
    id: string;
    displayName: string;
    email: string;
    role: string;
    createdAt: Date;
    lastLoginAt?: Date | null;
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
    error?: boolean;
}

export default function StaffDashboardClient({ staff, pendingInvites, orgCentres, currentUserId, error }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string | 'ALL'>('ALL');
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PENDING'>('ACTIVE');

    const getInitials = (name: string, email: string) => {
        if (name && name.trim().length > 0) {
            const parts = name.trim().split(' ').filter(Boolean);
            const raw = parts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
            return raw.length === 1 ? raw + raw : raw;
        }
        return (email || 'S').charAt(0).toUpperCase().repeat(2);
    };


    const handleRevokeInvite = async (inviteId: string) => {
        try {
            const res = await fetch(`/api/staff/invites/${inviteId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to revoke invite');
            toast({ title: 'Invite revoked', message: 'The pending invite has been cancelled.', variant: 'success' });
            startTransition(() => router.refresh());
        } catch (err) {
            toast({ title: 'Error', message: err instanceof Error ? err.message : 'Failed to revoke invite', variant: 'error' });
        }
    };

    const filteredStaff = staff.filter(member => {
        const matchesSearch = member.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            member.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-8">
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p>There was a problem loading all staff data. Some information may be missing or incomplete.</p>
                </div>
            )}

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

            {/* Segmented Control */}
            <div className="flex bg-secondary p-1 rounded-xl w-full sm:w-fit">
                <button
                    onClick={() => setActiveTab('ACTIVE')}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'ACTIVE' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Active Staff ({staff.length})
                </button>
                <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'PENDING' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    Pending Invites {pendingInvites.length > 0 && `(${pendingInvites.length})`}
                </button>
            </div>

            {/* List View */}
            {activeTab === 'ACTIVE' && (
                <div className="bg-card border border-border rounded-3xl overflow-hidden">
                    {/* Search & Filter Bar */}
                    <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <input
                            type="text"
                            placeholder="Search staff..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full sm:max-w-xs px-4 py-2 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <div className="relative w-full sm:w-auto">
                            <select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value)}
                                className="w-full sm:w-48 px-4 py-2 bg-secondary border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none pr-8 font-semibold text-foreground"
                            >
                                <option value="ALL">All Roles</option>
                                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>

                    <div className="divide-y divide-border">
                        {filteredStaff.map(member => {
                            const isCurrentUser = member.id === currentUserId;
                            const isOwner = member.role === 'ORG_OWNER';

                            return (
                                <Link href={`/dashboard/staff/${member.id}`} key={member.id} className="block group">
                                    <div className="flex items-center gap-4 px-6 py-4 hover:bg-secondary/30 transition-all active:scale-[0.99] duration-100 cursor-pointer">
                                        {/* Avatar */}
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm border flex-shrink-0 ${ROLE_AVATAR_COLORS[member.role] ?? 'bg-secondary text-foreground border-border'}`}>
                                            {getInitials(member.displayName, member.email)}
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
                                        <div className="hidden sm:flex w-24 items-center gap-1 text-xs text-muted-foreground">
                                            <Building2 className="w-3.5 h-3.5" />
                                            <span className="truncate">{isOwner ? 'Global' : `${member.centres.length} Centres`}</span>
                                        </div>

                                        {/* Last Login */}
                                        <div className="hidden md:flex w-32 items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="truncate">{member.lastLoginAt ? `${formatDistanceToNow(new Date(member.lastLoginAt))} ago` : 'Never'}</span>
                                        </div>

                                    </div>
                                </Link>
                            );
                        })}
                        {filteredStaff.length === 0 && (
                            <div className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">
                                No staff found matching your criteria.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Pending Invites View */}
            {activeTab === 'PENDING' && (
                <div className="bg-card border border-border rounded-3xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-border flex items-center gap-3">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Pending Invites</h2>
                        <span className="ml-auto text-xs text-muted-foreground font-semibold">{pendingInvites.length}</span>
                    </div>
                    {pendingInvites.length === 0 ? (
                        <div className="px-6 py-12 text-center text-muted-foreground text-sm font-medium">
                            No pending invites.
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {pendingInvites.map(invite => {
                                const isExpired = new Date(invite.expiresAt) < new Date();
                                return (
                                    <div key={invite.id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
                                                <Mail className="w-4 h-4 text-amber-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-foreground truncate">{invite.email}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {ROLE_LABELS[invite.role] ?? invite.role} · Sent {format(new Date(invite.createdAt), 'd MMM yyyy')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 self-end sm:self-auto">
                                            {isExpired ? (
                                                <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl uppercase tracking-widest">Expired</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl uppercase tracking-widest">Pending</span>
                                            )}
                                            <button
                                                onClick={() => handleRevokeInvite(invite.id)}
                                                className="text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg transition-all active:scale-95 duration-100"
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
