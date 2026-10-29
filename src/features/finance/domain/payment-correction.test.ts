import {describe,it,expect} from 'vitest';
import {PaymentCorrectionSchema,correctionDate,receiptIdentityPayment,correctableMethods} from './payment-correction';
describe('payment correction domain',()=>{
 it.each(['2026-02-30','2026-13-01','2025-02-29','1899-12-31','2026-10-30','26/10/2026'])('rejects invalid or future date %s',value=>expect(()=>correctionDate(value,'2026-10-29')).toThrow());
 it.each(['2026-03-29','2026-10-25','2024-02-29'])('retains London business date across DST/leap boundaries %s',value=>expect(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London'}).format(correctionDate(value,'2026-10-29'))).toBe(value));
 it('rejects financial field injection and provider methods',()=>{
  expect(PaymentCorrectionSchema.safeParse({paymentId:'11111111-1111-4111-8111-111111111111',correctionId:'22222222-2222-4222-8222-222222222222',paymentDate:'2026-10-26',reference:null,reason:'Wrong date',expectedRecordedAt:'2026-10-27T00:00:00Z',expectedReference:null,amount:'1.00'}).success).toBe(false);
  expect(correctableMethods).not.toContain('stripe');expect(correctableMethods).not.toContain('gocardless');
 });
 it('retains receipt identity after corrected dates change payment order without mutating inputs',()=>{
  const payments=[{id:'older',status:'verified',recordedAt:'2026-10-28',receiptIdentityDate:'2026-10-20'},{id:'newer',status:'verified',recordedAt:'2026-10-19',receiptIdentityDate:'2026-10-27'},{id:'reversed',status:'reversed',recordedAt:'2026-10-29'}];
  expect(receiptIdentityPayment(payments)?.id).toBe('newer');expect(payments.map(p=>p.id)).toEqual(['older','newer','reversed']);
 });
 it('has deterministic ties, legacy fallback and no receipt when nothing verified',()=>{
  expect(receiptIdentityPayment([{id:'a',status:'verified',recordedAt:'2026-10-26'},{id:'b',status:'verified',recordedAt:'2026-10-26'}])?.id).toBe('b');
  expect(receiptIdentityPayment([{id:'a',status:'pending'}])).toBeUndefined();
 });
});
