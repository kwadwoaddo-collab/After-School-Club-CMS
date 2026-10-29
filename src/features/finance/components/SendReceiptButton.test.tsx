// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
const m=vi.hoisted(()=>({send:vi.fn()}));
vi.mock('../send-receipt',()=>({sendReceiptEmail:m.send}));
import SendReceiptButton from './SendReceiptButton';
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('deliberate receipt email',()=>{
 it('does not send on render, opening the confirmation, or cancelling',()=>{render(<SendReceiptButton paymentId="payment" recipient="parent@example.test"/>);expect(m.send).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Send receipt by email'}));expect(screen.getByText('parent@example.test')).toBeTruthy();expect(m.send).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(m.send).not.toHaveBeenCalled();});
 it('sends only after explicit confirmation and does not claim delivery',async()=>{m.send.mockResolvedValue({success:true,status:'accepted'});render(<SendReceiptButton paymentId="payment" recipient="parent@example.test"/>);fireEvent.click(screen.getByRole('button',{name:'Send receipt by email'}));fireEvent.click(screen.getByRole('button',{name:'Confirm send receipt'}));await waitFor(()=>expect(m.send).toHaveBeenCalledOnce());expect(m.send.mock.calls[0][0]).toMatchObject({paymentId:'payment',expectedRecipient:'parent@example.test'});await waitFor(()=>expect(screen.getByRole('status').textContent).toContain('inbox delivery is not confirmed'));});
 it('keeps missing recipient disabled and never attempts sending',()=>{render(<SendReceiptButton paymentId="payment" recipient=""/>);expect((screen.getByRole('button',{name:'Send receipt by email'}) as HTMLButtonElement).disabled).toBe(true);expect(m.send).not.toHaveBeenCalled();});
});
