'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import GenerateInvoiceModal from './GenerateInvoiceModal';
import { previewBillingPeriods, formatIsoDate, computeExpectedPaymentDate } from '@/lib/billing/date-engine';
import Link from 'next/link';
import BillingSettingsCard from './BillingSettingsCard';
import type { StudentBillingConfig } from '../queries';
export type ParentBillingGroup = {
    centreId: string;
    centreName: string;
    siblings: {
        id: string;
        firstName: string;
        lastName: string;
        confirmedEnrolment?: boolean;
        lifecycleStatus?: 'active' | 'paused' | 'stopped' | string;
    }[];
    config: StudentBillingConfig | null;
};
export function ParentBillingSection({ groups, parentId, orgId, openSetup = false, familyName, parentEmail, hasInvoices = false }: {
    groups: ParentBillingGroup[];
    parentId: string;
    orgId: string;
    openSetup?: boolean;
    familyName: string;
    parentEmail: string;
    hasInvoices?: boolean;
}) {
    const [selected, setSelected] = useState(groups.length === 1 ? groups[0]!.centreId : '');
    const [showDraft, setShowDraft] = useState(false);
    const router = useRouter();
    const group = groups.find(g => g.centreId === selected);
    const preview = group?.config ? previewBillingPeriods(group.config.billingAnchorDate, 1, group.config)[0] : null;
    return <section id="family-billing" aria-labelledby="family-billing-heading" className="space-y-4 scroll-mt-24">
 <div><h2 id="family-billing-heading" className="text-lg font-semibold text-foreground">Family billing cycle</h2><p className="mt-1 text-sm text-muted-foreground">Set the monthly fee for this family at one centre. Saving makes the cycle eligible for scheduled draft preparation; it does not issue or email an invoice.</p></div>
 {groups.length > 1 && <label className="block text-sm font-medium">Billing centre<select value={selected} onChange={e => { setShowDraft(false); setSelected(e.target.value); }} className="mt-2 block min-h-11 w-full rounded-lg border border-border bg-card p-3"><option value="">Choose a centre</option>{groups.map(g => <option key={g.centreId} value={g.centreId}>{g.centreName}</option>)}</select><span className="mt-1 block text-sm text-muted-foreground">Each centre has a separate family fee and billing cycle.</span></label>}
 {!groups.length && <p className="rounded-lg border border-border p-4 text-sm">No students with an assigned, accessible centre are available. Check the children’s centre and enrolment in Overview before setting up billing.</p>}
 {group && <div className="space-y-3"><p className="text-sm font-medium">{group.centreName}</p>{(group.siblings.length > 0 || group.config) ? <BillingSettingsCard key={group.centreId} childId={group.siblings[0]?.id ?? ''} parentId={parentId} centreId={group.centreId} orgId={orgId} siblings={group.siblings} existingConfig={group.config} startEditing={openSetup && !group.config} familySurface/> : <p className="text-sm text-muted-foreground">This plan has no active students at this centre. Review the family’s children before changing its coverage.</p>}<p id="family-enrolment-links" className="text-sm text-muted-foreground">Need to check enrolment? {group.siblings.map((child, i) => <span key={child.id}>{i > 0 ? ' · ' : ''}<Link href={`/dashboard/students/${child.id}`} className="inline-flex min-h-11 items-center text-primary underline">{child.firstName} {child.lastName}</Link></span>)}</p> {group.config?.status === 'active' && group.config.agreedMonthlyPence > 0 && group.config.coveredChildren.length > 0 && <button type="button" onClick={() => setShowDraft(true)} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">{hasInvoices ? 'Review / prepare draft invoice' : 'Review first draft invoice'}</button>}
 {showDraft && group.config && preview && <GenerateInvoiceModal key={group.config.id} configId={group.config.id} familyName={familyName} parentEmail={parentEmail} coveredChildren={group.config.coveredChildren} amountPence={group.config.agreedMonthlyPence} periodLabel={preview.periodSpan} invoiceDateStr={formatIsoDate(new Date())} dueDateStr={formatIsoDate(computeExpectedPaymentDate(preview.periodStart, group.config.paymentDayOfMonth))} periodStartStr={formatIsoDate(preview.periodStart)} periodEndStr={formatIsoDate(preview.periodEnd)} billingAnchorDate={group.config.billingAnchorDate} onClose={() => setShowDraft(false)} onSuccess={() => { setShowDraft(false); router.refresh(); }}/>}</div>}
 </section>;
}
