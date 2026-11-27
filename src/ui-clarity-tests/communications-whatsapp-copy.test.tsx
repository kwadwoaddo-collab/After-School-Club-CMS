// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommunicationsClient from '@/app/dashboard/communications/CommunicationsClient';
const actions = vi.hoisted(() => ({ sendBroadcast: vi.fn(), createWhatsAppBroadcast: vi.fn(), markWhatsAppDeliverySent: vi.fn(), getBroadcasts: vi.fn(), getParentsForCentre: vi.fn(), getClassesForCentre: vi.fn(), getBroadcastDeliveryStats: vi.fn() }));
vi.mock('@/features/communications/actions', () => actions);
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => <a {...props}>{children}</a> }));

const waBroadcast = { id: 'wa-1', subject: 'WA Reminder', message: 'Club update', createdAt: '2026-11-26T10:00:00Z', status: 'WHATSAPP_QUEUE', recipientCount: 1, successCount: 0, failureCount: 0 };
const writeText = vi.fn();

beforeEach(() => {
    vi.resetAllMocks();
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    actions.getBroadcasts.mockResolvedValue([]);
    actions.getParentsForCentre.mockResolvedValue([{ id: 'parent-1', phone: '07700900123', communicationsConsent: true }]);
    actions.getClassesForCentre.mockResolvedValue([]);
    actions.createWhatsAppBroadcast.mockResolvedValue({
        success: true,
        broadcastId: 'wa-1',
        broadcast: waBroadcast,
        deliveries: [{ id: 'del-wa-1', parentId: 'parent-1', recipientName: 'Nga Le', recipientEmail: 'whatsapp:+447700900123', channel: 'whatsapp', status: 'AWAITING_HANDOFF', attemptCount: 0, sentAt: null, lastError: null, createdAt: '2026-11-26T10:00:00Z' }],
        count: 1,
        sent: 0,
        failed: 0,
        status: 'WHATSAPP_QUEUE',
    });
    actions.markWhatsAppDeliverySent.mockResolvedValue({ success: true });
});
afterEach(cleanup);

async function openQueue() {
    render(<CommunicationsClient centreId="centre-1" />);
    const send = screen.getByRole('button', { name: 'Send Broadcast' }) as HTMLButtonElement;
    await waitFor(() => expect(send.disabled).toBe(false));
    fireEvent.change(screen.getByPlaceholderText('e.g. Important Update: Centre Closure Tomorrow'), { target: { value: 'WA Reminder' } });
    fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'Club update' } });
    fireEvent.click(screen.getByRole('button', { name: /WhatsApp \(Free\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Prepare 1-to-1 WhatsApp Queue/i }));
    return screen.findByRole('link', { name: /Open in WhatsApp/i });
}

describe('WhatsApp Launch Queue copy-first actions', () => {
    it('Copy message / Copy number never mark the delivery as sent; opening the chat still does (unchanged)', async () => {
        const openLink = (await openQueue()) as HTMLAnchorElement;
        const expectedText = new URL(openLink.href).searchParams.get('text');
        expect(expectedText).toContain('Hi Nga,');
        expect(expectedText).toContain('WA Reminder');
        expect(expectedText).toContain('Club update');

        const copyMessage = screen.getByRole('button', { name: 'Copy message' });
        expect(copyMessage.compareDocumentPosition(openLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

        fireEvent.click(copyMessage);
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(expectedText));
        fireEvent.click(screen.getByRole('button', { name: 'Copy number' }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith('+44 7700 900123'));

        expect(actions.markWhatsAppDeliverySent).not.toHaveBeenCalled();
        expect(screen.getByText('READY')).toBeTruthy();

        fireEvent.click(openLink);
        await waitFor(() => expect(actions.markWhatsAppDeliverySent).toHaveBeenCalledTimes(1));
        expect(actions.markWhatsAppDeliverySent).toHaveBeenCalledWith('del-wa-1');
    });

    it('explains the copy-first workflow in the drawer description', async () => {
        await openQueue();
        expect(screen.getByText(/Copy each message and paste it into WhatsApp Web/)).toBeTruthy();
    });

    it('community copy shows a visible alert (not silence) when the clipboard is blocked', async () => {
        writeText.mockRejectedValue(new Error('denied'));
        render(<CommunicationsClient centreId="centre-1" />);
        const send = screen.getByRole('button', { name: 'Send Broadcast' }) as HTMLButtonElement;
        await waitFor(() => expect(send.disabled).toBe(false));
        fireEvent.change(screen.getByPlaceholderText('e.g. Important Update: Centre Closure Tomorrow'), { target: { value: 'S' } });
        fireEvent.change(screen.getByPlaceholderText('Type your message here...'), { target: { value: 'B' } });
        fireEvent.click(screen.getByRole('button', { name: /WhatsApp \(Free\)/i }));
        fireEvent.click(screen.getByRole('button', { name: /Copy for WhatsApp Community/i }));
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain("Couldn't copy automatically");
    });
});
