// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from '../clipboard';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExec = (document as unknown as { execCommand?: unknown }).execCommand;

function setClipboard(value: unknown) {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
}

beforeEach(() => {
    setClipboard(undefined);
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn(() => true);
});
afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    (document as unknown as { execCommand: unknown }).execCommand = originalExec;
    document.body.innerHTML = '';
});

describe('copyTextToClipboard', () => {
    it('uses the async Clipboard API when available', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        setClipboard({ writeText });
        await expect(copyTextToClipboard('hello')).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith('hello');
        expect(document.execCommand).not.toHaveBeenCalled();
    });

    it('falls back to execCommand when the Clipboard API rejects, and cleans up its temporary textarea', async () => {
        setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
        await expect(copyTextToClipboard('hello')).resolves.toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(document.querySelector('textarea')).toBeNull();
    });

    it('falls back to execCommand when the Clipboard API is missing', async () => {
        await expect(copyTextToClipboard('hello')).resolves.toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
    });

    it('returns false (never throws) when every method fails', async () => {
        setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
        (document as unknown as { execCommand: unknown }).execCommand = vi.fn(() => false);
        await expect(copyTextToClipboard('hello')).resolves.toBe(false);

        (document as unknown as { execCommand: unknown }).execCommand = vi.fn(() => {
            throw new Error('unsupported');
        });
        await expect(copyTextToClipboard('hello')).resolves.toBe(false);
        expect(document.querySelector('textarea')).toBeNull();
    });

    it('restores focus to the previously focused element after the legacy path', async () => {
        const btn = document.createElement('button');
        document.body.appendChild(btn);
        btn.focus();
        await copyTextToClipboard('hello');
        expect(document.activeElement).toBe(btn);
    });
});
