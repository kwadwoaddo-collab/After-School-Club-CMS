'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { BillingCycleRow } from '@/features/billing/queries';
import { adjacentInvoices, buildFinanceQueues, inspectInvoice, type WorkspaceInvoice } from '../domain/finance-workspace';
import { formatInvoiceDate, formatInvoicePeriod } from '../domain/invoice-display';
import RecordPaymentModal from './RecordPaymentModal';

const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
type Tab = 'drafts' | 'payments' | 'attention';
type Item = ReturnType<typeof buildFinanceQueues>['drafts'][number];

function InvoiceContext({ invoice, today }: { invoice: WorkspaceInvoice; today: string }) {
    const state = inspectInvoice(invoice, today);
    return <div className="space-y-1 text-sm">
        <Link className={`font-semibold text-primary underline underline-offset-2 ${focus}`} href={`/dashboard/finance/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
        <p>{formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)}</p>
        <p className="text-muted-foreground">{!state.financialReliable ? 'Payment totals need checking' : invoice.status === 'draft' ? `${money(state.amount)} · Draft — not issued` : state.remaining === 0 ? `${money(state.paid)} paid` : `${money(state.remaining)} remaining`}</p>
    </div>;
}

export default function FinanceWorkspace({ invoices, cycles, today, invoiceError, cycleError }: {
    invoices: WorkspaceInvoice[]; cycles: BillingCycleRow[]; today: string; invoiceError: boolean; cycleError: boolean;
}) {
    const router = useRouter();
    const params = useSearchParams();
    const initial = params.get('task') === 'payments' || params.get('status') === 'overdue' ? 'payments' : params.get('task') === 'attention' ? 'attention' : 'drafts';
    const [tab, setTab] = useState<Tab>(initial);
    const [search, setSearch] = useState('');
    const [requestedPage, setPage] = useState(1);
    const [requestedUpcomingPage, setUpcomingPage] = useState(1);
    const [payment, setPayment] = useState<Item | null>(null);
    const [overdueOnly, setOverdueOnly] = useState(params.get('status') === 'overdue');
    const routeKey = `${initial}:${params.get('status') === 'overdue'}`;
    const [confirmedRoute, setConfirmedRoute] = useState(routeKey);
    // Acknowledge URL changes without remounting or discarding a search typed during navigation.
    // Back/forward still synchronizes the task and overdue filter.
    if (confirmedRoute !== routeKey) {
        setConfirmedRoute(routeKey);
        setTab(initial);
        if (tab !== initial || confirmedRoute.split(':')[0] === initial) setOverdueOnly(params.get('status') === 'overdue');
        if (tab !== initial) { setPage(1); setUpcomingPage(1); }
    }
    const queues = buildFinanceQueues(invoices, today);
    const problems = cycles.filter(cycle => ['needs_setup', 'data_review_required', 'draft_due', 'ready'].includes(cycle.cycleStatus));
    const centre = params.get('centre');
    const href = (view: string, parent?: string) => `/dashboard/finance?${new URLSearchParams({ ...(centre ? { centre } : {}), view, ...(parent ? { family: parent } : {}) })}`;
    const matches = (invoice: WorkspaceInvoice) => `${invoice.parent?.firstName ?? ''} ${invoice.parent?.lastName ?? ''} ${invoice.invoiceNumber}`.toLowerCase().includes(search.toLowerCase().trim());
    const current = queues.drafts.filter(item => !item.upcoming && matches(item.invoice));
    const upcoming = queues.drafts.filter(item => item.upcoming && matches(item.invoice));
    const outstanding = queues.payments.filter(item => matches(item.invoice) && (!overdueOnly || item.overdue));
    const page = Math.min(requestedPage, Math.max(1, Math.ceil((tab === 'payments' ? outstanding.length : current.length)/25)));
    const upcomingPage = Math.min(requestedUpcomingPage, Math.max(1, Math.ceil(upcoming.length/25)));
    const matchingAttention = queues.attention.filter(item => matches(item.invoice));
    const matchingProblems = problems.filter(cycle => cycle.familyName.toLowerCase().includes(search.toLowerCase().trim()));
    const changeTab = (value: Tab) => {
        setTab(value); setPage(1); setUpcomingPage(1); setOverdueOnly(false);
        const next = new URLSearchParams(params.toString());
        next.set('task', value); next.delete('status'); next.delete('page');
        router.replace(`/dashboard/finance?${next}` , { scroll: false });
    };
    const familyLink = (invoice: WorkspaceInvoice) => <Link className={`font-semibold text-primary hover:underline ${focus}`} href={`/dashboard/parents/${invoice.parentId}`}>{invoice.parent ? `${invoice.parent.firstName} ${invoice.parent.lastName}` : 'Open family'}</Link>;
    function row(item: Item, mode: 'draft' | 'payment') {
        const invoice = item.invoice;
        const adjacent = adjacentInvoices(invoice, invoices);
        const cycle = cycles.find(cycle => cycle.config.parentId === invoice.parentId && cycle.config.centreId === invoice.centreId && (!invoice.billingConfigId || cycle.config.id === invoice.billingConfigId));
        const nextSchedule = cycle?.periodStartStr && item.end && cycle.periodStartStr > item.end ? cycle : undefined;
        return <li key={invoice.id} className="px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">{familyLink(invoice)}<Link href={`/dashboard/finance/invoices/${invoice.id}`} className={`text-sm text-muted-foreground underline underline-offset-2 ${focus}`}>{invoice.invoiceNumber}</Link>{invoice.centre && <span className="text-xs text-muted-foreground">{invoice.centre.name}</span>}</div>
                    <p className="text-sm">{formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)} <span className="text-muted-foreground">· Due {formatInvoiceDate(invoice.dueDate)}</span></p>
                    <p className="text-xs text-muted-foreground">{mode === 'draft' ? `${item.historical ? 'Historical period' : item.upcoming ? 'Upcoming period' : 'Current period'} · Draft — not issued` : `${item.overdue ? 'Overdue' : 'Awaiting payment'}${item.paid > 0 ? ' · Part-paid' : ''}`}{item.pending ? ' · Payment pending verification' : ''}{item.reasons.length ? ' · Needs checking' : ''}</p>
                </div>
                <div className="text-right text-sm tabular-nums"><p className="font-semibold">{!item.amountValid ? 'Check amount' : money(mode === 'payment' ? item.remaining : item.amount)}</p><p className="text-xs text-muted-foreground">{mode === 'payment' ? 'remaining' : 'invoice total'}</p></div>
                {mode === 'payment' && <button onClick={() => setPayment(item)} className={`rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 ${focus}`} aria-label={`Record payment for ${invoice.invoiceNumber}`}>Record payment</button>}
            </div>
            {mode === 'draft' ? <details className="mt-2 group"><summary className={`cursor-pointer w-fit py-1 text-sm font-semibold text-primary ${focus}`}>Review invoice <span className="sr-only">{invoice.invoiceNumber}</span></summary>
                <div className="mt-2 space-y-3 border-t border-border pt-3">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <section><h3 className="text-sm font-semibold mb-1">Previous billed period</h3>{adjacent.previous ? <InvoiceContext invoice={adjacent.previous} today={today}/> : <p className="text-sm text-muted-foreground">No earlier non-void invoice recorded.</p>}</section>
                        <section><h3 className="text-sm font-semibold mb-1">This invoice</h3><InvoiceContext invoice={invoice} today={today}/></section>
                        <section><h3 className="text-sm font-semibold mb-1">Next invoice or schedule</h3>{adjacent.next ? <InvoiceContext invoice={adjacent.next} today={today}/> : nextSchedule ? <div className="text-sm space-y-1"><p>{nextSchedule.periodLabel}</p><p className="text-muted-foreground">No invoice yet{nextSchedule.nextInvoiceDateStr ? ` · Draft preparation ${formatInvoiceDate(nextSchedule.nextInvoiceDateStr)}` : ''}</p></div> : <p className="text-sm text-muted-foreground">No later invoice recorded. <Link className="text-primary underline" href={href('families', invoice.parentId)}>Check billing schedule</Link>.</p>}</section>
                    </div>
                    <p className="text-sm text-muted-foreground">Other issued balances for this family: {queues.attention.some(other => other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId && other.invoice.status !== 'draft' && !other.financialReliable) ? 'Needs checking' : money(queues.payments.filter(other => other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId).reduce((sum, other) => sum + other.remaining, 0))}. Drafts excluded.</p>
                    {item.reasons.length > 0 && <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Check before issuing: {item.reasons.join(' ')}</p>}
                    {item.upcoming && <p className="text-sm text-muted-foreground">This period has not started. Draft preparation is not an instruction to issue today.</p>}
                    <p className="text-sm text-muted-foreground">Check the covered children and fee on the invoice. Issuing is separate from downloading or sending it to the parent.</p>
                    <Link href={`/dashboard/finance/invoices/${invoice.id}`} className={`inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 ${focus}`}>Open draft to {item.reasons.length ? 'check details' : 'issue'}</Link>
                </div>
            </details> : <Link href={`/dashboard/finance/invoices/${invoice.id}`} className={`mt-1 inline-block text-xs text-primary underline ${focus}`}>View invoice and payment history</Link>}
        </li>;
    }
    return <section aria-label="Finance daily tasks" className="space-y-5">
        <nav aria-label="Finance tasks" className="flex flex-wrap gap-2 border-b border-border pb-3">
            {([['drafts', 'Drafts to review', queues.drafts.length], ['payments', 'Awaiting payment', queues.payments.length], ['attention', 'Needs attention', queues.attention.length + problems.length]] as const).map(([value, label, total]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => changeTab(value)} className={`rounded-xl px-4 py-3 text-sm font-semibold ${focus} ${tab === value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}>{label} <span className="ml-2 tabular-nums">{invoiceError || (value === 'attention' && cycleError) ? 'Unavailable' : total}</span></button>)}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-bold">{tab === 'drafts' ? 'Review before issuing' : tab === 'payments' ? 'Record money received' : 'Resolve billing problems'}</h2><p className="mt-1 text-sm text-muted-foreground">{tab === 'drafts' ? 'Check the billing period and amount. Upcoming drafts are listed separately below.' : tab === 'payments' ? 'Only record a payment when it has been received. Includes existing debts for paused or stopped students.' : 'Automatic draft preparation remains the normal process. Resolve exceptions here.'}</p></div>
            <label className="text-sm font-medium">Find family or invoice<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); setUpcomingPage(1); }} className="mt-1 block rounded-xl border border-border bg-card px-3 py-2 text-foreground" type="search"/></label>
        </div>
        {invoiceError || (tab === 'attention' && cycleError) ? <div role="alert" className="rounded-xl border border-border p-4"><p>Couldn’t check {tab === 'attention' ? 'all billing tasks' : 'invoices'}. No complete task count is available.</p><button className={`mt-2 text-primary underline ${focus}`} onClick={() => router.refresh()}>Retry</button></div> : <>
            {tab === 'drafts' && <>
                <h3 className="text-sm font-semibold">Current and historical periods · {current.length} invoice{current.length === 1 ? '' : 's'}</h3>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-card">{current.slice((page-1)*25,page*25).map(item => row(item, 'draft'))}{!current.length && <li className="p-5 text-sm text-muted-foreground">No current or historical drafts to review. Check upcoming periods below.</li>}</ul>
                {current.length > 25 && <Pagination page={page} total={current.length} onChange={setPage}/>}
                <details className="rounded-2xl border border-border bg-card"><summary className={`cursor-pointer p-4 font-semibold text-sm ${focus}`}>Upcoming periods · {upcoming.length} draft invoice{upcoming.length === 1 ? '' : 's'}</summary><p className="px-4 pb-3 text-sm text-muted-foreground">Prepared for future periods. Review when appropriate; there is no automatic issuance deadline.</p><ul className="divide-y divide-border">{upcoming.slice((upcomingPage-1)*25,upcomingPage*25).map(item => row(item, 'draft'))}{!upcoming.length && <li className="p-4 text-sm text-muted-foreground">No upcoming drafts recorded.</li>}</ul><div className="px-4"><Pagination page={upcomingPage} total={upcoming.length} onChange={setUpcomingPage}/></div></details>
            </>}
            {tab === 'payments' && <><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overdueOnly} onChange={event => {setOverdueOnly(event.target.checked);setPage(1);}}/>Overdue only</label><p className="text-sm text-muted-foreground">{outstanding.length} invoice{outstanding.length === 1 ? '' : 's'} · {money(outstanding.reduce((sum,item) => sum+item.remaining,0))} remaining across this selection. Counts include every page.</p><ul className="divide-y divide-border rounded-2xl border border-border bg-card">{outstanding.slice((page-1)*25,page*25).map(item => row(item, 'payment'))}{!outstanding.length && <li className="p-5 text-sm text-muted-foreground">No issued invoices with a verified outstanding balance match this selection.</li>}</ul><Pagination page={page} total={outstanding.length} onChange={setPage}/></>}
            {tab === 'attention' && <><p className="text-sm text-muted-foreground">{queues.attention.length} invoice{queues.attention.length === 1 ? '' : 's'} and {problems.length} billing configuration{problems.length === 1 ? '' : 's'} need checking. One family may have more than one item.</p><ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                {matchingAttention.map(item => <li key={item.invoice.id} className="p-4 space-y-1">{familyLink(item.invoice)}<p className="text-sm">{item.invoice.invoiceNumber} · {formatInvoicePeriod(item.invoice.billingPeriodStart,item.invoice.billingPeriodEnd)}</p><p className="text-sm text-muted-foreground">{item.reasons.join(' ')}</p><Link className={`inline-block py-2 text-sm font-semibold text-primary underline ${focus}`} href={`/dashboard/finance/invoices/${item.invoice.id}`}>Check invoice</Link></li>)}
                {matchingProblems.map(cycle => <li key={cycle.config.id} className="p-4 space-y-1"><Link className={`font-semibold text-primary hover:underline ${focus}`} href={`/dashboard/parents/${cycle.config.parentId}`}>{cycle.familyName}</Link><p className="text-sm text-muted-foreground">{cycle.cycleStatus === 'needs_setup' ? 'Billing fee or setup is missing.' : cycle.cycleStatus === 'data_review_required' ? 'Confirm registration and the children covered by the family fee.' : 'An eligible billing cycle has no prepared invoice. Check the schedule before preparing a draft.'}</p><Link className={`inline-block py-2 text-sm font-semibold text-primary underline ${focus}`} href={href('families',cycle.config.parentId)}>{cycle.cycleStatus === 'needs_setup' ? 'Complete billing setup' : 'Review billing schedule'}</Link></li>)}
                {!matchingAttention.length && !matchingProblems.length && <li className="p-5 text-sm text-muted-foreground">{search.trim() ? 'No billing problems match your search.' : 'No billing problems found in this centre.'}</li>}
            </ul></>}
        </>}
        {payment && <RecordPaymentModal invoiceId={payment.invoice.id} invoiceNumber={payment.invoice.invoiceNumber} remainingBalance={payment.remaining/100} billingContext={{parentId:payment.invoice.parentId,familyName:payment.invoice.parent ? `${payment.invoice.parent.firstName} ${payment.invoice.parent.lastName}` : 'Family account',period:formatInvoicePeriod(payment.invoice.billingPeriodStart,payment.invoice.billingPeriodEnd)}} onClose={() => setPayment(null)} onSuccess={() => {setPayment(null);router.refresh();}}/>}
    </section>;
}

function Pagination({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void}) {
    if (total <= 25) return null;
    return <nav aria-label="Task pages" className="flex items-center gap-4 text-sm"><button disabled={page<=1} onClick={()=>onChange(page-1)} className={`py-2 text-primary disabled:text-muted-foreground ${focus}`}>Previous</button><span>Page {page} of {Math.ceil(total/25)}</span><button disabled={page*25>=total} onClick={()=>onChange(page+1)} className={`py-2 text-primary disabled:text-muted-foreground ${focus}`}>Next</button></nav>;
}
