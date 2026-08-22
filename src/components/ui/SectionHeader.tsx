import * as React from 'react';
import { cn } from './utils';

interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title: React.ReactNode;
    action?: React.ReactNode;
}

/** Heading for a sub-section within a page (a card grid, a schedule panel). */
export function SectionHeader({ title, action, className, ...props }: SectionHeaderProps) {
    return (
        <div className={cn('flex items-center justify-between gap-3 mb-3', className)} {...props}>
            <h2 className="text-section-title text-text">{title}</h2>
            {action}
        </div>
    );
}
