'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutGrid,
    School,
    Users,
    UserRound,
    Settings,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    UserCircle2,
    ClipboardList,
    ClipboardCheck,
    CalendarDays,
    ExternalLink,
    BarChart,
    X,
    Wallet,
    MapPin,
    Layers,
    Monitor,
    Share2,
    MessageSquare,
    AlertTriangle,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';
import OrgSwitcher from '@/components/dashboard/OrgSwitcher';

interface SidebarProps {
    userName?: string;
    userRole?: string;
    orgName?: string;
    orgId?: string;
    userOrgs?: { id: string; name: string; slug: string; role: string }[];
    centres?: { id: string; name: string }[];
}

const ROLE_NAV: Record<string, string[]> = {
    ORG_OWNER: ['Dashboard', 'Centres', 'Students', 'Parents', 'Bookings', 'Attendance', 'Incidents', 'Kiosk', 'Registrations', 'Finance', 'Reports', 'Team', 'Communications', 'Settings'],
    MANAGER: ['Dashboard', 'Centres', 'Students', 'Parents', 'Bookings', 'Attendance', 'Incidents', 'Kiosk', 'Registrations', 'Reports', 'Communications'],
    FRONT_DESK: ['Dashboard', 'Students', 'Bookings', 'Attendance', 'Incidents', 'Kiosk', 'Registrations'],
    // Milestone 3K (A-1 Option C — orchestrator decision 2026-08-24): TUTOR does not
    // have access to the Incidents module. Removed from this ROLE_NAV entry.
    TUTOR: ['Dashboard', 'Attendance', 'Kiosk'],
};

const ROLE_QUICK_ACTIONS: Record<string, string[]> = {
    ORG_OWNER: ['new-assessment', 'booking-link', 'registration-link'],
    MANAGER: ['new-assessment', 'booking-link', 'registration-link'],
    FRONT_DESK: ['new-assessment'],
    TUTOR: [],
};

