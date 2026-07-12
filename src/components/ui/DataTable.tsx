'use client';

import { ReactNode } from 'react';
import { cn } from './utils';

/* ------------------------------------------------------------------ */
/*  Column Definition                                                  */
/* ------------------------------------------------------------------ */

export interface DataTableColumn<T> {
  /** Unique key for the column – used as the React key */
  key: string;
  /** Column header label */
  header: string;
  /** Render the cell content for a given row */
  render: (row: T, index: number) => ReactNode;
  /** Optional header alignment (default: "left") */
  headerAlign?: 'left' | 'center' | 'right';
  /** Optional header className override */
  headerClassName?: string;
  /** Optional cell className override */
  cellClassName?: string;
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row data array */
  data: T[];
  /** Unique key extractor for each row */
  rowKey: (row: T) => string;

  /* ── Empty / Loading states ────────────────────────────────────── */
  /** Rendered when data is empty and isLoading is false */
  emptyState?: ReactNode;
  /** If true, shows the loading skeleton instead of data or empty state */
  isLoading?: boolean;
  /** Number of skeleton rows to show while loading (default: 5) */
  loadingRows?: number;

  /* ── Visual customisation ──────────────────────────────────────── */
  /** Additional className for the outermost wrapper */
  className?: string;
  /** Additional className for the <table> element */
  tableClassName?: string;
  /** Additional className applied to every <tr> in the body */
  rowClassName?: string | ((row: T) => string);
  /** onClick handler for row clicks */
  onRowClick?: (row: T) => void;

  /* ── Caption / summary ─────────────────────────────────────────── */
  /** Accessible caption (visually hidden) for screen readers */
  caption?: string;
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton row                                               */
/* ------------------------------------------------------------------ */

function SkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columnCount }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 rounded-lg bg-surface-container-low/50 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Default empty state                                                */
/* ------------------------------------------------------------------ */

function DefaultEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center mb-4 text-3xl">
        📭
      </div>
      <h3 className="text-white font-semibold mb-2">No data found</h3>
      <p className="text-on-surface-variant text-sm max-w-sm">
        There are no records to display. Try adjusting your filters or adding new items.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DataTable                                                          */
/* ------------------------------------------------------------------ */

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyState,
  isLoading = false,
  loadingRows = 5,
  className,
  tableClassName,
  rowClassName,
  onRowClick,
  caption,
}: DataTableProps<T>) {
  /* ── Loading state ────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div
        className={cn(
          'glassmorphic-card rounded-[32px] overflow-hidden',
          className
        )}
      >
        <div className="overflow-x-auto">
          <table className={cn('w-full', tableClassName)}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider',
                      col.headerAlign === 'right' ? 'text-right' : col.headerAlign === 'center' ? 'text-center' : 'text-left',
                      col.headerClassName
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {Array.from({ length: loadingRows }).map((_, i) => (
                <SkeletonRow key={i} columnCount={columns.length} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ── Empty state ──────────────────────────────────────────────── */
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'glassmorphic-card rounded-[32px] overflow-hidden bg-card border border-border shadow-sm',
          className
        )}
      >
        {emptyState ?? <DefaultEmptyState />}
      </div>
    );
  }

  /* ── Table ────────────────────────────────────────────────────── */
  return (
    <div
      className={cn(
        'glassmorphic-card rounded-[32px] overflow-hidden data-grid-optimized border border-border shadow-sm',
        className
      )}
    >
      <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto relative scrollbar-thin">
        <table className={cn('w-full', tableClassName)}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'sticky top-0 z-10 bg-card border-b border-border px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none',
                    col.headerAlign === 'right' ? 'text-right' : col.headerAlign === 'center' ? 'text-center' : 'text-left',
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 bg-card/45">
            {data.map((row, index) => {
              const key = rowKey(row);
              const rowCls =
                typeof rowClassName === 'function'
                  ? rowClassName(row)
                  : rowClassName;

              return (
                <tr
                  key={key}
                  className={cn(
                    'hover:bg-secondary/40 transition-colors',
                    onRowClick && 'cursor-pointer',
                    rowCls
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-6 py-4 text-foreground/90 font-medium text-sm', col.cellClassName)}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
