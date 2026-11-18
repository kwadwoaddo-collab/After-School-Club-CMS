// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Workspace from './FinanceWorkspace';
import type { WorkspaceInvoice } from '../domain/finance-workspace';
const mocks=vi.hoisted(()=>({replace:vi.fn(),refresh:vi.fn(),search:'centre=centre'}));
vi.mock('next/navigation',()=>({useRouter:()=>mocks,useSearchParams:()=>new URLSearchParams(mocks.search)}));
vi.mock('next/link',()=>({default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a>}));
vi.mock('../actions',()=>({recordPayment:vi.fn()}));
vi.mock('../hooks/use-payment-idempotency',()=>({usePaymentIdempotency:()=>({idempotencyKey:'test',originalRecordedAt:null,rotateIdempotencyKey:vi.fn(),clearIdempotencyKey:vi.fn()})}));
vi.mock('@/components/ui/ToastProvider',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('./RecordPaymentModal',()=>({default:({invoiceNumber,remainingBalance,billingContext}:{invoiceNumber:string;remainingBalance:number;billingContext?:{priorOverdueNotice?:string}})=><div role="dialog">{invoiceNumber} payment {remainingBalance}{billingContext?.priorOverdueNotice ? ` | ${billingContext.priorOverdueNotice}` : ''}</div>}));
const bill=(id:string,status:string,start='2026-11-06',end='2026-12-05'):WorkspaceInvoice=>({id,invoiceNumber:`INV-${id}`,organisationId:'org',centreId:'centre',parentId:'parent',parent:{id:'parent',firstName:'Demo',lastName:'Family'},amount:'1900',status,invoiceDate:'2026-10-16',billingPeriodStart:start,billingPeriodEnd:end,dueDate:start,payments:[]});
afterEach(()=>{cleanup();vi.clearAllMocks();mocks.search='centre=centre';});
describe('daily finance workflow',()=>{
 it('keeps historical and upcoming drafts out of the current work count without deleting them',()=>{
  render(<Workspace invoices={[bill('old','draft','2025-05-22','2025-06-21'),bill('future','draft'),bill('current','draft','2026-10-06','2026-11-05')]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  expect(screen.getByRole('button',{name:'Drafts to review 1'})).toBeTruthy();
  expect(within(screen.getByRole('list',{name:'Current draft invoices'})).getByRole('button',{name:'Review invoice INV-current'})).toBeTruthy();
  expect(within(screen.getByRole('list',{name:'Current draft invoices'})).queryByRole('button',{name:'Review invoice INV-old'})).toBeNull();
  expect(screen.getByText('Historical drafts to check · 1').closest('details')?.hasAttribute('open')).toBe(false);
  fireEvent.click(screen.getByText('Historical drafts to check · 1'));
  expect(screen.getByRole('button',{name:'Review invoice INV-old'})).toBeTruthy();
 });
 it('retains the optional table and expands review with the invoice’s recorded covered students',()=>{
  const current={...bill('current','draft','2026-10-06','2026-11-05'),coveredChildrenJson:[{id:'child',name:'Recorded Student'}]};
  render(<Workspace invoices={[current]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  fireEvent.click(screen.getByRole('button',{name:'Table'}));
  const table=screen.getByRole('table',{name:'Current draft invoices'});
  expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
  fireEvent.click(screen.getByRole('button',{name:'Review invoice INV-current'}));
  expect(screen.getByRole('link',{name:'Recorded Student'}).getAttribute('href')).toBe('/dashboard/students/child');
  fireEvent.click(screen.getByRole('button',{name:'Close review'}));
  expect(screen.queryByRole('region',{name:'Invoice review INV-current'})).toBeNull();
 });
 it('keeps upcoming drafts distinct and reveals prior invoice context before the issue route',()=>{
  render(<Workspace invoices={[bill('nov','sent'),bill('dec','draft','2026-12-06','2027-01-05')]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  expect(screen.getByText('Upcoming periods · 1 draft invoice')).toBeTruthy();
  fireEvent.click(screen.getByText('Upcoming periods · 1 draft invoice'));
  fireEvent.click(screen.getByRole('button',{name:'Review invoice INV-dec'}));
  const review=screen.getByRole('region',{name:'Invoice review INV-dec'});
  expect(within(review).getByText('Previous invoice')).toBeTruthy();
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
  expect(screen.queryByText(/No current-period drafts/)).toBeNull();
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
 it('resets payment stage filter on tab changes and clear filters instead of silently hiding future debts',()=>{
  render(<Workspace invoices={[bill('nov','sent')]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));
  const stageGroup=screen.getByRole('group',{name:'Payment stage filter'});
  fireEvent.click(within(stageGroup).getByRole('button',{name:'Overdue (0)'}));
  expect(screen.queryByRole('button',{name:'Record payment for INV-nov'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Clear filters'}));
  expect(within(stageGroup).getByRole('button',{name:'All unpaid (1)'}).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button',{name:'Record payment for INV-nov'})).toBeTruthy();
  fireEvent.click(within(stageGroup).getByRole('button',{name:'Overdue (0)'}));
  fireEvent.click(screen.getByRole('button',{name:/Drafts to review/}));
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));
  expect(screen.getByRole('button',{name:'Record payment for INV-nov'})).toBeTruthy();
 });
 it('preserves a search typed during tab navigation and synchronizes browser back',()=>{
  const props={invoices:[bill('nov','sent')],cycles:[],today:'2026-10-25',invoiceError:false,cycleError:false};
  const {rerender}=render(<Workspace {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Demo'}});
  mocks.search='centre=centre&task=payments';rerender(<Workspace {...props}/>);
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('Demo');
  expect(screen.getByRole('heading',{name:'Record money received'})).toBeTruthy();
  mocks.search='centre=centre';rerender(<Workspace {...props}/>);
  expect(screen.getByRole('heading',{name:'Review before issuing'})).toBeTruthy();
 });
 it('preserves a stage filter selected before the task URL finishes updating',()=>{
  const props={invoices:[bill('nov','sent')],cycles:[],today:'2026-10-25',invoiceError:false,cycleError:false};
  const {rerender}=render(<Workspace {...props}/>);
  fireEvent.click(screen.getByRole('button',{name:/Awaiting payment/}));
  fireEvent.click(within(screen.getByRole('group',{name:'Payment stage filter'})).getByRole('button',{name:'Overdue (0)'}));
  mocks.search='centre=centre&task=payments';rerender(<Workspace {...props}/>);
  expect(within(screen.getByRole('group',{name:'Payment stage filter'})).getByRole('button',{name:'Overdue (0)'}).getAttribute('aria-pressed')).toBe('true');
 });
 it('defaults to cards, keeps the selected draft prominent and shows older debt separately from a paid previous period',()=>{
  const previous={...bill('previous','paid','2026-09-06','2026-10-05'),payments:[{id:'paid',amount:'1900',status:'verified',recordedAt:'2026-09-07'}]};
  const old={...bill('older','sent','2026-08-06','2026-09-05'),amount:'120',payments:[{id:'part',amount:'60',status:'verified',recordedAt:'2026-08-07'}]};
  const current=bill('current','draft','2026-10-06','2026-11-05');
  render(<Workspace invoices={[previous,old,current,bill('future','draft','2026-11-06','2026-12-05')]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  expect(screen.getByRole('button',{name:'Cards'}).getAttribute('aria-pressed')).toBe('true');
  const card=screen.getByRole('article',{name:'INV-current billing card'});
  expect(within(card).getByText(/Paid in full/)).toBeTruthy();
  expect(within(card).getByText('£60.00')).toBeTruthy();
  expect(within(card).getByRole('button',{name:'Review invoice INV-current'})).toBeTruthy();
  expect(within(card).queryByText('INV-future')).toBeNull();
  expect(within(card).getByRole('link',{name:'View family invoices'}).getAttribute('href')).toBe('/dashboard/parents/parent');
  expect(screen.queryByRole('button',{name:'Issue invoice'})).toBeNull();
 });
 it('does not reassure that other balances are clear when an issued invoice cannot be reconciled',()=>{
  const bad={...bill('bad','paid','2026-08-06','2026-09-05'),payments:[]};
  render(<Workspace invoices={[bill('current','draft','2026-10-06','2026-11-05'),bad]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  expect(within(screen.getByRole('article',{name:'INV-current billing card'})).getByText('Other issued balances need checking.')).toBeTruthy();
 });
 it('uses verified unreversed money for remaining balance and warns about pending payment',()=>{
  const invoice={...bill('pay','sent','2026-10-06','2026-11-05'),payments:[{id:'verified',amount:'100',status:'verified',recordedAt:'2026-10-07'},{id:'reversed',amount:'200',status:'verified',reversedAt:'2026-10-08',recordedAt:'2026-10-07'},{id:'pending',amount:'50',status:'pending',recordedAt:'2026-10-07'}]};
  mocks.search='centre=centre&task=payments';
  render(<Workspace invoices={[invoice]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  const card=screen.getByRole('article',{name:'INV-pay billing card'});
  expect(within(card).getByText('£1,800.00')).toBeTruthy();
  expect(within(card).getByText(/Payment awaiting verification/)).toBeTruthy();
  fireEvent.click(within(card).getByRole('button',{name:'Record payment for INV-pay'}));
  expect(screen.getByRole('dialog').textContent).toContain('1800');
 });
 it('puts overlap reasons on attention cards and offers review rather than issuance',()=>{
  const first={...bill('first','draft','2026-10-06','2026-11-05'),billingConfigId:'config'};
  const second={...bill('second','sent','2026-10-06','2026-11-05'),billingConfigId:'config'};
  mocks.search='centre=centre&task=attention';
  render(<Workspace invoices={[first,second]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);
  const card=screen.getByRole('article',{name:'INV-first billing card'});
  expect(within(card).getByText('Another invoice overlaps this billing period.')).toBeTruthy();
  fireEvent.click(within(card).getByRole('button',{name:'Review problem INV-first'}));
  expect(screen.getByRole('link',{name:'Open draft to check details'})).toBeTruthy();
  expect(screen.queryByRole('link',{name:'Open draft to issue'})).toBeNull();
 });
 it('shows the verified paid date in green on both the collapsed card summary and expanded Previous invoice review',()=>{
  const previous={...bill('M-43AA','paid','2026-10-11','2026-11-10'),amount:'1600',payments:[{id:'p1',amount:'600',status:'verified',recordedAt:'2026-11-05T10:00:00Z'},{id:'p2',amount:'1000',status:'verified',recordedAt:'2026-11-13T15:30:00Z'}]};
  const current={...bill('TL7GFE','draft','2026-11-11','2026-12-10'),amount:'1600'};
  render(<Workspace invoices={[previous,current]} cycles={[]} today="2026-11-15" invoiceError={false} cycleError={false}/>);
  const card=screen.getByRole('article',{name:'INV-TL7GFE billing card'});
  const collapsedPaid=within(card).getByText('Paid in full (13/11/2026)');
  expect(collapsedPaid.className).toContain('text-emerald-700');
  fireEvent.click(within(card).getByRole('button',{name:'Review invoice INV-TL7GFE'}));
  const review=screen.getByRole('region',{name:'Invoice review INV-TL7GFE'});
  const expandedPaid=within(review).getByText('Paid £1,600.00 (13/11/2026)');
  expect(expandedPaid.className).toContain('text-emerald-700');
 });
 it('renders explicit 4-state payment badges across cards and table, filters by stage, and highlights prior overdue vs in-period balances',()=>{
  const sepOverdue={...bill('sep','partially_paid','2026-09-06','2026-10-05'),payments:[{id:'p1',amount:'400',status:'verified',recordedAt:'2026-09-10'}]};
  const octInPeriod=bill('oct','sent','2026-10-06','2026-11-05');
  const novUpcoming=bill('nov','sent','2026-11-06','2026-12-05');
  mocks.search='centre=centre&status=in_period';
  render(<Workspace invoices={[novUpcoming,octInPeriod,sepOverdue]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);

  const stageGroup=screen.getByRole('group',{name:'Payment stage filter'});
  expect(within(stageGroup).getByRole('button',{name:'All unpaid (3)'}).getAttribute('aria-pressed')).toBe('false');
  expect(within(stageGroup).getByRole('button',{name:'Overdue (1)'}).getAttribute('aria-pressed')).toBe('false');
  expect(within(stageGroup).getByRole('button',{name:'In period (1)'}).getAttribute('aria-pressed')).toBe('true');
  expect(within(stageGroup).getByRole('button',{name:'Upcoming (1)'}).getAttribute('aria-pressed')).toBe('false');

  // Initially filtered to In period (oct), whose previous invoice (sep) is Overdue · £400.00 paid · £1,500.00 remaining
  const octCard=screen.getByRole('article',{name:'INV-oct billing card'});
  expect(within(octCard).getByText('In period · Due').className).toContain('text-amber-800');
  expect(within(octCard).getByText('Overdue · £400.00 paid · £1,500.00 remaining').className).toContain('text-rose-700');

  // Switch to All unpaid to verify sort order and all 3 stage labels on cards and table
  fireEvent.click(within(stageGroup).getByRole('button',{name:'All unpaid (3)'}));
  const cards=screen.getAllByRole('article');
  expect(cards.map(c=>c.getAttribute('aria-label'))).toEqual(['INV-sep billing card','INV-oct billing card','INV-nov billing card']);
  expect(within(cards[0]).getByText('Overdue · Part-paid').className).toContain('text-rose-700');
  expect(within(cards[2]).getByText('Upcoming · Issued in advance').className).toContain('text-sky-800');
  expect(within(cards[2]).getByText('In period · £1,900.00 remaining').className).toContain('text-amber-800');

  fireEvent.click(screen.getByRole('button',{name:'Table'}));
  const table=screen.getByRole('table',{name:'Outstanding invoices'});
  expect(within(table).getByText('Overdue · Part-paid').className).toContain('bg-rose-500/10');
  expect(within(table).getByText('In period · Due').className).toContain('bg-amber-500/15');
  expect(within(table).getByText('Upcoming').className).toContain('bg-sky-500/10');
 });
 it('passes priorOverdueNotice to RecordPaymentModal when recording payment on an in-period or upcoming invoice with older family arrears',async()=>{
  const sepOverdue={...bill('sep','sent','2026-09-06','2026-10-05'),amount:'450'};
  const octInPeriod=bill('oct','sent','2026-10-06','2026-11-05');
  mocks.search='centre=centre&task=payments';
  render(<Workspace invoices={[octInPeriod,sepOverdue]} cycles={[]} today="2026-10-25" invoiceError={false} cycleError={false}/>);

  fireEvent.click(screen.getByRole('button',{name:'Record payment for INV-oct'}));
  const notice='Note: This family also has an older overdue invoice (INV-sep · £450.00 remaining) from a past assessment period.';
  expect(screen.getByRole('dialog').textContent).toContain(notice);

  cleanup();
  const { default: ActualRecordPaymentModal }=await vi.importActual<typeof import('./RecordPaymentModal')>('./RecordPaymentModal');
  render(<ActualRecordPaymentModal invoiceId="oct" invoiceNumber="INV-oct" remainingBalance={1900} billingContext={{parentId:'parent',familyName:'Demo Family',period:'6 Oct – 5 Nov 2026',priorOverdueNotice:notice}} onClose={()=>{}} onSuccess={()=>{}}/>);
  expect(screen.getByRole('note').textContent).toBe(notice);
 });
});
