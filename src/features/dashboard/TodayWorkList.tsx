import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { TodayWorkItem } from './today-work';

const priority = ['overdue', 'today', 'outcomes', 'confirmations', 'restart', 'finance'];
export default function TodayWorkList({ items }: { items: TodayWorkItem[] }) {
    const outstanding = items.filter(item => item.count === null || item.count > 0)
        .sort((a, b) => priority.indexOf(a.key) - priority.indexOf(b.key));
    const clear = items.filter(item => item.count === 0);
    return <>
        {outstanding.length ? <ul className="mt-3 divide-y divide-border">{outstanding.map(item => <li key={item.key}>
            <Link href={item.href} className="flex min-h-16 items-center justify-between gap-4 py-3 text-sm hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                <span className="min-w-0"><span className="font-medium text-primary">{item.title}</span><span className="mt-0.5 block max-w-prose text-muted-foreground">{item.description}</span></span>
                <span className="flex shrink-0 items-center gap-3"><span className="font-semibold tabular-nums text-foreground">{item.count === null ? 'Review' : item.count}</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" /></span>
            </Link>
        </li>)}</ul> : <p className="mt-4 text-sm text-foreground">No outstanding items in the checks below.</p>}
        {clear.length > 0 && <details className="mt-3 border-t border-border pt-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{clear.length} {clear.length === 1 ? 'check' : 'checks'} with no outstanding items</summary>
            <ul className="mt-2 space-y-1">{clear.map(item => <li key={item.key}><Link href={item.href} className="flex min-h-11 items-center justify-between gap-3 text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><span>{item.title}</span><span className="text-muted-foreground">0</span></Link></li>)}</ul>
        </details>}
    </>;
}
