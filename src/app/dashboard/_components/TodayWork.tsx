import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTodayWork } from '@/features/dashboard/today-work';

export default async function TodayWork(props:{orgId:string;centreIds:string[];centreId:string;role:string}) {
    if (!['ORG_OWNER','MANAGER','FRONT_DESK'].includes(props.role)) return null;
    const result = await getTodayWork(props);
    return <section aria-labelledby="today-work-title" className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
        <h2 id="today-work-title" className="text-lg font-semibold text-foreground">Today’s work</h2>
        <p className="mt-1 text-sm text-muted-foreground">{props.centreId === 'all' ? 'Across your accessible centres.' : 'For the selected centre.'} Review each item; nothing is approved, issued or sent automatically.</p>
        {result.unavailable ? <p role="alert" className="mt-4 text-sm text-foreground">We couldn’t check your work list. Reload this page to try again; the counts are unavailable.</p> : !result.items.length ? <p className="mt-4 text-sm text-muted-foreground">No accessible centre is available for this work list.</p> : <ul className="mt-3 divide-y divide-border">{result.items.map(item=><li key={item.key}><Link href={item.href} className="flex min-h-16 items-center justify-between gap-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"><span className="min-w-0"><span className="font-medium text-primary">{item.title}</span><span className="mt-0.5 block text-muted-foreground">{item.description}</span></span><span className="flex shrink-0 items-center gap-3"><span className="font-semibold tabular-nums text-foreground">{item.count === null ? 'Open' : item.count}</span><ArrowRight aria-hidden="true" className="h-4 w-4 text-muted-foreground"/></span></Link></li>)}</ul>}
    </section>;
}