export default function Sidebar({ userName, userRole = 'TUTOR', orgName = 'AfterSchool', orgId, userOrgs = [] }: SidebarProps) {
    const { collapsed, setCollapsed } = useSidebar();
    const pathname = usePathname();
    const router = useRouter();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const { selectedCentreId, setSelectedCentreId, centres } = useCentreFilter();
    const centreBtnRef = useRef<HTMLButtonElement>(null);
    const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);

    // Close dropdown on collapsed state change, window resize, or sidebar scroll
    useEffect(() => {
        setDropdownOpen(false);
    }, [collapsed]);

    useEffect(() => {
        const handleResize = () => {
            setDropdownOpen(false);
        };
        const handleScroll = () => {
            setDropdownOpen(false);
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, { capture: true });

        const sidebarScrollEl = sidebarScrollRef.current;
        if (sidebarScrollEl) {
            sidebarScrollEl.addEventListener('scroll', handleScroll);
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll, { capture: true });
            if (sidebarScrollEl) {
                sidebarScrollEl.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    const openCentreDropdown = () => {
        if (centreBtnRef.current) {
            const rect = centreBtnRef.current.getBoundingClientRect();
            setDropdownAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width });
        }
        setDropdownOpen(o => !o);
    };

    const closeCentreDropdown = () => {
        setDropdownOpen(false);
        setDropdownAnchor(null);
    };

    // Portal mount guard — prevents SSR mismatch
    const [portalMounted, setPortalMounted] = useState(false);
    useEffect(() => { setPortalMounted(true); }, []);

    const selectCentre = (centreId: string) => {
        setSelectedCentreId(centreId);
        setDropdownOpen(false);
        if (pathname !== '/dashboard') {
            router.push('/dashboard');
        }
    };

    const allowedNav = ROLE_NAV[userRole] || ROLE_NAV['TUTOR'];
    const allowedActions = ROLE_QUICK_ACTIONS[userRole] || [];

    const navItems = [
        { name: 'Dashboard', icon: LayoutGrid, href: '/dashboard' },
        { name: 'Centres', icon: School, href: '/dashboard/centres' },
        { name: 'Team', icon: UserCircle2, href: '/dashboard/staff' },
        { name: 'Communications', icon: MessageSquare, href: '/dashboard/communications' },
        { name: 'Students', icon: Users, href: '/dashboard/students' },
        { name: 'Parents', icon: UserRound, href: '/dashboard/parents', children: [
            { name: 'Recovery Bin', href: '/dashboard/parents/bin' },
        ] },
        { name: 'Bookings', icon: CalendarDays, href: '/dashboard/bookings' },
        { name: 'Attendance', icon: ClipboardCheck, href: '/dashboard/attendance', children: [
            { name: 'Session Ledger', href: '/dashboard/attendance/ledger' },
        ] },
        { name: 'Incidents', icon: AlertTriangle, href: '/dashboard/incidents' },
        { name: 'Kiosk', icon: Monitor, href: '/dashboard/kiosk' },
        { name: 'Registrations', icon: ClipboardList, href: '/dashboard/registrations' },
        { name: 'Reports', icon: BarChart, href: '/dashboard/reports' },
        { name: 'Finance', icon: Wallet, href: '/dashboard/finance' },
        { name: 'Settings', icon: Settings, href: '/dashboard/settings' },
    ].filter(item => allowedNav.includes(item.name));

    return (
        <>
            {/* Mobile Overlay */}
            {!collapsed && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setCollapsed(true)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50
                    bg-surface text-text flex flex-col
                    transition-all duration-300 ease-in-out
                    w-60
                    ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-[72px]' : 'translate-x-0'}
                    border-r border-border
                `}
            >
                {/* Header / Logo area */}
                <div className={`relative transition-all duration-300 flex flex-col flex-1 ${collapsed ? 'p-4' : 'p-5'}`}>
                    {!collapsed && (
                        <button
                            suppressHydrationWarning
                            className="absolute top-5 right-5 lg:hidden p-1.5 rounded-sm text-text-muted hover:text-text hover:bg-page transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            onClick={() => setCollapsed(true)}
                            aria-label="Close menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* Org Switcher / Logo */}
                    <OrgSwitcher
                        currentOrgId={orgId}
                        currentOrgName={orgName}
                        userOrgs={userOrgs}
                        collapsed={collapsed}
                    />


                    {/* Active Centre Selector — dropdown uses position:fixed so it renders in the
                        viewport stacking context (z-[200]), escaping the sidebar's z-50 context */}
                    {centres && centres.length > 1 && (() => {
                        const isCentresPageActive = pathname.startsWith('/dashboard/centres');
                        const dropdownContent = (
                            <>
                                <div className="h-px bg-border my-1" />
                                <div className="max-h-48 overflow-y-auto">
                                    <button
                                        role="option"
                                        aria-selected={selectedCentreId === 'all'}
                                        onClick={() => { selectCentre('all'); closeCentreDropdown(); }}
                                        className={`w-full text-left px-3 py-2 text-[13px] font-medium flex items-center gap-2.5 rounded-sm transition-colors ${
                                            selectedCentreId === 'all' ? 'text-accent bg-accent-soft font-semibold' : 'text-text-secondary hover:text-text hover:bg-page'
                                        }`}
                                    >
                                        <Layers className="w-4 h-4 flex-shrink-0" />
                                        Combined View
                                    </button>
                                    {centres.map(centre => (
                                        <button
                                            key={centre.id}
                                            role="option"
                                            aria-selected={selectedCentreId === centre.id}
                                            onClick={() => { selectCentre(centre.id); closeCentreDropdown(); }}
                                            className={`w-full text-left px-3 py-2 text-[13px] font-medium flex items-center gap-2.5 rounded-sm transition-colors ${
                                                selectedCentreId === centre.id ? 'text-accent bg-accent-soft font-semibold' : 'text-text-secondary hover:text-text hover:bg-page'
                                            }`}
                                        >
                                            <MapPin className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{centre.name}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-border-subtle my-1" />
                                <Link
                                    href="/dashboard/centres"
                                    onClick={() => { closeCentreDropdown(); if (window.innerWidth < 1024) setCollapsed(true); }}
                                    className={`w-full text-left px-3 py-2 text-[13px] font-medium flex items-center gap-2.5 rounded-sm hover:bg-page text-accent transition-colors ${
                                        isCentresPageActive ? 'bg-accent-soft font-semibold' : ''
                                    }`}
                                >
                                    <School className="w-4 h-4 flex-shrink-0" />
                                    Manage Centres
                                </Link>
                            </>
                        );

                        return (
                            <div className="mb-1">
                                {!collapsed ? (
                                    <button
                                        ref={centreBtnRef}
                                        onClick={openCentreDropdown}
                                        aria-haspopup="listbox"
                                        aria-expanded={dropdownOpen}
                                        aria-controls="centre-dropdown-menu"
                                        className={`
                                            keep-shape
                                            flex items-center justify-between w-full px-3 py-2 rounded-md border border-border
                                            transition-colors group text-left text-sm font-medium
                                            ${isCentresPageActive
                                                ? 'text-accent bg-accent-soft'
                                                : 'text-text-secondary hover:text-text hover:bg-page'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2.5 overflow-hidden">
                                            {selectedCentreId === 'all'
                                                ? <Layers className="size-4 text-accent flex-shrink-0" />
                                                : <MapPin className="size-4 text-accent flex-shrink-0" />
                                            }
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-label leading-none mb-0.5">Active Centre</span>
                                                <span className="font-medium truncate text-sm">
                                                    {selectedCentreId === 'all'
                                                        ? 'Combined View'
                                                        : centres.find(c => c.id === selectedCentreId)?.name || 'Select Centre'}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''} flex-shrink-0`} />
                                    </button>
                                ) : (
                                    <button
                                        ref={centreBtnRef}
                                        onClick={openCentreDropdown}
                                        aria-haspopup="listbox"
                                        aria-expanded={dropdownOpen}
                                        aria-controls="centre-dropdown-menu"
                                        className={`keep-shape flex items-center justify-center w-full px-4 py-2 rounded-md border border-border transition-colors group ${
                                            isCentresPageActive ? 'text-accent bg-accent-soft' : 'text-text-secondary hover:text-text hover:bg-page'
                                        }`}
                                        title={selectedCentreId === 'all' ? 'Combined View' : centres.find(c => c.id === selectedCentreId)?.name || 'Centre'}
                                    >
                                        {selectedCentreId === 'all'
                                            ? <Layers className="size-4 text-accent" />
                                            : <MapPin className="size-4 text-accent" />
                                        }
                                    </button>
                                )}

                                {/* Portal dropdown — renders into document.body, escaping
                                    the aside's compositing layer */}
                                {dropdownOpen && dropdownAnchor && portalMounted && createPortal(
                                    <>
                                        <div className="fixed inset-0 z-[199]" onClick={closeCentreDropdown} />
                                        <div
                                            id="centre-dropdown-menu"
                                            role="listbox"
                                            aria-label="Active Centre Selection"
                                            className="fixed bg-surface-elevated border border-border rounded-md shadow-[var(--shadow-popover)] z-[200] py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                                            style={{ top: dropdownAnchor.top, left: dropdownAnchor.left, width: dropdownAnchor.width, minWidth: '220px' }}
                                        >
                                            {dropdownContent}
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>
                        );
                    })()}

                    {/* Navigation */}
                    <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
                    <nav className="space-y-0.5">
                        {navItems.map((item) => {
                            const isActive = item.href === '/dashboard'
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            return (
                                <div key={item.name}>
                                    <Link
                                        href={item.href}
                                        prefetch={true}
                                        onClick={() => {
                                            if (window.innerWidth < 1024) {
                                                setCollapsed(true);
                                            }
                                        }}
                                        className={`
                                            flex items-center gap-2.5 px-3 py-2 rounded-md
                                            text-sm font-medium transition-colors group
                                            ${isActive
                                                ? 'text-accent bg-accent-soft'
                                                : 'text-text-secondary hover:text-text hover:bg-page'
                                            }
                                            ${collapsed ? 'justify-center' : ''}
                                        `}
                                        title={item.name}
                                    >
                                        <item.icon className={`size-4 shrink-0 ${
                                            isActive ? 'text-accent' : 'text-text-muted group-hover:text-text'
                                        } ${collapsed ? 'mx-auto' : ''}`} aria-hidden="true" />
                                        {!collapsed && (
                                            <span>{item.name}</span>
                                        )}
                                    </Link>
                                    {/* Sub-items (children) */}
                                    {!collapsed && (item as any).children && (
                                        <div className="ml-8 mt-0.5 space-y-0.5">
                                            {(item as any).children.map((child: { name: string; href: string }) => {
                                                const childActive = pathname.startsWith(child.href);
                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        onClick={() => { if (window.innerWidth < 1024) setCollapsed(true); }}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-[13px] font-medium transition-colors ${
                                                            childActive
                                                                ? 'text-accent bg-accent-soft'
                                                                : 'text-text-muted hover:text-text hover:bg-page'
                                                        }`}
                                                    >
                                                        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                                                        {child.name}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                    </nav>
                    </div>

                    {/* Utility Area & User Profile Footer */}
                    <div className="mt-auto pt-4 flex-shrink-0 flex flex-col">
                        <div className="h-px bg-border-subtle mb-4" />

                        {/* Share Portals Utility */}
                        {(allowedActions.includes('booking-link') || allowedActions.includes('registration-link')) && (
                            <div className="relative group/tooltip mb-2">
                                <Link
                                    href="/dashboard/share"
                                    className={`
                                        flex items-center gap-2.5 px-3 py-2 rounded-md
                                        text-sm font-medium text-text-secondary hover:text-text hover:bg-page
                                        transition-colors
                                        ${pathname === '/dashboard/share' ? 'text-accent bg-accent-soft' : ''}
                                        ${collapsed ? 'w-10 h-10 justify-center px-0 mx-auto' : 'w-full'}
                                    `}
                                >
                                    <Share2 className="size-4 shrink-0" aria-hidden="true" />
                                    {!collapsed && (
                                        <span>
                                            Share Portals
                                        </span>
                                    )}
                                </Link>
                                {collapsed && (
                                    <div className="absolute left-full ml-4 top-1/2 translate-y-[calc(-50%+4px)] group-hover/tooltip:-translate-y-1/2 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-all duration-200 delay-200 z-[100] px-2.5 py-1.5 bg-text text-surface text-xs font-medium rounded-sm shadow-[var(--shadow-popover)] whitespace-nowrap hidden lg:block">
                                        Share Portals
                                    </div>
                                )}
                            </div>
                        )}

                        <div
                            className={`
                                flex items-center gap-2.5 p-2 rounded-md transition-colors hover:bg-page
                                ${collapsed ? 'justify-center px-0' : 'px-3'}
                            `}
                            title={collapsed ? `${userName || 'Staff'} (${(userRole || 'TUTOR').toLowerCase().replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())})` : undefined}
                        >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                                {(userName || 'Staff')
                                    .split(' ')
                                    .map(n => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                            </span>
                            {!collapsed && (
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium text-text truncate leading-tight">
                                        {userName || 'Staff Member'}
                                    </span>
                                    <span className="text-xs text-text-muted truncate mt-0.5">
                                        {(userRole || 'TUTOR').toLowerCase().replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Collapse Toggle Button */}
                <button
                    suppressHydrationWarning
                    onClick={() => setCollapsed(!collapsed)}
                    className={`
                        absolute -right-3 top-20
                        w-6 h-6 bg-surface rounded-full
                        flex items-center justify-center
                        shadow-[var(--shadow-popover)] border border-border
                        hover:bg-page transition-colors
                        group z-50 hidden lg:flex
                    `}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" />
                    ) : (
                        <ChevronLeft className="w-3.5 h-3.5 text-text-muted group-hover:text-accent transition-colors" />
                    )}
                </button>
            </aside>
        </>
    );
}
