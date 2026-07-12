'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    School,
    Users,
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
    ORG_OWNER: ['Dashboard', 'Centres', 'Students', 'Bookings', 'Attendance', 'Kiosk', 'Registrations', 'Finance', 'Reports', 'Team', 'Settings'],
    MANAGER: ['Dashboard', 'Centres', 'Students', 'Bookings', 'Attendance', 'Kiosk', 'Registrations', 'Reports'],
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
        { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
        { name: 'Centres', icon: School, href: '/dashboard/centres' },
        { name: 'Team', icon: UserCircle2, href: '/dashboard/staff' },
        { name: 'Students', icon: Users, href: '/dashboard/students' },
        { name: 'Bookings', icon: CalendarDays, href: '/dashboard/bookings' },
        { name: 'Attendance', icon: ClipboardCheck, href: '/dashboard/attendance' },
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
                <div className="p-6 relative">
                    {!collapsed && (
                        <button
                            suppressHydrationWarning
                            className="absolute top-6 right-6 md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            onClick={() => setCollapsed(true)}
                            aria-label="Close menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* Logo */}
                    <div className={`flex items-center gap-3 mb-8 overflow-hidden px-3 ${collapsed ? 'justify-center mt-0 px-0' : 'mt-2'}`}>
                        <div className={`
                            w-9 h-9 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-xs flex-shrink-0
                            ring-1 ring-border shadow-sm
                            transition-all duration-300
                        `}>
                            {orgName.slice(0, 2).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-base font-extrabold tracking-tight truncate leading-tight text-foreground">
                                    {orgName}
                                </span>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                                    Workspace
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
                                        className="flex items-center justify-between w-full px-2 mb-3 group"
                                    >
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">
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

                    {/* Navigation */}
                    <nav className="space-y-0.5">
                        {navItems.map((item) => {
                            const isCentresPageActive = pathname.startsWith('/dashboard/centres');

                            // Special Dropdown rendering for Centres if multiple centres exist
                            if (item.name === 'Centres' && centres && centres.length > 1) {
                                return (
                                    <div key="centres-dropdown" className="relative">
                                        {!collapsed ? (
                                            <>
                                                <button
                                                    onClick={() => setDropdownOpen(o => !o)}
                                                    className={`
                                                        flex items-center justify-between w-full px-3 py-2.5 rounded-xl
                                                        transition-all group text-left relative overflow-hidden
                                                        ${isCentresPageActive
                                                            ? 'text-primary bg-primary/10 font-bold'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        {selectedCentreId === 'all' ? (
                                                            <Layers className="w-5 h-5 text-primary flex-shrink-0 group-hover:scale-105 transition-transform" />
                                                        ) : (
                                                            <MapPin className="w-5 h-5 text-primary flex-shrink-0 group-hover:scale-105 transition-transform" />
                                                        )}
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

                                                {dropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                                        <div className="absolute left-0 right-0 mt-1 bg-popover/90 backdrop-blur-2xl border border-border rounded-2xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                                            <button
                                                                onClick={() => selectCentre('all')}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-secondary/60 transition-colors ${
                                                                    selectedCentreId === 'all' ? 'text-primary bg-primary/10 font-bold' : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            >
                                                                <Layers className="w-4 h-4 flex-shrink-0" />
                                                                Combined View
                                                            </button>
                                                            <div className="h-px bg-border my-1" />
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {centres.map(centre => (
                                                                    <button
                                                                        key={centre.id}
                                                                        onClick={() => selectCentre(centre.id)}
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
                                                                onClick={() => {
                                                                    setDropdownOpen(false);
                                                                    if (window.innerWidth < 768) {
                                                                        setCollapsed(true);
                                                                    }
                                                                }}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-secondary/60 text-primary hover:text-primary/80 transition-colors ${
                                                                    isCentresPageActive ? 'bg-primary/5 font-bold' : ''
                                                                }`}
                                                            >
                                                                <School className="w-4 h-4 flex-shrink-0" />
                                                                Manage Centres
                                                            </Link>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setDropdownOpen(o => !o)}
                                                    className={`
                                                        flex items-center justify-center w-full px-4 py-2.5 rounded-xl
                                                        transition-all group relative
                                                        ${isCentresPageActive
                                                            ? 'text-primary bg-primary/10'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                                        }
                                                    `}
                                                    title={selectedCentreId === 'all'
                                                        ? 'Combined View'
                                                        : centres.find(c => c.id === selectedCentreId)?.name || 'Centre'}
                                                >
                                                    {selectedCentreId === 'all' ? (
                                                        <Layers className="w-5 h-5 text-primary group-hover:scale-105 transition-transform" />
                                                    ) : (
                                                        <MapPin className="w-5 h-5 text-primary group-hover:scale-105 transition-transform" />
                                                    )}
                                                </button>

                                                {dropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                                        <div className="absolute left-16 top-0 w-52 bg-popover/90 backdrop-blur-2xl border border-border rounded-2xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                                            <button
                                                                onClick={() => selectCentre('all')}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-secondary/60 transition-colors ${
                                                                    selectedCentreId === 'all' ? 'text-primary bg-primary/10 font-bold' : 'text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            >
                                                                <Layers className="w-4 h-4 flex-shrink-0" />
                                                                Combined View
                                                            </button>
                                                            <div className="h-px bg-border my-1" />
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {centres.map(centre => (
                                                                    <button
                                                                        key={centre.id}
                                                                        onClick={() => selectCentre(centre.id)}
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
                                                                onClick={() => setDropdownOpen(false)}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-secondary/60 text-primary hover:text-primary/80 transition-colors ${
                                                                    isCentresPageActive ? 'bg-primary/5 font-bold' : ''
                                                                }`}
                                                            >
                                                                <School className="w-4 h-4 flex-shrink-0" />
                                                                Manage Centres
                                                            </Link>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            }

                            const isActive = item.href === '/dashboard'
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    prefetch={true}
                                    onClick={() => {
                                        if (window.innerWidth < 768) {
                                            setCollapsed(true);
                                        }
                                    }}
                                    className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-xl
                                        transition-all duration-200 group relative overflow-hidden
                                        ${isActive
                                            ? 'text-primary bg-primary/10 font-bold'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                        }
                                        ${collapsed ? 'justify-center' : ''}
                                    `}
                                    title={collapsed ? item.name : undefined}
                                >
                                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-200 ${
                                        isActive ? 'scale-105 text-primary' : 'text-muted-foreground group-hover:scale-102 group-hover:text-primary'
                                    }`} />
                                    {!collapsed && (
                                        <span className="font-semibold text-sm">{item.name}</span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Quick Support Section */}
                <div className={`mt-auto p-6 ${collapsed ? 'hidden' : ''}`}>
                    <div className="p-4 rounded-2xl bg-secondary/40 border border-border">
                        <p className="text-[10px] text-muted-foreground font-bold mb-2 uppercase tracking-wider">
                            Quick Support
                        </p>
                        <p className="text-sm text-foreground/80 leading-relaxed">
                            Need help with bookings or payments?
                        </p>
                        <a
                            href="mailto:support@sprintscaleit.co.uk"
                            className="mt-3 text-xs font-bold text-primary hover:underline transition-colors inline-flex items-center gap-1"
                        >
                            CONTACT SUPPORT <span aria-hidden>→</span>
                        </a>
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
