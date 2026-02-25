'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    School,
    Users,
    Settings,
    ChevronLeft,
    ChevronRight,
    Plus,
    Share2,
    UserCircle2,
    ClipboardList,
    Link2,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';

interface SidebarProps {
    userName?: string;
    userRole?: string;
    orgName?: string;
}

const ROLE_NAV: Record<string, string[]> = {
    ORG_OWNER: ['Dashboard', 'Centres', 'Students', 'Registrations', 'Team', 'Settings'],
    MANAGER: ['Dashboard', 'Centres', 'Students', 'Registrations'],
    FRONT_DESK: ['Dashboard', 'Students'],
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

    const allowedNav = ROLE_NAV[userRole] || ROLE_NAV['TUTOR'];
    const allowedActions = ROLE_QUICK_ACTIONS[userRole] || [];

    const navItems = [
        { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
        { name: 'Centres', icon: School, href: '/dashboard/centres' },
        { name: 'Team', icon: UserCircle2, href: '/dashboard/staff' },
        { name: 'Students', icon: Users, href: '/dashboard/students' },
        { name: 'Registrations', icon: ClipboardList, href: '/dashboard/registrations' },
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
                    sidebar-gradient text-white flex flex-col
                    transition-all duration-300 ease-in-out
                    w-64
                    ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0'}
                    shadow-2xl
                `}
            >
                {/* Header */}
                <div className="p-6">
                    <div className={`flex items-center gap-3 mb-8 overflow-hidden ${collapsed ? 'justify-center' : ''}`}>
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-lg shadow-primary/20 flex-shrink-0">
                            {orgName.slice(0, 2).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <span className="text-base font-bold tracking-tight truncate leading-tight">
                                {orgName}
                            </span>
                        )}
                    </div>

                    {/* Quick Actions - Only show when expanded */}
                    {!collapsed && (
                        <>
                            {(allowedActions.includes('new-assessment') || allowedActions.includes('booking-link')) && (
                                <div className="mb-6">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">
                                        Quick Actions
                                    </p>
                                    <div className="space-y-2">
                                        {allowedActions.includes('new-assessment') && (
                                            <Link
                                                href="/dashboard/bookings/new"
                                                className="group relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-purple-500/20 hover:border-purple-500/40 transition-all overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
                                                    <Plus className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="relative text-sm font-bold text-white">New Assessment</span>
                                            </Link>
                                        )}
                                        {allowedActions.includes('booking-link') && (
                                            <Link
                                                href="/dashboard/booking-link"
                                                className="group relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/50">
                                                    <Share2 className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="relative text-sm font-bold text-white">
                                                    Booking Link
                                                </span>
                                            </Link>
                                        )}
                                        {allowedActions.includes('registration-link') && (
                                            <Link
                                                href="/dashboard/registration-link"
                                                className="group relative flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-violet-500/10 hover:from-purple-500/20 hover:to-violet-500/20 border border-purple-500/20 hover:border-purple-500/40 transition-all overflow-hidden"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-violet-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
                                                    <Link2 className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="relative text-sm font-bold text-white">
                                                    Reg. Link
                                                </span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-px bg-white/10 mb-6" />
                        </>
                    )}

                    {/* Navigation */}
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => {
                                        // Collapse on mobile after clicking
                                        if (window.innerWidth < 1024) {
                                            setCollapsed(true);
                                        }
                                    }}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl
                                        transition-all group relative
                                        ${isActive
                                            ? 'text-white bg-white/10'
                                            : 'text-slate-400 hover:text-white hover:bg-white/10'
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
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <p className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider">
                            Quick Support
                        </p>
                        <p className="text-sm text-slate-300">
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
                    onClick={() => setCollapsed(!collapsed)}
                    className={`
                        absolute -right-3 top-20
                        w-6 h-6 bg-white rounded-full
                        flex items-center justify-center
                        shadow-lg border border-slate-200
                        hover:bg-slate-50 transition-all
                        group z-50
                    `}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    ) : (
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                    )}
                </button>
            </aside>
        </>
    );
}
