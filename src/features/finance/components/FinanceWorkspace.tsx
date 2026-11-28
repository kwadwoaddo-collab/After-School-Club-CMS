'use client';
import { WhatsAppCopyActions } from '@/components/whatsapp/WhatsAppCopyActions';
import { buildInvoiceWhatsAppMessage } from '@/lib/whatsapp';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    CalendarClock,
    CheckCircle2,
    ChevronDown,
    Clock,
    Download,
    Search,
    SlidersHorizontal,
    X,
} from 'lucide-react';
import type { BillingCycleRow } from '@/features/billing/queries';
import { adjacentInvoices, buildFinanceQueues, inspectInvoice, splitDraftPeriods, type WorkspaceInvoice } from '../domain/finance-workspace';
import { financeWorkspaceCsv } from '../domain/finance-workspace-export';
import { COLLECTION_STAGE_STYLES } from '../domain/invoice-collection-state';
import { formatInvoiceDate, formatInvoicePeriod, formatPaidDate } from '../domain/invoice-display';
import RecordPaymentModal from './RecordPaymentModal';

const money = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const cell = 'block p-0! md:table-cell md:px-3! md:py-3! md:align-middle';
const control = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-secondary ${focus}`;
type Tab = 'drafts' | 'payments' | 'attention';
type PaymentStageFilter = 'all' | 'overdue' | 'in_period' | 'upcoming';
type Item = ReturnType<typeof buildFinanceQueues>['drafts'][number];

function parseStageFilter(status: string | null): PaymentStageFilter {
    return status === 'overdue' || status === 'in_period' || status === 'upcoming' ? status : 'all';
}

function paymentStageMeta(item: Item) {
    switch (item.collectionStage) {
        case 'overdue': {
            const label = item.paid > 0 ? 'Overdue · Part-paid' : item.start && item.end ? 'Overdue · Past period' : 'Overdue';
            return {
                cardLabel: label,
                badgeLabel: label,
                Icon: AlertTriangle,
                textClass: COLLECTION_STAGE_STYLES.overdue.text,
                badgeClass: COLLECTION_STAGE_STYLES.overdue.badge,
            };
        }
        case 'in_period': {
            const label = item.paid > 0 ? 'In period · Part-paid' : item.start && item.end ? 'In period · Due' : 'Due today';
            return {
                cardLabel: label,
                badgeLabel: label,
                Icon: Clock,
                textClass: COLLECTION_STAGE_STYLES.in_period.text,
                badgeClass: COLLECTION_STAGE_STYLES.in_period.badge,
            };
        }
        case 'upcoming':
            return {
                cardLabel: item.paid > 0 ? 'Upcoming · Part-paid' : 'Upcoming · Issued in advance',
                badgeLabel: item.paid > 0 ? 'Upcoming · Part-paid' : 'Upcoming',
                Icon: CalendarClock,
                textClass: COLLECTION_STAGE_STYLES.upcoming.text,
                badgeClass: COLLECTION_STAGE_STYLES.upcoming.badge,
            };
        default:
            return {
                cardLabel: 'Needs checking',
                badgeLabel: 'Needs checking',
                Icon: AlertTriangle,
                textClass: COLLECTION_STAGE_STYLES.needs_checking.text,
                badgeClass: COLLECTION_STAGE_STYLES.needs_checking.badge,
            };
    }
}

function InvoiceContext({ invoice, today }: { invoice: WorkspaceInvoice; today: string }) {
    const state = inspectInvoice(invoice, today);
    const paidInFull = state.financialReliable && state.remaining === 0 && invoice.status !== 'draft';
    const paidDate = paidInFull ? formatPaidDate(invoice.payments) : null;
    return <div className="space-y-1 text-sm">
        <Link className={`font-medium text-primary underline-offset-2 hover:underline ${focus}`} href={`/dashboard/finance/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
        <p>{formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)}</p>
        {!state.financialReliable ? (
            <p className={`inline-flex items-center gap-1.5 font-medium ${COLLECTION_STAGE_STYLES.needs_checking.text}`}><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>Payment totals need checking</p>
        ) : invoice.status === 'draft' ? (
            <p className="tabular-nums text-muted-foreground">{money(state.amount)} · Not issued</p>
        ) : paidInFull ? (
            <p className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.paid.text}`}><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`Paid ${money(state.paid)}${paidDate ? ` (${paidDate})` : ''}`}</p>
        ) : state.collectionStage === 'overdue' ? (
            <p className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.overdue.text}`}><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`Overdue · ${money(state.remaining)} remaining`}</p>
        ) : state.collectionStage === 'in_period' ? (
            <p className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.in_period.text}`}><Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`In period · ${money(state.remaining)} remaining`}</p>
        ) : state.collectionStage === 'upcoming' ? (
            <p className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.upcoming.text}`}><CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`Upcoming · ${money(state.remaining)} remaining`}</p>
        ) : (
            <p className="tabular-nums text-muted-foreground">{`${money(state.remaining)} remaining`}</p>
        )}
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
    const urlStageFilter = parseStageFilter(params.get('status'));
    const initial: Tab = params.get('task') === 'payments' || urlStageFilter !== 'all' ? 'payments' : params.get('task') === 'attention' ? 'attention' : 'drafts';
    const [tab, setTab] = useState<Tab>(initial);
    const [presentation, setPresentation] = useState<'cards' | 'table'>('cards');
    const [search, setSearch] = useState('');
    const [requestedPage, setPage] = useState(1);
    const [requestedUpcomingPage, setUpcomingPage] = useState(1);
    const [requestedHistoricalPage, setHistoricalPage] = useState(1);
    const [payment, setPayment] = useState<Item | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [checksOnly, setChecksOnly] = useState(false);
    const [stageFilter, setStageFilter] = useState<PaymentStageFilter>(urlStageFilter);
    const routeKey = `${initial}:${urlStageFilter}`;
    const [confirmedRoute, setConfirmedRoute] = useState(routeKey);
    // Preserve a search or filter typed while the task URL is being acknowledged.
    if (confirmedRoute !== routeKey) {
        setConfirmedRoute(routeKey);
        setTab(initial);
        if (tab !== initial || confirmedRoute.split(':')[0] === initial) setStageFilter(urlStageFilter);
        if (tab !== initial) { setPage(1); setUpcomingPage(1); setHistoricalPage(1); setExpanded(null); }
    }
    const queues = useMemo(() => buildFinanceQueues(invoices, today), [invoices, today]);
    const periods = useMemo(() => splitDraftPeriods(queues.drafts), [queues.drafts]);
    const problems = cycles.filter(cycle => ['needs_setup', 'data_review_required', 'draft_due', 'ready'].includes(cycle.cycleStatus));
    const centre = params.get('centre');
    const href = (view: string, parent?: string) => `/dashboard/finance?${new URLSearchParams({ ...(centre ? { centre } : {}), view, ...(parent ? { family: parent } : {}) })}`;
    const matches = (invoice: WorkspaceInvoice) => `${invoice.parent?.firstName ?? ''} ${invoice.parent?.lastName ?? ''} ${invoice.invoiceNumber}`.toLowerCase().includes(search.toLowerCase().trim());
    const matchesItem = (item: Item) => matches(item.invoice) && (!checksOnly || item.reasons.length > 0);
    const current = periods.current.filter(matchesItem);
    const upcoming = periods.upcoming.filter(matchesItem);
    const historical = periods.historical.filter(matchesItem);
    const missingPeriods = periods.needsChecking.filter(matchesItem);
    const allPaymentsMatchingSearch = queues.payments.filter(matchesItem);
    const overdueMatchingCount = allPaymentsMatchingSearch.filter(item => item.collectionStage === 'overdue').length;
    const inPeriodMatchingCount = allPaymentsMatchingSearch.filter(item => item.collectionStage === 'in_period').length;
    const upcomingMatchingCount = allPaymentsMatchingSearch.filter(item => item.collectionStage === 'upcoming').length;
    const outstanding = stageFilter === 'all'
        ? allPaymentsMatchingSearch
        : allPaymentsMatchingSearch.filter(item => item.collectionStage === stageFilter);
    const page = Math.min(requestedPage, Math.max(1, Math.ceil((tab === 'payments' ? outstanding.length : current.length)/25)));
    const upcomingPage = Math.min(requestedUpcomingPage, Math.max(1, Math.ceil(upcoming.length/25)));
    const historicalPage = Math.min(requestedHistoricalPage, Math.max(1, Math.ceil(historical.length/25)));
    const matchingAttention = queues.attention.filter(item => matches(item.invoice));
    const matchingProblems = problems.filter(cycle => cycle.familyName.toLowerCase().includes(search.toLowerCase().trim()));
    const priorOverdueNotice = useMemo(() => {
        if (!payment || (payment.collectionStage !== 'in_period' && payment.collectionStage !== 'upcoming')) return undefined;
        const olderOverdue = queues.payments.filter(
            other =>
                other.invoice.id !== payment.invoice.id &&
                other.invoice.parentId === payment.invoice.parentId &&
                other.invoice.centreId === payment.invoice.centreId &&
                other.collectionStage === 'overdue'
        );
        if (!olderOverdue.length) return undefined;
        const oldest = olderOverdue[0];
        return olderOverdue.length === 1
            ? `Note: This family also has an older overdue invoice (${oldest.invoice.invoiceNumber} · ${money(oldest.remaining)} remaining) from a past assessment period.`
            : `Note: This family also has ${olderOverdue.length} older overdue invoices (oldest: ${oldest.invoice.invoiceNumber} · ${money(oldest.remaining)} remaining) from past assessment periods.`;
    }, [payment, queues.payments]);
    const resetPages = () => { setPage(1); setUpcomingPage(1); setHistoricalPage(1); };
    const changeTab = (value: Tab) => {
        setTab(value); resetPages(); setStageFilter('all'); setChecksOnly(false); setExpanded(null);
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
                <section className="md:pl-5"><h4 className="mb-2 text-sm font-semibold">Selected invoice</h4><InvoiceContext invoice={invoice} today={today}/></section>
                <section className="md:pl-5"><h4 className="mb-2 text-sm font-semibold">Next cycle</h4>{adjacent.next ? <InvoiceContext invoice={adjacent.next} today={today}/> : nextSchedule ? <div className="space-y-1 text-sm"><p>{nextSchedule.periodLabel}</p><p className="text-muted-foreground">No invoice yet{nextSchedule.nextInvoiceDateStr ? ` · Draft preparation ${formatInvoiceDate(nextSchedule.nextInvoiceDateStr)}` : ''}</p></div> : <p className="text-sm text-muted-foreground">No later invoice recorded. <Link className="text-primary underline" href={href('families', invoice.parentId)}>Check billing schedule</Link>.</p>}</section>
            </div>
            <div className="space-y-2 border-t border-border pt-3 text-sm">
                <p>Students: {students.length ? students.map((student,index) => <Fragment key={student.id}>{index > 0 && ' · '}<Link className={`text-primary hover:underline ${focus}`} href={`/dashboard/students/${student.id}`}>{student.name}</Link></Fragment>) : <Link href={`/dashboard/finance/invoices/${invoice.id}`} className="text-primary underline">Check covered students on the invoice</Link>}</p>
                <p>Other issued balances: <span className="font-semibold tabular-nums">{queues.attention.some(other => other.invoice.id !== invoice.id && other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId && other.invoice.status !== 'draft' && !other.financialReliable) ? 'Needs checking' : money(queues.payments.filter(other => other.invoice.id !== invoice.id && other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId).reduce((sum, other) => sum + other.remaining, 0))}</span><span className="text-muted-foreground"> · Drafts excluded</span></p>
                {invoice.createdAt && <p className="text-muted-foreground">Created {formatInvoiceDate(invoice.createdAt)} · Assessment period {formatInvoicePeriod(invoice.billingPeriodStart,invoice.billingPeriodEnd)}</p>}
            </div>
            {item.reasons.length > 0 && <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{invoice.status === 'draft' ? 'Check before issuing: ' : 'Check this invoice: '}{item.reasons.join(' ')}</p>}
            {invoice.status === 'draft' && item.historical && <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Historical billing period. Confirm it was genuinely unbilled before issuing; old draft records are preserved.</p>}
            {invoice.status === 'draft' && item.upcoming && <p className="text-sm text-muted-foreground">This period has not started. Draft preparation is not an instruction to issue today.</p>}
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
                <p className="max-w-lg text-sm text-muted-foreground">Check the period, fee and covered children. Issuing is separate from downloading or sending to a parent.</p>
                <div className="flex items-center gap-3"><button className={`min-h-10 text-sm text-primary ${focus}`} onClick={() => closeReview(invoice.id)}>Close review</button><div><Link href={`/dashboard/finance/invoices/${invoice.id}`} className={`inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90 ${focus}`}>{invoice.status === 'draft' ? `Open draft to ${item.reasons.length ? 'check details' : 'issue'}` : 'Open invoice history'}</Link><p className="mt-1 text-xs text-muted-foreground">{invoice.status === 'draft' ? 'Separate confirmation before issuance' : 'Recorded payments and reversals remain available'}</p></div></div>
            </div>
        </section>;
    }
    function renderPriorSummary(previous: WorkspaceInvoice, prior: ReturnType<typeof inspectInvoice>, priorPaidDate: string | null) {
        if (!prior.financialReliable) {
            return <span className={`inline-flex items-center gap-1 font-medium ${COLLECTION_STAGE_STYLES.needs_checking.text}`}><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>Balance needs checking</span>;
        }
        if (previous.status === 'draft') {
            return 'Draft — not issued';
        }
        if (prior.remaining === 0) {
            return <span className="inline-flex items-center gap-1"><CheckCircle2 aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${COLLECTION_STAGE_STYLES.paid.text}`}/><span className={`font-medium tabular-nums ${COLLECTION_STAGE_STYLES.paid.text}`}>Paid in full{priorPaidDate ? ` (${priorPaidDate})` : ''}</span></span>;
        }
        const amounts = prior.paid > 0 ? `${money(prior.paid)} paid · ${money(prior.remaining)} remaining` : `${money(prior.remaining)} remaining`;
        if (prior.collectionStage === 'overdue') {
            return <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.overdue.text}`}><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`Overdue · ${amounts}`}</span>;
        }
        if (prior.collectionStage === 'in_period') {
            return <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.in_period.text}`}><Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`In period · ${amounts}`}</span>;
        }
        if (prior.collectionStage === 'upcoming') {
            return <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.upcoming.text}`}><CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`Upcoming · ${amounts}`}</span>;
        }
        return <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${COLLECTION_STAGE_STYLES.needs_checking.text}`}><AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>{`Needs checking · ${amounts}`}</span>;
    }
    function cards(items: Item[], mode: 'draft' | 'payment' | 'attention', label: string, empty: string) {
        return <ul aria-label={label} className="space-y-3">{items.map(item => {
            const invoice = item.invoice, paymentMode = mode === 'payment';
            const previous = adjacentInvoices(invoice, invoices).previous;
            const prior = previous ? inspectInvoice(previous, today) : null;
            const priorPaidDate = previous && prior && prior.financialReliable && previous.status !== 'draft' && prior.remaining === 0 ? formatPaidDate(previous.payments) : null;
            const students = coveredStudents(invoice);
            const others = queues.payments.filter(other => other.invoice.id !== invoice.id && other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId);
            const unreliable = queues.attention.some(other => other.invoice.id !== invoice.id && other.invoice.parentId === invoice.parentId && other.invoice.centreId === invoice.centreId && other.invoice.status !== 'draft' && !other.financialReliable);
            const pendingOther = others.some(other => other.pending);
            const isExpanded = expanded === invoice.id;
            const needsCheck = item.reasons.length > 0;
            const paymentMeta = paymentMode ? paymentStageMeta(item) : null;
            const status = mode === 'attention'
                ? 'Needs checking'
                : paymentMeta
                  ? paymentMeta.cardLabel
                  : needsCheck
                    ? 'Needs checking'
                    : item.historical
                      ? 'Historical draft — review required'
                      : item.upcoming
                        ? 'Upcoming draft — not issued'
                        : 'Draft — not issued';
            const StatusIcon = mode === 'attention'
                ? AlertTriangle
                : paymentMeta
                  ? paymentMeta.Icon
                  : needsCheck || item.historical
                    ? AlertTriangle
                    : null;
            const statusClass = mode === 'attention'
                ? COLLECTION_STAGE_STYLES.needs_checking.text
                : paymentMeta
                  ? paymentMeta.textClass
                  : needsCheck || item.historical
                    ? COLLECTION_STAGE_STYLES.in_period.text
                    : 'text-muted-foreground';
            return <li key={invoice.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <article aria-label={`${invoice.invoiceNumber} billing card`} className="px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-5 lg:[&>p]:col-start-1">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:gap-5 lg:col-start-1">
                        <div className="min-w-0">{familyLink(invoice)}
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {invoice.serviceType && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-surface-alt border border-border text-text-muted">
                                        {invoice.serviceType === 'tuition' ? 'Tuition' : 'Childcare'}
                                    </span>
                                )}
                                <p className="text-sm text-muted-foreground">{invoice.centre?.name ?? 'Centre not recorded'}</p>
                            </div>
                            {students.length > 0 && <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">{students.map(student => <Link key={student.id} href={`/dashboard/students/${student.id}`} className={`text-primary hover:underline ${focus}`}>{student.name}</Link>)}</p>}
                        </div>
                        <div className="min-w-0"><p className="text-base font-semibold text-foreground">{formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd)}</p>
                            <p className="mt-1 text-sm text-muted-foreground"><Link href={`/dashboard/finance/invoices/${invoice.id}`} className={`text-primary hover:underline ${focus}`}>{invoice.invoiceNumber}</Link> · Due {formatInvoiceDate(invoice.dueDate)}</p>
                            <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${statusClass}`}>{StatusIcon && <StatusIcon aria-hidden="true" className="h-4 w-4 shrink-0"/>}{status}</p>
                        </div>
                        <div className="text-left tabular-nums md:text-right"><p className="text-xl font-semibold text-foreground">{paymentMode ? money(item.remaining) : item.amountValid ? money(item.amount) : 'Check amount'}</p><p className="text-sm text-muted-foreground">{paymentMode ? 'Remaining balance' : invoice.status === 'draft' ? 'Draft invoice total' : 'Invoice total'}</p>{paymentMode && <p className="mt-1 text-sm text-muted-foreground">{money(item.paid)} verified paid · {money(item.amount)} total</p>}</div>
                    </div>
                    {previous && prior && <p className="mt-3 text-sm text-muted-foreground">Previous: <Link href={`/dashboard/finance/invoices/${previous.id}`} className={`text-primary hover:underline ${focus}`}>{formatInvoicePeriod(previous.billingPeriodStart,previous.billingPeriodEnd)} · {previous.invoiceNumber}</Link> · {renderPriorSummary(previous, prior, priorPaidDate)}{prior.pending ? ' · Payment awaiting verification' : ''}</p>}
                    {!previous && <p className="mt-3 text-sm text-muted-foreground">No earlier non-void invoice recorded for this billing account.</p>}
                    <p className="mt-1 text-sm text-muted-foreground">{unreliable ? 'Other issued balances need checking.' : others.length ? <>Other outstanding: <strong className="font-medium text-foreground">{money(others.reduce((sum,other)=>sum+other.remaining,0))}</strong> across {others.length} invoice{others.length === 1 ? '' : 's'}. <Link href={`/dashboard/parents/${invoice.parentId}`}  className={`text-primary underline underline-offset-4 ${focus}`}>View family invoices</Link></> : 'No other outstanding issued invoices recorded in this centre.'}{pendingOther ? ' A payment is awaiting verification.' : ''}</p>
                    {(item.pending || needsCheck) && <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">{needsCheck && item.reasons.join(' ')}{item.pending && `${needsCheck ? ' ' : ''}Payment awaiting verification — check it before recording the same money again.`}</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 lg:col-start-2 lg:row-start-1 lg:row-span-4 lg:mt-0 lg:flex-col-reverse lg:justify-center lg:border-t-0 lg:pt-0">
                        <button id={`review-${invoice.id}`} aria-controls={`context-${invoice.id}`} aria-expanded={isExpanded} onClick={()=>setExpanded(isExpanded ? null : invoice.id)} aria-label={`${isExpanded ? 'Hide review for' : 'Billing details for'} ${invoice.invoiceNumber}`} className={`inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary ${focus}`}>Billing details<ChevronDown aria-hidden="true" className={`h-4 w-4 ${isExpanded ? 'rotate-180' : ''}`}/></button>
                        {paymentMode ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                <button type="button" onClick={()=>setPayment(item)} aria-label={`Record payment for ${invoice.invoiceNumber}`} className={`inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90 ${focus}`}>
                                    Record payment
                                </button>
                                {item.collectionStage === 'overdue' && Boolean(invoice.parent?.phone) && !invoice.parent?.deletedAt && (
                                    <WhatsAppCopyActions
                                        phone={invoice.parent?.phone}
                                        message={buildInvoiceWhatsAppMessage({
                                            parentFirstName: invoice.parent?.firstName,
                                            invoiceNumber: invoice.invoiceNumber,
                                            amountFormatted: (item.remaining / 100).toFixed(2),
                                            dueDateFormatted: formatInvoiceDate(invoice.dueDate),
                                            periodFormatted: formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd),
                                            serviceType: invoice.serviceType === 'tuition' ? 'tuition' : 'childcare',
                                            isPaid: false,
                                            organisationName: invoice.centre?.name || 'After-School Club',
                                        })}
                                        recipientName={`${invoice.parent?.firstName ?? ''} ${invoice.parent?.lastName ?? ''}`.trim() || 'Parent'}
                                        variant="icon"
                                    />
                                )}
                            </div>
                        ) : <button aria-controls={`context-${invoice.id}`} aria-expanded={isExpanded} aria-label={`${needsCheck ? 'Review problem' : 'Review invoice'} ${invoice.invoiceNumber}`} onClick={()=>setExpanded(isExpanded ? null : invoice.id)} className={`inline-flex min-h-11 items-center rounded-lg ${needsCheck ? 'border border-border text-primary hover:bg-secondary' : 'bg-primary text-primary-foreground hover:bg-primary/90'} px-4 text-sm font-semibold ${focus}`}>{needsCheck ? 'Review problem' : 'Review draft'}</button>}
                    </div>
                </article>
                {isExpanded && <div id={`context-${invoice.id}`}>{review(item)}</div>}
            </li>;
        })}{!items.length && <li className="rounded-xl border border-border px-4 py-6 text-sm text-muted-foreground">{empty}</li>}</ul>;
    }
    function invoiceList(items: Item[], mode: 'draft' | 'payment', label: string, empty: string) {
        return presentation === 'cards' ? cards(items,mode,label,empty) : table(items,mode,label,empty);
    }
    function table(items: Item[], mode: 'draft' | 'payment', label: string, empty: string) {
        const paymentMode = mode === 'payment';
        const columns = paymentMode ? 7 : 6;
        return <div className="min-w-0 border-y border-border">
            <table role="table" aria-label={label} className="block w-full text-left text-sm md:table md:table-fixed">
                <thead className="sr-only md:not-sr-only md:table-header-group"><tr>{['Family','Assessment period','Invoice',paymentMode ? 'Total / remaining' : 'Amount',...(paymentMode ? ['Due'] : []),'Status','Action'].map((heading,index) => <th key={heading} scope="col" className={`px-3 py-3 font-medium text-muted-foreground ${index === 1 ? 'md:w-[23%]' : heading === 'Action' ? 'md:w-[17%]' : ''}`}>{heading}</th>)}</tr></thead>
                <tbody className="block md:table-row-group">
                    {items.map(item => {
                        const invoice = item.invoice;
                        const isExpanded = expanded === invoice.id;
                        const paymentMeta = paymentMode ? paymentStageMeta(item) : null;
                        const badgeLabel = paymentMeta ? paymentMeta.badgeLabel : 'Draft';
                        const badgeClass = paymentMeta ? paymentMeta.badgeClass : COLLECTION_STAGE_STYLES.draft.badge;
                        const BadgeIcon = paymentMeta ? paymentMeta.Icon : null;
                        return <Fragment key={invoice.id}>
                            <tr role="row" className="grid grid-cols-2 items-center gap-x-3 gap-y-2 border-t border-border px-3 py-4 md:table-row md:p-0">
                                <td role="cell" className={`${cell} min-w-0`}>
                                    {familyLink(invoice)}
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {invoice.serviceType && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-surface-alt border border-border text-text-muted">
                                                {invoice.serviceType === 'tuition' ? 'Tuition' : 'Childcare'}
                                            </span>
                                        )}
                                        {invoice.centre && <span className="block truncate text-xs text-muted-foreground">{invoice.centre.name}</span>}
                                    </div>
                                </td>
                                <td role="cell" className={`${cell} col-start-1 row-start-2 md:whitespace-nowrap`}>{formatInvoicePeriod(invoice.billingPeriodStart,invoice.billingPeriodEnd)}<span className="block text-xs text-muted-foreground md:hidden">Due {formatInvoiceDate(invoice.dueDate)}</span></td>
                                <td role="cell" className={`${cell} col-start-2 row-start-1 text-right md:text-left`}><Link className={`text-muted-foreground underline-offset-2 hover:text-primary hover:underline ${focus}`} href={`/dashboard/finance/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></td>
                                <td role="cell" className={`${cell} col-start-1 row-start-3 tabular-nums`}><span className={paymentMode ? 'block text-xs text-muted-foreground' : 'font-medium'}>{item.amountValid ? money(item.amount) : 'Check amount'}{paymentMode && <span className="md:sr-only"> total</span>}</span>{paymentMode && <strong className="block font-semibold">{money(item.remaining)} <span className="text-xs font-normal">remaining</span></strong>}</td>
                                {paymentMode && <td role="cell" className={`${cell} hidden whitespace-nowrap md:table-cell`}>{formatInvoiceDate(invoice.dueDate)}</td>}
                                <td role="cell" className={`${cell} col-start-2 row-start-2 text-right md:text-left`}><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}`}>{BadgeIcon && <BadgeIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0"/>}{badgeLabel}</span>{item.pending && <span className="mt-1 block text-xs text-muted-foreground">Payment pending</span>}{item.reasons.length > 0 && badgeLabel !== 'Needs checking' && <span className="mt-1 block text-xs font-medium text-amber-800 dark:text-amber-200">Needs checking</span>}</td>
                                <td role="cell" className={`${cell} col-start-2 row-start-3 text-right md:text-left`}>
                                    {paymentMode ? (
                                        <div className="flex items-center gap-2 justify-end md:justify-start flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setPayment(item)}
                                                className={`inline-flex min-h-10 items-center rounded-lg bg-accent px-3 text-sm font-medium text-on-accent hover:opacity-90 ${focus}`}
                                                aria-label={`Record payment for ${invoice.invoiceNumber}`}
                                            >
                                                Record payment
                                            </button>
                                            {item.collectionStage === 'overdue' && Boolean(invoice.parent?.phone) && !invoice.parent?.deletedAt && (
                                                <WhatsAppCopyActions
                                                    phone={invoice.parent?.phone}
                                                    message={buildInvoiceWhatsAppMessage({
                                                        parentFirstName: invoice.parent?.firstName,
                                                        invoiceNumber: invoice.invoiceNumber,
                                                        amountFormatted: (item.remaining / 100).toFixed(2),
                                                        dueDateFormatted: formatInvoiceDate(invoice.dueDate),
                                                        periodFormatted: formatInvoicePeriod(invoice.billingPeriodStart, invoice.billingPeriodEnd),
                                                        serviceType: invoice.serviceType === 'tuition' ? 'tuition' : 'childcare',
                                                        isPaid: false,
                                                        organisationName: invoice.centre?.name || 'After-School Club',
                                                    })}
                                                    recipientName={`${invoice.parent?.firstName ?? ''} ${invoice.parent?.lastName ?? ''}`.trim() || 'Parent'}
                                                    variant="icon"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            id={`review-${invoice.id}`}
                                            aria-controls={`context-${invoice.id}`}
                                            aria-expanded={isExpanded}
                                            aria-label={`${isExpanded ? 'Hide review for' : 'Review invoice'} ${invoice.invoiceNumber}`}
                                            onClick={() => setExpanded(isExpanded ? null : invoice.id)}
                                            className={`inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary ${focus}`}
                                        >
                                            {isExpanded ? 'Hide review' : 'Review invoice'}
                                            <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 ${isExpanded ? 'rotate-180' : ''}`}/>
                                        </button>
                                    )}
                                </td>
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
        <details className="group rounded-lg border border-border bg-card px-4">
            <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden ${focus}`}>
                How to use Finance
                <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 group-open:rotate-180"/>
            </summary>
            <div className="space-y-4 pb-5 text-sm text-foreground">
                <p className="max-w-prose text-muted-foreground">Start with current drafts, record payments you have received, then resolve anything that needs attention. Unpaid invoices can remain here while you wait for parents to pay.</p>
                <ol className="max-w-prose list-decimal space-y-3 pl-5 marker:font-medium">
                    <li><strong>Drafts to review: check, then issue.</strong> Select <strong>Review invoice</strong> to compare the previous invoice and its payment state, the selected draft, and the next invoice or scheduled cycle. Check the children, assessment period and amount. When correct, select <strong>Open draft to issue</strong> and confirm issuance on the invoice page. Download the issued invoice to send to the parent. A draft has not been issued and is not yet a request for payment.</li>
                    <li><strong>Awaiting payment: record money received.</strong> Match the family, invoice number and assessment period to the payment, then select <strong>Record payment</strong>. Check the remaining balance and enter the payment details. Two invoices can have the same amount but cover different months: always check the period. Record payment only after confirming receipt.</li>
                    <li><strong>Needs attention: resolve exceptions.</strong> Check missing billing information, overlapping periods and other warnings before issuing the affected invoices. Use <strong>Family accounts</strong> for the family’s billing setup and invoice history.</li>
                </ol>
                <div className="max-w-prose space-y-2 border-t border-border pt-3 text-muted-foreground">
                    <p><strong className="text-foreground">Upcoming periods</strong> contains drafts for future periods. Review their timing before issuing.</p>
                    <p><strong className="text-foreground">Historical drafts to check</strong> contains drafts for completed periods. They are preserved separately and excluded from the current-draft count. Check existing invoices and payments before issuing; do not issue an old draft simply to clear the list.</p>
                    <p><strong className="text-foreground">Where to find records:</strong> use <strong>All invoices</strong> to browse invoice history, <strong>Family accounts</strong> for billing setup, and <strong>Parent receipts</strong> for payment receipts. Issuing and recording payment are separate actions.</p>
                </div>
            </div>
        </details>
        <nav aria-label="Finance tasks" className="grid grid-cols-3 gap-1 border-b border-border md:flex md:gap-2">
            {([['drafts', 'Drafts to review', periods.current.length], ['payments', 'Awaiting payment', queues.payments.length], ['attention', 'Needs attention', queues.attention.length + problems.length]] as const).map(([value,label,total]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => changeTab(value)} className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 py-3 text-xs font-medium sm:px-2 sm:text-sm md:justify-start md:whitespace-nowrap ${focus} ${tab === value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}{' '}<span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${tab === value ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground'}`}>{invoiceError || (value === 'attention' && cycleError) ? 'Unavailable' : total}</span></button>)}
        </nav>
        <div className="space-y-4">
            <div><h2 className="sr-only">{tab === 'drafts' ? 'Review before issuing' : tab === 'payments' ? 'Record money received' : 'Resolve billing problems'}</h2><p className="text-sm text-muted-foreground">{tab === 'drafts' ? 'Current periods only. Upcoming and historical drafts are separate below.' : tab === 'payments' ? 'Record a payment only after money has been received. Overdue invoices are past their assessment period; paused and stopped students’ existing debts are included.' : 'Resolve billing setup problems and invoice details that need checking.'}</p></div>
            {tab !== 'attention' && <div role="group" aria-label="Invoice presentation" className="flex items-center gap-1"><button type="button" aria-pressed={presentation === 'cards'} onClick={()=>setPresentation('cards')} className={`${control} ${presentation === 'cards' ? 'border-primary text-primary' : ''}`}>Cards</button><button type="button" aria-pressed={presentation === 'table'} onClick={()=>setPresentation('table')} className={`${control} ${presentation === 'table' ? 'border-primary text-primary' : ''}`}>Table</button></div>}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="relative block w-full sm:max-w-md"><span className="sr-only">Find family or invoice</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input value={search} placeholder="Find family or invoice" onChange={event => {setSearch(event.target.value);resetPages();}} className={`h-10 w-full rounded-lg border border-border bg-card pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground ${focus}`} type="search"/></label>
                <div className="flex flex-wrap items-center gap-3">
                    {tab === 'payments' && <div role="group" aria-label="Payment stage filter" className="flex flex-wrap items-center gap-1.5">
                        {([
                            ['all', `All unpaid (${allPaymentsMatchingSearch.length})`],
                            ['overdue', `Overdue (${overdueMatchingCount})`],
                            ['in_period', `In period (${inPeriodMatchingCount})`],
                            ['upcoming', `Upcoming (${upcomingMatchingCount})`],
                        ] as const).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={stageFilter === value}
                                onClick={() => { setStageFilter(value); setPage(1); }}
                                className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors ${focus} ${
                                    stageFilter === value
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-card text-foreground hover:bg-secondary'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>}
                    <Link href={centre && centre !== 'all' ? `/dashboard/finance/reconciliation?${new URLSearchParams({ centre })}` : '/dashboard/finance/reconciliation'} className={control}>Reconcile TFC / Bank</Link>
                    {tab !== 'attention' && <><details className="relative"><summary className={`${control} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}><SlidersHorizontal aria-hidden="true" className="h-4 w-4"/>Filter{checksOnly && <span className="text-primary">1</span>}</summary><div className="absolute right-0 top-12 z-20 w-52 rounded-lg border border-border bg-card p-4 shadow-lg"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checksOnly} onChange={event => {setChecksOnly(event.target.checked);resetPages();}}/>Needs checking only</label></div></details><button type="button" onClick={exportRows} disabled={invoiceError} className={`${control} disabled:opacity-50`} aria-label={tab === 'drafts' ? 'Export matching drafts, including upcoming and historical' : 'Export matching outstanding invoices'}><Download aria-hidden="true" className="h-4 w-4"/>Export</button></>}
                    {(search || checksOnly || stageFilter !== 'all') && <button type="button" className={`inline-flex min-h-10 items-center gap-1 text-sm text-primary ${focus}`} onClick={() => {setSearch('');setChecksOnly(false);setStageFilter('all');resetPages();}}><X aria-hidden="true" className="h-3.5 w-3.5"/>Clear filters</button>}
                </div>
            </div>
        </div>
        {invoiceError || (tab === 'attention' && cycleError) ? <div role="alert" className="rounded-lg border border-border p-4"><p>Couldn’t check {tab === 'attention' ? 'all billing tasks' : 'invoices'}. No complete task count is available.</p><button type="button" className={`mt-2 text-primary underline ${focus}`} onClick={() => router.refresh()}>Retry</button></div> : <>
            {tab === 'drafts' && <>
                {missingPeriods.length > 0 && <p className="text-sm text-muted-foreground">{missingPeriods.length} draft{missingPeriods.length === 1 ? '' : 's'} with missing or invalid periods held in <button type="button" className={`min-h-10 font-medium text-primary underline ${focus}`} onClick={() => changeTab('attention')}>Needs attention</button>. They remain in the drafts export.</p>}
                <div><h3 className="mb-2 text-sm font-medium text-muted-foreground">Current assessment periods · {current.length} invoice{current.length === 1 ? '' : 's'}</h3>{invoiceList(current.slice((page-1)*25,page*25),'draft','Current draft invoices','No current-period drafts match this selection. Upcoming and historical drafts are below.')}<Pagination page={page} total={current.length} onChange={setPage}/></div>
                <details className="group border-b border-border"><summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden ${focus}`}><ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 group-open:rotate-0"/>Upcoming periods · {upcoming.length} draft invoice{upcoming.length === 1 ? '' : 's'}</summary><p className="pb-3 text-sm text-muted-foreground">Prepared for future periods. Review when appropriate; preparation is not an issuance deadline.</p>{invoiceList(upcoming.slice((upcomingPage-1)*25,upcomingPage*25),'draft','Upcoming draft invoices','No upcoming drafts match this selection.')}<Pagination page={upcomingPage} total={upcoming.length} onChange={setUpcomingPage}/></details>
                <details className="group border-b border-border"><summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden ${focus}`}><ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 group-open:rotate-0"/>Historical drafts to check · {historical.length}</summary><p className="pb-3 text-sm text-muted-foreground">Old drafts require review before issuing. Confirm the period was genuinely unbilled; no records have been deleted.</p>{invoiceList(historical.slice((historicalPage-1)*25,historicalPage*25),'draft','Historical draft invoices','No historical drafts match this selection.')}<Pagination page={historicalPage} total={historical.length} onChange={setHistoricalPage}/></details>
            </>}
            {tab === 'payments' && <><p className="text-sm text-muted-foreground">{outstanding.length} invoice{outstanding.length === 1 ? '' : 's'} · {money(outstanding.reduce((sum,item) => sum+item.remaining,0))} remaining across this selection. Counts include every page.</p>{invoiceList(outstanding.slice((page-1)*25,page*25),'payment','Outstanding invoices','No issued invoices with a verified outstanding balance match this selection.')}<Pagination page={page} total={outstanding.length} onChange={setPage}/><p className="text-sm text-muted-foreground">Family, invoice and assessment period are shown again before a payment is recorded. Open an invoice number for its payment history.</p></>}
            {tab === 'attention' && <><p className="text-sm text-muted-foreground">{queues.attention.length} invoice{queues.attention.length === 1 ? '' : 's'} and {problems.length} billing configuration{problems.length === 1 ? '' : 's'} need checking. A family can have more than one item.</p>{cards(matchingAttention,'attention','Invoice problems',search.trim() ? 'No invoice problems match your search.' : 'No invoice problems found in this centre.')}<ul aria-label="Billing setup problems" className="space-y-3">
                {matchingProblems.map(cycle => <li key={cycle.config.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><Link className={`font-medium text-primary hover:underline ${focus}`} href={`/dashboard/parents/${cycle.config.parentId}`}>{cycle.familyName}</Link><p className="mt-1 text-sm text-muted-foreground">{cycle.cycleStatus === 'needs_setup' ? 'Billing fee or setup is missing.' : cycle.cycleStatus === 'data_review_required' ? 'Confirm registration and the children covered by the family fee.' : 'An eligible billing cycle has no prepared invoice. Check the schedule before preparing a draft.'}</p></div><Link className={`inline-flex min-h-10 items-center text-sm font-medium text-primary ${focus}`} href={href('families',cycle.config.parentId)}>{cycle.cycleStatus === 'needs_setup' ? 'Complete billing setup' : 'Review billing schedule'}</Link></li>)}
                {!matchingAttention.length && !matchingProblems.length && <li className="py-6 text-sm text-muted-foreground">{search.trim() ? 'No billing problems match your search.' : 'No billing problems found in this centre.'}</li>}
            </ul></>}
        </>}
        {payment && <RecordPaymentModal invoiceId={payment.invoice.id} invoiceNumber={payment.invoice.invoiceNumber} remainingBalance={payment.remaining/100} invoiceTotal={payment.amount/100} billingContext={{parentId:payment.invoice.parentId,familyName:payment.invoice.parent ? `${payment.invoice.parent.firstName} ${payment.invoice.parent.lastName}` : 'Family account',period:formatInvoicePeriod(payment.invoice.billingPeriodStart,payment.invoice.billingPeriodEnd),...(priorOverdueNotice ? { priorOverdueNotice } : {})}} onClose={() => setPayment(null)} onSuccess={() => {setPayment(null);router.refresh();}}/>}
    </section>;
}

function Pagination({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void}) {
    if (!total) return null;
    return <nav aria-label="Task pages" className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-muted-foreground"><span>Showing {(page-1)*25+1}–{Math.min(page*25,total)} of {total} invoices</span>{total > 25 && <div className="flex items-center gap-4"><button type="button" disabled={page<=1} onClick={()=>onChange(page-1)} className={`min-h-10 text-primary disabled:text-muted-foreground ${focus}`}>Previous</button><span>Page {page} of {Math.ceil(total/25)}</span><button type="button" disabled={page*25>=total} onClick={()=>onChange(page+1)} className={`min-h-10 text-primary disabled:text-muted-foreground ${focus}`}>Next</button></div>}</nav>;
}
