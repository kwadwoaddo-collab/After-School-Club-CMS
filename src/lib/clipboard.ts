/**
 * Copies text to the clipboard and reports whether it worked.
 *
 * 1. Prefers the async Clipboard API (requires a secure context and permission).
 * 2. Falls back to a temporary off-screen textarea + `document.execCommand('copy')`
 *    (works in older browsers and some embedded/permission-restricted contexts).
 *
 * Never throws: callers get `false` and must show a visible failure state.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Permission denied / not focused / insecure context: try the legacy path below.
        }
    }
    return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
    if (typeof document === 'undefined' || !document.body) return false;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.tabIndex = -1;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    document.body.appendChild(textarea);
    let copied = false;
    try {
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        copied = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    } catch {
        copied = false;
    } finally {
        document.body.removeChild(textarea);
        previouslyFocused?.focus?.();
    }
    return copied;
}
