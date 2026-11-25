'use client';

import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.tabIndex >= 0
    );
}

/**
 * WCAG 2.2 AA modal dialog focus management:
 * - Moves initial focus inside the dialog when opened.
 * - Traps Tab / Shift+Tab focus cycling within focusable descendants.
 * - Invokes optional onEscape handler on Escape keydown.
 * - Restores focus to the previously focused trigger element when closed/unmounted.
 */
export function useDialogFocusTrap(
    isOpen: boolean,
    dialogRef: RefObject<HTMLElement | null>,
    onEscape?: () => void
): void {
    const onEscapeRef = useRef(onEscape);

    useEffect(() => {
        onEscapeRef.current = onEscape;
    }, [onEscape]);

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return;

        const previouslyFocused =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const container = dialogRef.current;
        if (container && !container.contains(document.activeElement)) {
            const initialFocusables = getFocusableElements(container);
            if (initialFocusables.length > 0) {
                initialFocusables[0].focus();
            } else {
                if (!container.hasAttribute('tabindex')) {
                    container.setAttribute('tabindex', '-1');
                }
                container.focus();
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (onEscapeRef.current) {
                    e.stopPropagation();
                    onEscapeRef.current();
                }
                return;
            }

            if (e.key !== 'Tab') return;
            const currentContainer = dialogRef.current;
            if (!currentContainer) return;

            const focusables = getFocusableElements(currentContainer);
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (e.shiftKey) {
                if (active === first || !currentContainer.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (active === last || !currentContainer.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (
                previouslyFocused &&
                typeof previouslyFocused.focus === 'function' &&
                document.contains(previouslyFocused)
            ) {
                previouslyFocused.focus();
            }
        };
    }, [isOpen, dialogRef]);
}
