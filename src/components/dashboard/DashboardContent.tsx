'use client';

import { useSidebar } from './SidebarContext';

export default function DashboardContent({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div
            className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'
                }`}
        >
            {/*
              pt-16 sm:pt-20 = space for the fixed header (h-16 on mobile, h-20 on sm+)
              pb-16 lg:pb-0  = space for the fixed mobile bottom nav
            */}
            <div className="flex-1 flex flex-col pt-16 sm:pt-20 pb-16 lg:pb-0">
                {children}
            </div>
        </div>
    );
}
