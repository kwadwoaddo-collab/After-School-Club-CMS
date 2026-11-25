'use server';
import { headers } from 'next/headers';
import { checkRateLimit, getClientIP, strictRateLimit } from '@/lib/rate-limit';
import { completeSigning } from '@/features/contracts/sign';
import { isWellFormedToken } from '@/features/contracts/tokens';

export type SubmitState = { status: 'idle' } | { status: 'error'; message: string } | { status: 'done'; emailed: boolean };

/** Public (no login). Next.js server actions reject cross-origin requests; the token authorises the single signing. */
export async function submitSignature(token: string, _prev: SubmitState, form: FormData): Promise<SubmitState> {
    const h = await headers();
    const ip = getClientIP(new Request('http://local', { headers: h }));
    const limit = await checkRateLimit(strictRateLimit, `contract-sign:${ip}`, { fallbackPolicy: 'fail-safe-local', localLimit: 5 });
    if (!limit.success) return { status: 'error', message: 'Too many attempts. Please wait a minute and try again.' };
    if (!isWellFormedToken(token)) return { status: 'error', message: 'This link is no longer available.' };
    const kind = form.get('signatureKind') === 'typed' ? 'typed' : 'drawn';
    const result = await completeSigning({
        token,
        signerName: String(form.get('signerName') ?? ''),
        agreed: form.get('agree') === 'on',
        kind,
        signature: String(form.get(kind === 'typed' ? 'typedSignature' : 'drawnSignature') ?? ''),
        ip,
        userAgent: h.get('user-agent') ?? '',
    });
    if (!result.ok) return { status: 'error', message: result.message };
    return { status: 'done', emailed: result.emailed };
}

