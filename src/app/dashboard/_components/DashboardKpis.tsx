import { summaryLinks } from '@/features/dashboard/summary-links';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { getStudentKpis, getBookingKpis, getRegistrationKpis } from '@/lib/dashboard-queries';

export default async function DashboardKpisWidget({
    orgId, activeCentreId, userRole,
    childrenCentreCondition,
    bookingsCentreCondition,
    registrationsCentreCondition,
    hasCentres,
    activeStartDate, activeEndDate,
    prevStartDate, prevEndDate,
    targetMonthStart, targetMonthEnd,
    targetWeekStart, targetWeekEnd
}: any) {
    let data;
    try {
        data = await Promise.all([
            getStudentKpis(orgId, childrenCentreCondition, activeStartDate.toISOString(), activeEndDate.toISOString(), prevStartDate.toISOString(), prevEndDate.toISOString()),
            getBookingKpis(hasCentres, bookingsCentreCondition, activeStartDate.toISOString(), activeEndDate.toISOString(), prevStartDate.toISOString(), prevEndDate.toISOString(), targetMonthStart.toISOString(), targetMonthEnd.toISOString(), targetWeekStart.toISOString(), targetWeekEnd.toISOString()),
            getRegistrationKpis(orgId, registrationsCentreCondition, activeStartDate.toISOString(), activeEndDate.toISOString(), prevStartDate.toISOString(), prevEndDate.toISOString(), targetMonthStart.toISOString(), targetMonthEnd.toISOString(), targetWeekStart.toISOString(), targetWeekEnd.toISOString())
        ]);
    } catch (e) {
        logger.error('Failed to load KPIs:', e);
        return <div className="text-red-400 p-4 bg-red-400/10 rounded-xl">Failed to load statistics</div>;
    }

    const [
        [studentKpis],
        [bookingKpis],
        [registrationKpis]
    ] = data;

        const calculateTrend = (curr: any, prev: any) => {
            const current = Number(curr || 0);
            const previous = Number(prev || 0);
            if (current === 0 && previous === 0) return { diff: 0, text: "0%", type: 'neutral' as const };
            if (previous === 0) return { diff: current, text: `+${current}`, type: 'positive' as const };
            const perc = ((current - previous) / previous) * 100;
            const trendType: 'positive' | 'negative' | 'neutral' = perc > 0 ? 'positive' : perc < 0 ? 'negative' : 'neutral';
            return {
                diff: current - previous,
                text: perc > 0 ? `+${perc.toFixed(0)}%` : `${perc.toFixed(0)}%`,
                type: trendType
            };
        };

        const studentsTrend = calculateTrend(studentKpis?.activePeriod, studentKpis?.prevPeriod);
        const bookingsTrend = calculateTrend(bookingKpis?.activePeriod, bookingKpis?.prevPeriod);
        const registrationsTrend = calculateTrend(registrationKpis?.activePeriod, registrationKpis?.prevPeriod);

        return (
            <KpiGrid
                links={summaryLinks(activeCentreId, activeStartDate, activeEndDate)}
                canOpenPeople={['ORG_OWNER','MANAGER','FRONT_DESK'].includes(userRole)}
                studentsActive={Number(studentKpis?.activePeriod || 0)}
                studentsTotal={Number(studentKpis?.total || 0)}
                bookingsActive={Number(bookingKpis?.activePeriod || 0)}
                bookingsTotal={Number(bookingKpis?.totalAll || 0)}
                registrationsActive={Number(registrationKpis?.activePeriod || 0)}
                registrationsTotal={Number(registrationKpis?.total || 0)}
                pendingRegistrations={Number(registrationKpis?.pending || 0)}
                studentsTrend={studentsTrend}
                bookingsTrend={bookingsTrend}
                registrationsTrend={registrationsTrend}
            />
        );
}
