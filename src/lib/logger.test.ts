/**
 * Logger redaction regression tests — Milestone 7H
 *
 * Verifies that the central logger's redact() function suppresses all
 * known secret/PII field names before they reach Sentry or stdout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Sentry before importing logger so no real network calls happen
vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';

// Capture what logger.log() actually sends to console/Sentry
function captureLogOutput(fn: () => void): {
  consoleLine: string;
  sentryExtra: Record<string, unknown> | undefined;
} {
  const sentryMock = Sentry.captureMessage as ReturnType<typeof vi.fn>;
  sentryMock.mockClear();

  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  fn();
  const consoleLine = consoleSpy.mock.calls[0]?.[0] ?? '';
  consoleSpy.mockRestore();

  const sentryCall = sentryMock.mock.calls[0];
  const sentryExtra = sentryCall?.[1]?.extra as Record<string, unknown> | undefined;

  return { consoleLine, sentryExtra };
}

describe('logger redact()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Known secret key patterns ─────────────────────────────────────────────

  it('redacts fields containing "password"', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { password: 'hunter2', passwordHash: 'abc123' })
    );
    expect(sentryExtra?.password).toBe('[REDACTED]');
    expect(sentryExtra?.passwordHash).toBe('[REDACTED]');
  });

  it('redacts fields containing "token"', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { token: 'abc', resetToken: 'xyz', UPSTASH_REDIS_REST_TOKEN: 'secret' })
    );
    expect(sentryExtra?.token).toBe('[REDACTED]');
    expect(sentryExtra?.resetToken).toBe('[REDACTED]');
    expect(sentryExtra?.UPSTASH_REDIS_REST_TOKEN).toBe('[REDACTED]');
  });

  it('redacts fields containing "secret"', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { AUTH_SECRET: 'x', NEXTAUTH_SECRET: 'y', cronSecret: 'z' })
    );
    expect(sentryExtra?.AUTH_SECRET).toBe('[REDACTED]');
    expect(sentryExtra?.NEXTAUTH_SECRET).toBe('[REDACTED]');
    expect(sentryExtra?.cronSecret).toBe('[REDACTED]');
  });

  it('redacts fields containing "key"', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { RESEND_API_KEY: 're_xxx', apiKey: 'sk-xxx' })
    );
    expect(sentryExtra?.RESEND_API_KEY).toBe('[REDACTED]');
    expect(sentryExtra?.apiKey).toBe('[REDACTED]');
  });

  it('redacts fields containing "url" (covers DATABASE_URL)', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', {
        DATABASE_URL: 'postgresql://user:pass@neon.tech/neondb',
        connectionUrl: 'postgres://...',
      })
    );
    expect(sentryExtra?.DATABASE_URL).toBe('[REDACTED]');
    expect(sentryExtra?.connectionUrl).toBe('[REDACTED]');
  });

  it('redacts fields containing "authorization"', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { authorization: 'Bearer sk-xxx' })
    );
    expect(sentryExtra?.authorization).toBe('[REDACTED]');
  });

  it('redacts fields containing "cookie"', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { cookie: 'session=abc', sessionCookie: 'xyz' })
    );
    expect(sentryExtra?.cookie).toBe('[REDACTED]');
    expect(sentryExtra?.sessionCookie).toBe('[REDACTED]');
  });

  it('redacts fields containing "host" (covers connection hostnames)', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { dbHost: 'ep-super-dawn-abuicpc2.neon.tech', hostname: 'neon.tech' })
    );
    expect(sentryExtra?.dbHost).toBe('[REDACTED]');
    expect(sentryExtra?.hostname).toBe('[REDACTED]');
  });

  it('redacts fields containing "phone"', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { phone: '+447700900123', phoneNumber: '+44...' })
    );
    expect(sentryExtra?.phone).toBe('[REDACTED]');
    expect(sentryExtra?.phoneNumber).toBe('[REDACTED]');
  });

  // ── Email string redaction ─────────────────────────────────────────────────

  it('redacts email-like string values', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { recipient: 'user@example.com' })
    );
    expect(sentryExtra?.recipient).toBe('[REDACTED_EMAIL]');
  });

  // ── Non-secret fields preserved ───────────────────────────────────────────

  it('preserves non-sensitive fields for diagnostics', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', { bookingId: 'bk-123', orgId: 'org-456', status: 'failed' })
    );
    expect(sentryExtra?.bookingId).toBe('bk-123');
    expect(sentryExtra?.orgId).toBe('org-456');
    expect(sentryExtra?.status).toBe('failed');
  });

  // ── Nested redaction ──────────────────────────────────────────────────────

  it('redacts nested sensitive fields', () => {
    const { sentryExtra } = captureLogOutput(() =>
      logger.error('test', {
        meta: {
          requestSecret: 'hidden',
          requestId: 'req-123',
        },
      })
    );
    const meta = sentryExtra?.meta as Record<string, unknown>;
    expect(meta?.requestSecret).toBe('[REDACTED]');
    expect(meta?.requestId).toBe('req-123');
  });

  // ── Error instance handling ───────────────────────────────────────────────

  it('forwards Error instances to Sentry with errorName and errorMessage', () => {
    const sentryMock = Sentry.captureMessage as ReturnType<typeof vi.fn>;
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.error('something failed', new Error('DB connection refused'));

    consoleSpy.mockRestore();

    const sentryCall = sentryMock.mock.calls[0];
    const extra = sentryCall?.[1]?.extra as Record<string, unknown>;

    expect(extra?.errorName).toBe('Error');
    expect(extra?.errorMessage).toBe('DB connection refused');
    expect(typeof extra?.stack).toBe('string');
  });
});
