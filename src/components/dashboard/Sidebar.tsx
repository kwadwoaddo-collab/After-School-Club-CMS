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
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { useCentreFilter } from '@/components/dashboard/CentreFilterContext';

interface SidebarProps {
    userName?: string;
    userRole?: string;
    orgName?: string;
    centres?: { id: string; name: string }[];
}

const ROLE_NAV: Record<string, string[]> = {
    ORG_OWNER: ['Dashboard', 'Centres', 'Students', 'Parents', 'Bookings', 'Attendance', 'Kiosk', 'Registrations', 'Finance', 'Reports', 'Team', 'Settings'],
    MANAGER: ['Dashboard', 'Centres', 'Students', 'Parents', 'Bookings', 'Attendance', 'Kiosk', 'Registrations', 'Reports'],
    FRONT_DESK: ['Dashboard', 'Students', 'Bookings', 'Attendance', 'Kiosk'],
    TUTOR: ['Dashboard', 'Attendance', 'Kiosk'],
};

const ROLE_QUICK_ACTIONS: Record<string, string[]> = {
    ORG_OWNER: ['new-assessment', 'booking-link', 'registration-link'],
    MANAGER: ['new-assessment', 'booking-link', 'registration-link'],
    FRONT_DESK: ['new-assessment'],
    TUTOR: [],
};

