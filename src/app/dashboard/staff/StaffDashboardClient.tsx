'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users, Mail, Building2, Clock, AlertTriangle, Search, X, Filter,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastProvider';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { ROLE_LABELS, ROLE_AVATAR_COLORS } from '@/lib/staff-constants';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import StaffGrid from '@/features/staff/components/StaffGrid';

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

function getInitials(name: string, email: string) {
    if (name && name.trim().length > 0) {
        const parts = name.trim().split(' ').filter(Boolean);
        const raw = parts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return raw.length === 1 ? raw + raw : raw;
    }
    return (email || 'S').charAt(0).toUpperCase().repeat(2);
}

export default function StaffDashboardClient({ staff, pendingInvites, currentUserId, error }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string | 'ALL'>('ALL');
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PENDING'>('ACTIVE');

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

    const hasActiveFilters = !!(searchQuery || roleFilter !== 'ALL');

    const filteredStaff = staff.filter(member => {
        const matchesSearch = member.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-lg border border-danger/30 bg-danger-soft p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
                    <p className="text-small-body text-text">There was a problem loading all staff data. Some information may be missing or incomplete.</p>
                </div>
            )}

            {/* Segmented Control */}
            <div className="flex bg-page p-1 rounded-md w-full sm:w-fit border border-border-subtle">
                <button
                    onClick={() => setActiveTab('ACTIVE')}
                    className={`flex-1 sm:flex-none px-5 py-1.5 rounded-sm text-sm font-medium transition-colors ${activeTab === 'ACTIVE' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    Active Staff ({staff.length})
                </button>
                <button
                    onClick={() => setActiveTab('PENDING')}
                    className={`flex-1 sm:flex-none px-5 py-1.5 rounded-sm text-sm font-medium transition-colors ${activeTab === 'PENDING' ? 'bg-surface text-text shadow-sm border border-border' : 'text-text-secondary hover:text-text'}`}
                >
                    Pending Invites {pendingInvites.length > 0 && `(${pendingInvites.length})`}
                </button>
            </div>

            {/* Active tab */}
            {activeTab === 'ACTIVE' && (
                <div className="space-y-4">
                    {/* Search & role filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-[220px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search staff by name or email…"
                                aria-label="Search staff"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-9 pl-9 pr-9 rounded-sm text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors border border-border bg-surface"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                                    aria-label="Clear search"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="relative">
                            <select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value)}
                                aria-label="Filter by role"
                                className="h-9 pl-3 pr-8 rounded-sm text-sm text-text focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-accent transition-colors appearance-none cursor-pointer border border-border bg-surface"
                            >
                                <option value="ALL">All roles</option>
                                {Object.entries(ROLE_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                            <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                        </div>
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setRoleFilter('ALL'); }}>
                                <X className="w-3.5 h-3.5" />
                                Clear
                            </Button>
                        )}
                    </div>

                    {staff.length === 0 ? (
                        <EmptyState
                            icon={<Users className="w-8 h-8" />}
                            title="No staff yet"
                            description="Invite your first team member to get started — they'll appear here once they accept."
                        />
                    ) : filteredStaff.length === 0 ? (
                        <EmptyState
                            icon={<Search className="w-8 h-8" />}
                            title="No staff match these filters"
                            description="Try a different search or role — or clear filters to see everyone."
                        />
                    ) : (
                        <>
                            {/* Desktop / tablet — table. Collapses to stacked cards below `md`. */}
                            <div className="hidden md:block rounded-lg border border-border bg-surface overflow-hidden">
                                <Table caption="Staff list">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Staff member</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Centres</TableHead>
                                            <TableHead>Last active</TableHead>
                                            <TableHead align="right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStaff.map(member => {
                                            const isCurrentUser = member.id === currentUserId;
                                            const isOwner = member.role === 'ORG_OWNER';
                                            const initials = getInitials(member.displayName, member.email);

                                            return (
                                                <TableRow key={member.id} className="group">
                                                    <TableCell>
                                                        <Link href={`/dashboard/staff/${member.id}`} className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${ROLE_AVATAR_COLORS[member.role] ?? 'bg-page text-text border border-border'}`}>
                                                                {initials}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-table-value font-medium text-text truncate group-hover:text-accent transition-colors">
                                                                        {member.displayName}
                                                                    </span>
                                                                    {isCurrentUser && <Badge variant="info">You</Badge>}
                                                                </div>
                                                                <span className="text-metadata truncate flex items-center gap-1">
                                                                    <Mail className="w-3 h-3" />
                                                                    {member.email}
                                                                </span>
                                                            </div>
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge>{ROLE_LABELS[member.role] ?? member.role}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-table-value text-text-secondary flex items-center gap-1.5">
                                                            <Building2 className="w-3.5 h-3.5 text-text-muted" />
                                                            {isOwner ? 'All centres' : `${member.centres.length} ${member.centres.length === 1 ? 'centre' : 'centres'}`}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-table-value text-text-secondary flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-text-muted" />
                                                            {member.lastLoginAt ? `${formatDistanceToNow(new Date(member.lastLoginAt))} ago` : 'Never'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Link
                                                            href={`/dashboard/staff/${member.id}`}
                                                            className="text-small-body font-medium text-accent hover:underline"
                                                        >
                                                            Manage
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile — stacked record cards. */}
                            <div className="md:hidden">
                                <StaffGrid staff={filteredStaff} currentUserId={currentUserId} />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Pending tab */}
            {activeTab === 'PENDING' && (
                pendingInvites.length === 0 ? (
                    <EmptyState
                        icon={<Clock className="w-8 h-8" />}
                        title="No pending invites"
                        description="Invitations you send will appear here until they're accepted, revoked, or expire."
                    />
                ) : (
                    <div className="rounded-lg border border-border bg-surface overflow-hidden">
                        <Table caption="Pending staff invitations">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Sent</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead align="right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingInvites.map(invite => {
                                    const isExpired = new Date(invite.expiresAt) < new Date();
                                    return (
                                        <TableRow key={invite.id}>
                                            <TableCell>
                                                <span className="flex items-center gap-2 font-medium text-text">
                                                    <Mail className="w-3.5 h-3.5 text-text-muted" />
                                                    {invite.email}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge>{ROLE_LABELS[invite.role] ?? invite.role}</Badge>
                                            </TableCell>
                                            <TableCell className="text-text-secondary">
                                                {format(new Date(invite.createdAt), 'd MMM yyyy')}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={isExpired ? 'error' : 'warning'}>
                                                    {isExpired ? 'Expired' : 'Pending'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => handleRevokeInvite(invite.id)}
                                                    className="text-danger hover:bg-danger-soft"
                                                >
                                                    Revoke
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )
            )}
        </div>
    );
}
