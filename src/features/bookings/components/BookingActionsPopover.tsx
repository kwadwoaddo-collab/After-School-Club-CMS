'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Escape table overflow without changing any booking action or its authority. */
export function BookingActionsPopover({ anchor, desktop, id, onClose, children }: {
    anchor: HTMLElement | null;
    desktop: boolean;
    id: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{top: number; left: number} | null>(null);
    useLayoutEffect(() => {
        const menu = ref.current;
        if (!menu || !anchor || getComputedStyle(menu).display === 'none') return;
        const place = () => {
            if (getComputedStyle(menu).display === 'none') { onClose(); return; }
            const rect = anchor.getBoundingClientRect();
            setPosition({
                top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8)),
                left: Math.max(8, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8)),
            });
        };
        const dismiss = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); anchor.focus(); }
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        document.addEventListener('keydown', dismiss);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
            document.removeEventListener('keydown', dismiss);
        };
    }, [anchor, onClose]);

    const ready = position !== null;
    useLayoutEffect(() => {
        if (ready) ref.current?.querySelector<HTMLElement>('a,button')?.focus();
    }, [ready]);

    return createPortal(
        <div id={id} ref={ref} role="group" aria-label="Booking action options" onClick={event => event.stopPropagation()}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onClose(); }}
            style={{top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden', maxHeight: 'calc(100dvh - 16px)'}}
            className={`${desktop ? 'hidden xl:block' : 'xl:hidden'} fixed w-52 max-w-[calc(100vw-16px)] overflow-y-auto bg-surface-elevated rounded-md shadow-[var(--shadow-popover)] border border-border py-1.5 z-[70]`}>
            {children}
        </div>, document.body,
    );
}
