import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verifies Meta's `X-Hub-Signature-256: sha256=<hex>` over the RAW request body, in constant time. */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string | null | undefined): boolean {
    if (!header || !appSecret) return false;
    const match = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
    if (!match) return false;
    const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
    const given = Buffer.from(match[1], 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Constant-time string equality (length-safe) for the GET verify token. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    const ha = createHmac('sha256', 'wa-verify').update(a).digest();
    const hb = createHmac('sha256', 'wa-verify').update(b).digest();
    return timingSafeEqual(ha, hb);
}
