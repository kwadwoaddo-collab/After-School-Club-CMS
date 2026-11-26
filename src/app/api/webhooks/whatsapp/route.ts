import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getWhatsAppAppSecret, getWhatsAppVerifyToken } from '@/features/whatsapp/config';
import { safeEqual, verifyMetaSignature } from '@/features/whatsapp/signature';
import { processWhatsAppWebhook } from '@/features/whatsapp/webhook';

/**
 * Meta WhatsApp Cloud API webhook.
 * GET  — subscription handshake (hub.verify_token, constant-time compare).
 * POST — delivery statuses + STOP replies; body is trusted only after X-Hub-Signature-256 verifies against the raw body.
 * Public by design (Meta calls it) like /api/webhooks/stripe-invoice: authenticity comes from the signature, not a session.
 * Stays active when FF_WHATSAPP_API is off so opt-out replies are always honoured.
 */
export async function GET(req: NextRequest) {
    const p = req.nextUrl.searchParams;
    const expected = getWhatsAppVerifyToken();
    if (p.get('hub.mode') === 'subscribe' && expected && safeEqual(p.get('hub.verify_token'), expected)) {
        return new NextResponse(p.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
    const secret = getWhatsAppAppSecret();
    if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });

    const raw = await req.text();
    if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'), secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    try {
        const result = await processWhatsAppWebhook(payload as Parameters<typeof processWhatsAppWebhook>[0]);
        return NextResponse.json({ ok: true, ...result });
    } catch (err) {
        logger.error('[whatsapp webhook] processing failed', err);
        return NextResponse.json({ error: 'Processing failed' }, { status: 500 }); // Meta retries; processing is idempotent
    }
}
