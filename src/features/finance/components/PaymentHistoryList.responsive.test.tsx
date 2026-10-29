// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('@/components/ui/ToastProvider',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock('../actions',()=>({verifyPayment:vi.fn(),failPayment:vi.fn(),reversePayment:vi.fn()}));
vi.mock('./SendReceiptButton',()=>({default:()=> <button>Send receipt by email</button>}));
vi.mock('./CorrectPaymentDialog',()=>({CorrectPaymentDialog:()=> <div role="dialog">Correct payment</div>}));
import PaymentHistoryList from './PaymentHistoryList';
afterEach(cleanup);
it('keeps correction and receipt actions outside payment facts and opens correction for the payment',()=>{
 render(<PaymentHistoryList canReverse canCorrect canSendReceipt receiptRecipient="parent@example.test" payments={[{id:'payment-1',amount:300,method:'bank_transfer',status:'verified',transactionReference:'A long reference that must wrap on smaller screens',recordedAt:'2026-10-27T12:00:00Z'}]}/>);
 const action=screen.getByRole('button',{name:'Correct payment details'});
 expect(action.closest('dl')).toBeNull();
 expect(action.closest('[aria-label="Payment actions"]')).not.toBeNull();
 expect(screen.getByRole('button',{name:'Send receipt by email'})).toBeTruthy();
 expect(screen.queryByRole('table')).toBeNull();
 fireEvent.click(action);
 expect(screen.getByRole('dialog').textContent).toBe('Correct payment');
});
