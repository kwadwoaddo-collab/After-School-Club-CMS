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
    CalendarDays,
    ExternalLink,
    BarChart,
    X,
    Wallet,
    MapPin,
    Layers,
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
    ORG_OWNER: ['Dashboard', 'Centres', 'Students', 'Bookings', 'Registrations', 'Finance', 'Reports', 'Team', 'Settings'],
    MANAGER: ['Dashboard', 'Centres', 'Students', 'Bookings', 'Registrations', 'Reports'],
    FRONT_DESK: ['Dashboard', 'Students', 'Bookings'],
    TUTOR: ['Dashboard'],
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
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setCollapsed(true)}
                />
            )}


            {/* Sidebar */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50
                    bg-[#1c1b1b] text-[#e5e2e1] flex flex-col
                    transition-all duration-300 ease-in-out
                    w-64
                    ${collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0'}
                    shadow-2xl
                `}
            >
                {/* Header */}
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
                    <div className={`flex items-center gap-3 mb-8 overflow-hidden ${collapsed ? 'justify-center mt-0' : 'mt-2'}`}>
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-lg shadow-primary/20 flex-shrink-0">
                            {orgName.slice(0, 2).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="flex flex-col">
                                <span className="text-base font-extrabold tracking-tight truncate leading-tight text-white">
                                    {orgName}
                                </span>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">
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
                                    {/* Collapsible header */}
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
                                        {allowedActions.includes('booking-link') && (
                                            <Link
                                                href="/dashboard/booking-link"
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-surface-container-low transition-all text-sm font-medium group"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                                Booking
                                            </Link>
                                        )}
                                        {allowedActions.includes('registration-link') && (
                                            <Link
                                                href="/dashboard/registration-link"
                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-on-surface-variant hover:text-white hover:bg-surface-container-low transition-all text-sm font-medium group"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                                Registration
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-px bg-[#424754]/15 mb-6" />
                        </>
                    )}

                    {/* Navigation */}
                    <nav className="space-y-1">
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
                                                        flex items-center justify-between w-full px-4 py-3 rounded-xl
                                                        transition-all group text-left
                                                        ${isCentresPageActive
                                                            ? 'text-primary bg-primary/10 font-bold'
                                                            : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        {selectedCentreId === 'all' ? (
                                                            <Layers className="w-5 h-5 text-primary flex-shrink-0 group-hover:scale-110 transition-transform" />
                                                        ) : (
                                                            <MapPin className="w-5 h-5 text-primary flex-shrink-0 group-hover:scale-110 transition-transform" />
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
                                                </button>

                                                {dropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                                        <div className="absolute left-0 right-0 mt-1 bg-[#1c1b1b] border border-[#424754]/25 rounded-xl shadow-2xl z-50 py-1 overflow-hidden backdrop-blur-md bg-opacity-95">
                                                            {/* Combined View Option */}
                                                            <button
                                                                onClick={() => selectCentre('all')}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-[#2c2c2c] transition-colors ${
                                                                    selectedCentreId === 'all' ? 'text-primary bg-primary/10' : 'text-[#8c909f] hover:text-white'
                                                                }`}
                                                            >
                                                                <Layers className="w-4 h-4 flex-shrink-0" />
                                                                Combined View
                                                            </button>
                                                            <div className="h-px bg-[#424754]/15 my-1" />
                                                            {/* Individual Centres */}
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {centres.map(centre => (
                                                                    <button
                                                                        key={centre.id}
                                                                        onClick={() => selectCentre(centre.id)}
                                                                        className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-[#2c2c2c] transition-colors ${
                                                                            selectedCentreId === centre.id ? 'text-primary bg-primary/10 font-bold' : 'text-[#8c909f] hover:text-white'
                                                                        }`}
                                                                    >
                                                                        <MapPin className="w-4 h-4 flex-shrink-0" />
                                                                        <span className="truncate">{centre.name}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="h-px bg-[#424754]/15 my-1" />
                                                            {/* Manage Centres Link */}
                                                            <Link
                                                                href="/dashboard/centres"
                                                                onClick={() => {
                                                                    setDropdownOpen(false);
                                                                    if (window.innerWidth < 768) {
                                                                        setCollapsed(true);
                                                                    }
                                                                }}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-[#2c2c2c] text-primary hover:text-blue-400 transition-colors ${
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
                                                        flex items-center justify-center w-full px-4 py-3 rounded-xl
                                                        transition-all group relative
                                                        ${isCentresPageActive
                                                            ? 'text-primary bg-primary/10'
                                                            : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'
                                                        }
                                                    `}
                                                    title={selectedCentreId === 'all'
                                                        ? 'Combined View'
                                                        : centres.find(c => c.id === selectedCentreId)?.name || 'Centre'}
                                                >
                                                    {selectedCentreId === 'all' ? (
                                                        <Layers className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                                    ) : (
                                                        <MapPin className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                                                    )}
                                                    {isCentresPageActive && (
                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                                                    )}
                                                </button>

                                                {dropdownOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                                                        <div className="absolute left-16 top-0 w-52 bg-[#1c1b1b] border border-[#424754]/25 rounded-xl shadow-2xl z-50 py-1 overflow-hidden backdrop-blur-md bg-opacity-95">
                                                            <button
                                                                onClick={() => selectCentre('all')}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 hover:bg-[#2c2c2c] transition-colors ${
                                                                    selectedCentreId === 'all' ? 'text-primary bg-primary/10' : 'text-[#8c909f] hover:text-white'
                                                                }`}
                                                            >
                                                                <Layers className="w-4 h-4 flex-shrink-0" />
                                                                Combined View
                                                            </button>
                                                            <div className="h-px bg-[#424754]/15 my-1" />
                                                            <div className="max-h-48 overflow-y-auto">
                                                                {centres.map(centre => (
                                                                    <button
                                                                        key={centre.id}
                                                                        onClick={() => selectCentre(centre.id)}
                                                                        className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-[#2c2c2c] transition-colors ${
                                                                            selectedCentreId === centre.id ? 'text-primary bg-primary/10 font-bold' : 'text-[#8c909f] hover:text-white'
                                                                        }`}
                                                                    >
                                                                        <MapPin className="w-4 h-4 flex-shrink-0" />
                                                                        <span className="truncate">{centre.name}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="h-px bg-[#424754]/15 my-1" />
                                                            <Link
                                                                href="/dashboard/centres"
                                                                onClick={() => {
                                                                    setDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 hover:bg-[#2c2c2c] text-primary hover:text-blue-400 transition-colors ${
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

                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => {
                                        // Collapse on mobile after clicking
                                        if (window.innerWidth < 768) {
                                            setCollapsed(true);
                                        }
                                    }}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl
                                        transition-all group relative
                                        ${isActive
                                            ? 'text-primary bg-primary/10 font-bold'
                                            : 'text-on-surface-variant hover:text-white hover:bg-surface-container-low'
                                        }
                                        ${collapsed ? 'justify-center' : ''}
                                    `}
                                    title={collapsed ? item.name : undefined}
                                >
                                    <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform flex-shrink-0" />
                                    {!collapsed && (
                                        <span className="font-medium">{item.name}</span>
                                    )}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Quick Support Section */}
                <div className={`mt-auto p-6 ${collapsed ? 'hidden' : ''}`}>
                    <div className="p-4 rounded-2xl bg-[#2a2a2a] border border-[#424754]/15">
                        <p className="text-xs text-[#8c909f] font-medium mb-2 uppercase tracking-wider">
                            Quick Support
                        </p>
                        <p className="text-sm text-[#c2c6d6]">
                            Need help with bookings or payments?
                        </p>
                        <a
                            href="mailto:support@afterschool.com"
                            className="mt-3 text-xs font-bold text-primary hover:text-blue-400 transition-colors inline-block"
                        >
                            CONTACT SUPPORT →
                        </a>
                    </div>
                </div>

                {/* Collapse Toggle Button */}
                <button
                    suppressHydrationWarning
                    onClick={() => setCollapsed(!collapsed)}
                    className={`
                        absolute -right-3 top-20
                        w-6 h-6 bg-[#20201f] rounded-full
                        flex items-center justify-center
                        shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#424754]/15
                        hover:bg-[#353535] transition-all
                        group z-50
                    `}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4 text-[#e5e2e1]" />
                    ) : (
                        <ChevronLeft className="w-4 h-4 text-[#e5e2e1]" />
                    )}
                </button>
            </aside>
        </>
    );
}
