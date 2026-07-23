'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reconcilePayment } from '@/features/billing/actions/reconcile-payment';
import { Button } from '@/components/ui/Button';
// import { toast } from 'sonner';

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

export function ReconciliationClient({ 
  invoices, 
  organisationId 
}: { 
  invoices: InvoiceDto[],
  organisationId: string
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'tax_free_childcare' | 'voucher' | 'bank_transfer'>('tax_free_childcare');
  const [reference, setReference] = useState<string>('');

  const handleReconcile = () => {
    if (!selectedInvoice) return toast.error('Select an invoice');
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return toast.error('Invalid amount');
    if (!reference) return toast.error('Reference is required');

    startTransition(async () => {
      const res = await reconcilePayment(organisationId, 'staff-user', {
        invoiceId: selectedInvoice,
        amount: parsedAmount,
        method,
        reference
      });

      if (res.success) {
        toast.success('Payment reconciled successfully');
        setSelectedInvoice(null);
        setAmount('');
        setReference('');
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to reconcile payment');
      }
    });
  };

  const invoice = invoices.find(i => i.id === selectedInvoice);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[--color-text]">Pending Invoices</h2>
        <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto">
          {invoices.map(inv => (
            <div 
              key={inv.id}
              onClick={() => setSelectedInvoice(inv.id)}
              className={`p-4 border rounded-xl cursor-pointer transition-colors \${
                selectedInvoice === inv.id 
                  ? 'border-[--color-primary] bg-[--color-primary]/5' 
                  : 'border-[--color-border] hover:border-[--color-primary]/50 bg-white dark:bg-black/20'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium text-[--color-text]">
                    {inv.parentFirstName} {inv.parentLastName}
                  </div>
                  <div className="text-sm text-[--color-text-secondary]">
                    {inv.invoiceNumber}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-[--color-text]">
                    £{inv.remainingBalance.toFixed(2)}
                  </div>
                  <div className="text-xs text-[--color-text-secondary]">
                    of £{inv.totalAmount.toFixed(2)}
                  </div>
                </div>
              </div>
              
              {inv.childTfcRef && (
                <div className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  TFC Ref: {inv.childTfcRef}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-[--color-text]">Reconcile Payment</h2>
        
        <div className="p-6 border border-[--color-border] rounded-xl bg-white dark:bg-black/20 space-y-4">
          {!selectedInvoice ? (
            <div className="text-center text-[--color-text-secondary] py-8">
              Select an invoice from the list to reconcile a payment.
            </div>
          ) : (
            <>
              <div className="pb-4 border-b border-[--color-border]">
                <div className="text-sm text-[--color-text-secondary]">Reconciling for</div>
                <div className="font-medium text-[--color-text] text-lg">
                  {invoice?.parentFirstName} {invoice?.parentLastName} ({invoice?.invoiceNumber})
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[--color-text]">Payment Method</label>
                <select 
                  value={method} 
                  onChange={e => setMethod(e.target.value as any)}
                  className="w-full p-2.5 rounded-lg border border-[--color-border] bg-[--color-background]"
                >
                  <option value="tax_free_childcare">Tax-Free Childcare</option>
                  <option value="voucher">Childcare Voucher</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[--color-text]">Amount (£)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  max={invoice?.remainingBalance}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder={`Max: \${invoice?.remainingBalance.toFixed(2)}`}
                  className="w-full p-2.5 rounded-lg border border-[--color-border] bg-[--color-background]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[--color-text]">Payment Reference</label>
                <input 
                  type="text" 
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. JSMIT12345TFC"
                  className="w-full p-2.5 rounded-lg border border-[--color-border] bg-[--color-background]"
                />
                <p className="text-xs text-[--color-text-secondary]">
                  Must be unique per invoice to prevent double-applying.
                </p>
              </div>

              <Button 
                onClick={handleReconcile} 
                disabled={isPending || !amount || !reference}
                className="w-full mt-4"
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
