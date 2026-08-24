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
import { useSidebar } from './SidebarContext';

interface MobileNavProps {
    userRole?: string;
}

const ROLE_NAV: Record<string, string[]> = {
    ORG_OWNER: ['Dashboard', 'Students', 'Registrations', 'Settings'],
    MANAGER: ['Dashboard', 'Students', 'Registrations'],
    // N-1 (Milestone 3M): Registrations added for FRONT_DESK mobile nav.
    // Sidebar (3L A-2) and page gate both permit FRONT_DESK access to Registrations;
    // the mobile nav was the sole remaining inconsistency.
    FRONT_DESK: ['Dashboard', 'Students', 'Registrations'],
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
    const { collapsed } = useSidebar();
    const allowed = ROLE_NAV[userRole] || ROLE_NAV['TUTOR'];
    const items = ALL_NAV.filter(i => allowed.includes(i.name)).slice(0, 5);

    // Hidden while the full-height mobile nav drawer (Sidebar.tsx, `!collapsed`
    // on <lg) is open — both are the "mobile navigation" surface, and showing
    // the tab bar drawn on top of the drawer at equal z-index (a layering
    // detail that predates Milestone 2) was confusing. `collapsed` has no
    // effect at `lg` and up, where the drawer never renders.
    if (!collapsed) return null;

    return (
        <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md border-t border-border"
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
                            className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-sm transition-colors min-h-[44px] min-w-[44px] justify-center ${isActive
                                    ? 'text-accent font-semibold'
                                    : 'text-text-muted hover:text-text'
                                }`}
                        >
                            {/* Active indicator pill at top */}
                            {isActive && (
                                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />
                            )}
                            <item.icon className={`w-5 h-5 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                            <span className={`text-[10px] font-semibold ${isActive ? 'text-accent' : ''}`}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
