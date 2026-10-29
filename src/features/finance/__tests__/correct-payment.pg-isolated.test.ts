import {describe,it,expect,beforeAll,afterAll,beforeEach,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {assertTestDatabaseUrl} from './helpers/test-db-guard';
import {correctPaymentDetails} from '../correct-payment';
import {client} from '@/db';
import {emailService} from '@/lib/services/email';
import {notifyOwners} from '@/lib/db-notifications';
const sql=postgres(assertTestDatabaseUrl(process.env.TEST_DATABASE_URL),{max:5,ssl:false});
const session=vi.hoisted(()=>({user:{id:'',organisationId:'',role:'ORG_OWNER'}}));
vi.mock('@/lib/session',()=>({requireTenantSession:vi.fn(async()=>session)}));
const org=randomUUID(),centre=randomUUID(),user=randomUUID(),parent=randomUUID(),invoice=randomUUID(),payment=randomUUID();
const input=()=>({paymentId:payment,correctionId:randomUUID(),paymentDate:'2026-10-26',reference:'BANK',reason:'Correct payment date',expectedRecordedAt:'2026-10-27T23:30:00.000Z',expectedReference:'BANK'});
beforeAll(async()=>{
 expect((await sql`select current_database() as name`)[0].name).toMatch(/_test$/);
 session.user.id=user;session.user.organisationId=org;
 await sql`insert into organisations(id,name,slug)values(${org},'Correction test',${org})`;
 await sql`insert into centres(id,organisation_id,name,slug)values(${centre},${org},'Correction centre',${centre})`;
 await sql`insert into users(id,email,name,role,organisation_id)values(${user},${user+'@isolated.test'},'Correction owner','ORG_OWNER',${org})`;
 await sql`insert into parents(id,organisation_id,first_name,last_name,preferred_contact)values(${parent},${org},'Test','Parent','email')`;
 await sql`insert into invoices(id,organisation_id,centre_id,parent_id,invoice_number,amount,status,invoice_date,due_date)values(${invoice},${org},${centre},${parent},${invoice},'1200.00','paid',CURRENT_DATE,CURRENT_DATE)`;
});
beforeEach(async()=>{
 vi.clearAllMocks();
 await sql`delete from audit_events where organisation_id=${org}`;
 await sql`delete from payments where invoice_id=${invoice}`;
 await sql`delete from centre_memberships where user_id=${user}`;
 await sql`insert into org_memberships(user_id,organisation_id,role)values(${user},${org},'ORG_OWNER')on conflict(user_id,organisation_id)do update set role='ORG_OWNER'`;
 await sql`insert into payments(id,invoice_id,amount,method,status,transaction_reference,recorded_at)values(${payment},${invoice},'1200.00','bank_transfer','verified','BANK','2026-10-27T23:30:00Z')`;
 await sql`update invoices set status='paid' where id=${invoice}`;
});
afterAll(async()=>{
 await sql`delete from audit_events where organisation_id=${org}`;await sql`delete from payments where invoice_id=${invoice}`;await sql`delete from invoices where id=${invoice}`;await sql`delete from parents where id=${parent}`;await sql`delete from centre_memberships where user_id=${user}`;await sql`delete from org_memberships where user_id=${user}`;await sql`delete from users where id=${user}`;await sql`delete from centres where id=${centre}`;await sql`delete from organisations where id=${org}`;
 await sql.end();await client.end();
});
describe('real payment correction transactions',()=>{
 it('serialises identical concurrent retries to one correction and one audit without notifications',async()=>{
  const data=input();const results=await Promise.all([correctPaymentDetails(data),correctPaymentDetails(data)]);
  expect(results.map(r=>r.success?r.isReplay:undefined).sort()).toEqual([false,true]);
  const [row]=await sql`select p.*,i.status as invoice_status from payments p join invoices i on i.id=p.invoice_id where p.id=${payment}`;
  expect(row.amount).toBe('1200.00');expect(row.status).toBe('verified');expect(row.invoice_status).toBe('paid');expect(row.recorded_at.toISOString()).toBe('2026-10-26T12:00:00.000Z');
  const events=await sql`select event_data from audit_events where organisation_id=${org} and event_type='payment_details_corrected'`;
  expect(events).toHaveLength(1);expect(JSON.parse(events[0].event_data).previousRecordedAt).toBe(data.expectedRecordedAt);expect(emailService.sendPaymentReceiptEmail).not.toHaveBeenCalled();expect(notifyOwners).not.toHaveBeenCalled();
 });
 it('rejects one competing stale edit instead of overwriting the first correction',async()=>{
  const results=await Promise.all([correctPaymentDetails(input()),correctPaymentDetails({...input(),paymentDate:'2026-10-25'})]);
  expect(results.filter(r=>r.success)).toHaveLength(1);expect(results.filter(r=>!r.success)).toHaveLength(1);
  expect(await sql`select id from audit_events where organisation_id=${org}`).toHaveLength(1);
 });
 it('uses live membership rather than privileged session role',async()=>{
  await sql`update org_memberships set role='FRONT_DESK' where user_id=${user} and organisation_id=${org}`;
  await expect(correctPaymentDetails(input())).resolves.toMatchObject({success:false,error:expect.stringMatching(/Owner or authorised Manager/)});
  expect(await sql`select id from audit_events where organisation_id=${org}`).toHaveLength(0);
 });
 it('requires manager centre access and permits the assigned manager',async()=>{
  await sql`update org_memberships set role='MANAGER' where user_id=${user} and organisation_id=${org}`;
  await expect(correctPaymentDetails(input())).resolves.toMatchObject({success:false,error:expect.stringMatching(/access to this centre/)});
  await sql`insert into centre_memberships(user_id,centre_id,role)values(${user},${centre},'MANAGER')`;
  expect(await correctPaymentDetails(input())).toMatchObject({success:true});
 });
 it('does not disclose or alter another organisation invoice',async()=>{
  const original=session.user.organisationId;session.user.organisationId=randomUUID();
  try{await expect(correctPaymentDetails(input())).resolves.toMatchObject({success:false});}finally{session.user.organisationId=original;}
  const [row]=await sql`select recorded_at from payments where id=${payment}`;expect(row.recorded_at.toISOString()).toBe(input().expectedRecordedAt);
 });
 it('rolls back the payment update when its audit cannot be saved',async()=>{
  const fn='correction_fail_'+org.replaceAll('-',''),trigger=fn+'_trigger';
  await sql.unsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`);
  await sql.unsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_events FOR EACH ROW WHEN (NEW.organisation_id = '${org}'::uuid) EXECUTE FUNCTION ${fn}()`);
  try{await expect(correctPaymentDetails(input())).resolves.toMatchObject({success:false,error:expect.stringMatching(/not confirmed/)});const [row]=await sql`select recorded_at,transaction_reference from payments where id=${payment}`;expect(row.recorded_at.toISOString()).toBe(input().expectedRecordedAt);expect(row.transaction_reference).toBe('BANK');}
  finally{await sql.unsafe(`DROP TRIGGER IF EXISTS ${trigger} ON audit_events`);await sql.unsafe(`DROP FUNCTION IF EXISTS ${fn}()`);}
 });
 it('preserves a reference-only payment instant and rejects a reversed payment',async()=>{
  await correctPaymentDetails({...input(),paymentDate:'2026-10-27',reference:'NEW'});
  expect((await sql`select recorded_at from payments where id=${payment}`)[0].recorded_at.toISOString()).toBe(input().expectedRecordedAt);
  await sql`update payments set status='reversed' where id=${payment}`;
  await expect(correctPaymentDetails({...input(),expectedReference:'NEW'})).resolves.toMatchObject({success:false,error:expect.stringMatching(/Only verified/)});
 });
});
