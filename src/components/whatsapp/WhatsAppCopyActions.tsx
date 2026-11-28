'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Check, ClipboardCopy, Copy } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';
import { formatPhoneForCopy } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

/**
 * WhatsApp Phase 1 (manual, shared centre phone): copy-first actions.
 *
 * Opening `wa.me` can reload an already-open WhatsApp Web tab, so staff copy the message / number
 * and paste it into WhatsApp Web/Desktop. These buttons sit beside (and before) the existing `wa.me` link.
 *
 * Accessibility:
 * - Native <button type="button">; icon-only variant has an accessible name (and title).
 * - Success is announced through a polite live region and shown visually (icon swaps to a check mark + text).
 * - Failure is never silent: an alert explains it and a focused, pre-selected read-only box lets the user
 *   copy manually (Ctrl/Cmd+C). Esc or leaving the box dismisses it.
 */

export type CopyKind = 'message' | 'number';
export type CopyVariant = 'icon' | 'pill' | 'button' | 'text';

const COPY_RESET_MS = 2500;

const KIND_COPY: Record<CopyKind, { label: string; done: string; manual: string }> = {
    message: { label: 'Copy message', done: 'Message copied', manual: 'Message to copy' },
    number: { label: 'Copy number', done: 'Number copied', manual: 'Number to copy' },
};

const FOCUS_RING =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function variantClasses(variant: CopyVariant, copied: boolean, solid: boolean): string {
    const base = 'inline-flex items-center justify-center whitespace-nowrap transition-colors cursor-pointer';
    switch (variant) {
        case 'icon':
            return cn(
                base,
                'min-h-9 min-w-9 sm:min-h-6 sm:min-w-6 p-1.5 rounded-sm hover:bg-page',
                copied ? 'text-accent' : 'text-text-muted hover:text-accent',
            );
        case 'text':
            return cn(
                base,
                'gap-1 min-h-9 sm:min-h-6 px-1 py-0.5 rounded-sm text-xs font-semibold hover:underline',
                'text-accent',
            );
        case 'pill':
        case 'button': {
            const size =
                variant === 'button'
                    ? 'gap-2 min-h-11 px-5 py-2.5 rounded-xl text-sm font-bold'
                    : 'gap-1 min-h-9 sm:min-h-7 px-2.5 py-1 rounded-sm text-xs font-semibold';
            const tone = solid
                ? 'bg-accent text-on-accent hover:opacity-90'
                : 'border border-accent/40 text-accent hover:bg-accent-soft/20';
            return cn(base, size, tone);
        }
    }
}

export interface CopyButtonProps {
    /** Exact text placed on the clipboard. */
    text: string;
    kind: CopyKind;
    variant?: CopyVariant;
    /** Used to make icon-only names and announcements specific ("Copy message for Jane Smith"). */
    recipientName?: string | null;
    /** Visually emphasise as the primary action (pill/button variants only). */
    solid?: boolean;
    /** Called after a successful copy. Errors thrown here never affect the copy feedback. */
    onCopied?: () => void;
    className?: string;
}

