# Dashboard Homepage Components Analysis

This document provides a detailed visual and structural audit of five critical dashboard components in preparation for their premium UI/UX upgrade.

## Executive Summary
A static audit of the dashboard homepage components reveals minor rendering bugs (e.g. missing greeting, broken hover glows), hardcoded colors that do not work in dark mode, and outdated Material Design 3 token classes. This report details the step-by-step code modifications required to align all five components with Apple HIG guidelines, ensuring pixel-perfect layout and theme-aware responsiveness.

---

## Baseline Checks Execution Report

Due to sandbox permission prompt constraints (automated runs timing out waiting for approval) and sandbox restrictions preventing npm/npx from accessing global Node configuration files:
* **npm run test** (vitest run): timed out during the permission verification step.
* **npm run lint** (eslint): bypassed due to sandbox command constraints.
* **npx tsc --noEmit**: failed with `EPERM` on global node modules `/opt/homebrew/lib/node_modules/npm/bin/npx-cli.js`.

**Action Plan for Implementer**: Prior to code integration, the implementer must execute `npm run test`, `npm run lint`, and `npx tsc --noEmit` locally in their environment to verify that all 133 tests pass and there are no lint or TypeScript errors.

---

## Detailed File Audits & Proposed Code Modifications

### 1. DashboardHero.tsx
* **Location**: `src/components/dashboard/DashboardHero.tsx`
* **Current State**:
  * The `firstName` prop is declared but completely omitted in the rendering output.
  * The page title is a hardcoded static header `"Overview"`.
  * The background gradient `from-card via-card to-primary/5` is extremely faint.
* **Upgrade Strategy**:
  * Introduce a client-side react hook (`useState` + `useEffect`) to calculate a time-aware greeting dynamically. This avoids SSR hydration mismatches that occur when generating times on the server.
  * Update the main title from `"Overview"` to `"Good morning/afternoon/evening, {firstName}"`.
  * Position `"Overview"` as a small, uppercase, secondary label above the main description.
  * Update the subtitle to `"Here's how things are looking today."`
  * Increase background wash to `from-card via-card/95 to-primary/8` and expand the right radial light aura `div` to `w-80 h-80 bg-primary/10` with custom blur filters for high-end Apple visual depth.

#### Code Comparison
**Before**:
```typescript
export default function DashboardHero({ firstName, orgName, children }: DashboardHeroProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    ...
    return (
        <div
            className={cn(
                "transition-all duration-300 ease-in-out",
                isScrolled
                    ? "sticky top-16 sm:top-20 z-30 bg-background/90 backdrop-blur-xl border-b border-border -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 shadow-sm mb-6"
                    : "relative overflow-hidden rounded-[32px] bg-gradient-to-r from-card via-card to-primary/5 p-8 border border-border shadow-md mb-2"
            )}
        >
            {!isScrolled && (
                <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none animate-in fade-in duration-500" />
            )}
            ...
                    <h1
                        className={cn(
                            "font-extrabold text-foreground tracking-tight transition-all duration-300",
                            isScrolled ? "text-lg md:text-xl" : "text-3xl md:text-4xl headline-lg"
                        )}
                    >
                        Overview
                    </h1>
                    {!isScrolled && (
                        <p className="text-muted-foreground text-sm mt-1.5 max-w-xl animate-in fade-in duration-300">
                            Centres, enrolments, and booking activity — all in one place.
                        </p>
                    )}
```

**After (Proposed)**:
```typescript
export default function DashboardHero({ firstName, orgName, children }: DashboardHeroProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [greeting, setGreeting] = useState('Hello');

    useEffect(() => {
        const hours = new Date().getHours();
        if (hours < 12) setGreeting('Good morning');
        else if (hours < 17) setGreeting('Good afternoon');
        else setGreeting('Good evening');
    }, []);
    ...
    return (
        <div
            className={cn(
                "transition-all duration-300 ease-in-out",
                isScrolled
                    ? "sticky top-16 sm:top-20 z-30 bg-background/90 backdrop-blur-xl border-b border-border -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 shadow-sm mb-6"
                    : "relative overflow-hidden rounded-[32px] bg-gradient-to-r from-card via-card/95 to-primary/8 p-8 border border-border shadow-md mb-2"
            )}
        >
            {!isScrolled && (
                <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-in fade-in duration-500" />
            )}
            ...
                    <h1
                        className={cn(
                            "font-extrabold text-foreground tracking-tight transition-all duration-300",
                            isScrolled ? "text-lg md:text-xl" : "text-3xl md:text-4xl headline-lg"
                        )}
                    >
                        {greeting}, {firstName}
                    </h1>
                    {!isScrolled && (
                        <>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mt-1">
                                Overview
                            </span>
                            <p className="text-muted-foreground text-sm mt-1.5 max-w-xl animate-in fade-in duration-300">
                                Here's how things are looking today.
                            </p>
                        </>
                    )}
```

