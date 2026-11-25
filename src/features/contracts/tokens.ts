import crypto from 'crypto';

export const CONTRACT_LINK_TTL_DAYS = 14;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/** 256-bit random token. Only its hash is stored. */
export function generateContractToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

export function hashContractToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function isWellFormedToken(token: unknown): token is string {
    return typeof token === 'string' && TOKEN_PATTERN.test(token);
}

export function contractExpiry(from: Date = new Date()): Date {
    return new Date(from.getTime() + CONTRACT_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export type LinkState = 'valid' | 'expired' | 'signed' | 'revoked' | 'unavailable';

/** What a stored contract row means for a visitor holding its link. */
export function linkState(row: { status: string; expiresAt: Date } | null | undefined, now: Date = new Date()): LinkState {
    if (!row) return 'unavailable';
    if (row.status === 'signed') return 'signed';
    if (row.status === 'revoked') return 'revoked';
    if (row.status !== 'sent') return 'unavailable';
    return row.expiresAt.getTime() > now.getTime() ? 'valid' : 'expired';
}
