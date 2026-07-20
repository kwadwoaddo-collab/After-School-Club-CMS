import { cache } from 'react';
import { db } from '@/db';
import {
    organisations, centres, parents, children,
    bookings, bookingAttendees, registrations, registrationChildren, studentNotes
} from '@/db/schema';
import { eq, desc, asc, sql, and, gte, lt, lte, inArray, isNull } from 'drizzle-orm';
import { startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, isSameDay, subDays } from 'date-fns';

export const getStudentKpis = cache(async (orgId: string, centreCondition: any, activeStart: string, activeEnd: string, prevStart: string, prevEnd: string) => {
    return db.select({ 
        total: sql<number>`count(distinct ${children.id})::int`,
        activePeriod: sql<number>`count(distinct ${children.id}) filter (where ${children.createdAt} >= ${activeStart} and ${children.createdAt} <= ${activeEnd})::int`,
        prevPeriod: sql<number>`count(distinct ${children.id}) filter (where ${children.createdAt} >= ${prevStart} and ${children.createdAt} <= ${prevEnd})::int`
    })
    .from(children)
    .innerJoin(parents, eq(children.parentId, parents.id))
    .where(and(eq(parents.organisationId, orgId), centreCondition, isNull(parents.deletedAt), isNull(children.deletedAt)));
});

export const getBookingKpis = cache(async (hasCentres: boolean, centreCondition: any, activeStart: string, activeEnd: string, prevStart: string, prevEnd: string, targetMonthStart: string, targetMonthEnd: string, targetWeekStart: string, targetWeekEnd: string) => {
    if (!hasCentres) return [{ totalAll: 0, thisMonth: 0, thisWeek: 0, activePeriod: 0, prevPeriod: 0 }];
    return db.select({ 
        totalAll: sql<number>`count(*)::int`,
        thisMonth: sql<number>`count(*) filter (where ${bookings.startAt} >= ${targetMonthStart} and ${bookings.startAt} <= ${targetMonthEnd})::int`,
        thisWeek: sql<number>`count(*) filter (where ${bookings.startAt} >= ${targetWeekStart} and ${bookings.startAt} <= ${targetWeekEnd})::int`,
        activePeriod: sql<number>`count(*) filter (where ${bookings.startAt} >= ${activeStart} and ${bookings.startAt} <= ${activeEnd})::int`,
        prevPeriod: sql<number>`count(*) filter (where ${bookings.startAt} >= ${prevStart} and ${bookings.startAt} <= ${prevEnd})::int`
    }).from(bookings).where(centreCondition);
});

export const getRegistrationKpis = cache(async (orgId: string, centreCondition: any, activeStart: string, activeEnd: string, prevStart: string, prevEnd: string, targetMonthStart: string, targetMonthEnd: string, targetWeekStart: string, targetWeekEnd: string) => {
    return db.select({ 
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${registrations.status} = 'awaiting_confirmation')::int`,
        thisMonth: sql<number>`count(*) filter (where ${registrations.startDate} >= ${targetMonthStart} and ${registrations.startDate} <= ${targetMonthEnd})::int`,
        thisWeek: sql<number>`count(*) filter (where ${registrations.startDate} >= ${targetWeekStart} and ${registrations.startDate} <= ${targetWeekEnd})::int`,
        activePeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${activeStart} and ${registrations.createdAt} <= ${activeEnd})::int`,
        prevPeriod: sql<number>`count(*) filter (where ${registrations.createdAt} >= ${prevStart} and ${registrations.createdAt} <= ${prevEnd})::int`
    }).from(registrations).where(and(eq(registrations.organisationId, orgId), centreCondition));
});

export const getWeeklyRegistrations = cache(async (orgId: string, centreCondition: any, now: Date) => {
    return db.select({
        weekStart: sql<string>`date_trunc('week', ${registrations.createdAt})`,
        count: sql<number>`count(*)::int`
    })
    .from(registrations)
    .where(and(eq(registrations.organisationId, orgId), centreCondition, gte(registrations.createdAt, subDays(now, 56))))
    .groupBy(sql`date_trunc('week', ${registrations.createdAt})`)
    .orderBy(asc(sql`date_trunc('week', ${registrations.createdAt})`));
});