export default function Sidebar({ userName, userRole = 'TUTOR', orgName = 'AfterSchool' }: SidebarProps) {
    const { collapsed, setCollapsed } = useSidebar();
    const pathname = usePathname();
    const router = useRouter();
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
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
        { name: 'Students', icon: Users, href: '/dashboard/students' },
        { name: 'Parents', icon: UserRound, href: '/dashboard/parents', children: [
            { name: 'Recovery Bin', href: '/dashboard/parents/bin' },
        ] },
        { name: 'Bookings', icon: CalendarDays, href: '/dashboard/bookings' },
        { name: 'Attendance', icon: ClipboardCheck, href: '/dashboard/attendance', children: [
            { name: 'Session Ledger', href: '/dashboard/attendance/ledger' },
        ] },

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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setCollapsed(true)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50
                    bg-sidebar/45 backdrop-blur-2xl text-foreground flex flex-col
                    transition-all duration-300 ease-in-out
                    w-64
                    ${collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0'}
                    border-r border-sidebar-border
                `}
            >
                {/* Header / Logo area */}
                <div className={`relative transition-all duration-300 flex flex-col flex-1 ${collapsed ? 'p-4' : 'p-5'}`}>
                    {!collapsed && (
                        <button
                            suppressHydrationWarning
                            className="absolute top-5 right-5 md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            onClick={() => setCollapsed(true)}
                            aria-label="Close menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* Logo */}
                    <div className={`flex items-center gap-3 mb-6 overflow-hidden px-2 ${collapsed ? 'justify-center mt-0 px-0' : 'mt-2'}`}>
                        <div
                            title={collapsed ? orgName : undefined}
                            className={`
                            w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center font-bold text-primary-foreground text-xs flex-shrink-0
                            ring-2 ring-primary/20 shadow-md shadow-primary/10
                            transition-all duration-300
                        `}>
                            {orgName.slice(0, 2).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-extrabold tracking-tight truncate leading-tight text-foreground">
                                    {orgName}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Quick Links - Only show when expanded */}
                    {!collapsed && (
                        <>
                            {(allowedActions.includes('booking-link') || allowedActions.includes('registration-link')) && (
                                <div className="mb-6">
                                    <button
                                        suppressHydrationWarning
                                        onClick={() => setQuickActionsOpen(o => !o)}
                                        aria-expanded={quickActionsOpen}
                                        className="flex items-center justify-between w-full px-2 mb-3 group active:scale-[0.98] transition-transform duration-100"
                                    >
                                        <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-[0.12em] group-hover:text-foreground transition-colors">
                                            Quick Links
                                        </p>
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-all duration-200 ${quickActionsOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    <div className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${quickActionsOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <Link
                                            href="/dashboard/share"
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all text-sm font-semibold group"
                                        >
                                            <Share2 className="w-3.5 h-3.5 flex-shrink-0 group-hover:scale-105 transition-transform" />
                                            Share Portals
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-px bg-border mb-6" />
                        </>
                    )}

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
                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-secondary/60 transition-colors ${
                                            selectedCentreId === 'all' ? 'text-primary bg-primary/10 font-bold' : 'text-muted-foreground hover:text-foreground'
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
                                            className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-secondary/60 transition-colors ${
                                                selectedCentreId === centre.id ? 'text-primary bg-primary/10 font-bold' : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            <MapPin className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{centre.name}</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-border my-1" />
                                <Link
                                    href="/dashboard/centres"
                                    onClick={() => { closeCentreDropdown(); if (window.innerWidth < 768) setCollapsed(true); }}
                                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-secondary/60 text-primary hover:text-primary/80 transition-colors ${
                                        isCentresPageActive ? 'bg-primary/5 font-bold' : ''
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
                                            flex items-center justify-between w-full px-3 py-2.5 rounded-xl
                                            transition-all group text-left active:scale-[0.97] duration-100
                                            ${isCentresPageActive
                                                ? 'text-primary bg-primary/10 font-bold'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {selectedCentreId === 'all'
                                                ? <Layers className="w-5 h-5 text-primary flex-shrink-0" />
                                                : <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                                            }
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider leading-none mb-0.5">Active Centre</span>
                                                <span className="font-semibold truncate text-sm">
                                                    {selectedCentreId === 'all'
                                                        ? 'Combined View'
                                                        : centres.find(c => c.id === selectedCentreId)?.name || 'Select Centre'}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''} flex-shrink-0`} />
                                    </button>
                                ) : (
                                    <button
                                        ref={centreBtnRef}
                                        onClick={openCentreDropdown}
                                        aria-haspopup="listbox"
                                        aria-expanded={dropdownOpen}
                                        aria-controls="centre-dropdown-menu"
                                        className={`keep-shape flex items-center justify-center w-full px-4 py-2.5 rounded-xl transition-all group active:scale-[0.95] duration-100 ${
                                            isCentresPageActive ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                        }`}
                                        title={selectedCentreId === 'all' ? 'Combined View' : centres.find(c => c.id === selectedCentreId)?.name || 'Centre'}
                                    >
                                        {selectedCentreId === 'all'
                                            ? <Layers className="w-5 h-5 text-primary" />
                                            : <MapPin className="w-5 h-5 text-primary" />
                                        }
                                    </button>
                                )}

                                {/* Portal dropdown — renders into document.body, escaping
                                    the aside's compositing layer (backdrop-blur + translate) */}
                                {dropdownOpen && dropdownAnchor && portalMounted && createPortal(
                                    <>
                                        <div className="fixed inset-0 z-[199]" onClick={closeCentreDropdown} />
                                        <div
                                            id="centre-dropdown-menu"
                                            role="listbox"
                                            aria-label="Active Centre Selection"
                                            className="fixed bg-popover border border-border rounded-2xl shadow-2xl z-[200] py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
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
                    <nav className="space-y-1">
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
                                            if (window.innerWidth < 768) {
                                                setCollapsed(true);
                                            }
                                        }}
                                        className={`
                                            flex items-center gap-4 px-4 py-2.5 rounded-full
                                            transition-all duration-300 ease-out group relative overflow-hidden active:scale-[0.97]
                                            ${isActive
                                                ? 'text-primary bg-primary/10 font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-primary before:rounded-r-full'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                            }
                                            ${collapsed ? 'justify-center' : ''}
                                        `}
                                        title={item.name}
                                    >
                                        <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-350 ease-out ${
                                            isActive ? 'scale-105 text-primary' : 'text-muted-foreground group-hover:scale-102 group-hover:text-primary'
                                        } ${collapsed ? 'mx-auto' : ''}`} />
                                        {!collapsed && (
                                            <span className="font-semibold text-sm tracking-tight">{item.name}</span>
                                        )}
                                    </Link>
                                    {/* Sub-items (children) */}
                                    {!collapsed && (item as any).children && (
                                        <div className="ml-9 mt-0.5 space-y-0.5">
                                            {(item as any).children.map((child: { name: string; href: string }) => {
                                                const childActive = pathname.startsWith(child.href);
                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        onClick={() => { if (window.innerWidth < 768) setCollapsed(true); }}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                                            childActive
                                                                ? 'text-primary bg-primary/10'
                                                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
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

                    {/* Premium User Profile Footer */}
                    <div className="mt-auto pt-4 flex-shrink-0">
                        <div className="h-px bg-border/60 mb-4" />
                        <div
                            className={`
                                flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-secondary/40
                                ${collapsed ? 'justify-center px-0' : 'px-3'}
                            `}
                            title={collapsed ? `${userName || 'Staff'} (${(userRole || 'TUTOR').toLowerCase().replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())})` : undefined}
                        >
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0 ring-1 ring-primary/20">
                                {(userName || 'Staff')
                                    .split(' ')
                                    .map(n => n[0])
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase()}
                            </div>
                            {!collapsed && (
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-bold text-foreground truncate leading-tight">
                                        {userName || 'Staff Member'}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate mt-0.5">
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
                        w-6 h-6 bg-card rounded-full
                        flex items-center justify-center
                        shadow-md border border-border
                        hover:bg-secondary transition-all duration-200
                        active:scale-90
                        group z-50 hidden md:flex
                    `}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    ) : (
                        <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                </button>
            </aside>
        </>
    );
}
