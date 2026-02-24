'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarContextType {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    // Default to collapsed (hidden) — works correctly for both SSR and mobile first-render
    const [collapsed, setCollapsed] = useState(true);

    // After hydration: expand on desktop, keep collapsed on mobile
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        setCollapsed(!mq.matches);

        const handler = (e: MediaQueryListEvent) => {
            // When resizing to desktop, auto-expand; shrinking to mobile, auto-collapse
            setCollapsed(!e.matches);
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    return (
        <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
