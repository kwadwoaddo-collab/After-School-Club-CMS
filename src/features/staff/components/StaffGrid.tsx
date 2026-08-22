'use client';

import Link from 'next/link';
import { Mail, Building2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { ROLE_LABELS, ROLE_AVATAR_COLORS } from '@/lib/staff-constants';

/* ------------------------------------------------------------------ */
/*  Mobile record card — same "tables collapse to stacked cards below   */
/*  md" pattern as StudentsGrid/ParentsGrid. StaffDashboardClient is     */
/*  already a Client Component, so this has no RSC-boundary concerns    */
/*  the way the Server-Component list tables do, but stays link-based   */
/*  for consistency with its siblings.                                  */
/* ------------------------------------------------------------------ */
interface StaffMember {
    id: string;
    displayName: string;
    email: string;
    role: string;
    lastLoginAt?: Date | null;
    centres: { centreId: string; centreName: string }[];
}

interface StaffGridProps {
    staff: StaffMember[];
    currentUserId: string;
}

function getInitials(name: string, email: string) {
    if (name && name.trim().length > 0) {
        const parts = name.trim().split(' ').filter(Boolean);
        const raw = parts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return raw.length === 1 ? raw + raw : raw;
    }
    return (email || 'S').charAt(0).toUpperCase().repeat(2);
}

export default function StaffGrid({ staff, currentUserId }: StaffGridProps) {
    return (
        <div className="flex flex-col gap-3">
            {staff.map((member) => {
                const isCurrentUser = member.id === currentUserId;
                const isOwner = member.role === 'ORG_OWNER';
                const initials = getInitials(member.displayName, member.email);

                return (
                    <Link
                        key={member.id}
                        href={`/dashboard/staff/${member.id}`}
                        className="block rounded-lg border border-border bg-surface p-4 active:bg-page/60 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${ROLE_AVATAR_COLORS[member.role] ?? 'bg-page text-text border border-border'}`}>
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-table-value font-medium text-text truncate">{member.displayName}</p>
                                    {isCurrentUser && <Badge variant="info">You</Badge>}
                                </div>
                                <p className="text-metadata flex items-center gap-1.5 truncate mt-1">
                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                    {member.email}
                                </p>
                            </div>
                            <Badge>{ROLE_LABELS[member.role] ?? member.role}</Badge>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-4 flex-wrap">
                            <span className="text-metadata flex items-center gap-1.5">
                                <Building2 className="w-3 h-3 text-text-muted" />
                                {isOwner ? 'All centres' : `${member.centres.length} ${member.centres.length === 1 ? 'centre' : 'centres'}`}
                            </span>
                            <span className="text-metadata flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-text-muted" />
                                {member.lastLoginAt ? `${formatDistanceToNow(new Date(member.lastLoginAt))} ago` : 'Never signed in'}
                            </span>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
