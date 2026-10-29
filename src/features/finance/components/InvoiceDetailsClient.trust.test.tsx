// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ issue:vi.fn(), resend:vi.fn(), refresh:vi.fn(), toast:vi.fn() }));
vi.mock('../actions', () => ({ issueDraftInvoice:mocks.issue, resendInvoiceEmail:mocks.resend, deleteInvoice:vi.fn(), voidInvoice:vi.fn(), updateInvoiceDate:vi.fn(), updateInvoiceNotes:vi.fn(), updateDraftInvoice:vi.fn(), discardDraftInvoice:vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter:()=>({refresh:mocks.refresh,push:vi.fn()}) }));
vi.mock('next/link', () => ({ default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a> }));
vi.mock('@/components/ui/ToastProvider',()=>({useToast:()=>({toast:mocks.toast})}));
vi.mock('@react-pdf/renderer',()=>({PDFDownloadLink:()=>null}));
vi.mock('./InvoiceTemplate',()=>({InvoiceTemplate:()=>null}));
vi.mock('./ReceiptTemplate',()=>({ReceiptTemplate:()=>null}));
vi.mock('./PaymentHistoryList',()=>({default:()=>null}));
vi.mock('./PDFPreviewModal',()=>({default:()=>null}));
vi.mock('./ConfirmActionModal',()=>({default:()=>null}));
vi.mock('./RecordPaymentModal',()=>({default:({billingContext,invoiceTotal}:{billingContext:{period:string};invoiceTotal:number})=><div role="dialog">{billingContext.period} total {invoiceTotal}</div>}));
import InvoiceDetails from './InvoiceDetailsClient';
const invoice = {id:'inv',invoiceNumber:'INV-TEST',amount:'1900',status:'draft',invoiceDate:'2026-10-16',dueDate:'2026-11-06',billingPeriodStart:'2026-11-06',billingPeriodEnd:'2026-12-05',parent:{id:'family',firstName:'Demo',lastName:'Family',email:'dummy@example.test'},centre:{name:'Dummy centre'},coveredChildrenJson:[{id:'child',name:'Sample Student'}],payments:[]};
beforeEach(()=>{
 vi.clearAllMocks();
 Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(){this.setAttribute('open','');}});
 Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(){this.removeAttribute('open');}});
 mocks.issue.mockResolvedValue({success:true,alreadyIssued:false,emailStatus:{status:'not_requested',attemptedAt:''}});
});
afterEach(cleanup);
describe('invoice review and truthful email status',()=>{
 it('opens a review without issuing; Cancel leaves the draft untouched',()=>{
  render(<InvoiceDetails invoice={invoice} organisationName="Dummy" userRole="MANAGER"/>);
  fireEvent.click(screen.getByRole('button',{name:'Issue Invoice'}));
  expect(screen.getByRole('dialog').textContent).toContain('6 Nov – 5 Dec 2026');
  expect(screen.getByRole('dialog').textContent).toContain('Sample Student');
  expect(mocks.issue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:/^Cancel$/}));
  expect(screen.queryByRole('dialog')).toBeNull();expect(mocks.issue).not.toHaveBeenCalled();
 });
 it('requires historical acknowledgement and issues only after confirmation',async()=>{
  render(<InvoiceDetails invoice={{...invoice,billingPeriodStart:'2025-05-22',billingPeriodEnd:'2025-06-21'}} organisationName="Dummy" userRole="MANAGER"/>);
  fireEvent.click(screen.getByRole('button',{name:'Issue Invoice'}));
  expect((screen.getByRole('button',{name:'Confirm and issue invoice'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button',{name:'Confirm and issue invoice'}));
  await waitFor(()=>expect(mocks.issue).toHaveBeenCalledTimes(1));
  expect(mocks.issue).toHaveBeenCalledWith('inv');
  expect(mocks.resend).not.toHaveBeenCalled();
  expect(mocks.toast.mock.calls[0][0].message).toContain('No email was sent');
 });
 it('does not allow repeated confirmation while issuance is in flight',async()=>{
  let finish:(v:unknown)=>void=()=>{};mocks.issue.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  render(<InvoiceDetails invoice={invoice} organisationName="Dummy" userRole="MANAGER"/>);
  fireEvent.click(screen.getByRole('button',{name:'Issue Invoice'}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm and issue invoice'}));
  expect((screen.getByRole('button',{name:'Issuing…'}) as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.issue).toHaveBeenCalledTimes(1);
  finish({success:true});await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 });
 it('shows persisted email acceptance separately from issued status',()=>{
  render(<InvoiceDetails invoice={{...invoice,status:'sent',emailStatus:{status:'accepted',attemptedAt:'2026-10-26T10:00:00Z'}}} organisationName="Dummy" userRole="MANAGER"/>);
  expect(screen.getByRole('status').textContent).toContain('inbox delivery not confirmed');
  expect(screen.getByText('ISSUED')).toBeTruthy();
  expect(screen.getByText(/Last attempt:/)).toBeTruthy();
 });
 it('handles a lost resend response without claiming failure or delivery',async()=>{
  mocks.resend.mockRejectedValue(new Error('lost response'));
  render(<InvoiceDetails invoice={{...invoice,status:'sent'}} organisationName="Dummy" userRole="MANAGER"/>);
  fireEvent.click(screen.getByRole('button',{name:'Send invoice by email'}));
  await waitFor(()=>expect(mocks.toast).toHaveBeenCalled());
  expect(mocks.toast.mock.calls[0][0].message).toContain('email may have been accepted');
  expect(screen.getByRole('status').textContent).toContain('not confirmed');
 });
 it('includes period and total in the invoice-details payment form',()=>{
  render(<InvoiceDetails invoice={{...invoice,status:'sent'}} organisationName="Dummy" userRole="ORG_OWNER"/>);
  fireEvent.click(screen.getByRole('button',{name:'Record Received Payment'}));
  expect(screen.getByRole('dialog').textContent).toContain('6 Nov – 5 Dec 2026 total 1900');
 });
});
