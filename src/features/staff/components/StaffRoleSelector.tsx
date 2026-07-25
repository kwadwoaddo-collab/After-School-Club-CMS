'use client';

import { Crown, Briefcase, MonitorSmartphone, GraduationCap, CheckCircle2, ShieldAlert } from 'lucide-react';

type StaffRole = 'TUTOR' | 'FRONT_DESK' | 'MANAGER' | 'ORG_OWNER';

interface RoleOption {
    value: StaffRole;
    label: string;
    description: string;
    permissions: string[];
    icon: React.ReactNode;
    color: string;
    bg: string;
    border: string;
    activeBg: string;
    activeBorder: string;
}

const ROLES: RoleOption[] = [
    {
        value: 'TUTOR',
        label: 'Club Leader',
        description: 'Club staff with limited access to their sessions only.',
        permissions: ['View assigned sessions', 'Mark attendance', 'Add session feedback', 'Access kiosk'],
        icon: <GraduationCap className="w-5 h-5" />,
        color: 'text-success',
        bg: 'bg-success/5',
        border: 'border-border',
        activeBg: 'bg-success/10',
        activeBorder: 'border-success/20',
    },
    {
        value: 'FRONT_DESK',
        label: 'Front Desk',
        description: 'Reception staff who manage daily check-ins and bookings.',
        permissions: ['View & manage bookings', 'Check-in students', 'View students', 'Attendance & kiosk'],
        icon: <MonitorSmartphone className="w-5 h-5" />,
        color: 'text-info',
        bg: 'bg-info/5',
        border: 'border-border',
        activeBg: 'bg-info/10',
        activeBorder: 'border-info/20',
    },
    {
        value: 'MANAGER',
        label: 'Manager',
        description: 'Senior staff with broad access to manage day-to-day operations.',
        permissions: ['Manage bookings & students', 'Attendance & kiosk', 'View registrations', 'View reports'],
        icon: <Briefcase className="w-5 h-5" />,
        color: 'text-accent-violet',
        bg: 'bg-accent-violet/5',
        border: 'border-border',
        activeBg: 'bg-accent-violet/10',
        activeBorder: 'border-accent-violet/20',
    },
    {
        value: 'ORG_OWNER',
        label: 'Owner',
        description: 'Full administrative access to everything including billing and settings.',
        permissions: ['Full system access', 'Manage all centres & staff', 'Finance & billing', 'All reports & settings'],
        icon: <Crown className="w-5 h-5" />,
        color: 'text-warning',
        bg: 'bg-warning/5',
        border: 'border-border',
        activeBg: 'bg-warning/10',
        activeBorder: 'border-warning/20',
    },
];

interface Props {
    currentRole: StaffRole;
    selectedRole: StaffRole;
    onRoleChange: (role: StaffRole) => void;
    ownerCount: number;
}

export default function StaffRoleSelector({ currentRole, selectedRole, onRoleChange, ownerCount }: Props) {
    return (
        <div className="bg-card rounded-[24px] p-6 border border-border space-y-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-info" />
                    <div>
                        <h2 className="font-bold text-foreground">Role & Access Level</h2>
                        <p className="text-xs text-muted-foreground font-semibold mt-0.5">Select the role that matches this staff member&apos;s responsibilities</p>
                    </div>
                </div>
            </div>

            {/* Role Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map((role) => {
                    const isActive = selectedRole === role.value;
                    return (
                        <button
                            key={role.value}
                            onClick={() => onRoleChange(role.value)}
                            disabled={currentRole === 'ORG_OWNER' && ownerCount === 1 && role.value !== 'ORG_OWNER'}
                            className={`relative text-left p-4 rounded-2xl border transition-all duration-200 ${
                                isActive
                                    ? `${role.activeBg} ${role.activeBorder} ring-1 ${role.activeBorder}`
                                    : `bg-card ${role.border} hover:border-border hover:bg-secondary/40`
                            } ${currentRole === 'ORG_OWNER' && ownerCount === 1 && role.value !== 'ORG_OWNER' ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                            {/* Selected checkmark */}
                            {isActive && (
                                <span className={`absolute top-3 right-3 ${role.color}`}>
                                    <CheckCircle2 className="w-4 h-4" />
                                </span>
                            )}

                            {/* Icon + Label */}
                            <div className={`flex items-center gap-2 mb-2 ${isActive ? role.color : 'text-muted-foreground'}`}>
                                {role.icon}
                                <span className={`text-sm font-bold ${isActive ? role.color : 'text-foreground'}`}>
                                    {role.label}
                                </span>
                            </div>

                            {/* Description */}
                            <p className="text-[11px] text-muted-foreground font-semibold leading-relaxed mb-3">
                                {role.description}
                            </p>

                            {/* Permissions list */}
                            <ul className="space-y-1">
                                {role.permissions.map((perm) => (
                                <li key={perm} className={`flex items-center gap-1.5 text-[11px] font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${isActive ? role.color : 'bg-muted-foreground/30'}`} />
                                        {perm}
                                    </li>
                                ))}
                            </ul>
                        </button>
                    );
                })}
            </div>

            {/* Owner Warning */}
            {selectedRole === 'ORG_OWNER' && selectedRole !== currentRole && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-warning/10 border border-warning/20 animate-in fade-in duration-300">
                    <Crown className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-warning font-semibold leading-relaxed">
                        <strong>Heads up:</strong> Granting Owner access gives this person full control over the organisation — including billing, settings, and the ability to manage other staff. Only do this for trusted administrators.
                    </p>
                </div>
            )}

            {/* Demote-from-owner warning */}
            {currentRole === 'ORG_OWNER' && selectedRole !== 'ORG_OWNER' && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 animate-in fade-in duration-300">
                <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-semibold leading-relaxed">
                  <strong>Warning:</strong> This will remove Owner access. They will no longer be able to manage staff, billing, or settings.
                </p>
              </div>
            )}
            
            {/* Last-owner lock notice */}
            {currentRole === 'ORG_OWNER' && ownerCount === 1 && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-secondary border border-border">
                <ShieldAlert className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground font-semibold leading-relaxed">
                  You cannot change the role of the only Owner. Invite another staff member and promote them to Owner first.
                </p>
              </div>
            )}

        </div>
    );
}
