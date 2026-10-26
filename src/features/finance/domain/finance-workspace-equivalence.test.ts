import {describe,it,expect} from 'vitest';
import {buildFinanceQueues,inspectInvoice,type WorkspaceInvoice} from './finance-workspace';
function referenceQueues(invoices: WorkspaceInvoice[], today: string) {
    const unique = [...new Map(invoices.map(invoice => [invoice.id, invoice])).values()];
    const inspected = unique.filter(invoice => invoice.status !== 'void').map(invoice => ({ invoice, ...inspectInvoice(invoice, today) }));
    // Multiple invoices for different children can be legitimate. Flag only a shared billing configuration.
    for (const item of inspected) {
        if (item.invoice.status !== 'draft' || !item.invoice.billingConfigId || !item.start || !item.end) continue;
        if (inspected.some(other => other.invoice.id !== item.invoice.id && other.invoice.billingConfigId === item.invoice.billingConfigId && other.invoice.centreId === item.invoice.centreId && other.invoice.parentId === item.invoice.parentId && other.start && other.end && other.start <= item.end! && other.end >= item.start!)) item.reasons.push('Another invoice overlaps this billing period.');
    }
    const drafts = inspected.filter(item => item.invoice.status === 'draft').sort((a,b) => (a.start ?? '').localeCompare(b.start ?? '') || a.invoice.id.localeCompare(b.invoice.id));
    const payments = inspected.filter(item => ['sent','partially_paid'].includes(item.invoice.status) && item.remaining > 0 && item.financialReliable).sort((a,b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.invoice.id.localeCompare(b.invoice.id));
    const attention = inspected.filter(item => item.reasons.length);
    return { drafts, payments, attention };
}

describe('indexed finance queue equivalence',()=>{it('retains every classification, amount, reason and order across mixed families',()=>{let seed=71823;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};const statuses=['draft','sent','paid','void','partially_paid'];for(let run=0;run<12;run++){const rows:WorkspaceInvoice[]=Array.from({length:220},(_,i)=>({id:String(i),invoiceNumber:`INV-${i}`,organisationId:'org',centreId:`c${Math.floor(random()*3)}`,parentId:`p${Math.floor(random()*7)}`,billingConfigId:random()<0.1?null:`b${Math.floor(random()*4)}`,amount:random()<0.04?'bad':'120.00',status:statuses[Math.floor(random()*statuses.length)],invoiceDate:'2026-10-01',dueDate:'2026-11-01',billingPeriodStart:random()<0.1?null:random()<0.5?'2026-10-01':'2026-11-01',billingPeriodEnd:random()<0.1?null:random()<0.5?'2026-10-31':'2026-12-01',payments:[]}));rows.push(rows[2]);expect(buildFinanceQueues(rows,'2026-10-26')).toEqual(referenceQueues(rows,'2026-10-26'));}});});
