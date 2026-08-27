/**
 * scripts/sentry-test-event.ts
 *
 * Sends ONE controlled test event to Sentry using the server-side SDK.
 * Uses the same DSN and config as the production instrumentation.ts.
 * Safe: no DB mutations, no business data, no communications.
 * Run with: DATABASE_URL=... NEXT_PUBLIC_SENTRY_DSN=... npx tsx scripts/sentry-test-event.ts
 */
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (!DSN) {
  console.error('ERROR: NEXT_PUBLIC_SENTRY_DSN is not set');
  process.exit(1);
}

console.log('DSN: PRESENT (value redacted)');
console.log('DSN host:', new URL(DSN).hostname);

Sentry.init({
  dsn: DSN,
  tracesSampleRate: 1,
  debug: true,
  enabled: true,
});

async function main() {
  const eventId = Sentry.captureException(
    new Error('7J-sentry-activation-verification-' + new Date().toISOString()),
    {
      tags: {
        milestone: '7J',
        type: 'activation-verification',
        environment: 'production-runtime-test',
      },
      level: 'info',
    }
  );

  console.log('Sentry event submitted, eventId:', eventId);

  // Flush to ensure the event is sent before process exits
  const flushed = await Sentry.flush(5000);
  console.log('Flush result:', flushed ? 'SUCCESS — event delivered to Sentry' : 'TIMEOUT — event may be queued');
}

main().catch(e => {
  console.error('Sentry test error:', e.message);
  process.exit(1);
});
