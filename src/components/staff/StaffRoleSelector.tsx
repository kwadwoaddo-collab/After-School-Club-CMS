'use client';

import { useState, useTransition } from 'react';
import { Crown, Briefcase, MonitorSmartphone, GraduationCap, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { updateStaffRole } from '@/features/staff/staff-actions';
import { useToast } from '@/components/ui/ToastProvider';

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
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/5',
        border: 'border-[#424754]/20',
        activeBg: 'bg-emerald-500/10',
        activeBorder: 'border-emerald-500/40',
    },
    {
        value: 'FRONT_DESK',
        label: 'Front Desk',
        description: 'Reception staff who manage daily check-ins and bookings.',
        permissions: ['View & manage bookings', 'Check-in students', 'View students', 'Attendance & kiosk'],
        icon: <MonitorSmartphone className="w-5 h-5" />,
        color: 'text-[#adc6ff]',
        bg: 'bg-[#adc6ff]/5',
        border: 'border-[#424754]/20',
        activeBg: 'bg-[#adc6ff]/10',
        activeBorder: 'border-[#adc6ff]/40',
    },
    {
        value: 'MANAGER',
        label: 'Manager',
        description: 'Senior staff with broad access to manage day-to-day operations.',
        permissions: ['Manage bookings & students', 'Attendance & kiosk', 'View registrations', 'View reports'],
        icon: <Briefcase className="w-5 h-5" />,
        color: 'text-[#d0bcff]',
        bg: 'bg-[#d0bcff]/5',
        border: 'border-[#424754]/20',
        activeBg: 'bg-[#d0bcff]/10',
        activeBorder: 'border-[#d0bcff]/40',
    },
    {
        value: 'ORG_OWNER',
        label: 'Owner',
        description: 'Full administrative access to everything including billing and settings.',
        permissions: ['Full system access', 'Manage all centres & staff', 'Finance & billing', 'All reports & settings'],
        icon: <Crown className="w-5 h-5" />,
        color: 'text-amber-400',
        bg: 'bg-amber-500/5',
        border: 'border-[#424754]/20',
        activeBg: 'bg-amber-500/10',
        activeBorder: 'border-amber-500/40',
    },
];

interface Props {
    userId: string;
    currentRole: StaffRole;
    staffName: string;
}

export default function StaffRoleSelector({ userId, currentRole, staffName }: Props) {
    const [selectedRole, setSelectedRole] = useState<StaffRole>(currentRole);
    const [isPending, startTransition] = useTransition();
    const [saved, setSaved] = useState(false);
    const { toast } = useToast();

    const hasChanged = selectedRole !== currentRole;

    const handleSave = () => {
        startTransition(async () => {
            try {
                await updateStaffRole(userId, selectedRole);
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                toast({
                    title: 'Role updated',
                    message: `${staffName} is now ${ROLES.find(r => r.value === selectedRole)?.label}.`,
                    variant: 'success',
                });
            } catch (err: any) {
                toast({
                    title: 'Could not update role',
                    message: err.message || 'Please try again.',
                    variant: 'error',
                });
                setSelectedRole(currentRole); // revert
            }
        });
    };

    return (
        <div className="bg-[#1a1d23] rounded-[24px] p-6 border border-[#424754]/15 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-[#adc6ff]" />
                    <div>
                        <h2 className="font-bold text-[#e5e2e1]">Role & Access Level</h2>
                        <p className="text-xs text-[#8c909f] mt-0.5">Select the role that matches this staff member&apos;s responsibilities</p>
                    </div>
                </div>
                {saved && (
                    <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold animate-in fade-in duration-300">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                    </span>
                )}
            </div>

            {/* Role Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map((role) => {
                    const isActive = selectedRole === role.value;
                    return (
                        <button
                            key={role.value}
                            onClick={() => setSelectedRole(role.value)}
                            disabled={isPending}
                            className={`relative text-left p-4 rounded-2xl border transition-all duration-200 ${
                                isActive
                                    ? `${role.activeBg} ${role.activeBorder} ring-1 ${role.activeBorder}`
                                    : `${role.bg} ${role.border} hover:border-[#adc6ff]/20 hover:bg-white/5`
                            }`}
                        >
                            {/* Selected checkmark */}
                            {isActive && (
                                <span className={`absolute top-3 right-3 ${role.color}`}>
                                    <CheckCircle2 className="w-4 h-4" />
                                </span>
                            )}

                            {/* Icon + Label */}
                            <div className={`flex items-center gap-2 mb-2 ${isActive ? role.color : 'text-[#8c909f]'}`}>
                                {role.icon}
                                <span className={`text-sm font-bold ${isActive ? role.color : 'text-[#e5e2e1]'}`}>
                                    {role.label}
                                </span>
                            </div>

                            {/* Description */}
                            <p className="text-[11px] text-[#8c909f] leading-relaxed mb-3">
                                {role.description}
                            </p>

                            {/* Permissions list */}
                            <ul className="space-y-1">
                                {role.permissions.map((perm) => (
                                    <li key={perm} className={`flex items-center gap-1.5 text-[11px] font-medium ${isActive ? 'text-white/70' : 'text-[#8c909f]/60'}`}>
                                        <span className={`w-1 h-1 rounded-full flex-shrink-0 ${isActive ? role.color : 'bg-[#424754]'}`} />
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
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 animate-in fade-in duration-300">
                    <Crown className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-400 leading-relaxed">
                        <strong>Heads up:</strong> Granting Owner access gives this person full control over the organisation — including billing, settings, and the ability to manage other staff. Only do this for trusted administrators.
                    </p>
                </div>
            )}

            {/* Save Button */}
            {hasChanged && (
                <div className="flex items-center justify-end gap-3 pt-1 animate-in slide-in-from-bottom-2 duration-300">
                    <button
                        onClick={() => setSelectedRole(currentRole)}
                        disabled={isPending}
                        className="px-4 py-2 rounded-xl bg-white/5 border border-[#424754]/20 text-white/60 hover:text-white text-sm font-bold transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#adc6ff] to-[#4d8eff] hover:opacity-90 text-slate-950 text-sm font-black transition-all flex items-center gap-2 shadow-[0_4px_16px_rgba(77,142,255,0.25)]"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Save Role Change
                    </button>
                </div>
            )}
        </div>
    );
}
