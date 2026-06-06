'use client';

import { GrowthSparkline } from '@/components/dashboard/GrowthSparkline';
import {
  Users, CalendarCheck, ClipboardList, Clock,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui/utils';

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
  bgGradient: string;
  borderColor: string;
  iconBg: string;
  trend?: Trend;
  sparkline?: number[];
  sparklineColor?: string;
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

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function TrendBadge({ trend }: { trend: Trend }) {
  const isPositive = trend.type === 'positive';
  const isNegative = trend.type === 'negative';

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide border',
        isPositive && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        isNegative && 'bg-red-500/10 text-red-400 border-red-500/20',
        !isPositive && !isNegative && 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/20'
      )}
    >
      {isPositive && <ArrowUpRight className="w-3 h-3" />}
      {isNegative && <ArrowDownRight className="w-3 h-3" />}
      {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
      {trend.text}
    </div>
  );
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
      subtext: `${formatNumber(studentsTotal)} total enrolled`,
      icon: Users,
      colorClass: 'text-primary',
      bgGradient: 'from-blue-500/5 via-transparent to-transparent',
      borderColor: 'border-primary/20 hover:border-primary/40',
      iconBg: 'bg-primary/15 text-primary',
      trend: studentsTrend,
      sparkline: growthStats,
      sparklineColor: 'stroke-primary',
    },
    {
      label: 'Bookings',
      value: bookingsActive,
      subtext: `${formatNumber(bookingsTotal)} total bookings`,
      icon: CalendarCheck,
      colorClass: 'text-secondary',
      bgGradient: 'from-purple-500/5 via-transparent to-transparent',
      borderColor: 'border-secondary/20 hover:border-secondary/40',
      iconBg: 'bg-secondary/15 text-secondary',
      trend: bookingsTrend,
      sparklineColor: 'stroke-secondary',
    },
    {
      label: 'New Registrations',
      value: registrationsActive,
      subtext: `${formatNumber(registrationsTotal)} total registrations`,
      icon: ClipboardList,
      colorClass: 'text-tertiary',
      bgGradient: 'from-green-500/5 via-transparent to-transparent',
      borderColor: 'border-tertiary/20 hover:border-tertiary/40',
      iconBg: 'bg-tertiary/15 text-tertiary',
      trend: registrationsTrend,
      sparkline: growthStats,
      sparklineColor: 'stroke-tertiary',
    },
    {
      label: 'Pending Approval',
      value: pendingRegistrations,
      subtext: 'Awaiting coordinator review',
      icon: Clock,
      colorClass: 'text-amber-400',
      bgGradient: 'from-amber-500/5 via-transparent to-transparent',
      borderColor: 'border-amber-500/20 hover:border-amber-500/40',
      iconBg: 'bg-amber-500/15 text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={cn(
            'relative group overflow-hidden rounded-xl border transition-all duration-300 cursor-default',
            'bg-surface-container-high',
            'hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)] hover:scale-[1.015] hover:-translate-y-0.5',
            stat.borderColor,
            'min-h-[116px] p-4 flex flex-col justify-between'
          )}
        >
          {/* Background gradient wash */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-70 pointer-events-none',
              stat.bgGradient
            )}
          />

          {/* Sparkline watermark */}
          {stat.sparkline && (
            <div className="absolute right-3 bottom-10 opacity-[0.15] group-hover:opacity-[0.35] transition-opacity duration-300 pointer-events-none">
              <GrowthSparkline
                data={stat.sparkline}
                width={64}
                height={22}
                strokeColor={stat.sparklineColor}
              />
            </div>
          )}

          <div className="relative z-10">
            {/* Header row: icon + trend */}
            <div className="flex items-center justify-between mb-2">
              <div className={cn('p-2 rounded-lg', stat.iconBg)}>
                <stat.icon className="w-4 h-4" />
              </div>

              {stat.trend ? (
                <TrendBadge trend={stat.trend} />
              ) : null}
            </div>

            {/* Label */}
            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest mb-0.5">
              {stat.label}
            </p>

            {/* Large metric number */}
            <h3 className={cn('text-2xl font-black tracking-tight tabular-nums', stat.colorClass)}>
              {formatNumber(stat.value ?? 0)}
            </h3>
          </div>

          {/* Footer */}
          <div className="relative z-10 pt-2 border-t border-outline-variant/10 text-[10px] text-on-surface-variant/60 font-medium">
            {stat.subtext}
          </div>
        </div>
      ))}
    </div>
  );
}
