'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reconcilePayment } from '@/features/billing/actions/reconcile-payment';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { CheckCircle2, Landmark, Ticket, Wallet } from 'lucide-react';

type InvoiceDto = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  remainingBalance: number;
  status: string;
  parentFirstName: string | null;
  parentLastName: string | null;
  childTfcRef: string | null;
  childFirstName: string | null;
};

const METHODS: { id: 'tax_free_childcare' | 'voucher' | 'bank_transfer'; label: string; icon: typeof Landmark }[] = [
  { id: 'tax_free_childcare', label: 'Tax-Free Childcare', icon: Wallet },
  { id: 'voucher', label: 'Childcare Voucher', icon: Ticket },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
];

// Milestone 3G: `organisationId` is no longer forwarded to reconcilePayment —
// the server action now derives both organisationId and staffId from the
// authenticated session itself (see project-notes/milestone-3g-finance-audit.md,
// L1). The prop is kept optional for backwards compatibility with the parent
// page but is intentionally unused here.
export function ReconciliationClient({
  invoices,
}: {
  invoices: InvoiceDto[];
  organisationId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'tax_free_childcare' | 'voucher' | 'bank_transfer'>('tax_free_childcare');
  const [reference, setReference] = useState<string>('');

  const handleReconcile = () => {
    if (!selectedInvoice) { toast('Please select an invoice', 'error'); return; }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { toast('Invalid amount', 'error'); return; }
    if (!reference) { toast('Reference is required', 'error'); return; }

    startTransition(async () => {
      const res = await reconcilePayment({
        invoiceId: selectedInvoice,
        amount: parsedAmount,
        method,
        reference
      });

      if (res.success) {
        toast('Payment reconciled successfully', 'success');
        setSelectedInvoice(null);
        setAmount('');
        setReference('');
        router.refresh();
      } else {
        toast(res.error || 'Failed to reconcile payment', 'error');
      }
    });
  };

  const invoice = invoices.find(i => i.id === selectedInvoice);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Pending Invoices</h2>
        <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
          {invoices.map(inv => (
            <button
              key={inv.id}
              type="button"
              onClick={() => setSelectedInvoice(inv.id)}
              className={`text-left p-4 border rounded-2xl transition-all ${
                selectedInvoice === inv.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40 bg-card'
              }`}
            >
              <div className="flex justify-between items-start mb-2 gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-foreground truncate">
                    {inv.parentFirstName} {inv.parentLastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {inv.invoiceNumber}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-foreground tabular-nums">
                    £{inv.remainingBalance.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    of £{inv.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>

              {inv.childTfcRef && (
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  TFC Ref: {inv.childTfcRef}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Reconcile Payment</h2>

        <div className="p-6 border border-border rounded-[32px] bg-card space-y-5">
          {!selectedInvoice ? (
            <div className="text-center text-muted-foreground py-12 flex flex-col items-center gap-3">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground/30" />
              Select an invoice from the list to reconcile a payment.
            </div>
          ) : (
            <>
              <div className="pb-4 border-b border-border">
                <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Reconciling for</div>
                <div className="font-bold text-foreground text-lg">
                  {invoice?.parentFirstName} {invoice?.parentLastName} ({invoice?.invoiceNumber})
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Payment Method</label>
                <div className="grid grid-cols-1 gap-2">
                  {METHODS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethod(m.id)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                        method === m.id
                          ? 'bg-primary/10 border-primary ring-1 ring-primary'
                          : 'bg-secondary/40 border-border hover:bg-secondary/60'
                      }`}
                    >
                      <m.icon className={`w-4 h-4 ${method === m.id ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-bold ${method === m.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Amount (£)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={invoice?.remainingBalance}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder={`Max: ${invoice?.remainingBalance.toFixed(2)}`}
                  className="w-full p-3 rounded-2xl border border-border bg-secondary/40 text-foreground font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Payment Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. JSMIT12345TFC"
                  className="w-full p-3 rounded-2xl border border-border bg-secondary/40 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-xs text-muted-foreground">
                  Must be unique per invoice to prevent double-applying.
                </p>
              </div>

              <Button
                onClick={handleReconcile}
                disabled={isPending || !amount || !reference}
                className="w-full mt-2"
              >
                {isPending ? 'Reconciling...' : 'Reconcile Payment'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
