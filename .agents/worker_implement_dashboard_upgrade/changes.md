# Change Log

This document lists the files modified and the details of the upgrades applied for the Dashboard Homepage Upgrade.

## Files Modified

### 1. `src/components/dashboard/DashboardHero.tsx`
- **Greeting Logic**: Added client-side state hooks (`useState` and `useEffect`) to dynamically set a time-aware greeting based on local time. This prevents SSR/hydration mismatches.
- **Header Formatting**: Updated the main title to display `Good morning/afternoon/evening, {firstName}` when expanded. If `firstName` is not present, it gracefully degrades to just `Good morning/afternoon/evening`.
- **Scrolled State**: Updated the header to collapse into a sticky sticky banner rendering `Overview · {firstName}` dynamically for optimal screen space utilization.
- **Subtitle**: Updated the subtitle description text to `"Here's how things are looking today."`
- **Visuals**: Expanded the gradient backgrounds and right radial glow aura from `w-64 h-64 bg-primary/5` to `w-80 h-80 bg-primary/10` with custom blur filters for visual depth.

### 2. `src/components/dashboard/KpiGrid.tsx`
- **Link Wrap**: Imported next/link and converted card elements into interactive `<Link>` components, enabling direct click-through navigation to relevant dashboard routes.
- **Interface & Configuration**: Added explicit `glowClass` and `href` properties to the `KpiStat` interface definition and mapped each statistic object.
- **Hover Glows**: Removed the obsolete `glowClasses` map lookup string mismatch. Used explicit glow classes on each item instead.
- **Pulsing Alert Dot**: Added a pulsing indicator dot next to the "Pending Approval" label if `pendingRegistrations > 0` to highlight actionable items.
- **Sizing & Styles**: Increased card paddings to `p-5` and height to `min-h-[148px]`. Increased subtext sizing to `text-[11px]` and top padding `pt-3`. Increased sparkline opacity slightly for better visibility.

### 3. `src/components/dashboard/StatCard.tsx`
- **Responsive Theme Variables**: Replaced hardcoded light-mode specific colors (`bg-purple-50`, `border-purple-200`, `text-slate-700`, etc.) with theme-aware responsive variables such as `text-foreground`, `text-muted-foreground`, `border-border`, and `bg-accent-*/10`.
- **Glow & Transition Upgrades**: Standardized glow hover effects into smooth, responsive `hover:shadow-md` shadow transitions.

### 4. `src/components/dashboard/TodaysSnapshot.tsx`
- **Standardized Classes**: Mapped legacy emerald, indigo, and amber classes to design system tokens (`text-tertiary`, `text-primary`, `text-accent-amber`).
- **Responsive Layout Protection**: Added `min-w-0` to the snapshot cells to prevent horizontal layout overflow when text scales.
- **Tooltips**: Added a title hover attribute on the attendance container (`title="${snapshot.checkedIn} of ${snapshot.confirmed} attended"`).
- **Navigation Link**: Added a `"View Attendance →"` Link in the header pointing to `/dashboard/attendance`.
- **Empty State Fallback**: Implemented a friendly placeholder returning a Calendar icon and label if there are no bookings scheduled (`snapshot.total === 0`).

### 5. `src/components/dashboard/DashboardSkeletons.tsx`
- **Obsolete MD3 Replacement**: Replaced legacy material design 3 tokens with standard equivalents (`bg-secondary`, `bg-card`, `border-border/20`, `border-border/10`).
- **Shimmer Transitions**: Replaced basic `animate-pulse` animations from containers and used `skeleton-shimmer` class directly on layout placeholder blocks to provide smooth linear shimmering.
