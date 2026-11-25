export type ContractRowLite = {
    id: string;
    status: 'draft' | 'sent' | 'signed' | 'expired' | 'revoked';
    expiresAt: Date;
    createdAt: Date;
    amountPence: number;
    childIds: string[];
    signedAt: Date | null;
    sentAt: Date | null;
    signerName: string | null;
    archivedAt: Date | null;
};

export type ContractStatusLabel = 'Not sent' | 'Sent' | 'Signed' | 'Expired' | 'Amount changed — new contract needed' | 'Children changed — new contract needed';

export interface ArchivedContractView {
    id: string;
    status: ContractRowLite['status'];
    amountPence: number;
    signedAt: string | null;
    archivedAt: string;
    signerName: string | null;
    /** Only signed contracts have a PDF to download */
    downloadable: boolean;
}

export interface ContractStatusView {
    label: ContractStatusLabel;
    /** The latest signed, non-archived contract, if any (download target) */
    signed: { id: string; signedAt: string; amountPence: number; signerName: string | null } | null;
    /** Pending link, if any */
    pending: { id: string; expiresAt: string; sentAt: string | null } | null;
    /** Latest contract that can be archived (signed, revoked or expired; not an open link) */
    archivable: { id: string; status: ContractRowLite['status'] } | null;
    amountChanged: boolean;
    childrenChanged: boolean;
    archived: ArchivedContractView[];
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id));

/**
 * Status is derived from stored rows + the family's current agreed amount and covered children;
 * nothing is auto-sent. Archived contracts never drive the status: archiving frees the family for a new one.
 */
export function deriveContractStatus(rows: ContractRowLite[], current: { amountPence: number; childIds: string[] } | null, now: Date = new Date()): ContractStatusView {
    const byNewest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const live = byNewest.filter(r => !r.archivedAt);
    const signedRow = live.find(r => r.status === 'signed' && r.signedAt);
    const open = live.find(r => r.status === 'sent' || r.status === 'draft');
    const pending = open && open.status === 'sent' && open.expiresAt > now ? { id: open.id, expiresAt: open.expiresAt.toISOString(), sentAt: open.sentAt?.toISOString() ?? null } : null;
    const signed = signedRow ? { id: signedRow.id, signedAt: signedRow.signedAt!.toISOString(), amountPence: signedRow.amountPence, signerName: signedRow.signerName } : null;
    const amountChanged = !!signed && !!current && signed.amountPence !== current.amountPence;
    // Contracts signed before child tracking have no recorded children, so nothing can be compared.
    const childrenChanged = !!signedRow && !!current && signedRow.childIds.length > 0 && !sameSet(signedRow.childIds, current.childIds);
    const archivableRow = live.find(r => r.status === 'signed' || r.status === 'revoked' || r.status === 'expired' || (r.status === 'sent' && r.expiresAt <= now));
    const archived: ArchivedContractView[] = byNewest.filter(r => r.archivedAt).map(r => ({
        id: r.id, status: r.status, amountPence: r.amountPence, signedAt: r.signedAt?.toISOString() ?? null,
        archivedAt: r.archivedAt!.toISOString(), signerName: r.signerName, downloadable: r.status === 'signed',
    }));

    let label: ContractStatusLabel;
    if (amountChanged) label = 'Amount changed — new contract needed';
    else if (childrenChanged) label = 'Children changed — new contract needed';
    else if (signed) label = 'Signed';
    else if (pending) label = 'Sent';
    else if (open?.status === 'sent' || live[0]?.status === 'expired') label = 'Expired';
    else label = 'Not sent';
    return { label, signed, pending, archivable: archivableRow ? { id: archivableRow.id, status: archivableRow.status } : null, amountChanged, childrenChanged, archived };
}
