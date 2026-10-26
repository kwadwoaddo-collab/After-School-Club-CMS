import { formatInvoicePeriod } from '@/features/finance/domain/invoice-display';
type DateValue = string | Date | null | undefined;
export type ActivityChild = { id:string; firstName:string; lastName:string; createdAt?:DateValue; registeredAt?:DateValue };
export type FamilyActivity = { id:string; at:string; title:string; detail:string; href?:string; children:{id:string;name:string}[] };
type Invoice = {id:string;invoiceNumber:string;amount:string|number;status:string;createdAt?:DateValue;billingPeriodStart?:DateValue;billingPeriodEnd?:DateValue;childId?:string|null;coveredChildrenJson?:unknown;payments?:{id:string;amount:string|number;status:string;recordedAt?:DateValue;reversedAt?:DateValue;reversalReason?:string|null}[]};
export type FamilyActivityInput = {
 children:ActivityChild[]; invoices:Invoice[];
 bookings?:{id:string;createdAt:DateValue;startAt:DateValue;status:string}[];
 registrations?:{id:string;createdAt:DateValue;status:string}[];
 lifecycle?:{id:string;childId:string;createdAt:DateValue;effectiveDate:string;status:string;reason:string}[];
 contacts?:{id:string;childId:string;contactedAt:DateValue;notes:string;nextContactDate?:string|null}[];
 audit?:{id:string;createdAt:DateValue;eventType:string;eventData:string|null}[];
};
const labels:Record<string,string>={invoice_issued:'Invoice issued',invoice_voided:'Invoice voided',invoice_draft_updated:'Draft invoice updated',invoice_date_updated:'Invoice date corrected',invoice_notes_updated:'Invoice note updated'};
export function buildFamilyActivity(input:FamilyActivityInput):FamilyActivity[] {
 const events:FamilyActivity[]=[];
 const children=new Map(input.children.map(child=>[child.id,{id:child.id,name:`${child.firstName} ${child.lastName}`} ]));
 const childRefs=(ids:string[])=>ids.flatMap(id=>children.has(id)?[children.get(id)!]:[]);
 function add(id:string,at:DateValue,title:string,detail:string,href?:string,ids:string[]=[]){const date=at?new Date(at):null;if(!date||!Number.isFinite(date.getTime()))return;events.push({id,at:date.toISOString(),title,detail,href,children:childRefs(ids)});}
 for(const child of input.children){add(`child:${child.id}`,child.createdAt,'Student record created','Existing student record; this does not establish attendance or payment.',`/dashboard/students/${child.id}`,[child.id]);add(`registered:${child.id}`,child.registeredAt,'Registration recorded','Recorded registration date; current enrolment changes are listed separately.',`/dashboard/students/${child.id}`,[child.id]);}
 for(const booking of input.bookings??[])add(`booking:${booking.id}`,booking.createdAt,'Assessment booking recorded',`Scheduled ${booking.startAt?new Date(booking.startAt).toLocaleDateString('en-GB',{timeZone:'Europe/London'}):'date not recorded'} · Current booking status: ${booking.status.replaceAll('_',' ')}. This is not proof of attendance.`,`/dashboard/bookings/${booking.id}`);
 for(const registration of input.registrations??[])add(`registration:${registration.id}`,registration.createdAt,'Registration form received',`Current status: ${registration.status.replaceAll('_',' ')}. Status shown now; receipt time is not the confirmation time.`,`/dashboard/registrations/${registration.id}`);
 for(const event of input.lifecycle??[])add(`lifecycle:${event.id}`,event.createdAt,`Enrolment ${event.status}`,`Effective ${event.effectiveDate} · ${event.reason}`,`/dashboard/students/${event.childId}`,[event.childId]);
 for(const contact of input.contacts??[])add(`contact:${contact.id}`,contact.contactedAt,'Follow-up contact recorded',`${contact.notes}${contact.nextContactDate?` · Next contact ${contact.nextContactDate}`:''}`,`/dashboard/students/${contact.childId}`,[contact.childId]);
 const invoiceMap=new Map(input.invoices.map(invoice=>[invoice.id,invoice]));
 for(const invoice of input.invoices){
 const snapshot=Array.isArray(invoice.coveredChildrenJson)?invoice.coveredChildrenJson:[];
 const ids=snapshot.flatMap(item=>typeof item==='object'&&item&&'id' in item&&typeof item.id==='string'?[item.id]:[]);
 if(!ids.length&&invoice.childId)ids.push(invoice.childId);
 const context=`${invoice.invoiceNumber} · ${formatInvoicePeriod(invoice.billingPeriodStart,invoice.billingPeriodEnd)}`;
 add(`invoice:${invoice.id}`,invoice.createdAt,'Invoice record created',`${context} · £${Number(invoice.amount).toFixed(2)} · Current status: ${invoice.status.replaceAll('_',' ')}. Creation is separate from issuance and delivery.`,`/dashboard/finance/invoices/${invoice.id}`,ids);
 for(const payment of invoice.payments??[]){add(`payment:${payment.id}`,payment.recordedAt,'Payment recorded',`${context} · £${Number(payment.amount).toFixed(2)} · Current status: ${payment.status}. Receipt availability does not prove delivery.`,`/dashboard/finance/invoices/${invoice.id}`,ids);if(payment.reversedAt)add(`reversal:${payment.id}`,payment.reversedAt,'Payment reversed',`${context} · £${Number(payment.amount).toFixed(2)} · ${payment.reversalReason||'Reason not recorded'}. Original payment preserved.`,`/dashboard/finance/invoices/${invoice.id}`,ids);}
 }
 for(const audit of input.audit??[]){if(!labels[audit.eventType])continue;let data:Record<string,unknown>;try{data=JSON.parse(audit.eventData??'');}catch{continue;}if(!data||typeof data.invoiceId!=='string')continue;const invoice=invoiceMap.get(data.invoiceId);if(!invoice)continue;add(`audit:${audit.id}`,audit.createdAt,labels[audit.eventType],`${invoice.invoiceNumber} · ${formatInvoicePeriod(invoice.billingPeriodStart,invoice.billingPeriodEnd)}${audit.eventType==='invoice_issued'?' · Issuance does not confirm email delivery.':''}`,`/dashboard/finance/invoices/${invoice.id}`,invoice.childId?[invoice.childId]:[]);}
 return events.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
}
