import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Grid,{type FinanceInvoice} from './FinanceDataGridClient';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()}),useSearchParams:()=>new URLSearchParams()}));
vi.mock('next/link',()=>({default:({children,...props}:React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>)=><a {...props}>{children}</a>}));
vi.mock('@/components/ui/ToastProvider',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('@/features/finance/actions',()=>({recordPayment:vi.fn()}));
vi.mock('./CreateInvoiceModal',()=>({default:()=>null}));
const invoice:FinanceInvoice={id:'nov',invoiceNumber:'INV-NOV',organisationId:'org',parentId:'parent',parent:{id:'parent',firstName:'Demo',lastName:'Family'},amount:'1900.00',status:'sent',invoiceDate:'2026-10-16',createdAt:'2026-10-16',dueDate:'2026-11-06',billingPeriodStart:'2026-11-06',billingPeriodEnd:'2026-12-05',payments:[{id:'reversed',amount:'1900.00',status:'reversed',recordedAt:'2026-10-15'}]};
describe('compact invoice row',()=>{
 it('uses the existing seven columns for coverage, creation, due date and remaining balance',()=>{
  const html=renderToStaticMarkup(<Grid invoices={[invoice]} />);
  expect(html).toContain('Billing period / Due');
  expect(html).toContain('6 Nov – 5 Dec 2026');
  expect(html).toContain('Created ');
  expect(html).toContain('16 Oct 2026');
  expect(html).toContain('Remaining £1,900.00');
  expect(html).toContain('View invoice INV-NOV');
  expect(html.match(/<th class=/g)).toHaveLength(7);
 });
 it('makes review and issuance an explicit navigation step, not an automatic issuance action',()=>{
  const html=renderToStaticMarkup(<Grid invoices={[{...invoice,id:'dec',invoiceNumber:'INV-DEC',status:'draft'}]}/>);
  expect(html).toContain('Review &amp; issue');
  expect(html).toContain('aria-label="Review and issue invoice INV-DEC"');
  expect(html).toContain('href="/dashboard/finance/invoices/dec"');
  expect(html).toContain('Not issued');
 });
});
