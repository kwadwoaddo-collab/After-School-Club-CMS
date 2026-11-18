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
  expect(csv).toContain('"In period — part-paid","320.00","220.00"');
 });
 it('exports explicit 4-state collection statuses for overdue, in-period and upcoming invoices',()=>{
  const overdue={...bill,id:'ov',invoiceNumber:'INV-OV',status:'sent',billingPeriodStart:'2026-09-06',billingPeriodEnd:'2026-10-05',dueDate:'2026-09-06'};
  const inPeriod={...bill,id:'ip',invoiceNumber:'INV-IP',status:'sent',billingPeriodStart:'2026-10-06',billingPeriodEnd:'2026-11-05',dueDate:'2026-10-06'};
  const upcoming={...bill,id:'up',invoiceNumber:'INV-UP',status:'sent',billingPeriodStart:'2026-11-06',billingPeriodEnd:'2026-12-05',dueDate:'2026-11-06'};
  const csv=financeWorkspaceCsv(buildFinanceQueues([upcoming,inPeriod,overdue],'2026-10-25').payments);
  expect(csv).toContain('"INV-OV","6 Sept – 5 Oct 2026","Overdue — past assessment period","320.00","320.00"');
  expect(csv).toContain('"INV-IP","6 Oct – 5 Nov 2026","In period — due","320.00","320.00"');
  expect(csv).toContain('"INV-UP","6 Nov – 5 Dec 2026","Upcoming — issued in advance","320.00","320.00"');
 });
 it('exports ad-hoc one-off due and overdue labels when assessment period bounds are absent',()=>{
  const dueToday={...bill,id:'due',invoiceNumber:'INV-DUE',status:'sent',billingPeriodStart:null,billingPeriodEnd:null,dueDate:'2026-10-25'};
  const pastDue={...bill,id:'past',invoiceNumber:'INV-PAST',status:'sent',billingPeriodStart:null,billingPeriodEnd:null,dueDate:'2026-10-20'};
  const csv=financeWorkspaceCsv(buildFinanceQueues([dueToday,pastDue],'2026-10-25').payments);
  expect(csv).toContain('"INV-PAST","Period missing","Overdue","320.00","320.00"');
  expect(csv).toContain('"INV-DUE","Period missing","Due today","320.00","320.00"');
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
