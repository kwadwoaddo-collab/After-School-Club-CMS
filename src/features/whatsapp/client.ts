import { getGraphVersion } from './config';

export type GraphSendResult =
    | { ok: true; wamid: string }
    | { ok: false; code: string; message: string };

/** POSTs a message to the Cloud API. The token is only ever placed in the Authorization header. */
export async function sendGraphMessage(
    phoneNumberId: string,
    payload: unknown,
    token: string,
    fetchImpl: typeof fetch = fetch,
): Promise<GraphSendResult> {
    try {
        const res = await fetchImpl(`https://graph.facebook.com/${getGraphVersion()}/${encodeURIComponent(phoneNumberId)}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10_000),
            redirect: 'error',
        });
        const body = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { code?: number; message?: string } };
        const wamid = body.messages?.[0]?.id;
        if (res.ok && wamid) return { ok: true, wamid };
        return { ok: false, code: String(body.error?.code ?? res.status), message: String(body.error?.message ?? 'Send failed').slice(0, 300) };
    } catch {
        return { ok: false, code: 'network', message: 'Could not reach WhatsApp' };
    }
}
