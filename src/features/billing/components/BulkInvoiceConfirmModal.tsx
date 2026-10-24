'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import type { BillingCycleRow } from '@/features/billing/queries';

interface BulkInvoiceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  cycles: BillingCycleRow[];
}

export default function BulkInvoiceConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  cycles
}: BulkInvoiceConfirmModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalAmountPence = cycles.reduce((sum, c) => sum + (c.config?.agreedMonthlyPence ?? 0), 0);
  const totalChildren = cycles.reduce((sum, c) => sum + (c.coveredChildren?.length ?? 0), 0);

  const handleConfirm = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      await onConfirm();
      setIsDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preparation stopped. Refresh the dashboard to review any drafts already prepared before trying again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="prepare-drafts-title" onCancel={event => { event.preventDefault(); if (!isGenerating) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl bg-card p-0 text-foreground backdrop:bg-black/40">
      <div className="bg-card w-full overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="prepare-drafts-title" className="text-lg font-bold text-foreground">Prepare eligible drafts</h2>
          <button aria-label="Close draft preparation" onClick={onClose} disabled={isGenerating}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body - Success State */}
        {isDone ? (
          <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <p className="text-lg font-bold text-foreground">Draft preparation complete</p>
            <p className="text-sm text-muted-foreground">Review the drafts before issuing them. No invoices were issued or sent by this action.</p>
            <button onClick={onClose} className="mt-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90">
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Body - Preview */}
            <div className="px-6 py-4 space-y-4">
              {/* Summary row */}
              <div className="bg-secondary rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">{cycles.length} famil{cycles.length !== 1 ? 'ies' : 'y'}</p>
                  <p className="text-xs text-muted-foreground">{totalChildren} child{totalChildren !== 1 ? 'ren' : ''}</p>
                </div>
                <p className="text-xl font-black text-foreground">
                  £{(totalAmountPence / 100).toFixed(2)}
                </p>
              </div>

              {/* Family breakdown - scrollable */}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {cycles.map(cycle => (
                  <div key={cycle.config.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <Link href={`/dashboard/parents/${cycle.config.parentId}`} className="text-sm font-medium text-primary underline underline-offset-4">{cycle.familyName}</Link>
                      <p className="text-xs text-foreground">{cycle.periodLabel}</p>
                      <p className="text-xs text-muted-foreground">{cycle.centreName}</p>
                      <p className="text-xs text-muted-foreground">{cycle.coveredChildren?.length ?? 0} child{(cycle.coveredChildren?.length ?? 0) !== 1 ? 'ren' : ''}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground">£{((cycle.config?.agreedMonthlyPence ?? 0) / 100).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Warning if > 1 family */}
              {cycles.length > 1 && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning font-medium">This prepares {cycles.length} draft invoices only. Verify the families, billing periods and amounts. Issuing is a separate action.</p>
                </div>
              )}
            </div>

            {error && <p role="alert" className="px-6 pb-4 text-sm text-destructive">{error} Refresh to review any drafts already prepared.</p>}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button onClick={onClose} disabled={isGenerating}
                className="flex-1 py-2.5 bg-secondary rounded-xl text-sm font-bold text-foreground hover:bg-secondary/80 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={isGenerating || cycles.length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
                ) : (
                  <>Prepare {cycles.length} draft{cycles.length !== 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
