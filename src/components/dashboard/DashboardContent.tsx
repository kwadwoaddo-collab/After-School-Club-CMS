'use client';

import { useSidebar } from './SidebarContext';

export default function DashboardContent({ children }: { children: React.ReactNode }) {
    const { collapsed } = useSidebar();

    return (
        <div
            className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed ? 'lg:ml-[72px]' : 'lg:ml-60'
                }`}
        >
            {/*
              pt-14 = space for the fixed header, now a single InvoiceFlow-aligned
              h-14 (56px) at every breakpoint (Milestone 2 Correction Pass —
              previously h-16 mobile / h-20 sm+, responsive height was itself
              part of the "too much old-CMS chrome" problem).
              Mobile bottom nav clearance handled in <main pb-24 lg:pb-8> in layout.tsx
            */}
            <div className="flex-1 flex flex-col pt-14">
                {children}
            </div>
        </div>
    );
}
