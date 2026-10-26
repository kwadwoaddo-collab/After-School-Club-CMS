import {describe,it,expect,vi,beforeEach} from 'vitest';
import {PgDialect} from 'drizzle-orm/pg-core';
import type {SQL} from 'drizzle-orm';
const mocks=vi.hoisted(()=>({where:vi.fn()}));
vi.mock('@/db',()=>({db:{select:()=>({from:()=>({where:mocks.where,innerJoin:()=>({where:mocks.where})})})}}));
import {getFamilyActivityRecords} from './family-activity-query';
beforeEach(()=>mocks.where.mockReset().mockResolvedValue([]));
describe('family activity query scope',()=>{
 it('scopes supplemental records to the authorised parent, org and exact owned child IDs',async()=>{await getFamilyActivityRecords('org','parent',['child'],['invoice']);const queries=mocks.where.mock.calls.map(([where])=>new PgDialect().sqlToQuery(where as SQL));expect(queries).toHaveLength(5);expect(queries[0].params).toEqual(['org','parent']);expect(queries[1].params).toEqual(['org','parent']);expect(queries[2].params).toEqual(['org','child']);expect(queries[3].params).toEqual(['org','child']);expect(queries[4].params).toContain('org');expect(queries[4].params).toContain('%invoice%');expect(queries[4].sql).not.toContain('::json');});
 it('does not query all children or all audit records for an empty family',async()=>{const result=await getFamilyActivityRecords('org','parent',[],[]);expect(mocks.where).toHaveBeenCalledTimes(2);expect(result.lifecycle).toEqual([]);expect(result.contacts).toEqual([]);expect(result.audit).toEqual([]);});
});
