'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Download, Search, SlidersHorizontal, X } from 'lucide-react';
import type { BillingCycleRow } from '@/features/billing/queries';
import { adjacentInvoices, buildFinanceQueues, inspectInvoice, splitDraftPeriods, type WorkspaceInvoice } from '../domain/finance-workspace';
import { financeWorkspaceCsv } from '../domain/finance-workspace-export';
import { formatInvoiceDate, formatInvoicePeriod } from '../domain/invoice-display';
import RecordPaymentModal from './RecordPaymentModal';

const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const cell = 'block p-0! md:table-cell md:px-3! md:py-3! md:align-middle';
const control = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-secondary ${focus}`;
type Tab = 'drafts' | 'payments' | 'attention';
type Item = ReturnType<typeof buildFinanceQueues>['drafts'][number];

function InvoiceContext({ invoice, today }: { invoice: WorkspaceInvoice; today: string }) {
    const state = inspectInvoice(invoice, today);
    return <div className="space-y-1 text-sm">
        <Link className={`font-medium text-primary underline-offset-2 hover:underline ${focus}`} href={`/dashboard/finance/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
        <p>{formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)}</p>
        <p className={state.financialReliable && state.remaining === 0 && invoice.status !== 'draft' ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>
            {!state.financialReliable ? 'Payment totals need checking' : invoice.status === 'draft' ? `${money(state.amount)} · Not issued` : state.remaining === 0 ? `Paid ${money(state.paid)}` : `${money(state.remaining)} remaining`}
        </p>
    </div>;
}

