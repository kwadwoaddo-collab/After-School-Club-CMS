import crypto from 'crypto';

/**
 * Generate a secure random token for email links
 */
export function generateMagicLinkToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a magic link token for safe database storage
 */
export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