export function CopyButton({
    text,
    kind,
    variant = 'pill',
    recipientName,
    solid = false,
    onCopied,
    className,
}: CopyButtonProps) {
    const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mounted = useRef(true);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const manualRef = useRef<HTMLTextAreaElement>(null);
    const copy = KIND_COPY[kind];
    const who = recipientName?.trim() ? ` for ${recipientName.trim()}` : '';

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    useEffect(() => {
        if (status === 'failed' && manualRef.current) {
            manualRef.current.focus();
            manualRef.current.select();
        }
    }, [status]);

    const handleClick = useCallback(
        async (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            if (timer.current) clearTimeout(timer.current);
            const ok = await copyTextToClipboard(text);
            if (!mounted.current) return;
            if (ok) {
                setStatus('copied');
                try {
                    onCopied?.();
                } catch {
                    // Side-effect callbacks must never break the copy feedback.
                }
                timer.current = setTimeout(() => {
                    if (mounted.current) setStatus('idle');
                }, COPY_RESET_MS);
            } else {
                setStatus('failed');
            }
        },
        [text, onCopied],
    );

    const dismissManual = useCallback((refocusButton: boolean) => {
        setStatus('idle');
        if (refocusButton) buttonRef.current?.focus();
    }, []);

    const copied = status === 'copied';
    const showText = variant !== 'icon';
    const Icon = copied ? Check : kind === 'message' ? ClipboardCopy : Copy;
    const iconSize = variant === 'button' ? 'w-4 h-4' : variant === 'icon' ? 'w-3.5 h-3.5' : 'w-3 h-3';
    const accessibleName = `${copy.label}${who}`;

    return (
        <span className="inline-flex flex-col items-start">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleClick}
                aria-label={showText ? undefined : accessibleName}
                title={showText ? undefined : accessibleName}
                data-copy-kind={kind}
                className={cn(variantClasses(variant, copied, solid), FOCUS_RING, className)}
            >
                <Icon className={iconSize} aria-hidden="true" />
                {showText && <span>{copied ? 'Copied' : copy.label}</span>}
            </button>
            <span className="sr-only" aria-live="polite" aria-atomic="true">
                {copied ? `${copy.done}${who}` : ''}
            </span>
            {status === 'failed' && (
                <span
                    role="alert"
                    className="mt-1 flex w-56 max-w-[70vw] flex-col gap-1 rounded-sm border border-danger/40 bg-surface p-2 text-left text-[11px] font-medium text-text whitespace-normal"
                >
                    <span>Couldn&apos;t copy automatically. Select the text below and copy it (Ctrl/Cmd+C).</span>
                    <textarea
                        ref={manualRef}
                        readOnly
                        value={text}
                        rows={Math.min(5, Math.max(1, text.split('\n').length))}
                        aria-label={`${copy.manual}${who}`}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => dismissManual(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                dismissManual(true);
                            }
                        }}
                        className="w-full resize-none rounded-sm border border-border bg-page p-1 text-[11px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    />
                </span>
            )}
        </span>
    );
}

export interface WhatsAppCopyActionsProps {
    /** Raw stored phone number (any format `normaliseWhatsAppPhone` accepts). */
    phone: string | null | undefined;
    /** Exact message that would be pre-filled by the adjacent `wa.me` link. Omit to show only "Copy number". */
    message?: string | null;
    recipientName?: string | null;
    variant?: CopyVariant;
    /** Called after "Copy message" succeeds (e.g. to record an audit handoff). Never called for "Copy number". */
    onMessageCopied?: () => void;
    className?: string;
}

/**
 * "Copy message" + "Copy number" pair. Renders nothing when neither can be produced.
 * Place BEFORE the `wa.me` link so Copy is the primary action. Copying never opens WhatsApp,
 * never marks anything as sent, and never calls the server unless `onMessageCopied` does.
 */
export function WhatsAppCopyActions({
    phone,
    message,
    recipientName,
    variant = 'pill',
    onMessageCopied,
    className,
}: WhatsAppCopyActionsProps) {
    const number = formatPhoneForCopy(phone);
    const text = message?.trim() || null;
    if (!number && !text) return null;

    const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();
    const gap = variant === 'icon' ? 'gap-0.5' : 'gap-2';
    const groupName = recipientName?.trim() ? `Copy options for ${recipientName.trim()}` : 'Copy options';

    return (
        // Stops clicks/keys bubbling to clickable table rows and cards.
        <span
            role="group"
            aria-label={groupName}
            onClick={stop}
            onKeyDown={stop}
            className={cn('inline-flex flex-wrap items-start', gap, className)}
        >
            {text && (
                <CopyButton
                    kind="message"
                    text={text}
                    variant={variant}
                    recipientName={recipientName}
                    solid
                    onCopied={onMessageCopied}
                />
            )}
            {number && <CopyButton kind="number" text={number} variant={variant} recipientName={recipientName} />}
        </span>
    );
}
