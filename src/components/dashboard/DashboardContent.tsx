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
              Mobile bottom nav clearance handled in <main pb-24 lg:pb-8> in layout.tsx
            */}
            <div className="flex-1 flex flex-col pt-16 sm:pt-20">
                {children}
            </div>
        </div>
    );
}
