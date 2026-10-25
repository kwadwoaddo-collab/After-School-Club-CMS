import { describe, expect, it } from 'vitest';
import { adjacentInvoices, buildFinanceQueues, inspectInvoice, isFinanceWorkspaceView, type WorkspaceInvoice } from './finance-workspace';
const today = '2026-10-25';
export const invoice = (id: string, overrides: Partial<WorkspaceInvoice> = {}): WorkspaceInvoice => ({id,invoiceNumber:`INV-${id}`,organisationId:'org',centreId:'centre',parentId:'parent',billingConfigId:'config',amount:'1900.00',status:'sent',invoiceDate:'2026-10-16',dueDate:'2026-11-06',billingPeriodStart:'2026-11-06',billingPeriodEnd:'2026-12-05',payments:[],...overrides});
describe('finance work queues', () => {
    it('preserves existing manual create links and secondary records views',()=>{
        expect(isFinanceWorkspaceView({})).toBe(true);
        expect(isFinanceWorkspaceView({status:'draft'})).toBe(true);
        expect(isFinanceWorkspaceView({create:'1'})).toBe(false);
        expect(isFinanceWorkspaceView({create:'true'})).toBe(false);
        expect(isFinanceWorkspaceView({view:'history'})).toBe(false);
        expect(isFinanceWorkspaceView({view:'families'})).toBe(false);
    });
    it('keeps paid October, unpaid November and upcoming December distinct', () => {
        const oct = invoice('oct',{status:'paid',billingPeriodStart:'2026-10-06',billingPeriodEnd:'2026-11-05',payments:[{id:'p',amount:'1900',status:'verified',recordedAt:today}]});
        const nov = invoice('nov');
        const dec = invoice('dec',{status:'draft',billingPeriodStart:'2026-12-06',billingPeriodEnd:'2027-01-05'});
        const queues = buildFinanceQueues([oct,nov,dec],today);
        expect(queues.payments.map(item=>item.invoice.id)).toEqual(['nov']);
        expect(queues.drafts[0].upcoming).toBe(true);
        expect(queues.attention).toHaveLength(0);
        expect(adjacentInvoices(dec,[oct,nov,dec]).previous?.id).toBe('nov');
    });
    it('only verified unreversed allocations reduce the balance', () => {
        const result = inspectInvoice(invoice('mixed',{payments:[
            {id:'v',amount:'200',status:'verified',recordedAt:today},
            {id:'p',amount:'500',status:'pending',recordedAt:today},
            {id:'r',amount:'1900',status:'reversed',recordedAt:today},
            {id:'rv',amount:'500',status:'verified',reversedAt:today,recordedAt:today},
        ]}),today);
        expect(result.remaining).toBe(170000); expect(result.pending).toBe(true);
    });
    it.each(['-1','bad','1.999'])('holds invalid payment %s for attention, not collection', amount=>{
        const queues=buildFinanceQueues([invoice('bad',{payments:[{id:'p',amount,status:'verified',recordedAt:today}]})],today);
        expect(queues.payments).toHaveLength(0);expect(queues.attention).toHaveLength(1);
    });
    it('holds overpayment, paid mismatch and a paid draft for checking',()=>{
        const payment={id:'p',amount:'2000',status:'verified',recordedAt:today};
        const queues=buildFinanceQueues([invoice('over',{payments:[payment]}),invoice('paid',{status:'paid'}),invoice('draft',{status:'draft',payments:[payment]})],today);
        expect(queues.attention).toHaveLength(3);expect(queues.payments).toHaveLength(0);
    });
    it('retains legacy debts without a billing config or lifecycle restriction and deduplicates shared invoices',()=>{
        const legacy=invoice('legacy',{billingConfigId:null});
        expect(buildFinanceQueues([legacy,legacy],today).payments).toHaveLength(1);
    });
    it('keeps reliable legacy debts collectible despite missing coverage dates',()=>{
        const queues=buildFinanceQueues([invoice('legacy',{billingConfigId:null,billingPeriodStart:null,billingPeriodEnd:null})],today);
        expect(queues.payments).toHaveLength(1);expect(queues.payments[0].remaining).toBe(190000);
        expect(queues.attention).toHaveLength(1);
    });
    it('flags overlapping configuration periods but not legitimate separate-child configs',()=>{
        const queues=buildFinanceQueues([invoice('a',{status:'draft'}),invoice('b'),invoice('c',{billingConfigId:'other',parentId:'other'})],today);
        expect(queues.attention.map(item=>item.invoice.id)).toEqual(['a']);
        expect(queues.payments).toHaveLength(2);
    });
    it('retains lifecycle-held drafts and marks them for checking',()=>{
        const queues=buildFinanceQueues([invoice('held',{status:'draft',needsBillingReview:true})],today);
        expect(queues.drafts).toHaveLength(1);expect(queues.attention).toHaveLength(1);
    });
    it('does not turn creation/preparation dates into an issuance deadline',()=>{
        const draft=inspectInvoice(invoice('future',{status:'draft',createdAt:'2025-01-01',billingPeriodStart:'2026-12-06'}),today);
        expect(draft.upcoming).toBe(true);expect(draft.overdue).toBe(false);
    });
    it('keeps full-set counts stable beyond a single page and orders overdue debts first',()=>{
        const invoices=Array.from({length:60},(_,i)=>invoice(String(i),{billingConfigId:null}));
        invoices.push(invoice('overdue',{billingConfigId:null,dueDate:'2026-10-01'}));
        const queues=buildFinanceQueues(invoices,today);
        expect(queues.payments).toHaveLength(61);expect(queues.payments[0].invoice.id).toBe('overdue');
    });
    it('does not flood daily attention with fully paid legacy invoices lacking coverage dates',()=>{
        expect(buildFinanceQueues([invoice('old',{status:'paid',billingPeriodStart:null,billingPeriodEnd:null,payments:[{id:'p',amount:'1900',status:'verified',recordedAt:today}]})],today).attention).toHaveLength(0);
    });
    it('never takes previous/next context from another family or centre, or a voided invoice',()=>{
        const selected=invoice('nov');
        expect(adjacentInvoices(selected,[invoice('foreign',{centreId:'other',billingPeriodStart:'2026-10-01',billingPeriodEnd:'2026-10-31'}),invoice('void',{status:'void',billingPeriodStart:'2026-10-01',billingPeriodEnd:'2026-10-31'})]).previous).toBeUndefined();
    });
});
