'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, Loader2 } from 'lucide-react';

interface OrgEntry {
    id: string;
    name: string;
    slug: string;
    role: string;
}

interface OrgSwitcherProps {
    currentOrgId?: string | null;
    currentOrgName: string;
    userOrgs: OrgEntry[];
    collapsed?: boolean;
}

export default function OrgSwitcher({ currentOrgId, currentOrgName, userOrgs, collapsed }: OrgSwitcherProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [switching, startTransition] = useTransition();

    // Only show switcher if user has more than one org
    if (!userOrgs || userOrgs.length <= 1) {
        // Render just the org name (no dropdown)
        return (
            <div className={`flex items-center gap-3 mb-6 overflow-hidden px-2 ${collapsed ? 'justify-center mt-0 px-0' : 'mt-2'}`}>
                <div
                    title={collapsed ? currentOrgName : undefined}
                    className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center font-bold text-primary-foreground text-xs flex-shrink-0 ring-2 ring-primary/20 shadow-md shadow-primary/10 transition-all duration-300"
                >
                    {currentOrgName.slice(0, 2).toUpperCase()}
                </div>
                {!collapsed && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-extrabold tracking-tight truncate leading-tight text-foreground">
                            {currentOrgName}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    const handleSwitch = (orgId: string) => {
        if (orgId === currentOrgId) { setOpen(false); return; }
        setOpen(false);
        startTransition(async () => {
            await fetch('/api/user/switch-org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orgId }),
            });
            // Force a full page reload so Next.js re-fetches session with new org
            window.location.href = '/dashboard';
        });
    };

    return (
        <div className={`relative mb-6 ${collapsed ? 'flex justify-center' : ''}`}>
            <button
                onClick={() => setOpen(o => !o)}
                title={collapsed ? currentOrgName : undefined}
                className={`flex items-center gap-3 w-full rounded-xl transition-all duration-200 hover:bg-secondary/50 ${collapsed ? 'justify-center p-1' : 'px-2 py-1.5'}`}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center font-bold text-primary-foreground text-xs flex-shrink-0 ring-2 ring-primary/20 shadow-md shadow-primary/10">
                    {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : currentOrgName.slice(0, 2).toUpperCase()}
                </div>
                {!collapsed && (
                    <>
                        <div className="flex flex-col min-w-0 flex-1 text-left">
                            <span className="text-sm font-extrabold tracking-tight truncate leading-tight text-foreground">
                                {currentOrgName}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">Switch organisation</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[199]" onClick={() => setOpen(false)} />
                    <div
                        role="listbox"
                        className="absolute left-0 top-full mt-1 w-64 bg-card border border-border rounded-xl shadow-xl z-[200] overflow-hidden animate-fadeIn"
                    >
                        <div className="px-3 py-2 border-b border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Organisations</p>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1">
                            {userOrgs.map(org => {
                                const isActive = org.id === currentOrgId;
                                return (
                                    <button
                                        key={org.id}
                                        role="option"
                                        aria-selected={isActive}
                                        onClick={() => handleSwitch(org.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/60 ${isActive ? 'bg-primary/10' : ''}`}
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0">
                                            {org.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className={`font-semibold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                                                {org.name}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground capitalize">{org.role.replace('_', ' ').toLowerCase()}</p>
                                        </div>
                                        {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
