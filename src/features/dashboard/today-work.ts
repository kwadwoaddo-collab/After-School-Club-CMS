import { db } from '@/db';
import { bookings, bookingAttendees, centres, registrations, children } from '@/db/schema';
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { enrolmentBusinessDate } from '@/lib/enrolment/business-date';
import { studentLifecycleStatusSql, studentFollowUpFilterSql, studentRestartBillingReviewSql } from '@/features/students/lifecycle-queries';

export type TodayWorkItem = { key: string; title: string; description: string; count: number | null; href: string };
export function workLink(path: string, centreId: string, filters: Record<string,string> = {}) {
    return `${path}?${new URLSearchParams({centre:centreId,...filters})}`;
}
/** The caller supplies only already-authorised centres; each query also enforces tenant scope. */
export async function getTodayWork(input: { orgId:string; centreIds:string[]; centreId:string; role:string; now?:Date }): Promise<{items:TodayWorkItem[]; unavailable:boolean}> {
    if (!['ORG_OWNER','MANAGER','FRONT_DESK'].includes(input.role) || !input.centreIds.length) return {items:[],unavailable:false};
    const ids = input.centreId === 'all' ? input.centreIds : input.centreIds.filter(id=>id===input.centreId);
    if (!ids.length) return {items:[],unavailable:false};
    const now = input.now ?? new Date(), today = enrolmentBusinessDate(now);
    const childScope = and(eq(children.organisationId,input.orgId),inArray(children.centreId,ids),isNull(children.deletedAt));
    const countRows = async (query:PromiseLike<{total:number}[]>)=>Number((await query)[0]?.total ?? 0);
    try {
        const [outcomes,confirmations,overdue,todayCalls,billingReviews] = await Promise.all([
            countRows(db.select({total:sql<number>`count(*)::int`}).from(bookings).innerJoin(centres,eq(bookings.centreId,centres.id)).where(and(eq(centres.organisationId,input.orgId),inArray(bookings.centreId,ids),inArray(bookings.status,['confirmed','pending']),lt(bookings.startAt,now),sql`(NOT EXISTS (SELECT 1 FROM ${bookingAttendees} ba WHERE ba.booking_id = ${bookings.id}) OR EXISTS (SELECT 1 FROM ${bookingAttendees} ba WHERE ba.booking_id = ${bookings.id} AND ba.attendance_status IS NULL))`))),
            countRows(db.select({total:sql<number>`count(*)::int`}).from(registrations).where(and(eq(registrations.organisationId,input.orgId),inArray(registrations.centreId,ids),eq(registrations.status,'awaiting_confirmation')))),
            countRows(db.select({total:sql<number>`count(*)::int`}).from(children).where(and(childScope,sql`${studentLifecycleStatusSql(today)} IN ('paused','stopped')`,studentFollowUpFilterSql('overdue',today)))),
            countRows(db.select({total:sql<number>`count(*)::int`}).from(children).where(and(childScope,sql`${studentLifecycleStatusSql(today)} IN ('paused','stopped')`,studentFollowUpFilterSql('today',today)))),
            countRows(db.select({total:sql<number>`count(*)::int`}).from(children).where(and(childScope,studentRestartBillingReviewSql(today)))),
        ]);
        const items:TodayWorkItem[] = [
            {key:'outcomes',title:'Record appointment outcomes',description:'Past bookings still need an outcome; a passed date does not mean attended.',count:outcomes,href:workLink('/dashboard/bookings',input.centreId,{outcome:'required'})},
            {key:'confirmations',title:'Confirm joining registrations',description:'Review received forms before confirming that a family has joined.',count:confirmations,href:workLink('/dashboard/registrations',input.centreId,{status:'awaiting_confirmation'})},
            {key:'overdue',title:'Overdue follow-up calls',description:'Paused or stopped students with a missed next-contact date.',count:overdue,href:workLink('/dashboard/students',input.centreId,{status:'follow-ups',followUp:'overdue'})},
            {key:'today',title:'Follow-up calls due today',description:'Contact families already scheduled for a call today.',count:todayCalls,href:workLink('/dashboard/students',input.centreId,{status:'follow-ups',followUp:'today'})},
        ];
        if (['ORG_OWNER','MANAGER'].includes(input.role)) items.push(
            {key:'restart',title:'Review restarted students’ billing',description:'Check the agreed fee and start date. Reactivation alone does not restart billing.',count:billingReviews,href:workLink('/dashboard/students',input.centreId,{status:'billing-review'})},
            {key:'finance',title:'Review finance exceptions',description:'Open Needs attention for billing setup, invoice and payment checks.',count:null,href:workLink('/dashboard/finance',input.centreId,{task:'attention'})},
        );
        return {items,unavailable:false};
    } catch { return {items:[],unavailable:true}; }
}
