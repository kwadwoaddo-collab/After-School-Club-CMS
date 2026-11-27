// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const clip = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock('@/lib/clipboard', () => ({ copyTextToClipboard: clip.copy }));

import { CopyButton, WhatsAppCopyActions } from '../WhatsAppCopyActions';

beforeEach(() => {
    clip.copy.mockReset();
    clip.copy.mockResolvedValue(true);
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('WhatsAppCopyActions', () => {
    it('renders Copy message and Copy number (message first) with accessible names for icon variant', () => {
        render(
            <WhatsAppCopyActions phone="07700900123" message="Hi Jane, " recipientName="Jane Smith" variant="icon" />,
        );
        const group = screen.getByRole('group', { name: 'Copy options for Jane Smith' });
        const buttons = group.querySelectorAll('button');
        expect(buttons).toHaveLength(2);
        expect(buttons[0].getAttribute('aria-label')).toBe('Copy message for Jane Smith');
        expect(buttons[1].getAttribute('aria-label')).toBe('Copy number for Jane Smith');
        expect(buttons[0].getAttribute('type')).toBe('button');
    });

    it('uses visible text as the accessible name for pill/button/text variants', () => {
        render(<WhatsAppCopyActions phone="07700900123" message="Hello" variant="pill" />);
        expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Copy number' })).toBeTruthy();
    });

    it('copies the exact (trimmed) message and announces success visibly and politely', async () => {
        render(<WhatsAppCopyActions phone="07700900123" message={'Hi Jane, this is Club. '} recipientName="Jane Smith" variant="pill" />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
        });
        expect(clip.copy).toHaveBeenCalledTimes(1);
        expect(clip.copy).toHaveBeenCalledWith('Hi Jane, this is Club.');
        expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
        const live = document.querySelector('[aria-live="polite"]');
        expect(live?.textContent).toBe('Message copied for Jane Smith');
    });

    it('copies a formatted number, never the message, for Copy number', async () => {
        render(<WhatsAppCopyActions phone="07700900123" message="Hello" variant="pill" />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy number' }));
        });
        expect(clip.copy).toHaveBeenCalledWith('+44 7700 900123');
    });

    it('calls onMessageCopied only after a successful message copy (not for number, not on failure)', async () => {
        const onMessageCopied = vi.fn();
        render(<WhatsAppCopyActions phone="07700900123" message="Hello" onMessageCopied={onMessageCopied} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy number' }));
        });
        expect(onMessageCopied).not.toHaveBeenCalled();

        clip.copy.mockResolvedValueOnce(false);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
        });
        expect(onMessageCopied).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
        });
        expect(onMessageCopied).toHaveBeenCalledTimes(1);
    });

    it('a throwing onMessageCopied never breaks copy feedback', async () => {
        render(
            <WhatsAppCopyActions
                phone="07700900123"
                message="Hello"
                onMessageCopied={() => {
                    throw new Error('boom');
                }}
            />,
        );
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
        });
        expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    });

    it('resets the Copied state after a short delay', async () => {
        vi.useFakeTimers();
        render(<WhatsAppCopyActions phone="07700900123" message="Hello" />);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
        });
        expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
        await act(async () => {
            vi.advanceTimersByTime(3000);
        });
        expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
    });

    it('never fails silently: shows an alert and a focused, selected read-only fallback box; Esc dismisses', async () => {
        clip.copy.mockResolvedValue(false);
        render(<WhatsAppCopyActions phone="07700900123" message={'Line one\nLine two'} recipientName="Jane Smith" />);
        const button = screen.getByRole('button', { name: 'Copy message' });
        await act(async () => {
            fireEvent.click(button);
        });
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toContain("Couldn't copy automatically");
        const box = screen.getByLabelText('Message to copy for Jane Smith') as HTMLTextAreaElement;
        expect(box.readOnly).toBe(true);
        expect(box.value).toBe('Line one\nLine two');
        expect(document.activeElement).toBe(box);
        expect(screen.queryByText('Message copied for Jane Smith')).toBeNull();

        fireEvent.keyDown(box, { key: 'Escape' });
        expect(screen.queryByRole('alert')).toBeNull();
        expect(document.activeElement).toBe(button);
    });

    it('does not let clicks or key presses bubble to clickable rows/cards', async () => {
        const rowClick = vi.fn();
        const rowKey = vi.fn();
        render(
            <div onClick={rowClick} onKeyDown={rowKey} data-testid="row">
                <WhatsAppCopyActions phone="07700900123" message="Hello" variant="icon" />
            </div>,
        );
        const [msg] = screen.getAllByRole('button');
        await act(async () => {
            fireEvent.click(msg);
        });
        fireEvent.keyDown(msg, { key: 'Enter' });
        expect(rowClick).not.toHaveBeenCalled();
        expect(rowKey).not.toHaveBeenCalled();
    });

    it('renders nothing when there is neither a valid number nor a message', () => {
        const { container } = render(<WhatsAppCopyActions phone="not a phone" message="  " />);
        expect(container.firstChild).toBeNull();
    });

    it('shows only Copy number when no message is available, and only Copy message for an invalid number', () => {
        const { rerender } = render(<WhatsAppCopyActions phone="07700900123" />);
        expect(screen.queryByRole('button', { name: 'Copy message' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Copy number' })).toBeTruthy();
        rerender(<WhatsAppCopyActions phone="n/a" message="Hello" />);
        expect(screen.getByRole('button', { name: 'Copy message' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Copy number' })).toBeNull();
    });

    it('CopyButton copies arbitrary text and does not trigger navigation or form submission', async () => {
        const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
        render(
            <form onSubmit={onSubmit}>
                <CopyButton kind="message" text="abc" />
            </form>,
        );
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
        });
        expect(clip.copy).toHaveBeenCalledWith('abc');
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
