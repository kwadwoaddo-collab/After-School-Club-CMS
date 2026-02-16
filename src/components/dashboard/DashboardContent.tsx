'use client';

import { useSidebar } from './SidebarContext';

export default function DashboardContent({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div
            className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'
                }`}
        >
            {children}
        </div>
    );
}
