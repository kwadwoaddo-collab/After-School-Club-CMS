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
                    bg-[#0f1117] text-[#e5e2e1] flex flex-col
                    transition-all duration-300 ease-in-out
                    w-64
                    ${collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0'}
                    border-r border-white/5
                `}
                style={{
                    background: 'linear-gradient(195deg, #0d1117 0%, #13192a 100%)',
                    boxShadow: '4px 0 32px rgba(0,0,0,0.4)',
                }}
            >
                {/* Header / Logo area */}
                <div className="p-6 relative">
                    {!collapsed && (
                        <button
                            suppressHydrationWarning
                            className="absolute top-6 right-6 md:hidden p-1.5 rounded-lg text-[#8c909f] hover:text-[#e5e2e1] hover:bg-[#353535] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            onClick={() => setCollapsed(true)}
                            aria-label="Close menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}

                    {/* Logo */}
                    <div className={`flex items-center gap-3 mb-8 overflow-hidden ${collapsed ? 'justify-center mt-0' : 'mt-2'}`}>
                        <div className={`
                            w-9 h-9 rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#6366f1] flex items-center justify-center font-bold text-white text-xs flex-shrink-0
                            shadow-[0_0_20px_rgba(99,102,241,0.4)] ring-1 ring-white/10
                            transition-all duration-300 hover:shadow-[0_0_28px_rgba(99,102,241,0.6)]
                        `}>
                            {orgName.slice(0, 2).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-base font-extrabold tracking-tight truncate leading-tight text-white">
                                    {orgName}
                                </span>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8c909f]">
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
                                        <p className="text-[10px] font-bold text-[#8c909f] uppercase tracking-widest group-hover:text-[#c2c6d6] transition-colors">
                                            Quick Links
                                        </p>
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 text-[#8c909f] group-hover:text-[#c2c6d6] transition-all duration-200 ${quickActionsOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    <div className={`space-y-1 overflow-hidden transition-all duration-300 ease-in-out ${quickActionsOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <Link
                                            href="/dashboard/share"
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[#8c909f] hover:text-[#adc6ff] hover:bg-[#adc6ff]/8 transition-all text-sm font-semibold group"
                                        >
                                            <Share2 className="w-3.5 h-3.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                                            Share Portals
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-px bg-white/5 mb-6" />
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
                                                            ? 'text-[#adc6ff] bg-gradient-to-r from-[#adc6ff]/15 to-[#6366f1]/8 font-bold'
                                                            : 'text-[#8c909f] hover:text-[#c2c6d6] hover:bg-white/4'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        {selectedCentreId === 'all' ? (
                                                            <Layers className="w-5 h-5 text-[#adc6ff] flex-shrink-0 group-hover:scale-105 transition-transform" />
                                                        ) : (
                                                            <MapPin className="w-5 h-5 text-[#adc6ff] flex-shrink-0 group-hover:scale-105 transition-transform" />
                                                        )}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] text-[#8c909f] font-bold uppercase tracking-wider leading-none mb-0.5">Active Centre</span>
                                                            <span className="font-semibold truncate text-sm">
                                                                {selectedCentreId === 'all'
                                                                    ? 'Combined View'
                                                                    : centres.find(c => c.id === selectedCentreId)?.name || 'Select Centre'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ChevronDown className={`w-4 h-4 text-[#8c909f] transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''} flex-shrink-0`} />
                                                    {/* Active indicator */}
                                                    {isCentresPageActive && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-[#adc6ff] to-[#6366f1] rounded-r-full" />
                                                    )}
                                                </button>

                                                {dropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                                        <div className="absolute left-0 right-0 mt-1 bg-[#15192a] border border-[#424754]/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 py-1 overflow-hidden">
                                                            <button
                                                                onClick={() => selectCentre('all')}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-[#1e2436] transition-colors ${
                                                                    selectedCentreId === 'all' ? 'text-[#adc6ff] bg-[#adc6ff]/8' : 'text-[#8c909f] hover:text-white'
                                                                }`}
                                                            >
                                                                <Layers className="w-4 h-4 flex-shrink-0" />
                                                                Combined View
                                                            </button>
                                                            <div className="h-px bg-white/5 my-1" />
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {centres.map(centre => (
                                                                    <button
                                                                        key={centre.id}
                                                                        onClick={() => selectCentre(centre.id)}
                                                                        className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-[#1e2436] transition-colors ${
                                                                            selectedCentreId === centre.id ? 'text-[#adc6ff] bg-[#adc6ff]/8 font-bold' : 'text-[#8c909f] hover:text-white'
                                                                        }`}
                                                                    >
                                                                        <MapPin className="w-4 h-4 flex-shrink-0" />
                                                                        <span className="truncate">{centre.name}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="h-px bg-white/5 my-1" />
                                                            <Link
                                                                href="/dashboard/centres"
                                                                onClick={() => {
                                                                    setDropdownOpen(false);
                                                                    if (window.innerWidth < 768) {
                                                                        setCollapsed(true);
                                                                    }
                                                                }}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-[#1e2436] text-[#adc6ff] hover:text-[#6b9dff] transition-colors ${
                                                                    isCentresPageActive ? 'bg-[#adc6ff]/5 font-bold' : ''
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
                                                            ? 'text-[#adc6ff] bg-[#adc6ff]/10'
                                                            : 'text-[#8c909f] hover:text-[#c2c6d6] hover:bg-white/4'
                                                        }
                                                    `}
                                                    title={selectedCentreId === 'all'
                                                        ? 'Combined View'
                                                        : centres.find(c => c.id === selectedCentreId)?.name || 'Centre'}
                                                >
                                                    {selectedCentreId === 'all' ? (
                                                        <Layers className="w-5 h-5 text-[#adc6ff] group-hover:scale-110 transition-transform" />
                                                    ) : (
                                                        <MapPin className="w-5 h-5 text-[#adc6ff] group-hover:scale-110 transition-transform" />
                                                    )}
                                                    {isCentresPageActive && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-[#adc6ff] to-[#6366f1] rounded-r-full" />
                                                    )}
                                                </button>

                                                {dropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                                        <div className="absolute left-16 top-0 w-52 bg-[#15192a] border border-[#424754]/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 py-1 overflow-hidden">
                                                            <button
                                                                onClick={() => selectCentre('all')}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-[#1e2436] transition-colors ${
                                                                    selectedCentreId === 'all' ? 'text-[#adc6ff] bg-[#adc6ff]/8' : 'text-[#8c909f] hover:text-white'
                                                                }`}
                                                            >
                                                                <Layers className="w-4 h-4 flex-shrink-0" />
                                                                Combined View
                                                            </button>
                                                            <div className="h-px bg-white/5 my-1" />
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {centres.map(centre => (
                                                                    <button
                                                                        key={centre.id}
                                                                        onClick={() => selectCentre(centre.id)}
                                                                        className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-[#1e2436] transition-colors ${
                                                                            selectedCentreId === centre.id ? 'text-[#adc6ff] bg-[#adc6ff]/8 font-bold' : 'text-[#8c909f] hover:text-white'
                                                                        }`}
                                                                    >
                                                                        <MapPin className="w-4 h-4 flex-shrink-0" />
                                                                        <span className="truncate">{centre.name}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="h-px bg-white/5 my-1" />
                                                            <Link
                                                                href="/dashboard/centres"
                                                                onClick={() => setDropdownOpen(false)}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-[#1e2436] text-[#adc6ff] hover:text-[#6b9dff] transition-colors ${
                                                                    isCentresPageActive ? 'bg-[#adc6ff]/5 font-bold' : ''
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

                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => {
                                        if (window.innerWidth < 768) {
                                            setCollapsed(true);
                                        }
                                    }}
                                    className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-xl
                                        transition-all duration-200 group relative overflow-hidden
                                        ${isActive
                                            ? 'text-[#adc6ff] bg-gradient-to-r from-[#adc6ff]/15 to-[#6366f1]/8 font-bold'
                                            : 'text-[#8c909f] hover:text-[#c2c6d6] hover:bg-white/4'
                                        }
                                        ${collapsed ? 'justify-center' : ''}
                                    `}
                                    title={collapsed ? item.name : undefined}
                                >
                                    {/* Active left indicator */}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-[#adc6ff] to-[#6366f1] rounded-r-full" />
                                    )}
                                    <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-200 ${
                                        isActive ? 'scale-110' : 'group-hover:scale-105 group-hover:text-[#adc6ff]'
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
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-[#adc6ff]/8 to-[#6366f1]/5 border border-[#adc6ff]/10">
                        <p className="text-[10px] text-[#8c909f] font-bold mb-2 uppercase tracking-wider">
                            Quick Support
                        </p>
                        <p className="text-sm text-[#c2c6d6] leading-relaxed">
                            Need help with bookings or payments?
                        </p>
                        <a
                            href="mailto:support@sprintscaleit.co.uk"
                            className="mt-3 text-xs font-bold text-[#adc6ff] hover:text-[#6b9dff] transition-colors inline-flex items-center gap-1"
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
                        w-6 h-6 bg-[#15192a] rounded-full
                        flex items-center justify-center
                        shadow-[0_4px_16px_rgba(0,0,0,0.5)] border border-white/10
                        hover:bg-[#1e2436] hover:border-[#adc6ff]/20 hover:shadow-[0_0_12px_rgba(173,198,255,0.2)] transition-all duration-200
                        group z-50 hidden md:flex
                    `}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-[#8c909f] group-hover:text-[#adc6ff] transition-colors" />
                    ) : (
                        <ChevronLeft className="w-3.5 h-3.5 text-[#8c909f] group-hover:text-[#adc6ff] transition-colors" />
                    )}
                </button>
            </aside>
        </>
    );
}
