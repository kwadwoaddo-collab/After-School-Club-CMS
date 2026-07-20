'use client';

import Link from 'next/link';
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
  glowClass: string;
  href: string;
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
        isPositive && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        isNegative && 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        !isPositive && !isNegative && 'bg-secondary text-muted-foreground border-border'
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
      glowClass: 'glow-hover-primary',
      href: '/dashboard/students',
    },
    {
      label: 'Bookings',
      value: bookingsActive,
      subtext: `${formatNumber(bookingsTotal)} total bookings`,
      icon: CalendarCheck,
      colorClass: 'text-violet-600 dark:text-violet-400',
      bgGradient: 'from-violet-500/5 via-transparent to-transparent',
      borderColor: 'border-violet-500/20 hover:border-violet-500/40',
      iconBg: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
      trend: bookingsTrend,
      sparkline: growthStats,
      sparklineColor: 'stroke-violet-500',
      glowClass: 'glow-hover-accent-violet',
      href: '/dashboard/bookings',
    },
    {
      label: 'New Registrations',
      value: registrationsActive,
      subtext: `${formatNumber(registrationsTotal)} total registrations`,
      icon: ClipboardList,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgGradient: 'from-emerald-500/5 via-transparent to-transparent',
      borderColor: 'border-emerald-500/20 hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      trend: registrationsTrend,
      sparkline: growthStats,
      sparklineColor: 'stroke-emerald-500',
      glowClass: 'glow-hover-tertiary',
      href: '/dashboard/registrations',
    },
    {
      label: 'Pending Approval',
      value: pendingRegistrations,
      subtext: 'Awaiting coordinator review',
      icon: Clock,
      colorClass: 'text-amber-700 dark:text-amber-400',
      bgGradient: 'from-amber-500/5 via-transparent to-transparent',
      borderColor: 'border-amber-500/20 hover:border-amber-500/40',
      iconBg: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
      glowClass: 'glow-hover-warning',
      href: '/dashboard/registrations?status=awaiting_confirmation',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map(stat => (
        <Link
          key={stat.label}
          href={stat.href}
          className={cn(
            'relative group overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer block',
            'glassmorphic-card',
            'hover:scale-[1.015] hover:-translate-y-0.5',
            'active:scale-[0.985] active:opacity-95',
            stat.glowClass || 'hover:border-outline-variant/30',
            'min-h-[148px] p-5 flex flex-col justify-between'
          )}
        >
          {/* Background gradient wash */}
          <div
            className={cn(
              'absolute inset-0 bg-gradient-to-br opacity-5 pointer-events-none',
              stat.bgGradient
            )}
          />

          {/* Sparkline watermark */}
          {stat.sparkline && (
            <div className="absolute right-3 bottom-10 opacity-[0.2] group-hover:opacity-[0.4] transition-opacity duration-300 pointer-events-none">
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

              {stat.trend && (stat.value ?? 0) > 0 ? (
                <TrendBadge trend={stat.trend} />
              ) : null}
            </div>

            {/* Label */}
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
              {stat.label}
              {stat.label === 'Pending Approval' && stat.value > 0 && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
              )}
            </p>

            {/* Large metric number */}
            <h3 className={cn('text-2xl font-black tracking-tight tabular-nums', stat.colorClass)}>
              {formatNumber(stat.value ?? 0)}
            </h3>
          </div>

          {/* Footer */}
          <div className="relative z-10 pt-3 border-t border-border/30 text-[11px] text-muted-foreground font-medium">
            {stat.subtext}
          </div>
        </Link>
      ))}
    </div>
  );
}
