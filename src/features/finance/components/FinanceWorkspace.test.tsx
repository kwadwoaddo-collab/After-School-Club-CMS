// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Workspace from './FinanceWorkspace';
import type { WorkspaceInvoice } from '../domain/finance-workspace';
const mocks=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>mocks,useSearchParams:()=>new URLSearchParams('centre=centre')}));
vi.mock('next/link',()=>({default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a>}));
vi.mock('./RecordPaymentModal',()=>({default:({invoiceNumber,remainingBalance}:{invoiceNumber:string;remainingBalance:number})=><div role="dialog">{invoiceNumber} payment {remainingBalance}</div>}));
const bill=(id:string,status:string,start='2026-11-06',end='2026-12-05'):WorkspaceInvoice=>({id,invoiceNumber:`INV-${id}`,organisationId:'org',centreId:'centre',parentId:'parent',parent:{id:'parent',firstName:'Demo',lastName:'Family'},amount:'1900',status,invoiceDate:'2026-10-16',billingPeriodStart:start,billingPeriodEnd:end,dueDate:start,payments:[]});
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('daily finance workflow',()=>{
 it('keeps upcoming drafts distinct and reveals prior invoice context before the issue route',()=>{
  render(<Workspace invoices={[bill('nov','sent'),bill('dec','draft','2026-12-06','2027-01-05')]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  expect(screen.getByText('Upcoming periods · 1 draft invoice')).toBeTruthy();
  const review=screen.getByText('Review invoice',{exact:false}).closest('details')!;
  expect(within(review).getByText('Previous billed period')).toBeTruthy();
  expect(within(review).getByRole('link',{name:'INV-nov'}).getAttribute('href')).toBe('/dashboard/finance/invoices/nov');
  expect(screen.getByRole('link',{name:'Open draft to issue'}).getAttribute('href')).toBe('/dashboard/finance/invoices/dec');
  expect(screen.queryByRole('button',{name:'Issue invoice'})).toBeNull();
 });
 it('opens the existing guarded payment form for the selected invoice and preserves centre',()=>{
  render(<Workspace invoices={[bill('nov','sent')]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));
  expect(mocks.replace).toHaveBeenCalledWith('/dashboard/finance?centre=centre&task=payments',{scroll:false});
  fireEvent.click(screen.getByRole('button',{name:'Record payment for INV-nov'}));
  expect(screen.getByRole('dialog').textContent).toContain('INV-nov payment 1900');
 });
 it('shows unavailable rather than all clear on a failed load',()=>{
  render(<Workspace invoices={[]} cycles={[]} today="2026-10-25" invoiceError={true} cycleError={false}/>);
  expect(screen.getByRole('alert').textContent).toContain('No complete task count');
  expect(screen.queryByText(/No current or historical drafts/)).toBeNull();
 });
 it('keeps invoice counts across pagination and resets page on search',()=>{
  render(<Workspace invoices={Array.from({length:30},(_,i)=>bill(String(i),'sent'))} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));
  fireEvent.click(screen.getByRole('button',{name:'Next'}));
  expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  expect(screen.getByText(/30 invoices ·/)).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'INV-29'}});
  expect(screen.getByRole('button',{name:'Record payment for INV-29'})).toBeTruthy();
 });
 it('clamps the last page after payment refresh removes its final records',()=>{
  const invoices=Array.from({length:26},(_,i)=>bill(String(i),'sent'));
  const {rerender}=render(<Workspace invoices={invoices} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));fireEvent.click(screen.getByRole('button',{name:'Next'}));
  rerender(<Workspace invoices={invoices.slice(0,25)} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  expect(screen.getByRole('button',{name:'Record payment for INV-0'})).toBeTruthy();
 });
 it('clears overdue-only on tab changes instead of silently hiding future debts',()=>{
  render(<Workspace invoices={[bill('nov','sent')]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));fireEvent.click(screen.getByRole('checkbox',{name:'Overdue only'}));
  expect(screen.queryByRole('button',{name:'Record payment for INV-nov'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/Drafts to review/}));fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));
  expect(screen.getByRole('button',{name:'Record payment for INV-nov'})).toBeTruthy();
 });
});
