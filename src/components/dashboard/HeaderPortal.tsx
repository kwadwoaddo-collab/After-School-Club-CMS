'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface HeaderPortalProps {
    children: React.ReactNode;
    targetId: 'header-left' | 'header-middle' | 'header-right-actions';
}

const MOBILE_ACTIONS_QUERY = '(max-width: 639px)';

export default function HeaderPortal({ children, targetId }: HeaderPortalProps) {
    const [mounted, setMounted] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(false);

    useEffect(() => {
        setMounted(true);

        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mql = window.matchMedia(MOBILE_ACTIONS_QUERY);
        const updateMatch = () => setIsMobileViewport(mql.matches);
        updateMatch();

        mql.addEventListener('change', updateMatch);
        return () => mql.removeEventListener('change', updateMatch);
    }, []);

    if (!mounted) return null;

    const resolvedTargetId =
        targetId === 'header-right-actions' && isMobileViewport
            ? 'header-mobile-actions'
            : targetId;

    const targetEl =
        document.getElementById(resolvedTargetId) ??
        document.getElementById(targetId);

    if (!targetEl) return null;

    return createPortal(children, targetEl);
}
