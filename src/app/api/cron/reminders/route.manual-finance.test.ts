import {describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({bookings:vi.fn().mockResolvedValue([]),invoices:vi.fn(),send:vi.fn()}));
vi.mock('@/db',()=>({db:{query:{bookings:{findMany:m.bookings},invoices:{findMany:m.invoices}}}}));
vi.mock('@/app/api/cron/broadcasts/route',()=>({verifyCronAuthorization:()=>({authorized:true})}));
vi.mock('resend',()=>({Resend:class{emails={send:m.send};}}));
import {POST} from './route';
describe('manual-only financial communications during scheduled reminders',()=>{
 it('never selects or emails due invoices during the cron run',async()=>{const response=await POST(new NextRequest('https://localhost/api/cron/reminders',{method:'POST'}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({invoiceRemindersSent:0});expect(m.invoices).not.toHaveBeenCalled();expect(m.send).not.toHaveBeenCalled();});
});
