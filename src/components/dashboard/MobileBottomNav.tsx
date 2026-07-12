'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutGrid,
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
    { name: 'Dashboard', icon: LayoutGrid, href: '/dashboard', exact: true },
    { name: 'Centres', icon: School, href: '/dashboard/centres', exact: false },
    { name: 'Team', icon: UserCircle2, href: '/dashboard/staff', exact: false },
    { name: 'Students', icon: Users, href: '/dashboard/students', exact: false },
    { name: 'Registrations', icon: ClipboardList, href: '/dashboard/registrations', exact: false },
    { name: 'Settings', icon: Settings, href: '/dashboard/settings', exact: false },
];

export default function MobileBottomNav({ userRole = 'TUTOR' }: MobileNavProps) {
    const pathname = usePathname();
    const allowed = ROLE_NAV[userRole] || ROLE_NAV['TUTOR'];
    const items = ALL_NAV.filter(i => allowed.includes(i.name)).slice(0, 5);

    return (
        <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-2xl border-t border-border/80 shadow-lg transition-colors duration-300"
            aria-label="Mobile navigation"
        >
            <div className="flex items-center justify-around h-16 px-2">
                {items.map(item => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname === item.href || pathname.startsWith(item.href + '/');
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            prefetch={true}
                            aria-current={isActive ? 'page' : undefined}
                            aria-label={item.name}
                            className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-h-[44px] min-w-[44px] justify-center ${isActive
                                    ? 'text-primary font-bold'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {/* Active indicator pill at top */}
                            {isActive && (
                                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                            )}
                            <item.icon className={`w-5 h-5 transition-all duration-200 ${isActive ? 'text-primary scale-110' : 'text-muted-foreground'}`} />
                            <span className={`text-[10px] font-semibold transition-colors duration-200 ${isActive ? 'text-primary' : ''}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
