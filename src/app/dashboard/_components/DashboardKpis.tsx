import { KpiGrid } from '@/components/dashboard/KpiGrid';
import { getStudentKpis, getBookingKpis, getRegistrationKpis, getWeeklyRegistrations } from '@/lib/dashboard-queries';
import { subDays, eachWeekOfInterval, isSameDay } from 'date-fns';

export default async function DashboardKpisWidget({
    orgId,
    childrenCentreCondition,
    bookingsCentreCondition,
    registrationsCentreCondition,
    hasCentres,
    activeStartDate, activeEndDate,
    prevStartDate, prevEndDate,
    targetMonthStart, targetMonthEnd,
    targetWeekStart, targetWeekEnd,
    now
}: any) {
    try {
        const [
            [studentKpis],
            [bookingKpis],
            [registrationKpis],
            weeklyRegistrations
        ] = await Promise.all([
            getStudentKpis(orgId, childrenCentreCondition, activeStartDate.toISOString(), activeEndDate.toISOString(), prevStartDate.toISOString(), prevEndDate.toISOString()),
            getBookingKpis(hasCentres, bookingsCentreCondition, activeStartDate.toISOString(), activeEndDate.toISOString(), prevStartDate.toISOString(), prevEndDate.toISOString(), targetMonthStart.toISOString(), targetMonthEnd.toISOString(), targetWeekStart.toISOString(), targetWeekEnd.toISOString()),
            getRegistrationKpis(orgId, registrationsCentreCondition, activeStartDate.toISOString(), activeEndDate.toISOString(), prevStartDate.toISOString(), prevEndDate.toISOString(), targetMonthStart.toISOString(), targetMonthEnd.toISOString(), targetWeekStart.toISOString(), targetWeekEnd.toISOString()),
            getWeeklyRegistrations(orgId, registrationsCentreCondition, now)
        ]);

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

        const weeks = eachWeekOfInterval({ start: subDays(now, 49), end: now }, { weekStartsOn: 1 });
        const growthStats = weeks.map(w => {
            const match = weeklyRegistrations.find((d: any) => isSameDay(new Date(d.weekStart), w));
            return Number(match?.count || 0);
        });

        return (
            <KpiGrid
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
                growthStats={growthStats}
            />
        );
    } catch (e) {
        console.error('Failed to load KPIs:', e);
        return <div className="text-red-400 p-4 bg-red-400/10 rounded-xl">Failed to load statistics</div>;
    }
}