function coveredStudents(invoice: WorkspaceInvoice) {
    if (Array.isArray(invoice.coveredChildrenJson)) {
        return invoice.coveredChildrenJson.flatMap(value => {
            if (!value || typeof value !== 'object') return [];
            const item = value as Record<string, unknown>;
            const name = typeof item.name === 'string' ? item.name : [item.firstName,item.lastName].filter(part => typeof part === 'string').join(' ');
            return typeof item.id === 'string' && name ? [{id:item.id,name}] : [];
        });
    }
    return invoice.child ? [{id:invoice.child.id,name:`${invoice.child.firstName} ${invoice.child.lastName}`}] : [];
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
    const [requestedHistoricalPage, setHistoricalPage] = useState(1);
    const [payment, setPayment] = useState<Item | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [checksOnly, setChecksOnly] = useState(false);
    const [overdueOnly, setOverdueOnly] = useState(params.get('status') === 'overdue');
    const routeKey = `${initial}:${params.get('status') === 'overdue'}`;
    const [confirmedRoute, setConfirmedRoute] = useState(routeKey);
    // Preserve a search or filter typed while the task URL is being acknowledged.
    if (confirmedRoute !== routeKey) {
        setConfirmedRoute(routeKey);
        setTab(initial);
        if (tab !== initial || confirmedRoute.split(':')[0] === initial) setOverdueOnly(params.get('status') === 'overdue');
        if (tab !== initial) { setPage(1); setUpcomingPage(1); setHistoricalPage(1); setExpanded(null); }
    }
    const queues = buildFinanceQueues(invoices, today);
    const periods = splitDraftPeriods(queues.drafts);
    const problems = cycles.filter(cycle => ['needs_setup', 'data_review_required', 'draft_due', 'ready'].includes(cycle.cycleStatus));
    const centre = params.get('centre');
    const href = (view: string, parent?: string) => `/dashboard/finance?${new URLSearchParams({ ...(centre ? { centre } : {}), view, ...(parent ? { family: parent } : {}) })}`;
    const matches = (invoice: WorkspaceInvoice) => `${invoice.parent?.firstName ?? ''} ${invoice.parent?.lastName ?? ''} ${invoice.invoiceNumber}`.toLowerCase().includes(search.toLowerCase().trim());
    const matchesItem = (item: Item) => matches(item.invoice) && (!checksOnly || item.reasons.length > 0);
    const current = periods.current.filter(matchesItem);
    const upcoming = periods.upcoming.filter(matchesItem);
    const historical = periods.historical.filter(matchesItem);
    const missingPeriods = periods.needsChecking.filter(matchesItem);
    const outstanding = queues.payments.filter(item => matchesItem(item) && (!overdueOnly || item.overdue));
    const page = Math.min(requestedPage, Math.max(1, Math.ceil((tab === 'payments' ? outstanding.length : current.length)/25)));
    const upcomingPage = Math.min(requestedUpcomingPage, Math.max(1, Math.ceil(upcoming.length/25)));
    const historicalPage = Math.min(requestedHistoricalPage, Math.max(1, Math.ceil(historical.length/25)));
    const matchingAttention = queues.attention.filter(item => matches(item.invoice));
    const matchingProblems = problems.filter(cycle => cycle.familyName.toLowerCase().includes(search.toLowerCase().trim()));
    const resetPages = () => { setPage(1); setUpcomingPage(1); setHistoricalPage(1); };
    const changeTab = (value: Tab) => {
        setTab(value); resetPages(); setOverdueOnly(false); setChecksOnly(false); setExpanded(null);
        const next = new URLSearchParams(params.toString());
        next.set('task', value); next.delete('status'); next.delete('page');
        router.replace(`/dashboard/finance?${next}`, { scroll: false });
    };
    const familyLink = (invoice: WorkspaceInvoice) => <Link className={`block truncate font-medium text-primary hover:underline ${focus}`} title={invoice.parent ? `${invoice.parent.firstName} ${invoice.parent.lastName}` : 'Family account'} href={`/dashboard/parents/${invoice.parentId}`}>{invoice.parent ? `${invoice.parent.firstName} ${invoice.parent.lastName}` : 'Open family'}</Link>;
    const exportRows = () => {
        const rows = tab === 'payments' ? outstanding : queues.drafts.filter(matchesItem);
        const url = URL.createObjectURL(new Blob([financeWorkspaceCsv(rows)], {type:'text/csv;charset=utf-8;'}));
        const link = document.createElement('a');
        link.href = url; link.download = `finance-${tab}-${today}.csv`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    function closeReview(id: string) {
        setExpanded(null);
        document.getElementById(`review-${id}`)?.focus();
    }
    function review(item: Item) {
        const invoice = item.invoice;
        const adjacent = adjacentInvoices(invoice, invoices);
        const cycle = cycles.find(cycle => cycle.config.parentId === invoice.parentId && cycle.config.centreId === invoice.centreId && (!invoice.billingConfigId || cycle.config.id === invoice.billingConfigId));
        const nextSchedule = cycle?.periodStartStr && item.end && cycle.periodStartStr > item.end ? cycle : undefined;
        const students = coveredStudents(invoice);
        return <section aria-label={`Invoice review ${invoice.invoiceNumber}`} className="space-y-4 bg-secondary/35 px-4 py-5 md:px-6">
            <div className="grid gap-4 md:grid-cols-3 md:divide-x md:divide-border">
                <section><h4 className="mb-2 text-sm font-semibold">Previous invoice</h4>{adjacent.previous ? <InvoiceContext invoice={adjacent.previous} today={today}/> : <p className="text-sm text-muted-foreground">No earlier non-void invoice recorded.</p>}</section>
                <section className="md:pl-5"><h4 className="mb-2 text-sm font-semibold">This draft</h4><InvoiceContext invoice={invoice} today={today}/></section>
                <section className="md:pl-5"><h4 className="mb-2 text-sm font-semibold">Next cycle</h4>{adjacent.next ? <InvoiceContext invoice={adjacent.next} today={today}/> : nextSchedule ? <div className="space-y-1 text-sm"><p>{nextSchedule.periodLabel}</p><p className="text-muted-foreground">No invoice yet{nextSchedule.nextInvoiceDateStr ? ` · Draft preparation ${formatInvoiceDate(nextSchedule.nextInvoiceDateStr)}` : ''}</p></div> : <p className="text-sm text-muted-foreground">No later invoice recorded. <Link className="text-primary underline" href={href('families', invoice.parentId)}>Check billing schedule</Link>.</p>}</section>
            </div>
            <div className="space-y-2 border-t border-border pt-3 text-sm">
                <p>Students: {students.length ? students.map((student,index) => <Fragment key={student.id}>{index > 0 && ' · '}<Link className={`text-primary hover:underline ${focus}`} href={`/dashboard/students/${student.id}`}>{student.name}</Link></Fragment>) : <Link href={`/dashboard/finance/invoices/${invoice.id}`} className="text-primary underline">Check covered students on the invoice</Link>}</p>
                <p>Other issued balances: <span className="font-semibold tabular-nums">{queues.attention.some(other => other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId && other.invoice.status !== 'draft' && !other.financialReliable) ? 'Needs checking' : money(queues.payments.filter(other => other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId).reduce((sum, other) => sum + other.remaining, 0))}</span><span className="text-muted-foreground"> · Drafts excluded</span></p>
                {invoice.createdAt && <p className="text-muted-foreground">Created {formatInvoiceDate(invoice.createdAt)} · Covers {formatInvoicePeriod(invoice.billingPeriodStart,invoice.billingPeriodEnd)}</p>}
            </div>
            {item.reasons.length > 0 && <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Check before issuing: {item.reasons.join(' ')}</p>}
            {item.historical && <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Historical billing period. Confirm it was genuinely unbilled before issuing; old draft records are preserved.</p>}
            {item.upcoming && <p className="text-sm text-muted-foreground">This period has not started. Draft preparation is not an instruction to issue today.</p>}
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
                <p className="max-w-lg text-sm text-muted-foreground">Check the period, fee and covered children. Issuing is separate from downloading or sending to a parent.</p>
                <div className="flex items-center gap-3"><button className={`min-h-10 text-sm text-primary ${focus}`} onClick={() => closeReview(invoice.id)}>Close review</button><div><Link href={`/dashboard/finance/invoices/${invoice.id}`} className={`inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 ${focus}`}>Open draft to {item.reasons.length ? 'check details' : 'issue'}</Link><p className="mt-1 text-xs text-muted-foreground">Separate confirmation before issuance</p></div></div>
            </div>
        </section>;
    }
    function table(items: Item[], mode: 'draft' | 'payment', label: string, empty: string) {
        const paymentMode = mode === 'payment';
        const columns = paymentMode ? 7 : 6;
        return <div className="min-w-0 border-y border-border">
            <table role="table" aria-label={label} className="block w-full text-left text-sm md:table md:table-fixed">
                <thead className="sr-only md:not-sr-only md:table-header-group"><tr>{['Family','Billing period','Invoice',paymentMode ? 'Total / remaining' : 'Amount',...(paymentMode ? ['Due'] : []),'Status','Action'].map((heading,index) => <th key={heading} scope="col" className={`px-3 py-3 font-medium text-muted-foreground ${index === 1 ? 'md:w-[23%]' : heading === 'Action' ? 'md:w-[17%]' : ''}`}>{heading}</th>)}</tr></thead>
                <tbody className="block md:table-row-group">
                    {items.map(item => {
                        const invoice = item.invoice;
                        const isExpanded = expanded === invoice.id;
                        const state = paymentMode ? item.overdue ? 'Overdue' : item.paid > 0 ? 'Part-paid' : 'Awaiting payment' : 'Draft';
                        return <Fragment key={invoice.id}>
                            <tr role="row" className="grid grid-cols-2 items-center gap-x-3 gap-y-2 border-t border-border px-3 py-4 md:table-row md:p-0">
                                <td role="cell" className={`${cell} min-w-0`}>{familyLink(invoice)}{invoice.centre && <span className="block truncate text-xs text-muted-foreground">{invoice.centre.name}</span>}</td>
                                <td role="cell" className={`${cell} col-start-1 row-start-2 md:whitespace-nowrap`}>{formatInvoicePeriod(invoice.billingPeriodStart,invoice.billingPeriodEnd)}<span className="block text-xs text-muted-foreground md:hidden">Due {formatInvoiceDate(invoice.dueDate)}</span></td>
                                <td role="cell" className={`${cell} col-start-2 row-start-1 text-right md:text-left`}><Link className={`text-muted-foreground underline-offset-2 hover:text-primary hover:underline ${focus}`} href={`/dashboard/finance/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></td>
                                <td role="cell" className={`${cell} col-start-1 row-start-3 tabular-nums`}><span className={paymentMode ? 'block text-xs text-muted-foreground' : 'font-medium'}>{item.amountValid ? money(item.amount) : 'Check amount'}{paymentMode && <span className="md:sr-only"> total</span>}</span>{paymentMode && <strong className="block font-semibold">{money(item.remaining)} <span className="text-xs font-normal">remaining</span></strong>}</td>
                                {paymentMode && <td role="cell" className={`${cell} hidden whitespace-nowrap md:table-cell`}>{formatInvoiceDate(invoice.dueDate)}</td>}
                                <td role="cell" className={`${cell} col-start-2 row-start-2 text-right md:text-left`}><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.overdue && paymentMode ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'bg-secondary text-foreground'}`}>{state}</span>{item.pending && <span className="mt-1 block text-xs text-muted-foreground">Payment pending</span>}{item.reasons.length > 0 && <span className="mt-1 block text-xs font-medium text-amber-800 dark:text-amber-200">Needs checking</span>}</td>
                                <td role="cell" className={`${cell} col-start-2 row-start-3 text-right md:text-left`}>{paymentMode ? <button onClick={() => setPayment(item)} className={`inline-flex min-h-10 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 ${focus}`} aria-label={`Record payment for ${invoice.invoiceNumber}`}>Record payment</button> : <button id={`review-${invoice.id}`} aria-controls={`context-${invoice.id}`} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide review for' : 'Review invoice'} ${invoice.invoiceNumber}`} onClick={() => setExpanded(isExpanded ? null : invoice.id)} className={`inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary ${focus}`}>{isExpanded ? 'Hide review' : 'Review invoice'}<ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 ${isExpanded ? 'rotate-180' : ''}`}/></button>}</td>
                            </tr>
                            {!paymentMode && isExpanded && <tr className="block md:table-row"><td id={`context-${invoice.id}`} colSpan={columns} className="block p-0! md:table-cell">{review(item)}</td></tr>}
                        </Fragment>;
                    })}
                    {!items.length && <tr className="block md:table-row"><td colSpan={columns} className="block px-3 py-6 text-sm text-muted-foreground md:table-cell">{empty}</td></tr>}
                </tbody>
            </table>
        </div>;
    }
    return <section aria-label="Finance daily tasks" className="min-w-0 space-y-5">
        <nav aria-label="Finance tasks" className="grid grid-cols-3 gap-1 border-b border-border md:flex md:gap-2">
            {([['drafts', 'Drafts to review', periods.current.length], ['payments', 'Awaiting payment', queues.payments.length], ['attention', 'Needs attention', queues.attention.length + problems.length]] as const).map(([value,label,total]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => changeTab(value)} className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium sm:px-2 sm:text-sm md:justify-start md:whitespace-nowrap ${focus} ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}{' '}<span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${tab === value ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground'}`}>{invoiceError || (value === 'attention' && cycleError) ? 'Unavailable' : total}</span></button>)}
        </nav>
        <div className="space-y-4">
            <div><h2 className="sr-only">{tab === 'drafts' ? 'Review before issuing' : tab === 'payments' ? 'Record money received' : 'Resolve billing problems'}</h2><p className="text-sm text-muted-foreground">{tab === 'drafts' ? 'Current periods only. Upcoming and historical drafts are separate below.' : tab === 'payments' ? 'Record a payment only after money has been received. Paused and stopped students’ existing debts are included.' : 'Resolve billing setup problems and invoice details that need checking.'}</p></div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="relative block w-full sm:max-w-md"><span className="sr-only">Find family or invoice</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input value={search} placeholder="Find family or invoice" onChange={event => {setSearch(event.target.value);resetPages();}} className={`h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground ${focus}`} type="search"/></label>
                <div className="flex flex-wrap items-center gap-3">
                    {tab === 'payments' && <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={overdueOnly} onChange={event => {setOverdueOnly(event.target.checked);setPage(1);}}/>Overdue only</label>}
                    {tab !== 'attention' && <><details className="relative"><summary className={`${control} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}><SlidersHorizontal aria-hidden="true" className="h-4 w-4"/>Filter{checksOnly && <span className="text-primary">1</span>}</summary><div className="absolute right-0 top-12 z-20 w-52 rounded-lg border border-border bg-card p-4 shadow-lg"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checksOnly} onChange={event => {setChecksOnly(event.target.checked);resetPages();}}/>Needs checking only</label></div></details><button onClick={exportRows} disabled={invoiceError} className={`${control} disabled:opacity-50`} aria-label={tab === 'drafts' ? 'Export matching drafts, including upcoming and historical' : 'Export matching outstanding invoices'}><Download aria-hidden="true" className="h-4 w-4"/>Export</button></>}
                    {(search || checksOnly || overdueOnly) && <button className={`inline-flex min-h-10 items-center gap-1 text-sm text-primary ${focus}`} onClick={() => {setSearch('');setChecksOnly(false);setOverdueOnly(false);resetPages();}}><X aria-hidden="true" className="h-3.5 w-3.5"/>Clear filters</button>}
                </div>
            </div>
        </div>
        {invoiceError || (tab === 'attention' && cycleError) ? <div role="alert" className="rounded-lg border border-border p-4"><p>Couldn’t check {tab === 'attention' ? 'all billing tasks' : 'invoices'}. No complete task count is available.</p><button className={`mt-2 text-primary underline ${focus}`} onClick={() => router.refresh()}>Retry</button></div> : <>
            {tab === 'drafts' && <>
                {missingPeriods.length > 0 && <p className="text-sm text-muted-foreground">{missingPeriods.length} draft{missingPeriods.length === 1 ? '' : 's'} with missing or invalid periods held in <button className={`min-h-10 font-medium text-primary underline ${focus}`} onClick={() => changeTab('attention')}>Needs attention</button>. They remain in the drafts export.</p>}
                <div><h3 className="mb-2 text-sm font-medium text-muted-foreground">Current billing periods · {current.length} invoice{current.length === 1 ? '' : 's'}</h3>{table(current.slice((page-1)*25,page*25),'draft','Current draft invoices','No current-period drafts match this selection. Upcoming and historical drafts are below.')}<Pagination page={page} total={current.length} onChange={setPage}/></div>
                <details className="group border-b border-border"><summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden ${focus}`}><ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 group-open:rotate-0"/>Upcoming periods · {upcoming.length} draft invoice{upcoming.length === 1 ? '' : 's'}</summary><p className="pb-3 text-sm text-muted-foreground">Prepared for future periods. Review when appropriate; preparation is not an issuance deadline.</p>{table(upcoming.slice((upcomingPage-1)*25,upcomingPage*25),'draft','Upcoming draft invoices','No upcoming drafts match this selection.')}<Pagination page={upcomingPage} total={upcoming.length} onChange={setUpcomingPage}/></details>
                <details className="group border-b border-border"><summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden ${focus}`}><ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 group-open:rotate-0"/>Historical drafts to check · {historical.length}</summary><p className="pb-3 text-sm text-muted-foreground">Old drafts require review before issuing. Confirm the period was genuinely unbilled; no records have been deleted.</p>{table(historical.slice((historicalPage-1)*25,historicalPage*25),'draft','Historical draft invoices','No historical drafts match this selection.')}<Pagination page={historicalPage} total={historical.length} onChange={setHistoricalPage}/></details>
            </>}
            {tab === 'payments' && <><p className="text-sm text-muted-foreground">{outstanding.length} invoice{outstanding.length === 1 ? '' : 's'} · {money(outstanding.reduce((sum,item) => sum+item.remaining,0))} remaining across this selection. Counts include every page.</p>{table(outstanding.slice((page-1)*25,page*25),'payment','Outstanding invoices','No issued invoices with a verified outstanding balance match this selection.')}<Pagination page={page} total={outstanding.length} onChange={setPage}/><p className="text-sm text-muted-foreground">Family, invoice and billing period are shown again before a payment is recorded. Open an invoice number for its payment history.</p></>}
            {tab === 'attention' && <><p className="text-sm text-muted-foreground">{queues.attention.length} invoice{queues.attention.length === 1 ? '' : 's'} and {problems.length} billing configuration{problems.length === 1 ? '' : 's'} need checking. A family can have more than one item.</p><ul className="divide-y divide-border border-y border-border">
                {matchingAttention.map(item => <li key={item.invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1">{familyLink(item.invoice)}<p className="mt-1 text-sm">{item.invoice.invoiceNumber} · {formatInvoicePeriod(item.invoice.billingPeriodStart,item.invoice.billingPeriodEnd)}</p><p className="mt-1 text-sm text-muted-foreground">{item.reasons.join(' ')}</p></div><Link className={`inline-flex min-h-10 items-center text-sm font-medium text-primary ${focus}`} href={`/dashboard/finance/invoices/${item.invoice.id}`}>Check invoice</Link></li>)}
                {matchingProblems.map(cycle => <li key={cycle.config.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><Link className={`font-medium text-primary hover:underline ${focus}`} href={`/dashboard/parents/${cycle.config.parentId}`}>{cycle.familyName}</Link><p className="mt-1 text-sm text-muted-foreground">{cycle.cycleStatus === 'needs_setup' ? 'Billing fee or setup is missing.' : cycle.cycleStatus === 'data_review_required' ? 'Confirm registration and the children covered by the family fee.' : 'An eligible billing cycle has no prepared invoice. Check the schedule before preparing a draft.'}</p></div><Link className={`inline-flex min-h-10 items-center text-sm font-medium text-primary ${focus}`} href={href('families',cycle.config.parentId)}>{cycle.cycleStatus === 'needs_setup' ? 'Complete billing setup' : 'Review billing schedule'}</Link></li>)}
                {!matchingAttention.length && !matchingProblems.length && <li className="py-6 text-sm text-muted-foreground">{search.trim() ? 'No billing problems match your search.' : 'No billing problems found in this centre.'}</li>}
            </ul></>}
        </>}
        {payment && <RecordPaymentModal invoiceId={payment.invoice.id} invoiceNumber={payment.invoice.invoiceNumber} remainingBalance={payment.remaining/100} billingContext={{parentId:payment.invoice.parentId,familyName:payment.invoice.parent ? `${payment.invoice.parent.firstName} ${payment.invoice.parent.lastName}` : 'Family account',period:formatInvoicePeriod(payment.invoice.billingPeriodStart,payment.invoice.billingPeriodEnd)}} onClose={() => setPayment(null)} onSuccess={() => {setPayment(null);router.refresh();}}/>}
    </section>;
}

function Pagination({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void}) {
    if (!total) return null;
    return <nav aria-label="Task pages" className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-muted-foreground"><span>Showing {(page-1)*25+1}–{Math.min(page*25,total)} of {total} invoices</span>{total > 25 && <div className="flex items-center gap-4"><button disabled={page<=1} onClick={()=>onChange(page-1)} className={`min-h-10 text-primary disabled:text-muted-foreground ${focus}`}>Previous</button><span>Page {page} of {Math.ceil(total/25)}</span><button disabled={page*25>=total} onClick={()=>onChange(page+1)} className={`min-h-10 text-primary disabled:text-muted-foreground ${focus}`}>Next</button></div>}</nav>;
}
