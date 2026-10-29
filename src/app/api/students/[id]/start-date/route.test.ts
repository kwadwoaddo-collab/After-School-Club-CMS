import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),select:vi.fn(),insert:vi.fn(),read:vi.fn(),transaction:vi.fn()}));
vi.mock('@/lib/require-auth',()=>({requireApiAuth:m.auth}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/features/students/enrolment-start-query',()=>({readEnrolmentStart:m.read}));
vi.mock('@/db',()=>({db:{transaction:m.transaction}}));
import {POST} from './route';
const id='11111111-1111-4111-8111-111111111111',version='22222222-2222-4222-8222-222222222222';
const body={startDate:'2025-01-01',reason:'Correct original attendance date',expectedVersion:version,correctionId:'33333333-3333-4333-8333-333333333333'};
const params={params:Promise.resolve({id})};
function request(data:object=body){return new Request('https://localhost/test',{method:'POST',body:JSON.stringify(data)});}
function rows(value:unknown[]){const p=Promise.resolve(value);return {where:()=>Object.assign(p,{for:()=>p})};}
beforeEach(()=>{vi.clearAllMocks();m.auth.mockResolvedValue({user:{id:'owner',role:'ORG_OWNER'},organisationId:'org'});m.read.mockResolvedValue({date:'2026-09-25',version});m.select.mockReturnValueOnce(rows([{role:'ORG_OWNER'}])).mockReturnValueOnce(rows([{id,centreId:'centre',parentId:'parent'}])).mockReturnValueOnce(rows([{id}])).mockReturnValueOnce(rows([]));m.insert.mockResolvedValue([]);m.transaction.mockImplementation(async fn=>fn({execute:vi.fn(),select:()=>({from:m.select}),insert:()=>({values:m.insert})}));});
describe('audited original start-date correction',()=>{
 it('denies unauthenticated requests before DB access',async()=>{m.auth.mockResolvedValue(null);expect((await POST(request(),params)).status).toBe(401);expect(m.transaction).not.toHaveBeenCalled();});
 it.each(['2025-02-30','1899-12-31','2099-01-01'])('rejects invalid or out-of-range date %s',async startDate=>{expect((await POST(request({...body,startDate}),params)).status).toBe(400);expect(m.transaction).not.toHaveBeenCalled();});
 it('rejects extra financial fields and missing reason',async()=>{expect((await POST(request({...body,amount:1}),params)).status).toBe(400);expect((await POST(request({...body,reason:''}),params)).status).toBe(400);});
 it('checks live membership',async()=>{m.select.mockReset().mockReturnValueOnce(rows([{role:'FRONT_DESK'}]));expect((await POST(request(),params)).status).toBe(403);expect(m.insert).not.toHaveBeenCalled();});
 it('cannot read a student from a different tenant',async()=>{m.select.mockReset().mockReturnValueOnce(rows([{role:'ORG_OWNER'}])).mockReturnValueOnce(rows([]));expect((await POST(request(),params)).status).toBe(404);expect(m.read).not.toHaveBeenCalled();});
 it('requires live Manager centre membership',async()=>{m.select.mockReset().mockReturnValueOnce(rows([{role:'MANAGER'}])).mockReturnValueOnce(rows([{id,centreId:'other'}])).mockReturnValueOnce(rows([]));expect((await POST(request(),params)).status).toBe(403);expect(m.insert).not.toHaveBeenCalled();});
 it('does not implicitly confirm an unconfirmed child',async()=>{m.select.mockReset().mockReturnValueOnce(rows([{role:'ORG_OWNER'}])).mockReturnValueOnce(rows([{id,centreId:'centre'}])).mockReturnValueOnce(rows([]));expect((await POST(request(),params)).status).toBe(409);expect(m.insert).not.toHaveBeenCalled();});
 it('rejects stale edits',async()=>{m.read.mockResolvedValue({date:'2026-10-01',version:'different'});expect((await POST(request(),params)).status).toBe(409);expect(m.insert).not.toHaveBeenCalled();});
 it('records old/new dates, reason and actor without any update or lifecycle insertion',async()=>{expect((await POST(request(),params)).status).toBe(200);expect(m.insert).toHaveBeenCalledOnce();const event=m.insert.mock.calls[0][0];expect(event.eventType).toBe('student_enrolment_start_date_corrected');expect(JSON.parse(event.eventData)).toMatchObject({childId:id,startDate:'2025-01-01',previousStartDate:'2026-09-25',actorId:'owner',reason:body.reason});});
 it('returns a safe failure if the audit cannot commit',async()=>{m.insert.mockRejectedValueOnce(Error('private DB error'));const r=await POST(request(),params);expect(r.status).toBe(500);expect((await r.json()).error).not.toContain('private DB');});
 it('accepts a matching retry without a second audit',async()=>{m.select.mockReset().mockReturnValueOnce(rows([{role:'ORG_OWNER'}])).mockReturnValueOnce(rows([{id,centreId:'centre',parentId:'parent'}])).mockReturnValueOnce(rows([{id}])).mockReturnValueOnce(rows([{userId:'owner',eventData:JSON.stringify({childId:id,startDate:body.startDate,reason:body.reason,previousVersion:version})}]));expect((await POST(request(),params)).status).toBe(200);expect(m.insert).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();});
 it('refuses a reused correction ID with altered content',async()=>{m.select.mockReset().mockReturnValueOnce(rows([{role:'ORG_OWNER'}])).mockReturnValueOnce(rows([{id,centreId:'centre',parentId:'parent'}])).mockReturnValueOnce(rows([{id}])).mockReturnValueOnce(rows([{userId:'owner',eventData:JSON.stringify({childId:id,startDate:'2024-01-01',reason:body.reason,previousVersion:version})}]));expect((await POST(request(),params)).status).toBe(409);expect(m.insert).not.toHaveBeenCalled();});

});
