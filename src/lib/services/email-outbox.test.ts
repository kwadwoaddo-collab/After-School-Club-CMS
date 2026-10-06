/**
 * CMS-OPS-REMEDIATION-1C V15 phase 3: pure unit tests (no database, no network, no real email/SMS).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/lib/org-approval-guard', () => ({ isPlatformAdmin: () => false }));

import {
  decideMaintenance,
  decidePreSend,
  extractRawToken,
  isWorkerEnabled,
  type RungFacts,
} from './email-outbox-dispatch';
import { buildIdempotencyKey, registerFastPathAfterCommit, resolveDiagnosticsScope } from './email-outbox';
import * as types from './email-outbox-types';

const dir = __dirname;
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');

function facts(over: Partial<RungFacts> = {}): RungFacts {
  return {
    id: 'o1', status: 'PENDING', claimToken: null, communicationType: 'BOOKING_CONFIRMATION', transitionVersion: 1,
    recipient: 'parent@example.com', bookingFound: true, parentFound: true, bookingStatus: 'confirmed', communicationVersion: 1,
    startAtPassed: false, parentBinned: false, ceilingReached: false, firstHeldSet: false, binnedHoldExpired: false,
    payload: { payloadVersion: 1, magicLink: 'https://x.test/p?token=abc' }, payloadSupported: true, hasRawLinkKey: true,
    linkMode: null, stamped: false, afterLatestStart: false, afterBackstop: false, tokenMatches: true, tokenExpired: false,
    tokenOutlivesGuard: true, dbNow: new Date(), ...over,
  };
}

describe('frozen constants (D-11)', () => {
  it('keeps the frozen values', () => {
    expect(types.PACING_WAIT_MAX_MS).toBe(1100);
    expect(types.PACING_RELEASE_DELAY_SECONDS).toBe(5);
    expect(types.PACING_MAX_STAMPS_PER_WINDOW).toBe(2);
    expect(types.POST_STAMP_MIN_TIMEOUT_MS).toBe(1000);
  });
  it('defines each frozen constant exactly once across the family', () => {
    for (const name of ['PACING_WAIT_MAX_MS', 'PACING_RELEASE_DELAY_SECONDS', 'POST_STAMP_MIN_TIMEOUT_MS']) {
      const defs = fs.readdirSync(dir).filter((f) => /^email-outbox.*\.ts$/.test(f) && !f.endsWith('.test.ts'))
        .filter((f) => new RegExp(`export const ${name}\\b`).test(read(f)));
      expect(defs).toEqual(['email-outbox-types.ts']);
    }
  });
});

describe('E4 ladder (pure)', () => {
  it('cancelled booking disposes a confirmation; sends nothing', () => {
    const d = decidePreSend(facts({ bookingStatus: 'cancelled' }));
    expect(d).toMatchObject({ kind: 'TARGET', target: { kind: 'DISPOSE', status: 'SKIPPED_CANCELLED' } });
  });
  it('version mismatch is SUPERSEDED', () => {
    expect(decidePreSend(facts({ communicationVersion: 2 }))).toMatchObject({ target: { status: 'SUPERSEDED' } });
  });
  it('BOOKING_CANCELLED on a non-cancelled booking is SUPERSEDED; on completed is past-session', () => {
    expect(decidePreSend(facts({ communicationType: 'BOOKING_CANCELLED', bookingStatus: 'confirmed' }))).toMatchObject({ target: { status: 'SUPERSEDED' } });
    expect(decidePreSend(facts({ communicationType: 'BOOKING_CANCELLED', bookingStatus: 'completed' }))).toMatchObject({ target: { status: 'SKIPPED_PAST_SESSION' } });
  });
  it('binned parent and pending booking hold; invalid recipient and missing payload reject', () => {
    expect(decidePreSend(facts({ parentBinned: true }))).toMatchObject({ target: { kind: 'HOLD', status: 'HELD_PARENT_BINNED' } });
    expect(decidePreSend(facts({ bookingStatus: 'pending' }))).toMatchObject({ target: { kind: 'HOLD', status: 'HELD_BOOKING_PENDING' } });
    expect(decidePreSend(facts({ recipient: 'not-an-email' }))).toMatchObject({ target: { status: 'FAILED_PERMANENT' } });
    expect(decidePreSend(facts({ payload: null, payloadSupported: false }))).toMatchObject({ target: { attentionReason: 'MISSING_PAYLOAD' } });
  });
  it('link choice: live matching token that outlives the guard => WITH_LINK, otherwise LINK_FREE', () => {
    expect(decidePreSend(facts())).toEqual({ kind: 'SEND', linkMode: 'WITH_LINK' });
    expect(decidePreSend(facts({ tokenOutlivesGuard: false }))).toEqual({ kind: 'SEND', linkMode: 'LINK_FREE' });
    expect(decidePreSend(facts({ tokenMatches: false }))).toEqual({ kind: 'SEND', linkMode: 'LINK_FREE' });
  });
  it('frozen WITH_LINK with a dead token is rejected; frozen mode is never re-chosen', () => {
    expect(decidePreSend(facts({ stamped: true, linkMode: 'WITH_LINK', tokenMatches: false }))).toMatchObject({ target: { attentionReason: 'LINK_INVALID_AFTER_FREEZE' } });
    expect(decidePreSend(facts({ stamped: true, linkMode: 'LINK_FREE' }))).toEqual({ kind: 'SEND', linkMode: 'LINK_FREE' });
  });
  it('maintenance and pre-send agree on every terminal disposal (single ladder)', () => {
    const variants: Partial<RungFacts>[] = [
      {}, { bookingFound: false }, { parentFound: false }, { communicationVersion: 3 }, { bookingStatus: 'cancelled' },
      { bookingStatus: 'rescheduled' }, { bookingStatus: 'completed' }, { startAtPassed: true }, { ceilingReached: true },
      { ceilingReached: true, status: 'HELD_BOOKING_PENDING' }, { ceilingReached: true, status: 'HELD_PARENT_BINNED' },
      { ceilingReached: true, status: 'HELD_PROVIDER_OPERATIONAL' }, { communicationType: 'BOOKING_CANCELLED', bookingStatus: 'cancelled' },
      { communicationType: 'BOOKING_CANCELLED', bookingStatus: 'confirmed' }, { communicationType: 'BOOKING_CANCELLED', startAtPassed: true, bookingStatus: 'cancelled' },
      { communicationType: 'BOOKING_RESCHEDULE' }, { parentBinned: true }, { parentBinned: true, binnedHoldExpired: true },
      { status: 'HELD_PARENT_BINNED', binnedHoldExpired: true }, { bookingStatus: 'pending' }, { status: 'HELD_BOOKING_PENDING', bookingStatus: 'confirmed' },
    ];
    for (const status of ['PENDING', 'HELD_PARENT_BINNED', 'HELD_BOOKING_PENDING'] as const) {
      for (const v of variants) {
        const f = facts({ status, ...v });
        const pre = decidePreSend(f);
        const m = decideMaintenance(f);
        if (m.action === 'DISPOSE' && !m.target.rung.match(/anchor|link/)) {
          expect(pre).toMatchObject({ kind: 'TARGET', target: { kind: 'DISPOSE', status: m.target.status } });
        }
        if (pre.kind === 'TARGET' && pre.target.kind === 'DISPOSE' && pre.target.rung !== '8') {
          expect(m.action).toBe('DISPOSE');
        }
      }
    }
  });
  it('maintenance backstop at 23 h disposes a stamped row; a stamped WITH_LINK row with a live token is untouched', () => {
    expect(decideMaintenance(facts({ stamped: true, afterBackstop: true, linkMode: 'LINK_FREE' }))).toMatchObject({ action: 'DISPOSE', target: { attentionReason: 'WINDOW_23H' } });
    expect(decideMaintenance(facts({ stamped: true, linkMode: 'WITH_LINK', status: 'RETRY_SCHEDULED' }))).toMatchObject({ action: 'NONE' });
  });
  it('maintenance scrubs an expired unstamped token and a LINK_FREE raw token', () => {
    expect(decideMaintenance(facts({ tokenExpired: true }))).toMatchObject({ scrub: true });
    expect(decideMaintenance(facts({ linkMode: 'LINK_FREE', stamped: true }))).toMatchObject({ scrub: true });
  });
});

describe('helpers', () => {
  it('extractRawToken', () => {
    expect(extractRawToken('https://x.test/p?token=abc')).toBe('abc');
    expect(extractRawToken('nonsense')).toBeNull();
    expect(extractRawToken(undefined)).toBeNull();
  });
  it('isWorkerEnabled: only the exact string "false" pauses', () => {
    expect(isWorkerEnabled({})).toBe(true);
    expect(isWorkerEnabled({ FEATURE_OUTBOX_WORKER_ENABLED: 'FALSE' })).toBe(true);
    expect(isWorkerEnabled({ FEATURE_OUTBOX_WORKER_ENABLED: '0' })).toBe(true);
    expect(isWorkerEnabled({ FEATURE_OUTBOX_WORKER_ENABLED: 'false' })).toBe(false);
  });
  it('buildIdempotencyKey never produces "vnull"', () => {
    expect(buildIdempotencyKey('BOOKING_CONFIRMATION', 'b1', 2)).toBe('booking_confirmation:b1:v2:parent');
    expect(() => buildIdempotencyKey('BOOKING_CONFIRMATION', 'b1', null as never)).toThrow();
    expect(() => buildIdempotencyKey('BOOKING_CONFIRMATION', 'b1', 0)).toThrow();
  });
  it('resolveDiagnosticsScope: non-admin requesting platform scope is NOT_FOUND', () => {
    expect(resolveDiagnosticsScope({ requestedScope: 'platform', email: 'a@b.test' })).toBe('NOT_FOUND');
    expect(resolveDiagnosticsScope({ email: 'a@b.test' })).toBe('TENANT');
  });
  it('registerFastPathAfterCommit never throws, even when the registrar throws', () => {
    expect(() => registerFastPathAfterCommit(() => { throw new Error('no request scope'); }, { origin: 'route' } as never)).not.toThrow();
  });
});

describe('source scans', () => {
  const family = fs.readdirSync(dir).filter((f) => /^email-outbox.*\.ts$/.test(f) && !f.endsWith('.test.ts'));
  it('no "use server" directive anywhere in the outbox family', () => {
    for (const f of family) expect(read(f)).not.toMatch(/^\s*['"]use server['"]/m);
  });
  it('import graph is acyclic: types -> classifier -> breaker -> claim -> dispatch -> maintenance -> outbox', () => {
    const order = ['email-outbox-types', 'email-outbox-classifier', 'email-outbox-breaker', 'email-outbox-claim', 'email-outbox-dispatch', 'email-outbox-maintenance', 'email-outbox'];
    order.forEach((mod, i) => {
      const src = read(`${mod}.ts`);
      for (const later of order.slice(i + 1)) {
        expect(src, `${mod} must not import ${later}`).not.toMatch(new RegExp(`from ['"]\\./${later}['"]`));
      }
    });
  });
  it('only the breaker module writes or locks the breaker table', () => {
    for (const f of family.filter((x) => x !== 'email-outbox-breaker.ts')) {
      const src = read(f);
      expect(src, f).not.toMatch(/UPDATE\s+booking_email_provider_state/i);
      expect(src, f).not.toMatch(/FROM\s+booking_email_provider_state[^`;]*FOR UPDATE|FOR UPDATE OF s\b/i);
    }
  });
  it('logger payloads in the dispatcher carry no recipient, token or payload fields', () => {
    const src = read('email-outbox-dispatch.ts');
    const calls = src.split('\n').filter((l) => /logger\.(info|warn|error)\(/.test(l));
    expect(calls.length).toBeGreaterThan(0);
    for (const l of calls) expect(l).not.toMatch(/\b(recipient|recipientEmail|magicLink|payload|email)\s*:/);
  });
  it('plan 306: "use server" files never export maxDuration, dynamic, revalidate or constants', () => {
    const actionFiles = [
      'src/app/portal/actions.ts',
      'src/app/portal/book/actions.ts',
    ];
    for (const f of actionFiles) {
      const fullPath = path.resolve(process.cwd(), f);
      const src = fs.readFileSync(fullPath, 'utf8');
      expect(src).toMatch(/^\s*['"]use server['"]/m);
      expect(src).not.toMatch(/export\s+const\s+maxDuration/);
      expect(src).not.toMatch(/export\s+const\s+dynamic/);
      expect(src).not.toMatch(/export\s+const\s+revalidate/);
    }
  });
  it('plan 307: api/bookings/route.ts and api/cron/email-outbox/route.ts export numeric maxDuration <= 300', async () => {
    const bRoute = await import('@/app/api/bookings/route');
    expect(typeof bRoute.maxDuration).toBe('number');
    expect(bRoute.maxDuration).toBeLessThanOrEqual(300);
    expect(bRoute.maxDuration).toBe(60);

    const cRoute = await import('@/app/api/cron/email-outbox/route');
    expect(typeof cRoute.maxDuration).toBe('number');
    expect(cRoute.maxDuration).toBeLessThanOrEqual(300);
    expect(cRoute.maxDuration).toBe(60);
  });
});

describe('real email.ts send path (SDK options pass-through)', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); delete process.env.RESEND_API_KEY; });
  it('passes AbortSignal and Idempotency-Key to the HTTP request', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    vi.doUnmock('@/lib/services/email');
    const mod = await vi.importActual<typeof import('./email')>('./email');
    const signal = AbortSignal.timeout(5000);
    const out = await mod.sendOutboxEmail({
      communicationType: 'BOOKING_CONFIRMATION', recipientEmail: 'p@example.com', linkMode: 'LINK_FREE', idempotencyKey: 'k-1', signal,
      payload: { payloadVersion: 1, parentFirstName: 'P', parentEmail: 'p@example.com', confirmationCode: 'C', children: [{ firstName: 'A', lastName: 'B', subjects: ['x'] }], modality: 'online', startAt: '2099-01-01T10:00:00Z', duration: 60 },
    } as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [unknown, RequestInit])[1];
    expect(init.signal).toBeDefined();
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('k-1');
    expect('response' in out ? out.response.error : 'thrown').toBeNull();
  });
});
