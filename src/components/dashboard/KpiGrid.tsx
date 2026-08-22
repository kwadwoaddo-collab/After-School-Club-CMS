'use client';

import Link from 'next/link';
import { GrowthSparkline } from '@/components/dashboard/GrowthSparkline';
import {
  Users, CalendarCheck, ClipboardList, Clock,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { Card } from '@/components/ui/Card';

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
  iconBg: string;
  iconColor: string;
  trend?: Trend;
  sparkline?: number[];
  sparklineColor?: string;
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
        'flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-semibold',
        isPositive && 'bg-success-soft text-emerald-700 dark:text-emerald-400',
        isNegative && 'bg-danger-soft text-danger',
        !isPositive && !isNegative && 'bg-page text-text-muted'
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
      iconBg: 'bg-accent-soft',
      iconColor: 'text-accent',
      trend: studentsTrend,
      sparkline: growthStats,
      sparklineColor: 'stroke-accent',
      href: '/dashboard/students',
    },
    {
      label: 'Bookings',
      value: bookingsActive,
      subtext: `${formatNumber(bookingsTotal)} total bookings`,
      icon: CalendarCheck,
      iconBg: 'bg-info-soft',
      iconColor: 'text-blue-600 dark:text-blue-400',
      trend: bookingsTrend,
      sparkline: growthStats,
      sparklineColor: 'stroke-blue-500',
      href: '/dashboard/bookings',
    },
    {
      label: 'New Registrations',
      value: registrationsActive,
      subtext: `${formatNumber(registrationsTotal)} total registrations`,
      icon: ClipboardList,
      iconBg: 'bg-success-soft',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      trend: registrationsTrend,
      sparkline: growthStats,
      sparklineColor: 'stroke-emerald-500',
      href: '/dashboard/registrations',
    },
    {
      label: 'Pending Approval',
      value: pendingRegistrations,
      subtext: 'Awaiting coordinator review',
      icon: Clock,
      iconBg: 'bg-warning-soft',
      iconColor: 'text-amber-700 dark:text-amber-400',
      href: '/dashboard/registrations?status=awaiting_confirmation',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(stat => (
        <Link key={stat.label} href={stat.href} className="block h-full">
          <Card className="h-full transition-colors hover:border-accent/40">
            <div className="relative p-5 flex flex-col justify-between min-h-[140px]">
              {/* Sparkline watermark */}
              {stat.sparkline && (
                <div className="absolute right-4 bottom-4 opacity-30 pointer-events-none">
                  <GrowthSparkline data={stat.sparkline} width={64} height={22} strokeColor={stat.sparklineColor} />
                </div>
              )}

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('flex size-9 items-center justify-center rounded-md', stat.iconBg, stat.iconColor)}>
                    <stat.icon className="w-4 h-4" />
                  </span>
                  {stat.trend && (stat.value ?? 0) > 0 ? <TrendBadge trend={stat.trend} /> : null}
                </div>

                <p className="text-metadata flex items-center gap-1.5">
                  {stat.label}
                  {stat.label === 'Pending Approval' && stat.value > 0 && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </span>
                  )}
                </p>

                <h3 className="text-financial-total text-text mt-1">{formatNumber(stat.value ?? 0)}</h3>
              </div>

              <div className="relative z-10 pt-3 mt-3 border-t border-border-subtle text-xs text-text-muted">
                {stat.subtext}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
