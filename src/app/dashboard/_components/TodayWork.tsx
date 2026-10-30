import TodayWorkList from '@/features/dashboard/TodayWorkList';
import { getTodayWork } from '@/features/dashboard/today-work';

export default async function TodayWork(props:{orgId:string;centreIds:string[];centreId:string;centreName?:string;role:string}) {
    if (!['ORG_OWNER','MANAGER','FRONT_DESK'].includes(props.role)) return null;
    const result = await getTodayWork(props);
    const scopeText = props.centreId === 'all'
        ? 'Across your accessible centres.'
        : props.centreName
            ? `For ${props.centreName}.`
            : 'For the selected centre.';
    return <section aria-labelledby="today-work-title" className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
        <h2 id="today-work-title" className="text-lg font-semibold text-foreground">Today’s work</h2>
        <p className="mt-1 text-sm text-muted-foreground">{scopeText} This live work list uses today’s date, independently of the weekly/monthly date filter. Nothing is approved, issued or sent automatically.</p>
        {result.unavailable ? <p role="alert" className="mt-4 text-sm text-foreground">We couldn’t check your work list. Reload this page to try again; the counts are unavailable.</p> : !result.items.length ? <p className="mt-4 text-sm text-muted-foreground">No accessible centre is available for this work list.</p> : <TodayWorkList items={result.items}/>}
    </section>;
}
