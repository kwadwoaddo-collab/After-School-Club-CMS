// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const mocks=vi.hoisted(()=>({correct:vi.fn()}));
vi.mock('../correct-payment',()=>({correctPaymentDetails:mocks.correct}));
import {CorrectPaymentDialog} from './CorrectPaymentDialog';
const payment={id:'11111111-1111-4111-8111-111111111111',amount:'1200.00',recordedAt:'2026-10-27T23:30:00Z',transactionReference:'BANK'};
beforeEach(()=>{HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.open=true;});});
afterEach(()=>{cleanup();vi.clearAllMocks();});
function submit(){fireEvent.change(screen.getByLabelText('Payment date'),{target:{value:'2026-10-26'}});fireEvent.change(screen.getByLabelText('Reason for correction'),{target:{value:'Incorrect bank date'}});fireEvent.click(screen.getByRole('button',{name:'Save correction'}));}
describe('correct payment dialog result handling',()=>{
 it('keeps the dialog open and reports a structured stale error without claiming success',async()=>{
  mocks.correct.mockResolvedValue({success:false,error:'This payment changed while you were editing.'});const saved=vi.fn(),close=vi.fn();render(<CorrectPaymentDialog payment={payment} onClose={close} onSaved={saved}/>);submit();
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('changed while you were editing'));expect(saved).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Save correction'})).toBeTruthy();
 });
 it('only calls saved after a confirmed correction and sends immutable stale values',async()=>{
  mocks.correct.mockResolvedValue({success:true,isReplay:false});const saved=vi.fn();render(<CorrectPaymentDialog payment={payment} onClose={vi.fn()} onSaved={saved}/>);submit();await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(mocks.correct).toHaveBeenCalledWith(expect.objectContaining({paymentId:payment.id,paymentDate:'2026-10-26',expectedRecordedAt:'2026-10-27T23:30:00.000Z',expectedReference:'BANK',reason:'Incorrect bank date'}));
 });
 it('retains the same request identity after an unconfirmed network failure',async()=>{
  mocks.correct.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({success:true,isReplay:true});const saved=vi.fn();render(<CorrectPaymentDialog payment={payment} onClose={vi.fn()} onSaved={saved}/>);submit();await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Connection lost'));expect(saved).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Save correction'}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(mocks.correct.mock.calls[1][0].correctionId).toBe(mocks.correct.mock.calls[0][0].correctionId);
 });
});
