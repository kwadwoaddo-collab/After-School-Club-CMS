import * as React from 'react';
import { cn } from './utils';

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
}

/**
 * Standard page-level heading: title + optional description on the left,
 * optional actions (filters, primary buttons) on the right. Replaces
 * one-off hero/heading markup in new shell/Dashboard code — existing
 * per-module headers are out of scope and untouched.
 */
export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
    return (
        <div
            className={cn(
                'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
                className
            )}
            {...props}
        >
            <div className="min-w-0">
                <h1 className="text-page-title text-text truncate">{title}</h1>
                {description && <p className="text-small-body text-text-secondary mt-1">{description}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
        </div>
    );
}
