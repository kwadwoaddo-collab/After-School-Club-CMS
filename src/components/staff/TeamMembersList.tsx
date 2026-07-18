'use client';

import { useState } from 'react';
import { Mail, MapPin, Users, Crown, Briefcase, MonitorSmartphone, GraduationCap, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

type Member = {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: Date;
    memberships: {
        centre: {
            id: string;
            name: string;
        };
    }[];
};

export default function TeamMembersList({
    members,
    currentUserId,
}: {
    members: any[];
    currentUserId: string;
}) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const getRoleStyle = (role: string) => {
        const styles: Record<string, string> = {
            ORG_OWNER:  'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
            MANAGER:    'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
            FRONT_DESK: 'bg-primary/10 text-primary border-primary/20',
            TUTOR:      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
        return styles[role] || 'bg-secondary text-muted-foreground border-border';
    };

    const getRoleAvatarStyle = (role: string) => {
        const styles: Record<string, string> = {
            ORG_OWNER:  'bg-amber-500/15 text-amber-700 dark:text-amber-400',
            MANAGER:    'bg-violet-500/15 text-violet-600 dark:text-violet-400',
            FRONT_DESK: 'bg-primary/15 text-primary',
            TUTOR:      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        };
        return styles[role] || 'bg-secondary text-muted-foreground';
    };

    const getRoleIcon = (role: string) => {
        if (role === 'ORG_OWNER') return Crown;
        if (role === 'MANAGER') return Briefcase;
        if (role === 'FRONT_DESK') return MonitorSmartphone;
        return GraduationCap;
    };

    return (
        <div className="bg-card rounded-[32px] overflow-hidden border border-border shadow-sm">
            {/* Header - Clickable to toggle collapse */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full px-8 py-6 border-b border-border flex items-center justify-between hover:bg-secondary transition-colors cursor-pointer select-none"
            >
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-foreground">Team Members</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-secondary text-muted-foreground border border-border">
                        {members.length}
                    </span>
                </div>
                <div>
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
                    {members.length === 0 ? (
                        <div className="px-8 py-12 text-center">
                            <div className="w-16 h-16 bg-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 border border-border">
                                <Users className="w-8 h-8 text-muted-foreground opacity-50" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">No team members yet</h3>
                            <p className="text-sm text-muted-foreground mb-6">Invite your first staff member to get started.</p>
                            <Link href="/dashboard/staff/invite" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-colors">
                                <Users className="w-4 h-4" /> Invite Staff Member
                            </Link>
                        </div>
                    ) : (
                        members.map((member) => {
                            const RoleIcon = getRoleIcon(member.role);
                            const initials = member.name
                                ? member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                                : member.email.charAt(0).toUpperCase();
                            return (
                                <div key={member.id} className="p-4 sm:px-8 sm:py-6 hover:bg-secondary/40 transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full border border-border flex items-center justify-center font-bold text-base flex-shrink-0 ${getRoleAvatarStyle(member.role)}`}>
                                                {initials}
                                            </div>
                                            <div>
                                                <div className="flex items-center justify-start gap-3 mb-1.5 flex-wrap">
                                                    <h3 className="font-bold text-foreground text-base">{member.name || 'Unnamed User'}</h3>
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleStyle(member.role)}`}>
                                                        <RoleIcon className="w-3 h-3" />
                                                        {member.role.replace(/_/g, ' ')}
                                                    </span>
                                                    {member.id === currentUserId && (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary text-muted-foreground border border-border">You</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground flex-wrap">
                                                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {member.email}</span>
                                                    {member.role === 'ORG_OWNER' ? (
                                                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> All Centres</span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {member.memberships.length} centre{member.memberships.length !== 1 ? 's' : ''}</span>
                                                    )}
                                                    <span className="text-muted-foreground/60">Joined {format(new Date(member.createdAt), 'MMM yyyy')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {member.id !== currentUserId && (
                                            <Link href={`/dashboard/staff/${member.id}`} className="px-4 py-2 sm:py-2.5 text-xs font-bold text-primary bg-secondary hover:bg-secondary/60 border border-border rounded-xl transition-colors whitespace-nowrap self-start sm:self-auto active:scale-95 duration-100">
                                                Manage Access
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
