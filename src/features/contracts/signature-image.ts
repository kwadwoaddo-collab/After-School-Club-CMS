import { logger } from '@/lib/logger';

const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 4000;

const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const startsWith = (b: Buffer, magic: number[]) => magic.every((m, i) => b[i] === m);

/** Literal private/loopback hosts are refused so a stored URL cannot be used to probe the network. */
function isSafeHttpsUrl(raw: string): URL | null {
    let url: URL;
    try { url = new URL(raw); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.includes(':')) return null;
    if (/^(127|10|0)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
}

/**
 * Fetches the centre's signature image once, at send time, and returns it as a PNG/JPEG data URL so it is
 * frozen in the contract snapshot. Any problem returns null and the typed signatory name is used instead.
 */
export async function loadSignatureImage(rawUrl: string | null | undefined, fetchImpl: typeof fetch = fetch): Promise<string | null> {
    const url = rawUrl ? isSafeHttpsUrl(rawUrl.trim()) : null;
    if (!url) return null;
    try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
        if (!res.ok) return null;
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
        const mime = startsWith(bytes, PNG) ? 'image/png' : startsWith(bytes, JPEG) ? 'image/jpeg' : null;
        if (!mime) return null;
        return `data:${mime};base64,${bytes.toString('base64')}`;
    } catch (error) {
        logger.warn('[contracts] signature image could not be loaded; using typed signatory name', error);
        return null;
    }
}
