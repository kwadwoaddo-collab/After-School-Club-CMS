/**
 * KpiGrid — Top-level stat cards for the dashboard overview.
 *
 * Extracted from the monolithic dashboard/page.tsx (Phase 2A – A2).
 * This is a server component — it receives pre-computed data, no DB access.
 */

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
  icon: LucideIcon;
  colorClass: string;
  trend?: Trend;
  sparkline?: number[];
}

interface KpiGridProps {
  totalStudents: number;
  totalBookings: number;
  totalRegistrations: number;
  pendingRegistrations: number;
  studentsTrend: Trend;
  bookingsTrend: Trend;
  registrationsTrend: Trend;
  growthStats: number[];
}

export function KpiGrid({
  totalStudents,
  totalBookings,
  totalRegistrations,
  pendingRegistrations,
  studentsTrend,
  bookingsTrend,
  registrationsTrend,
  growthStats,
}: KpiGridProps) {
  const stats: KpiStat[] = [
    { label: 'Total Students', value: totalStudents, icon: Users, colorClass: 'text-primary bg-primary/10', trend: studentsTrend, sparkline: growthStats },
    { label: 'All-time Bookings', value: totalBookings, icon: CalendarCheck, colorClass: 'text-secondary bg-secondary/10', trend: bookingsTrend },
    { label: 'Registrations', value: totalRegistrations, icon: ClipboardList, colorClass: 'text-tertiary bg-tertiary/10', trend: registrationsTrend, sparkline: growthStats },
    { label: 'Pending Approval', value: pendingRegistrations, icon: ClipboardList, colorClass: 'text-error bg-error/10' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map(stat => (
        <div key={stat.label} className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/10 group hover:bg-surface-bright transition-all relative">
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
      ))}
    </div>
  );
}
