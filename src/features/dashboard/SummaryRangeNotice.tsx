import Link from 'next/link';
import type { SummaryRange } from './summary-links';
export default function SummaryRangeNotice({ range, basis, clearHref }: { range: SummaryRange | null; basis: string; clearHref: string }) {
    if (!range) return null;
    const format = (date: Date) => date.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'});
    return <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
        <p className="text-foreground"><strong>From dashboard:</strong> {basis} {format(range.from)} – {format(range.to)}. Other filters can narrow these results.</p>
        <Link href={clearHref} className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Show all dates</Link>
    </div>;
}
