import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { getTableName } from 'drizzle-orm';
import { getWeeklyReport } from '@/features/reports/weekly-report.action';
import { reportCentreIds } from '@/features/reports/report-scope';
import { getReportFinanceSummary } from '@/features/reports/finance-summary';
const state = vi.hoisted(() => ({ role:'MANAGER', accessible:['centre-a','centre-b'], calls:[] as {table:string;sql:string;params:unknown[]}[], pending:false, fail:false }));
vi.mock('@/lib/session', () => ({ requireTenantSession: async () => ({ user:{id:'user-1',organisationId:'org-1',role:state.role,name:'Fixture manager'} }) }));
vi.mock('@/lib/permissions', () => ({ getUserAccessibleCentreIds: async () => state.accessible }));
vi.mock('@/db', () => ({ db: { select: (selection: Record<string,unknown>) => {
    let tableName = '';
    const joinParams: unknown[] = [];
    const chain = {
        from(table: Parameters<typeof getTableName>[0]) { tableName = getTableName(table); return chain; },
        innerJoin(_table: unknown, condition: Parameters<PgDialect['sqlToQuery']>[0]) { joinParams.push(...new PgDialect().sqlToQuery(condition).params); return chain; }, leftJoin(_table: unknown, condition: Parameters<PgDialect['sqlToQuery']>[0]) { joinParams.push(...new PgDialect().sqlToQuery(condition).params); return chain; }, groupBy() { return chain; },
        where(condition: Parameters<PgDialect['sqlToQuery']>[0]) { const query = new PgDialect().sqlToQuery(condition); state.calls.push({table:tableName,sql:query.sql,params:[...joinParams,...query.params]}); return chain; },
        orderBy() { return chain; }, limit() { return chain; },
        then(resolve: (value: unknown[])=>unknown, reject: (error:unknown)=>unknown) {
            if (state.fail && tableName === 'payments') return Promise.reject(new Error('fixture unavailable')).then(resolve,reject);
            let rows:unknown[] = [];
            if (tableName === 'centres') rows = [{id:'centre-a',name:'Centre A'},{id:'centre-b',name:'Centre B'}];
            if ('amount' in selection) rows = [{amount:tableName === 'payments' ? '25.00' : '100.00'}];
            if (state.pending && tableName === 'registrations' && !('status' in selection) && 'regId' in selection) rows = [{regId:'reg-1',createdAt:new Date('2026-10-01'),submittedAt:null,childFirst:'Fixture',childLast:'Student',centreName:'Centre A'}];
            if (state.pending && tableName === 'bookings' && !('status' in selection) && 'bookingId' in selection) rows = [{bookingId:'booking-1',startAt:new Date('2026-10-01'),childFirst:'Fixture',childLast:'Student',centreName:'Centre A'}];
            return Promise.resolve(rows).then(resolve,reject);
        },
    }; return chain;
} } }));
beforeEach(() => { state.role='MANAGER';state.accessible=['centre-a','centre-b'];state.calls=[];state.pending=false;state.fail=false; });
describe('actionable scoped reports', () => {
    it('narrows accessible IDs only and rejects forged or empty scope', () => {
        expect(reportCentreIds(['a','b'],'a')).toEqual(['a']);
        expect(reportCentreIds(['a','b'],'all')).toEqual(['a','b']);
        expect(() => reportCentreIds(['a'],'foreign')).toThrow();
        expect(() => reportCentreIds([])).toThrow();
    });
    it('retains role guard and rejects inaccessible selection before database queries', async () => {
        state.role='TUTOR';
        await expect(getWeeklyReport('2026-10-01','2026-10-07')).rejects.toThrow('Forbidden');
        state.role='MANAGER';
        await expect(getWeeklyReport('2026-10-01','2026-10-07','foreign')).rejects.toThrow('No access');
        expect(state.calls).toHaveLength(0);
    });
    it('scopes every report activity and financial query to the selected centre and tenant', async () => {
        const report = await getWeeklyReport('2026-10-01','2026-10-07','centre-a');
        expect(report.scope?.label).toBe('Centre A');
        expect(report.scope?.centreId).toBe('centre-a');
        const scoped = state.calls.filter(call => !['organisations','centres'].includes(call.table));
        expect(scoped).toHaveLength(9);
        for (const call of scoped) {
            expect(call.params).toContain('org-1');expect(call.params).toContain('centre-a');expect(call.params).not.toContain('centre-b');
        }
        expect(report.finance).toEqual({cashCollected:'25.00',invoiced:'100.00',draftsPrepared:'100.00'});
    });
    it('all-centre scope uses only the accessible set and supplies direct pending-action links', async () => {
        state.pending=true;
        const report = await getWeeklyReport('2026-10-01','2026-10-07');
        expect(report.scope?.label).toBe('All accessible centres');
        expect(report.pendingActions.map(row=>row.href)).toEqual(expect.arrayContaining(['/dashboard/registrations/reg-1','/dashboard/bookings/booking-1']));
        const scoped = state.calls.filter(call=>!['organisations','centres'].includes(call.table));
        for (const call of scoped) {expect(call.params).toContain('centre-a');expect(call.params).toContain('centre-b');}
    });
    it('financial aggregate cash requires verification, no reversal and recording dates; does not multiply invoice totals by payment joins', async () => {
        await getReportFinanceSummary('org-1',['centre-a'],new Date('2026-10-01'),new Date('2026-10-07'));
        const cash=state.calls.find(call=>call.table==='payments')!;
        expect(cash.params).toContain('verified');expect(cash.sql).toContain('"reversed_at" is null');expect(cash.sql).toContain('"recorded_at"');
        const invoiceCalls=state.calls.filter(call=>call.table==='invoices');
        expect(invoiceCalls).toHaveLength(2);
        expect(invoiceCalls[0].sql).toContain('"invoice_date"');expect(invoiceCalls[0].params).not.toContain('draft');
        expect(invoiceCalls[1].sql).toContain('"created_at"');expect(invoiceCalls[1].params).toContain('draft');
    });
    it('fails visibly rather than manufacturing zero financial totals on query failure', async () => {
        state.fail=true;
        await expect(getWeeklyReport('2026-10-01','2026-10-07')).rejects.toThrow('fixture unavailable');
    });
});
