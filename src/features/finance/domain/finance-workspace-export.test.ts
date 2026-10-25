import {describe,it,expect} from 'vitest';
import {buildFinanceQueues,type WorkspaceInvoice} from './finance-workspace';
import {financeWorkspaceCsv} from './finance-workspace-export';
const bill:WorkspaceInvoice={id:'invoice',invoiceNumber:'INV-1',organisationId:'org',parentId:'parent',centreId:'centre',parent:{id:'parent',firstName:'Demo',lastName:'Family'},amount:'320',status:'draft',invoiceDate:'2026-10-15',billingPeriodStart:'2026-10-06',billingPeriodEnd:'2026-11-05',dueDate:'2026-10-06',payments:[]};
describe('finance workspace CSV',()=>{
 it('does not export a draft as money owed',()=>{
  const csv=financeWorkspaceCsv(buildFinanceQueues([bill],'2026-10-25').drafts);
  expect(csv).toContain('"Draft — not issued","320.00",""');
 });
 it('exports verified remaining balances without pending or reversed allocations',()=>{
  const invoice={...bill,status:'sent',payments:[{id:'v',status:'verified',amount:'100',recordedAt:'2026-10-15'},{id:'r',status:'reversed',amount:'320',recordedAt:'2026-10-15'}]};
  const csv=financeWorkspaceCsv(buildFinanceQueues([invoice],'2026-10-25').payments);
  expect(csv).toContain('"Part-paid","320.00","220.00"');
 });
 it('quotes commas, line breaks and formula-like user data safely',()=>{
  const invoice={...bill,parent:{id:'parent',firstName:'=1+1',lastName:'Comma, "quote"\nline'}};
  const csv=financeWorkspaceCsv(buildFinanceQueues([invoice],'2026-10-25').drafts);
  expect(csv).toContain('"\'=1+1 Comma, ""quote""\nline"');
 });
 it('retains missing and reversed-period drafts exactly once in a full drafts export',()=>{
  const drafts=buildFinanceQueues([{...bill,id:'missing',invoiceNumber:'INV-MISSING',billingPeriodStart:null},{...bill,id:'reversed',invoiceNumber:'INV-REVERSED',billingPeriodStart:'2026-12-01',billingPeriodEnd:'2026-09-01'}],'2026-10-25').drafts;
  const csv=financeWorkspaceCsv(drafts);
  expect(csv.match(/INV-MISSING/g)).toHaveLength(1);expect(csv.match(/INV-REVERSED/g)).toHaveLength(1);
 });
});
