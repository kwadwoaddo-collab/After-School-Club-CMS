import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({session:vi.fn(),transaction:vi.fn(),revalidate:vi.fn()}));
vi.mock('@/lib/session',()=>({requireTenantSession:mocks.session}));
vi.mock('@/db',()=>({db:{transaction:mocks.transaction}}));
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidate}));
import {correctPaymentDetails} from './correct-payment';
import type {PaymentCorrectionInput} from './domain/payment-correction';
const input:PaymentCorrectionInput={paymentId:'11111111-1111-4111-8111-111111111111',correctionId:'22222222-2222-4222-8222-222222222222',paymentDate:'2026-10-26',reference:'BANK-123',reason:'Correct bank payment date',expectedRecordedAt:'2026-10-27T23:30:00.000Z',expectedReference:'BANK-123'};
const payment={id:input.paymentId,invoiceId:'invoice',recordedAt:new Date(input.expectedRecordedAt),transactionReference:'BANK-123',amount:'1200.00',method:'bank_transfer',status:'verified'};
const invoice={id:'invoice',parentId:'parent',centreId:'centre',status:'paid',invoiceNumber:'INV-TEST'};
function fixture({role='ORG_OWNER',member=true,centre=true,foundInvoice=true,pay=payment,prior=undefined as unknown}={}){
 const rows:unknown[][]=[member?[{role}]:[],[{invoiceId:'invoice'}],foundInvoice?[invoice]:[]];
 if(role==='MANAGER')rows.push(centre?[{id:'membership'}]:[]);
 rows.push([pay],prior?[prior]:[]);
 const set=vi.fn((_change:Record<string,unknown>)=>({where:vi.fn().mockResolvedValue(undefined)})),values=vi.fn<(event:{eventData:string})=>Promise<void>>().mockResolvedValue(undefined),locks:string[]=[];
 const tx={execute:vi.fn().mockResolvedValue(undefined),select:vi.fn(()=>({from:vi.fn(()=>({where:vi.fn(()=>{const result=Promise.resolve(rows.shift()??[]);return Object.assign(result,{for:(mode:string)=>{locks.push(mode);return result;}});})}))})),update:vi.fn(()=>({set})),insert:vi.fn(()=>({values}))};
 mocks.transaction.mockImplementation((fn:(value:typeof tx)=>unknown)=>fn(tx));return{tx,set,values,locks};
}
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({user:{id:'owner',organisationId:'org',role:'ORG_OWNER'}});});
describe('correctPaymentDetails boundaries',()=>{
 it.each([{member:false},{role:'FRONT_DESK'},{role:'MANAGER',centre:false},{foundInvoice:false}])('blocks missing live authority or wrong tenant %j',async options=>{const f=fixture(options);await expect(correctPaymentDetails(input)).resolves.toMatchObject({success:false});expect(f.set).not.toHaveBeenCalled();expect(f.values).not.toHaveBeenCalled();});
 it('allows an assigned live Manager despite a stale lower session role',async()=>{mocks.session.mockResolvedValue({user:{id:'owner',organisationId:'org',role:'FRONT_DESK'}});const f=fixture({role:'MANAGER'});expect(await correctPaymentDetails(input)).toEqual({success:true,isReplay:false});expect(f.locks).toEqual(['share','update','share','update']);});
 it('updates date/reference only and audits the original values',async()=>{const f=fixture();await correctPaymentDetails(input);const change=f.set.mock.calls[0][0] as Record<string,unknown>;expect(Object.keys(change).sort()).toEqual(['recordedAt','transactionReference','updatedAt']);expect(change.recordedAt).toEqual(new Date('2026-10-26T12:00:00.000Z'));const event=JSON.parse(f.values.mock.calls[0][0].eventData);expect(event).toMatchObject({previousRecordedAt:input.expectedRecordedAt,correctedRecordedAt:'2026-10-26T12:00:00.000Z',amount:'1200.00',paymentStatus:'verified',actorId:'owner',reason:input.reason});});
 it('preserves the exact instant on a reference-only correction',async()=>{const f=fixture();await correctPaymentDetails({...input,paymentDate:'2026-10-27',reference:'CORRECTED'});expect(f.set.mock.calls[0][0].recordedAt).toEqual(payment.recordedAt);});
 it.each([{...payment,recordedAt:new Date('2026-10-26T12:00:00Z')},{...payment,transactionReference:'Another edit'},{...payment,status:'reversed'},{...payment,method:'stripe'},{...payment,method:'gocardless'}])('rejects stale or ineligible payment %#',async pay=>{const f=fixture({pay});await expect(correctPaymentDetails(input)).resolves.toMatchObject({success:false});expect(f.set).not.toHaveBeenCalled();});
 it('does not write a correction when nothing changed',async()=>{const f=fixture();await expect(correctPaymentDetails({...input,paymentDate:'2026-10-27'})).resolves.toMatchObject({success:false,error:expect.stringMatching(/Change the payment/)});expect(f.set).not.toHaveBeenCalled();});
 it('recognises a committed retry without updating or adding a second audit',async()=>{const request={paymentDate:input.paymentDate,reference:input.reference,reason:input.reason,expectedRecordedAt:input.expectedRecordedAt,expectedReference:input.expectedReference};const f=fixture({pay:{...payment,recordedAt:new Date('2026-10-26T12:00:00Z')},prior:{eventData:JSON.stringify({paymentId:input.paymentId,actorId:'owner',request})}});expect(await correctPaymentDetails(input)).toEqual({success:true,isReplay:true});expect(f.set).not.toHaveBeenCalled();expect(f.values).not.toHaveBeenCalled();});
 it('refuses request ID reuse with different correction content',async()=>{const f=fixture({prior:{eventData:JSON.stringify({paymentId:input.paymentId,actorId:'owner',request:{reason:'different'}})}});await expect(correctPaymentDetails(input)).resolves.toMatchObject({success:false,error:expect.stringMatching(/request has changed/)});expect(f.set).not.toHaveBeenCalled();});
});