---

### 2. KpiGrid.tsx
* **Location**: `src/components/dashboard/KpiGrid.tsx`
* **Current State**:
  * **Hover Glow Bug**: The `glowClasses` lookup record attempts to match `stat.colorClass` which contains complex classes like `'text-violet-600 dark:text-violet-400'`, meaning it fails the map lookup and fails to glow on hover.
  * Cards are small (`min-h-[116px]`), cramped (`p-4`), and lack click actions.
  * Sparklines have low visibility (`opacity-[0.15]`).
* **Upgrade Strategy**:
  * Restructure `KpiStat` interface to support explicit `glowClass` and `href` properties.
  * Import `Link` from `next/link` and convert the outer static card container `div` to a responsive, interactive `<Link href={stat.href}>`.
  * Expand card padding to `p-5` and height to `min-h-[148px]`.
  * Bump sparkline opacity parameters: `opacity-[0.2]` default, `group-hover:opacity-[0.4]` on hover.
  * Increase subtext spacing and font sizing: `pt-3` and `text-[11px]`.
  * Inject an interactive, pulsing alert dot (`status-dot` style) next to the "Pending Approval" label if `pendingRegistrations > 0`.

#### Code Comparison
**Before**:
```typescript
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
...
  const stats: KpiStat[] = [
    {
      label: 'New Students',
      value: studentsActive,
      ...
    },
    ...
  ];

  const glowClasses: Record<string, string> = {
    'text-primary': 'glow-hover-primary',
    'text-violet-600 dark:text-violet-400': 'glow-hover-primary',
    'text-emerald-600 dark:text-emerald-400': 'glow-hover-tertiary',
    'text-amber-700 dark:text-amber-400': 'glow-hover-warning'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={cn(
            'relative group overflow-hidden rounded-2xl border transition-all duration-300 cursor-default',
            'glassmorphic-card',
            'hover:scale-[1.015] hover:-translate-y-0.5',
            glowClasses[stat.colorClass] || 'hover:border-outline-variant/30',
            'min-h-[116px] p-4 flex flex-col justify-between'
          )}
        >
```

**After (Proposed)**:
```typescript
import Link from 'next/link';

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
...
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
      href: '/dashboard/registrations?status=pending',
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
            stat.glowClass || 'hover:border-outline-variant/30',
            'min-h-[148px] p-5 flex flex-col justify-between'
          )}
        >
          ...
          <div className="absolute right-3 bottom-10 opacity-[0.2] group-hover:opacity-[0.4] transition-opacity duration-300 pointer-events-none">
          ...
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1.5">
              {stat.label}
              {stat.label === 'Pending Approval' && stat.value > 0 && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
              )}
            </p>
          ...
          <div className="relative z-10 pt-3 border-t border-border/30 text-[11px] text-muted-foreground font-medium">
            {stat.subtext}
          </div>
        </Link>
```

---

### 3. StatCard.tsx
* **Location**: `src/components/dashboard/StatCard.tsx`
* **Current State**:
  * Utilizes hardcoded slate/purple/cyan/amber theme values (`bg-purple-50`, `border-purple-200`, `text-slate-700`, etc.) that do not adapt to dark mode, leaving components broken under dark themed environments.
* **Upgrade Strategy**:
  * Standardize colors to responsive CSS variables:
    * `text-slate-700` / `text-slate-900` → `text-foreground`
    * `text-slate-600` → `text-muted-foreground`
    * `border-purple-200` etc. → `border-border`
    * `bg-purple-50` / `bg-cyan-50` / `bg-amber-50` / `bg-blue-50` → `bg-primary/10`, `bg-accent-violet/10`, `bg-accent-amber/10`, `bg-accent-cyan/10`
    * `text-purple-600` etc. → `text-accent-violet`, `text-accent-cyan`, `text-accent-amber`, `text-primary`
    * Swap specific glow hover classes for a clean `hover:shadow-md` shadow container transition.

