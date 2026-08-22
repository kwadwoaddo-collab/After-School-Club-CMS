import * as React from 'react';
import { cn } from './utils';

/**
 * Minimal pulse skeleton (InvoiceFlow's primitive), additive alongside the
 * CMS's existing shimmer skeletons in dashboard/_components/DashboardSkeletons.tsx
 * — used for new shell/Dashboard loading states only.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-sm bg-border-subtle', className)}
            aria-hidden="true"
            {...props}
        />
    );
}
