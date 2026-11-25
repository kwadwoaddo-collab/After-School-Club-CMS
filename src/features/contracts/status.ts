export type ContractRowLite = {
    id: string;
    status: 'draft' | 'sent' | 'signed' | 'expired' | 'revoked';
    expiresAt: Date;
    createdAt: Date;
    amountPence: number;
    signedAt: Date | null;
    sentAt: Date | null;
    signerName: string | null;
};

export type ContractStatusLabel = 'Not sent' | 'Sent' | 'Signed' | 'Expired' | 'Amount changed — new contract needed';

export interface ContractStatusView {
    label: ContractStatusLabel;
    /** The latest signed contract, if any (download target) */
    signed: { id: string; signedAt: string; amountPence: number; signerName: string | null } | null;
    /** Pending link, if any */
    pending: { id: string; expiresAt: string; sentAt: string | null } | null;
    amountChanged: boolean;
}

/** Status is derived from stored rows + the family's current agreed amount; nothing is auto-sent. */
export function deriveContractStatus(rows: ContractRowLite[], currentAmountPence: number, now: Date = new Date()): ContractStatusView {
    const byNewest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const signedRow = byNewest.find(r => r.status === 'signed' && r.signedAt);
    const open = byNewest.find(r => r.status === 'sent' || r.status === 'draft');
    const pending = open && open.status === 'sent' && open.expiresAt > now ? { id: open.id, expiresAt: open.expiresAt.toISOString(), sentAt: open.sentAt?.toISOString() ?? null } : null;
    const signed = signedRow ? { id: signedRow.id, signedAt: signedRow.signedAt!.toISOString(), amountPence: signedRow.amountPence, signerName: signedRow.signerName } : null;
    const amountChanged = !!signed && signed.amountPence !== currentAmountPence;

    let label: ContractStatusLabel;
    if (amountChanged) label = 'Amount changed — new contract needed';
    else if (signed) label = 'Signed';
    else if (pending) label = 'Sent';
    else if (open?.status === 'sent' || byNewest[0]?.status === 'expired') label = 'Expired';
    else label = 'Not sent';
    return { label, signed, pending, amountChanged };
}
