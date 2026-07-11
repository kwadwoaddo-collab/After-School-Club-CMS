'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface HeaderPortalProps {
    children: React.ReactNode;
    targetId: 'header-left' | 'header-middle' | 'header-right-actions';
}

export default function HeaderPortal({ children, targetId }: HeaderPortalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const targetEl = document.getElementById(targetId);
    if (!targetEl) return null;

    return createPortal(children, targetEl);
}
