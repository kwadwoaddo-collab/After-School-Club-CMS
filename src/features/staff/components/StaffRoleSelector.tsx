'use client';

import { Crown, Briefcase, MonitorSmartphone, GraduationCap, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { ROLE_LABELS } from '@/lib/staff-constants';

type StaffRole = 'TUTOR' | 'FRONT_DESK' | 'MANAGER' | 'ORG_OWNER';

interface RoleOption {
    value: StaffRole;
    description: string;
    permissions: string[];
    icon: React.ReactNode;
    // Semantic token classes — same family as ROLE_COLORS/ROLE_AVATAR_COLORS
    // in staff-constants.ts, so the selector's palette matches the role
    // badges shown everywhere else in the module.
    color: string;
    activeClasses: string;
}

const ROLES: RoleOption[] = [
    {
        value: 'TUTOR',
        description: 'Club staff with limited access to their sessions only.',
        permissions: ['View assigned sessions', 'Mark attendance', 'Add session feedback', 'Access kiosk'],
        icon: <GraduationCap className="w-5 h-5" />,
        color: 'text-success',
        activeClasses: 'bg-success-soft border-success/30',
    },
    {
        value: 'FRONT_DESK',
        description: 'Reception staff who manage daily check-ins and bookings.',
        permissions: ['View & manage bookings', 'Check-in students', 'View students', 'Attendance & kiosk'],
        icon: <MonitorSmartphone className="w-5 h-5" />,
        color: 'text-info',
        activeClasses: 'bg-info-soft border-info/30',
    },
    {
        value: 'MANAGER',
        description: 'Senior staff with broad access to manage day-to-day operations.',
        permissions: ['Manage bookings & students', 'Attendance & kiosk', 'View registrations', 'View reports'],
        icon: <Briefcase className="w-5 h-5" />,
        color: 'text-accent-violet',
        activeClasses: 'bg-accent-violet/10 border-accent-violet/30',
    },
    {
        value: 'ORG_OWNER',
        description: 'Full administrative access to everything including billing and settings.',
        permissions: ['Full system access', 'Manage all centres & staff', 'Finance & billing', 'All reports & settings'],
        icon: <Crown className="w-5 h-5" />,
        color: 'text-warning',
        activeClasses: 'bg-warning-soft border-warning/30',
    },
];

interface Props {
    currentRole: StaffRole;
    selectedRole: StaffRole;
    onRoleChange: (role: StaffRole) => void;
    ownerCount: number;
}

export default function StaffRoleSelector({ currentRole, selectedRole, onRoleChange, ownerCount }: Props) {
    // UI-only last-owner lock — server-side owner safety is enforced
    // independently by updateStaffRole's self-change guard (see
    // project-notes/milestone-3c-staff-audit.md §5). This is a more
    // conservative affordance, not a substitute for it.
    const lastOwnerLocked = currentRole === 'ORG_OWNER' && ownerCount === 1;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-text-muted" />
                    <CardTitle>Role &amp; access</CardTitle>
                </div>
                <CardDescription>Select the role that matches this staff member&apos;s responsibilities.</CardDescription>
            </CardHeader>

            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ROLES.map((role) => {
                        const isActive = selectedRole === role.value;
                        const isLocked = lastOwnerLocked && role.value !== 'ORG_OWNER';
                        return (
                            <button
                                key={role.value}
                                type="button"
                                onClick={() => onRoleChange(role.value)}
                                disabled={isLocked}
                                className={`relative text-left p-4 rounded-md border transition-colors ${isActive
                                        ? role.activeClasses
                                        : 'bg-page border-border-subtle hover:border-border'
                                    } ${isLocked ? 'cursor-not-allowed opacity-40' : ''}`}
                            >
                                {isActive && (
                                    <span className={`absolute top-3 right-3 ${role.color}`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                    </span>
                                )}

                                <div className={`flex items-center gap-2 mb-2 ${isActive ? role.color : 'text-text-muted'}`}>
                                    {role.icon}
                                    <span className={`text-small-body font-semibold ${isActive ? role.color : 'text-text'}`}>
                                        {ROLE_LABELS[role.value]}
                                    </span>
                                </div>

                                <p className="text-metadata leading-relaxed mb-3">{role.description}</p>

                                <ul className="space-y-1">
                                    {role.permissions.map((perm) => (
                                        <li key={perm} className={`flex items-center gap-1.5 text-metadata ${isActive ? 'text-text' : ''}`}>
                                            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${isActive ? role.color.replace('text-', 'bg-') : 'bg-text-muted/40'}`} />
                                            {perm}
                                        </li>
                                    ))}
                                </ul>
                            </button>
                        );
                    })}
                </div>

                {selectedRole === 'ORG_OWNER' && selectedRole !== currentRole && (
                    <div className="flex items-start gap-3 p-4 mt-4 rounded-md bg-warning-soft border border-warning/20">
                        <Crown className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-metadata leading-relaxed">
                            <strong className="text-text font-medium">Heads up:</strong> Granting Owner access gives this person full control over the organisation — including billing, settings, and the ability to manage other staff. Only do this for trusted administrators.
                        </p>
                    </div>
                )}

                {currentRole === 'ORG_OWNER' && selectedRole !== 'ORG_OWNER' && (
                    <div className="flex items-start gap-3 p-4 mt-4 rounded-md bg-danger-soft border border-danger/20">
                        <ShieldAlert className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                        <p className="text-metadata leading-relaxed">
                            <strong className="text-text font-medium">Warning:</strong> This will remove Owner access. They will no longer be able to manage staff, billing, or settings.
                        </p>
                    </div>
                )}

                {lastOwnerLocked && (
                    <div className="flex items-start gap-3 p-4 mt-4 rounded-md bg-page border border-border-subtle">
                        <ShieldAlert className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
                        <p className="text-metadata leading-relaxed">
                            You cannot change the role of the only Owner. Invite another staff member and promote them to Owner first.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
