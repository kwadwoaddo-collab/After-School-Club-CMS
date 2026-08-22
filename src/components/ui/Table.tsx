import * as React from 'react';
import { cn } from './utils';

/**
 * Flat, InvoiceFlow-aligned table primitive — additive alongside the
 * existing `DataTable` component (glassmorphic-card styling, still used by
 * modules outside this milestone's scope). New list screens under Milestone
 * 3 (Students/Parents/Staff/Centres) compose directly from these instead of
 * wrapping `DataTable`, so that upgrading a table's chrome never touches an
 * unrelated module's rendering. See project-notes/milestone-3-people-audit.md
 * for the rationale (§7, "Table primitive").
 *
 * Consistent px-5 cell padding, `text-label` headers, `text-table-value`
 * cells, restrained row hover — mirrors InvoiceFlow's own
 * src/components/ui/table.tsx.
 */
export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
    /** Accessible, visually-hidden summary of the table's purpose. */
    caption?: string;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
    ({ className, caption, children, ...props }, ref) => (
        <div className="w-full overflow-x-auto">
            <table ref={ref} className={cn('w-full border-collapse text-left', className)} {...props}>
                {caption && <caption className="sr-only">{caption}</caption>}
                {children}
            </table>
        </div>
    )
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <thead ref={ref} className={cn('border-b border-border', className)} {...props} />
    )
);
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <tbody ref={ref} className={cn('divide-y divide-border-subtle', className)} {...props} />
    )
);
TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    clickable?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
    ({ className, clickable, ...props }, ref) => (
        <tr
            ref={ref}
            className={cn(
                'transition-colors',
                clickable && 'cursor-pointer hover:bg-page/60 focus-within:bg-page/60',
                className
            )}
            {...props}
        />
    )
);
TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
    align?: 'left' | 'center' | 'right';
}

export const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
    ({ className, align = 'left', ...props }, ref) => (
        <th
            ref={ref}
            scope="col"
            className={cn(
                'text-label text-text-muted px-5 py-3 select-none',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                className
            )}
            {...props}
        />
    )
);
TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
    align?: 'left' | 'center' | 'right';
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
    ({ className, align = 'left', ...props }, ref) => (
        <td
            ref={ref}
            className={cn(
                'text-table-value text-text px-5 py-3.5 align-middle',
                align === 'right' && 'text-right',
                align === 'center' && 'text-center',
                className
            )}
            {...props}
        />
    )
);
TableCell.displayName = 'TableCell';
