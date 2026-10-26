import {beforeEach,describe,it,expect,vi} from 'vitest';
import {PgDialect} from 'drizzle-orm/pg-core';
const mocks=vi.hoisted(()=>({where:vi.fn()}));
vi.mock('@/db',()=>({db:{select:()=>({from:()=>({where:mocks.where,innerJoin:()=>({where:mocks.where})})})}}));
import {getTodayWork} from './today-work';
const input={orgId:'org',centreIds:['a','b'],centreId:'a',role:'ORG_OWNER',now:new Date('2026-10-26T10:00:00Z')};
beforeEach(()=>{vi.clearAllMocks();mocks.where.mockResolvedValue([{total:2}]);});
describe('Today work scope and safe links',()=>{
 it('keeps every count tenant/centre scoped and links to actionable queues',async()=>{const result=await getTodayWork(input);expect(result.items).toHaveLength(6);for(const call of mocks.where.mock.calls){const query=new PgDialect().sqlToQuery(call[0]);expect(query.params).toContain('org');expect(query.params).toContain('a');expect(query.params).not.toContain('b');}expect(result.items[0].href).toContain('outcome=required');expect(result.items.find(i=>i.key==='overdue')?.href).toContain('followUp=overdue');expect(result.items.find(i=>i.key==='restart')?.href).toContain('status=billing-review');expect(result.items.find(i=>i.key==='finance')?.count).toBeNull();});
 it('does not query or expose work for unassigned or unsupported role requests',async()=>{expect((await getTodayWork({...input,centreId:'foreign'})).items).toEqual([]);expect((await getTodayWork({...input,role:'TUTOR'})).items).toEqual([]);expect(mocks.where).not.toHaveBeenCalled();});
 it('does not offer finance actions to front desk',async()=>{expect((await getTodayWork({...input,role:'FRONT_DESK'})).items.map(i=>i.key)).toEqual(['outcomes','confirmations','overdue','today']);});
 it('reports unavailable instead of zero counts on failed reads',async()=>{mocks.where.mockRejectedValue(new Error('offline'));expect(await getTodayWork(input)).toEqual({items:[],unavailable:true});});
});
