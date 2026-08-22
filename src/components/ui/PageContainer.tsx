import * as React from 'react';
import { cn } from './utils';

/**
 * Comfortable centred content column for dashboard pages, mirroring
 * InvoiceFlow's `max-w-6xl` main-content convention. Optional — pages that
 * already manage their own width (e.g. wide data tables) are not required
 * to adopt it this milestone.
 */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('mx-auto w-full max-w-6xl', className)} {...props} />;
}
