// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks=vi.hoisted(()=>({reconcile:vi.fn(),refresh:vi.fn(),toast:vi.fn()}));
vi.mock('@/features/billing/actions/reconcile-payment',()=>({reconcilePayment:mocks.reconcile}));
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock('@/components/ui/ToastProvider',()=>({useToast:()=>({toast:mocks.toast})}));
import { ReconciliationClient } from './reconciliation-client';
const bill=(id:string,start:string|null='2026-10-06',end:string|null='2026-11-05')=>({id,invoiceNumber:`INV-${id}`,totalAmount:1900,remainingBalance:1400,status:'partially_paid',parentId:'family',parentFirstName:'Demo',parentLastName:'Family',childTfcRef:null,childFirstName:null,billingPeriodStart:start,billingPeriodEnd:end});
afterEach(()=>{cleanup();vi.resetAllMocks();});
const select=(id:string)=>fireEvent.click(screen.getByRole('button',{name:new RegExp(`INV-${id}`)}));
const fill=()=>{fireEvent.change(screen.getByLabelText('Amount (£)'),{target:{value:'500'}});fireEvent.change(screen.getByLabelText('Payment Reference'),{target:{value:'BANK-123'}});};
describe('reconciliation payment context',()=>{
 it('shows distinct periods, invoice totals and remaining balances before selection',()=>{
  render(<ReconciliationClient invoices={[bill('OCT'),bill('NOV','2026-11-06','2026-12-05')]}/>);
  expect(screen.getByText('6 Oct – 5 Nov 2026')).toBeTruthy();
  expect(screen.getByText('6 Nov – 5 Dec 2026')).toBeTruthy();
  expect(screen.getAllByText('Remaining £1400.00')).toHaveLength(2);
  expect(screen.getAllByText('Total £1900.00')).toHaveLength(2);
  expect(mocks.reconcile).not.toHaveBeenCalled();
 });
 it('requires confirmation and clears payment details when the invoice changes',()=>{
  render(<ReconciliationClient invoices={[bill('OCT'),bill('NOV','2026-11-06','2026-12-05')]}/>);
  select('OCT');fill();
  expect((screen.getByRole('button',{name:'Reconcile Payment'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  expect((screen.getByRole('button',{name:'Reconcile Payment'}) as HTMLButtonElement).disabled).toBe(false);
  select('NOV');
  expect((screen.getByLabelText('Amount (£)') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Payment Reference') as HTMLInputElement).value).toBe('');
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  expect(screen.getByText('Billing period: 6 Nov – 5 Dec 2026')).toBeTruthy();
 });
 it('locks allocation context while submitting and passes the confirmed invoice only',async()=>{
  let finish!:(value:{success:boolean})=>void;
  mocks.reconcile.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  render(<ReconciliationClient invoices={[bill('OCT'),bill('NOV')]}/>);
  select('OCT');fill();fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Reconcile Payment'}));
  await waitFor(()=>expect(mocks.reconcile).toHaveBeenCalledWith({invoiceId:'OCT',amount:500,method:'tax_free_childcare',reference:'BANK-123'}));
  expect((screen.getByRole('button',{name:/INV-NOV/}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('Amount (£)') as HTMLInputElement).disabled).toBe(true);
  finish({success:true});await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledOnce());
 });
 it('keeps input on a failed request and asks staff to check history before retrying',async()=>{
  mocks.reconcile.mockRejectedValue(new Error('network'));
  render(<ReconciliationClient invoices={[bill('OCT',null,null)]}/>);select('OCT');fill();fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Reconcile Payment'}));
  await waitFor(()=>expect(mocks.toast).toHaveBeenCalledWith(expect.stringContaining('Check the invoice payment history'),'error'));
  expect(screen.getByText('Billing period: Period missing')).toBeTruthy();
  expect((screen.getByLabelText('Payment Reference') as HTMLInputElement).value).toBe('BANK-123');
 });
});