#### Code Comparison
**Before**:
```typescript
export default function StatCard({ title, value, icon: Icon, trend, trendType, color }: StatCardProps) {
    const colorClasses = {
        violet: 'bg-purple-50 text-purple-600 border-purple-200',
        cyan: 'bg-cyan-50 text-cyan-600 border-cyan-200',
        amber: 'bg-amber-50 text-amber-600 border-amber-200',
        primary: 'bg-blue-50 text-blue-600 border-blue-200',
    };

    const glowClasses = {
        violet: 'border-purple-100 hover:shadow-purple-200/50',
        cyan: 'border-cyan-100 hover:shadow-cyan-200/50',
        amber: 'border-amber-100 hover:shadow-amber-200/50',
        primary: 'border-blue-100 hover:shadow-blue-200/50',
    };

    return (
        <div className={`glass-card p-6 rounded-3xl ${glowClasses[color]} border group hover:scale-[1.02] transition-all`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-semibold text-slate-700 mb-1 uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">{value}</h3>
                    ...
                            <span className="text-xs text-slate-600 font-medium">vs last month</span>
```

**After (Proposed)**:
```typescript
export default function StatCard({ title, value, icon: Icon, trend, trendType, color }: StatCardProps) {
    const colorClasses = {
        violet: 'bg-accent-violet/10 text-accent-violet border-border',
        cyan: 'bg-accent-cyan/10 text-accent-cyan border-border',
        amber: 'bg-accent-amber/10 text-accent-amber border-border',
        primary: 'bg-primary/10 text-primary border-border',
    };

    const glowClasses = {
        violet: 'border-border hover:shadow-md',
        cyan: 'border-border hover:shadow-md',
        amber: 'border-border hover:shadow-md',
        primary: 'border-border hover:shadow-md',
    };

    return (
        <div className={`glass-card p-6 rounded-3xl ${glowClasses[color]} border group hover:scale-[1.02] transition-all`}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">{title}</p>
                    <h3 className="text-3xl font-bold text-foreground tracking-tight">{value}</h3>
                    ...
                            <span className="text-xs text-muted-foreground font-medium">vs last month</span>
```

---

### 4. TodaysSnapshot.tsx
* **Location**: `src/components/dashboard/TodaysSnapshot.tsx`
* **Current State**:
  * Contains legacy `text-emerald-600 dark:text-emerald-400` color codes.
  * Lacks basic layout overflow protection (`min-w-0` missing on cards inside the grids).
  * No visual fallback for empty state (`snapshot.total === 0`), causing it to display empty grids of zeroes.
  * Missing interactive links to navigate details.
* **Upgrade Strategy**:
  * Clean up and standardize the Tailwind theme classes: Green → `text-tertiary`, Amber → `text-accent-amber`, Blue/Indigo → `text-primary`.
  * Put `min-w-0` on card container elements to prevent overflow when text scales.
  * Put a `title` hover attribute on the attendance container (`title="{snapshot.checkedIn} of {snapshot.confirmed} attended"`).
  * Add a `"View Attendance →"` navigation link inline in the header pointing to `/dashboard/attendance`.
  * Implement an elegant empty state fallback returning a `Calendar` icon + descriptive label if there are no bookings scheduled.

#### Code Comparison
**Before**:
```typescript
  const items = [
    ...
    {
      label: 'Confirmed',
      value: snapshot.confirmed,
      icon: CalendarCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    },
    {
      label: 'Pending',
      value: snapshot.pending,
      icon: Clock,
      color: 'text-amber-700 dark:text-amber-400',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
    },
    {
      label: 'Checked In',
      value: snapshot.checkedIn,
      icon: UserCheck,
      color: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    },
    {
      label: 'Not Arrived',
      value: snapshot.notArrived,
      icon: UserX,
      color: snapshot.notArrived > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
      iconBg: snapshot.notArrived > 0 ? 'bg-amber-500/10 dark:bg-amber-500/15' : 'bg-secondary',
    },
  ];

  return (
    <div className="glassmorphic-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
            Today&apos;s Snapshot
          </span>
        </div>
        <div className="flex items-center gap-2">
          {attendanceRate !== null ? (
            <>
              <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    ...
                  )}
                  style={{ width: `${attendanceRate}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/80">
                {attendanceRate}% attended
              </span>
            </>
          ) : (
            <span className="text-[10px] font-bold text-muted-foreground/60">No sessions yet</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-1 py-4 px-3 text-center bg-card border border-border rounded-xl hover:bg-secondary/40 transition-[background-color] duration-150 cursor-default">
            ...
          </div>
        ))}
      </div>
    </div>
  );
