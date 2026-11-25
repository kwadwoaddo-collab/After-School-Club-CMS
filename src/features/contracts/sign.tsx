import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '@/db';
import { auditEvents, contractPdfs, contracts, parents } from '@/db/schema';
import { emailService } from '@/lib/services/email';
import { logger } from '@/lib/logger';
import { ContractPdf, type SignatureBlock } from './ContractPdf';
import { hashContractToken, isWellFormedToken, linkState, type LinkState } from './tokens';
import { formatContractDate, type ContractValues } from './template';

export interface SigningView {
    values: ContractValues;
    templateVersion: string;
}

export type LookupResult = { state: Exclude<LinkState, 'valid'> } | { state: 'valid'; view: SigningView };

/** Same answer for unknown, malformed and unusable tokens so links cannot be enumerated. */
export async function lookupContractForSigning(token: string, now: Date = new Date()): Promise<LookupResult> {
    if (!isWellFormedToken(token)) return { state: 'unavailable' };
    const [row] = await db.select({ status: contracts.status, expiresAt: contracts.expiresAt, snapshot: contracts.snapshot, templateVersion: contracts.templateVersion })
        .from(contracts).where(eq(contracts.tokenHash, hashContractToken(token)));
    const state = linkState(row, now);
    if (state !== 'valid') return { state };
    return { state: 'valid', view: { values: JSON.parse(row!.snapshot) as ContractValues, templateVersion: row!.templateVersion } };
}

const MAX_SIGNATURE_BYTES = 150 * 1024;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface SignInput {
    token: string;
    signerName: string;
    agreed: boolean;
    kind: 'drawn' | 'typed';
    signature: string;
    ip: string;
    userAgent: string;
}

export type SignResult = { ok: true; emailed: boolean } | { ok: false; reason: 'invalid' | 'unavailable'; message: string };

export function validateSignatureInput(input: Pick<SignInput, 'signerName' | 'agreed' | 'kind' | 'signature'>): string | null {
    const name = input.signerName.trim();
    if (!input.agreed) return 'Tick the box to confirm you have read and agree.';
    if (name.length < 2 || name.length > 200) return 'Enter your full name.';
    if (input.kind === 'typed') {
        const typed = input.signature.trim();
        if (typed.length < 2 || typed.length > 120) return 'Type your signature.';
        return null;
    }
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(input.signature);
    if (!match) return 'Draw your signature, or choose to type it.';
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length > MAX_SIGNATURE_BYTES || bytes.length < PNG_MAGIC.length || !bytes.subarray(0, 8).equals(PNG_MAGIC)) return 'Draw your signature, or choose to type it.';
    return null;
}

export async function completeSigning(input: SignInput, now: Date = new Date()): Promise<SignResult> {
    const invalid = validateSignatureInput(input);
    if (invalid) return { ok: false, reason: 'invalid', message: invalid };
    if (!isWellFormedToken(input.token)) return { ok: false, reason: 'unavailable', message: 'This link is no longer available.' };
    const tokenHash = hashContractToken(input.token);

    const [row] = await db.select().from(contracts).where(eq(contracts.tokenHash, tokenHash));
    if (linkState(row, now) !== 'valid') return { ok: false, reason: 'unavailable', message: 'This link is no longer available.' };

    const values = JSON.parse(row.snapshot) as ContractValues;
    const signerName = input.signerName.trim();
    const signature: SignatureBlock = {
        signerName, kind: input.kind, data: input.kind === 'typed' ? input.signature.trim() : input.signature,
        signedDate: formatContractDate(now), signedAtIso: now.toISOString(),
    };
    const pdf = Buffer.from(await renderToBuffer(<ContractPdf values={values} templateVersion={row.templateVersion} signature={signature} contractId={row.id} />));
    const sha256 = crypto.createHash('sha256').update(pdf).digest('hex');

    // Single use: only one concurrent submit can move sent → signed.
    const claimed = await db.transaction(async tx => {
        const updated = await tx.update(contracts).set({
            status: 'signed', signedAt: now, signerName, signatureKind: input.kind, signatureData: signature.data,
            signerIp: input.ip.slice(0, 64), signerUserAgent: input.userAgent.slice(0, 400), updatedAt: now,
        }).where(and(eq(contracts.id, row.id), eq(contracts.tokenHash, tokenHash), eq(contracts.status, 'sent'))).returning({ id: contracts.id });
        if (updated.length === 0) return false;
        await tx.insert(contractPdfs).values({ contractId: row.id, content: pdf, sizeBytes: pdf.length, sha256 });
        await tx.insert(auditEvents).values({ organisationId: row.organisationId, userId: null, eventType: 'contract_signed', eventData: JSON.stringify({ contractId: row.id, amountPence: row.amountPence, templateVersion: row.templateVersion, templateHash: row.templateHash, pdfSha256: sha256 }) });
        return true;
    });
    if (!claimed) return { ok: false, reason: 'unavailable', message: 'This link is no longer available.' };

    // Best effort: the signature is already recorded; a failed email can be re-sent from the family page.
    let emailed = false;
    try {
        const [parent] = await db.select({ email: parents.email, firstName: parents.firstName }).from(parents).where(and(eq(parents.id, row.parentId), eq(parents.organisationId, row.organisationId)));
        if (parent?.email) {
            const sent = await emailService.sendSignedContractCopy({ parentEmail: parent.email, parentName: parent.firstName, providerName: values.provider.providerName, pdf, filename: 'childcare-service-agreement.pdf' });
            emailed = sent.success;
            if (emailed) await db.update(contracts).set({ copyEmailedAt: new Date() }).where(eq(contracts.id, row.id));
        }
    } catch (error) {
        logger.error('[contracts] signed copy email failed', error);
    }
    return { ok: true, emailed };
}
