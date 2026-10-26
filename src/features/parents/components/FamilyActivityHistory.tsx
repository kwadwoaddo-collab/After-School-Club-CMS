import Link from 'next/link';
import type { FamilyActivity } from '../domain/family-activity';
export function FamilyActivityHistory({events,unavailable=false}:{events:FamilyActivity[];unavailable?:boolean}) {
 return <details className="rounded-xl border border-border bg-card p-4 sm:p-5">
  <summary className="cursor-pointer text-base font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">Family activity history · {events.length} recorded events</summary>
  <p className="mt-3 max-w-prose text-sm text-muted-foreground">Newest first. Recorded dates and current statuses are labelled separately. This read-only history does not change invoices, payments or enrolment. Receipt downloads are available from the invoice payment history; downloading is not evidence that a receipt was sent.</p>
  {unavailable&&<p role="status" className="mt-3 text-sm text-foreground">Some assessment, registration or follow-up records could not be loaded. Existing financial records remain below; refresh to try again.</p>}
  {!events.length?<p className="mt-4 text-sm text-muted-foreground">No dated activity is available for this family.</p>:<ol className="mt-4 max-h-[36rem] overflow-y-auto divide-y divide-border" aria-label="Family activity events">{events.map(event=><li key={event.id} className="py-3 first:pt-0">
   <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-medium text-foreground">{event.title}</span><time className="text-xs text-muted-foreground tabular-nums" dateTime={event.at}>{new Date(event.at).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})} UK</time></div>
   {event.children.length>0&&<p className="mt-1 flex flex-wrap gap-x-3 text-sm">{event.children.map(child=><Link key={child.id} href={`/dashboard/students/${child.id}`} className="text-primary hover:underline">{child.name}</Link>)}</p>}
   <p className="mt-1 break-words text-sm text-muted-foreground">{event.detail}</p>
   {event.href&&<Link className="mt-1 inline-flex min-h-8 items-center text-sm font-medium text-primary hover:underline" href={event.href}>View source record<span className="sr-only">: {event.title}</span></Link>}
  </li>)}</ol>}
 </details>;
}
