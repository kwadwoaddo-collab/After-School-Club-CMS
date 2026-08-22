import * as React from 'react';
import { cn } from './utils';

/**
 * Flat, restrained surface primitive — the InvoiceFlow-aligned counterpart to
 * the existing `.glass-card`/`.kpi-card` utility classes (which remain
 * untouched for pages that already use them). New shell/Dashboard code
 * should use this instead of introducing more ad-hoc `bg-white dark:bg-*`
 * cards. See project-notes/milestone-2-invoiceflow-adoption-map.md.
 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'rounded-lg border border-border bg-surface text-text',
                'shadow-[0_1px_2px_rgba(28,27,26,0.04),0_1px_8px_rgba(28,27,26,0.04)]',
                'dark:shadow-[0_1px_2px_rgba(0,0,0,0.20),0_1px_8px_rgba(0,0,0,0.20)]',
                className
            )}
            {...props}
        />
    )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex flex-col gap-1 border-b border-border-subtle px-5 py-4', className)} {...props} />
    )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn('text-section-title text-text', className)} {...props} />
    )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('text-small-body text-text-secondary', className)} {...props} />
    )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('px-5 py-4', className)} {...props} />
    )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('flex items-center gap-3 border-t border-border-subtle px-5 py-4', className)} {...props} />
    )
);
CardFooter.displayName = 'CardFooter';
