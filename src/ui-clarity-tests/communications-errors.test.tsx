// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CommunicationsClient from '@/app/dashboard/communications/CommunicationsClient';
const actions = vi.hoisted(() => ({ sendBroadcast: vi.fn(), getBroadcasts: vi.fn(), getParentsForCentre: vi.fn(), getClassesForCentre: vi.fn(), getBroadcastDeliveryStats: vi.fn() }));
vi.mock('@/features/communications/actions', () => actions);
vi.mock('next/link', () => ({ default: ({children, ...props}: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => <a {...props}>{children}</a> }));
const broadcast = { id:'broadcast-1', subject:'Fixture update', message:'Fixture content', createdAt:'2026-10-26T10:00:00Z', status:'PARTIALLY_FAILED', recipientCount:3, successCount:2, failureCount:1 };
const technical = 'Provider SMTP error Bearer secret@example.com stack trace';
beforeEach(() => {
    vi.resetAllMocks();
    actions.getBroadcasts.mockResolvedValue([broadcast]);
    actions.getParentsForCentre.mockResolvedValue([{ id:'parent-1', communicationsConsent:true },{id:'parent-2',communicationsConsent:false}]);
    actions.getClassesForCentre.mockResolvedValue([]);
    actions.getBroadcastDeliveryStats.mockResolvedValue({ deliveries:[{id:'delivery-1',parentId:'parent-1',recipientName:'Fixture parent',recipientEmail:'fixture@example.test',status:'FAILED',lastError:technical}] });
});
afterEach(cleanup);
async function compose() {
    render(<CommunicationsClient centreId="centre-1"/>);
    const send = screen.getByRole('button',{name:'Send Broadcast'}) as HTMLButtonElement;
    await waitFor(() => expect(send.disabled).toBe(false));
    fireEvent.change(screen.getByPlaceholderText('e.g. Important Update: Centre Closure Tomorrow'),{target:{value:'Fixture subject'}});
    fireEvent.change(screen.getByPlaceholderText('Type your message here...'),{target:{value:'Fixture body'}});
    return send;
}
describe('communications understandable errors', () => {
    it('shows recoverable load failure instead of false empty history and blocks stale recipients', async () => {
        actions.getBroadcasts.mockRejectedValueOnce(new Error(technical));
        render(<CommunicationsClient centreId="centre-1"/>);
        await screen.findByText(/We couldn’t load recipients/);
        expect((screen.getByRole('button',{name:'Send Broadcast'}) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole('button',{name:'History & Audit Log'}));
        expect(screen.queryByText('No messages yet')).toBeNull();
        expect(document.body.textContent).not.toContain(technical);
        fireEvent.click(screen.getByRole('button',{name:'Try loading again'}));
        await screen.findByText('Fixture update');
        expect(actions.sendBroadcast).not.toHaveBeenCalled();
    });
    it('retains draft and prevents blind resend after an interrupted response; history recovery only reads', async () => {
        actions.sendBroadcast.mockRejectedValueOnce(new Error(technical));
        fireEvent.click(await compose());
        await screen.findByText(/Your message may already be queued/);
        expect((screen.getByRole('button',{name:'Send Broadcast'}) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByPlaceholderText('Type your message here...') as HTMLTextAreaElement).value).toBe('Fixture body');
        expect(document.body.textContent).not.toContain(technical);
        fireEvent.click(screen.getByRole('button',{name:'Check message history'}));
        await screen.findByText('Fixture update');
        expect(actions.sendBroadcast).toHaveBeenCalledTimes(1);
    });
    it('treats an unrecognized returned error as unknown instead of rendering it', async () => {
        actions.sendBroadcast.mockResolvedValueOnce({success:false,count:0,sent:0,failed:0,error:technical});
        fireEvent.click(await compose());
        await screen.findByText(/Your message may already be queued/);
        expect(document.body.textContent).not.toContain(technical);
    });
    it('explains access denial and preserves consent filtering and payload', async () => {
        actions.sendBroadcast.mockResolvedValueOnce({success:false,count:0,sent:0,failed:0,error:'Unauthorized: only Owner/Manager may send broadcasts'});
        fireEvent.click(await compose());
        await screen.findByText(/Only an owner or manager/);
        expect(actions.sendBroadcast).toHaveBeenCalledWith({centreId:'centre-1',audienceParentIds:['parent-1'],subject:'Fixture subject',message:'Fixture body'});
        expect(document.body.textContent).not.toContain('Unauthorized:');
    });
    it('retries delivery reads without sending and hides raw provider text including tooltips while preserving counts', async () => {
        actions.getBroadcastDeliveryStats.mockRejectedValueOnce(new Error(technical));
        await compose();
        fireEvent.click(screen.getByRole('button',{name:'History & Audit Log'}));
        fireEvent.click(await screen.findByText('Fixture update'));
        await screen.findByText(/We couldn’t load delivery details/);
        fireEvent.click(screen.getByRole('button',{name:'Try loading delivery details again'}));
        await screen.findByText(/Delivery needs checking/);
        expect(document.body.innerHTML).not.toContain(technical);
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
        expect(screen.getAllByText('1').length).toBeGreaterThan(0);
        expect(actions.sendBroadcast).not.toHaveBeenCalled();
    });
    it('keeps confirmed queue success and counts without claiming inbox delivery', async () => {
        actions.sendBroadcast.mockResolvedValueOnce({success:true,count:1,sent:0,failed:0,status:'QUEUED'});
        fireEvent.click(await compose());
        await screen.findByText(/Successfully queued message to 1 parents/);
        expect((screen.getByPlaceholderText('Type your message here...') as HTMLTextAreaElement).value).toBe('');
        expect(screen.queryByText(/could not be confirmed/)).toBeNull();
    });
});