```

**After (Proposed)**:
```typescript
import Link from 'next/link';

  const items = [
    ...
    {
      label: 'Confirmed',
      value: snapshot.confirmed,
      icon: CalendarCheck,
      color: 'text-tertiary',
      iconBg: 'bg-tertiary/10',
    },
    {
      label: 'Pending',
      value: snapshot.pending,
      icon: Clock,
      color: 'text-accent-amber',
      iconBg: 'bg-accent-amber/10',
    },
    {
      label: 'Checked In',
      value: snapshot.checkedIn,
      icon: UserCheck,
      color: 'text-primary',
      iconBg: 'bg-primary/10',
    },
    {
      label: 'Not Arrived',
      value: snapshot.notArrived,
      icon: UserX,
      color: snapshot.notArrived > 0 ? 'text-accent-amber' : 'text-muted-foreground',
      iconBg: snapshot.notArrived > 0 ? 'bg-accent-amber/10' : 'bg-secondary',
    },
  ];

  return (
    <div className="glassmorphic-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <span className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
            Today&apos;s Snapshot
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {attendanceRate !== null ? (
              <>
                <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden" title={`${snapshot.checkedIn} of ${snapshot.confirmed} attended`}>
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000',
                      ...
                    )}
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground/80">
                  {attendanceRate}% attended
                </span>
              </>
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground/60">No sessions yet</span>
            )}
          </div>
          <Link href="/dashboard/attendance" className="text-primary text-[11px] font-semibold hover:underline">
            View Attendance →
          </Link>
        </div>
      </div>

      {snapshot.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center bg-card">
          <Calendar className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No sessions scheduled for today</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1 py-4 px-3 text-center bg-card border border-border rounded-xl hover:bg-secondary/40 transition-[background-color] duration-150 cursor-default min-w-0">
              ...
            </div>
          ))}
        </div>
      )}
    </div>
  );
```

---

### 5. DashboardSkeletons.tsx
* **Location**: `src/components/dashboard/DashboardSkeletons.tsx`
* **Current State**:
  * **Critical UI/Style Bug**: Uses obsolete, broken Material Design 3 token classes which will fail to style correctly and result in fallback styles or broken alignment.
  * Uses simple, low-fidelity `animate-pulse` animations rather than custom high-end shimmer transitions.
* **Upgrade Strategy**:
  * Replace all obsolete MD3 token classes with the CMS standard equivalents:
    * `bg-surface-container-high` → `bg-secondary`
    * `bg-surface-bright` → `skeleton-shimmer` (replaces old bright backgrounds and enables active shimmering)
    * `bg-surface-container-low` → `bg-card`
    * `border-outline-variant/10` → `border-border/20`
    * `border-outline-variant/5` → `border-border/10`
  * Remove generic `animate-pulse` from the card containers and apply the CSS-class `skeleton-shimmer` directly on the placeholder blocks (`div`s representing lines, buttons, and graphics). This delivers a smooth Linear/Vercel-style loading visual.

#### Code Comparison (Example: KpiGridSkeleton)
**Before**:
```typescript
export function KpiGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      aria-busy="true"
      aria-label="Loading key performance indicators"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-container-high p-6 rounded-xl border border-outline-variant/10 animate-pulse"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-surface-bright" />
            <div className="w-12 h-5 rounded-full bg-surface-bright" />
          </div>
          <div className="w-24 h-4 rounded bg-surface-bright mb-2" />
          <div className="w-16 h-8 rounded bg-surface-bright" />
        </div>
      ))}
    </div>
  );
}
```

**After (Proposed)**:
```typescript
export function KpiGridSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      aria-busy="true"
      aria-label="Loading key performance indicators"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="bg-secondary p-6 rounded-xl border border-border/20"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg skeleton-shimmer" />
            <div className="w-12 h-5 rounded-full skeleton-shimmer" />
          </div>
          <div className="w-24 h-4 rounded skeleton-shimmer mb-2" />
          <div className="w-16 h-8 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
```

---

## Actionable Recommendations & Integration Plan
1. **Apply component upgrades in sequence**:
   * DashboardSkeletons -> StatCard -> KpiGrid -> TodaysSnapshot -> DashboardHero
2. **Import verification**: Ensure `Link` from `next/link` is correctly imported in `KpiGrid.tsx` and `TodaysSnapshot.tsx`.
3. **Execution environment checks**: Run linting (`npm run lint`), typescript verification (`npx tsc --noEmit`), and tests (`npm run test`) locally to guarantee 0 regressions before committing the code.
