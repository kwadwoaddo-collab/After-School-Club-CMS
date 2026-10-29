import {describe,it,expect,vi} from 'vitest';
import {captureDraftResult,DraftEnrolmentReviewError} from './draft-result';
describe('production-safe draft result boundary',()=>{
 it('returns confirmed success with the original invoice identity',async()=>{expect(await captureDraftResult(async()=>({invoiceId:'existing',alreadyGenerated:true}),vi.fn())).toEqual({ok:true,data:{invoiceId:'existing',alreadyGenerated:true}});});
 it('exposes only the blocked child IDs and actionable enrolment feedback',async()=>{const report=vi.fn();const result=await captureDraftResult(async()=>{throw new DraftEnrolmentReviewError(['held-child']);},report);expect(result).toMatchObject({ok:false,problem:{reviewEnrolment:true,childIds:['held-child'],title:'Review enrolment before creating this draft'}});expect(report).not.toHaveBeenCalled();});
 it('does not return raw database/server/React errors to the browser',async()=>{const result=await captureDraftResult(async()=>{throw Error('private DB detail Minified React #441');},()=> 'DRAFT-safe');expect(JSON.stringify(result)).not.toMatch(/private DB|React|441/);expect(result).toMatchObject({ok:false,problem:{reference:'DRAFT-safe',title:'Draft creation not confirmed'}});});
 it('preserves framework redirects rather than swallowing authentication control flow',async()=>{const error=Object.assign(Error('redirect'),{digest:'NEXT_REDIRECT;/login'});await expect(captureDraftResult(async()=>{throw error;},vi.fn())).rejects.toBe(error);});
});
