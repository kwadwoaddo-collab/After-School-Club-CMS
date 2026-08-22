'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

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
        // Render just the org name (no dropdown) — InvoiceFlow-aligned flat chip,
        // no gradient/ring/glow.
        return (
            <div className={`flex items-center gap-2 mb-5 overflow-hidden ${collapsed ? 'justify-center px-0' : 'px-1'}`}>
                <span
                    title={collapsed ? currentOrgName : undefined}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-white"
                >
                    {currentOrgName.slice(0, 2).toUpperCase()}
                </span>
                {!collapsed && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate leading-tight text-text">
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
        <div className={`relative mb-5 ${collapsed ? 'flex justify-center' : ''}`}>
            <button
                onClick={() => setOpen(o => !o)}
                title={collapsed ? currentOrgName : undefined}
                className={`flex items-center gap-2 rounded-md border border-border bg-surface text-left transition-colors hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${collapsed ? 'justify-center p-1.5' : 'w-full px-2.5 py-2'}`}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-white">
                    {switching ? <Loader2 className="size-4 animate-spin" /> : currentOrgName.slice(0, 2).toUpperCase()}
                </span>
                {!collapsed && (
                    <>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-text">
                                {currentOrgName}
                            </span>
                            <span className="block truncate text-xs text-text-muted">Switch organisation</span>
                        </span>
                        <ChevronDown className={`size-4 shrink-0 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
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
                        aria-label="Your Organisations"
                        className="absolute left-0 top-full mt-1 w-64 bg-surface-elevated border border-border rounded-md shadow-[var(--shadow-popover)] z-[200] overflow-hidden py-1"
                    >
                        <div className="px-3 py-1.5 border-b border-border-subtle mb-1">
                            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Your Organisations</p>
                        </div>
                        <div className="max-h-60 overflow-y-auto px-1">
                            {userOrgs.map(org => {
                                const isActive = org.id === currentOrgId;
                                return (
                                    <button
                                        key={org.id}
                                        role="option"
                                        aria-selected={isActive}
                                        onClick={() => handleSwitch(org.id)}
                                        className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-sm text-sm transition-colors hover:bg-page ${isActive ? 'bg-accent-soft' : ''}`}
                                    >
                                        <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-xs font-semibold text-accent">
                                            {org.name.slice(0, 2).toUpperCase()}
                                        </span>
                                        <span className="flex-1 text-left min-w-0">
                                            <span className={`block font-medium truncate ${isActive ? 'text-accent' : 'text-text'}`}>
                                                {org.name}
                                            </span>
                                            <span className="block text-xs text-text-muted capitalize">{org.role.replace('_', ' ').toLowerCase()}</span>
                                        </span>
                                        {isActive && <Check className="size-4 text-accent flex-shrink-0" aria-hidden="true" />}
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
