'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    School,
    Users,
    Settings,
    ClipboardList,
    UserCircle2,
} from 'lucide-react';

interface MobileNavProps {
    userRole?: string;
}

const ROLE_NAV: Record<string, string[]> = {
    ORG_OWNER: ['Dashboard', 'Students', 'Registrations', 'Settings'],
    MANAGER: ['Dashboard', 'Students', 'Registrations'],
    FRONT_DESK: ['Dashboard', 'Students'],
    TUTOR: ['Dashboard'],
};

const ALL_NAV = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Centres', icon: School, href: '/dashboard/centres' },
    { name: 'Team', icon: UserCircle2, href: '/dashboard/staff' },
    { name: 'Students', icon: Users, href: '/dashboard/students' },
    { name: 'Registrations', icon: ClipboardList, href: '/dashboard/registrations' },
    { name: 'Settings', icon: Settings, href: '/dashboard/settings' },
];

export default function MobileBottomNav({ userRole = 'TUTOR' }: MobileNavProps) {
    const pathname = usePathname();
    const allowed = ROLE_NAV[userRole] || ROLE_NAV['TUTOR'];
    const items = ALL_NAV.filter(i => allowed.includes(i.name)).slice(0, 5);

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-white/10 safe-area-pb">
            <div className="flex items-center justify-around h-16 px-2">
                {items.map(item => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${isActive
                                    ? 'text-white'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                            <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : ''}`}>
                                {item.name}
                            </span>
                            {isActive && (
                                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
