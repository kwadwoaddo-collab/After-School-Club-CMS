import { GrowthSparkline } from '@/components/dashboard/GrowthSparkline';
import {
  Users, CalendarCheck, ClipboardList,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Trend {
  diff: number;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}

interface KpiStat {
  label: string;
  value: number;
  subtext: string;
  icon: LucideIcon;
  colorClass: string;
  trend?: Trend;
  sparkline?: number[];
}

interface KpiGridProps {
  studentsActive: number;
  studentsTotal: number;
  bookingsActive: number;
  bookingsTotal: number;
  registrationsActive: number;
  registrationsTotal: number;
  pendingRegistrations: number;
  studentsTrend: Trend;
  bookingsTrend: Trend;
  registrationsTrend: Trend;
  growthStats: number[];
}

export function KpiGrid({
  studentsActive,
  studentsTotal,
  bookingsActive,
  bookingsTotal,
  registrationsActive,
  registrationsTotal,
  pendingRegistrations,
  studentsTrend,
  bookingsTrend,
  registrationsTrend,
  growthStats,
}: KpiGridProps) {
  const stats: KpiStat[] = [
    {
      label: 'New Students',
      value: studentsActive,
      subtext: `${studentsTotal} total students`,
      icon: Users,
      colorClass: 'text-primary bg-primary/10',
      trend: studentsTrend,
      sparkline: growthStats,
    },
    {
      label: 'Bookings',
      value: bookingsActive,
      subtext: `${bookingsTotal} total bookings`,
      icon: CalendarCheck,
      colorClass: 'text-secondary bg-secondary/10',
      trend: bookingsTrend,
    },
    {
      label: 'New Registrations',
      value: registrationsActive,
      subtext: `${registrationsTotal} total registrations`,
      icon: ClipboardList,
      colorClass: 'text-tertiary bg-tertiary/10',
      trend: registrationsTrend,
      sparkline: growthStats,
    },
    {
      label: 'Pending Approval',
      value: pendingRegistrations,
      subtext: 'Awaiting coordinator review',
      icon: ClipboardList,
      colorClass: 'text-error bg-error/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map(stat => (
        <div key={stat.label} className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/10 group hover:bg-surface-bright transition-all relative flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${stat.colorClass}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.sparkline && (
                <div className="absolute right-6 top-6 opacity-40 group-hover:opacity-100 transition-opacity">
                  <GrowthSparkline data={stat.sparkline} width={60} height={20} />
                </div>
              )}
              {!stat.sparkline && stat.trend && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold tracking-wider ${
                  stat.trend.type === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  stat.trend.type === 'negative' ? 'bg-error-container/20 text-error border border-error/20' :
                  'bg-surface-container-lowest text-on-surface-variant border border-outline-variant/20'
                }`}>
                  {stat.trend.type === 'positive' && <ArrowUpRight className="w-3 h-3" />}
                  {stat.trend.type === 'negative' && <ArrowDownRight className="w-3 h-3" />}
                  {stat.trend.type === 'neutral' && <Minus className="w-3 h-3" />}
                  {stat.trend.text}
                </div>
              )}
            </div>
            <p className="text-on-surface-variant text-sm font-medium">{stat.label}</p>
            <h3 className="text-3xl font-bold text-white mt-1">{stat.value ?? 0}</h3>
          </div>
          <div className="mt-4 pt-2 border-t border-outline-variant/5 text-xs text-on-surface-variant/70 font-medium">
            {stat.subtext}
          </div>
        </div>
      ))}
    </div>
  );
}
