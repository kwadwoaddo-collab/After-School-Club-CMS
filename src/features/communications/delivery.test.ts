import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  escapeHtml,
  sanitizeErrorMessage,
  classifyError,
  processBroadcastDeliveries,
  reconcileBroadcastStatus,
  MAX_DELIVERY_ATTEMPTS,
} from './delivery';
import { db } from '@/db';
import { sendEmail } from '@/lib/services/email';

// Top-level Mocks
vi.mock('@/lib/services/email', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Broadcast Delivery Processor & Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'audit-1' }]),
      }),
    } as any);

    vi.spyOn(db, 'update').mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      }),
    } as any);
  });

  describe('escapeHtml', () => {
    it('correctly escapes all critical HTML characters', () => {
      const input = '<script>alert("xss" & \'test\')</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot; &amp; &#39;test&#39;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('handles clean strings without modification', () => {
      expect(escapeHtml('Hello Parents!')).toBe('Hello Parents!');
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('redacts Resend API keys', () => {
      const raw = 'Failed to connect using key re_123456789_abcdefg to provider';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('re_123456789_abcdefg');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });

    it('redacts Bearer authentication tokens', () => {
      const raw = 'Authorization failed for Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');
    });

    it('redacts recipient email addresses (PII protection)', () => {
      const raw = 'Could not deliver message to parent.john.doe@example.org due to bounce';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('parent.john.doe@example.org');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
    });

    it('strips raw HTML markup', () => {
      const raw = '<html><body><h1>502 Bad Gateway</h1><p>Server error</p></body></html>';
      const sanitized = sanitizeErrorMessage(raw);
      expect(sanitized).not.toContain('<h1>');
      expect(sanitized).not.toContain('</html>');
      expect(sanitized).toContain('502 Bad Gateway Server error');
    });

    it('truncates excessively long messages to at most 500 characters', () => {
      const longMessage = 'A'.repeat(800);
      const sanitized = sanitizeErrorMessage(longMessage);
      expect(sanitized.length).toBeLessThanOrEqual(500);
      expect(sanitized.endsWith('...')).toBe(true);
    });
  });

  describe('classifyError', () => {
    it('identifies unconfigured service as non-retryable', () => {
      const { isRetryable } = classifyError('Email service not configured');
      expect(isRetryable).toBe(false);
    });

    it('identifies invalid recipient or validation error as non-retryable', () => {
      expect(classifyError('validation_error: invalid email domain').isRetryable).toBe(false);
      expect(classifyError('missing_required_field').isRetryable).toBe(false);
      expect(classifyError('invalid_from_address').isRetryable).toBe(false);
      expect(classifyError('Unsupported delivery channel').isRetryable).toBe(false);
    });

    it('identifies rate limits (429) as retryable', () => {
      const res = classifyError('rate_limit_exceeded: 429 Too Many Requests');
      expect(res.isRetryable).toBe(true);
    });

    it('identifies transient 5xx server errors as retryable', () => {
      expect(classifyError('500 Internal Server Error').isRetryable).toBe(true);
      expect(classifyError('502 Bad Gateway').isRetryable).toBe(true);
      expect(classifyError('503 Service Unavailable').isRetryable).toBe(true);
    });

    it('identifies network timeouts as retryable', () => {
      expect(classifyError('ETIMEDOUT: Connection timed out').isRetryable).toBe(true);
      expect(classifyError('ECONNRESET').isRetryable).toBe(true);
      expect(classifyError('fetch failed').isRetryable).toBe(true);
    });

    it('PM-2B.C: correctly classifies Resend 409 concurrent request as retryable', () => {
      const res = classifyError('Resend 409: concurrent_idempotent_requests');
      expect(res.isRetryable).toBe(true);
    });

    it('PM-2B.C: correctly classifies Resend 409 payload mismatch as terminal non-retryable', () => {
      const res1 = classifyError('Resend 409: invalid_idempotent_request');
      expect(res1.isRetryable).toBe(false);

      const res2 = classifyError('409 Conflict: idempotent_parameter_mismatch');
      expect(res2.isRetryable).toBe(false);
    });
  });

  describe('processBroadcastDeliveries & reconcileBroadcastStatus logic', () => {
    it('passes delivery.id as Resend idempotencyKey to prevent duplicate sends', async () => {
      const mockDelivery = {
        id: 'del-1234-uuid',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        parentId: 'p-1',
        recipientEmail: 'parent@synthetic.org',
        recipientName: 'Jane',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1,
        claimToken: 'worker-token-abc',
      };

      const mockBroadcast = {
        id: 'b-1',
        organisationId: 'org-1',
        subject: 'Weekly Announcement',
        message: 'Important session details.',
      };

      // Mock execute returning claimed row
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [mockDelivery],
      } as any);

      // Mock select returning broadcast
      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast]),
        }),
      } as any);

      // Mock update
      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      });
      vi.spyOn(db, 'update').mockReturnValue({
        set: updateSetMock,
      } as any);

      vi.spyOn(db, 'insert').mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      } as any);

      // Mock successful email send
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: true,
        messageId: 'resend-msg-999',
      });

      // Mock reconcileBroadcastStatus execute
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 1, failed_count: 0, pending_count: 0, total_count: 1 }],
      } as any);

      const result = await processBroadcastDeliveries({
        broadcastId: 'b-1',
        limit: 10,
        workerToken: 'worker-token-abc',
      });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'parent@synthetic.org',
          subject: 'Weekly Announcement',
          organisationId: 'org-1',
          idempotencyKey: 'del-1234-uuid', // Resend Idempotency-Key forwarded
        })
      );
      expect(result.sentCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('marks row FAILED immediately for permanent provider error', async () => {
      const mockDelivery = {
        id: 'del-perm-fail',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'bad-email@synthetic.org',
        recipientName: 'Bob',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1,
        claimToken: 'worker-token-abc',
      };

      const mockBroadcast = {
        id: 'b-1',
        organisationId: 'org-1',
        subject: 'Weekly Update',
        message: 'Hello!',
      };

      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [mockDelivery],
      } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast]),
        }),
      } as any);

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      });
      vi.spyOn(db, 'update').mockReturnValue({
        set: updateSetMock,
      } as any);

      // Provider rejects with permanent validation error
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'validation_error: Domain not verified',
      });

      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 0, failed_count: 1, pending_count: 0, total_count: 1 }],
      } as any);

      const result = await processBroadcastDeliveries({
        broadcastId: 'b-1',
        limit: 10,
        workerToken: 'worker-token-abc',
      });

      expect(result.failedCount).toBe(1);
      expect(result.retriedCount).toBe(0);

      // Verify update marked row FAILED
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          lastError: expect.stringContaining('validation_error'),
        })
      );
    });

    it('returns row to PENDING with exponential backoff for transient error under attempt limit', async () => {
      const mockDelivery = {
        id: 'del-retryable',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'retry@synthetic.org',
        recipientName: 'Alice',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1, // First attempt
        claimToken: 'worker-token-abc',
      };

      const mockBroadcast = {
        id: 'b-1',
        organisationId: 'org-1',
        subject: 'Notice',
        message: 'Class cancelled today.',
      };

      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [mockDelivery],
      } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast]),
        }),
      } as any);

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      });
      vi.spyOn(db, 'update').mockReturnValue({
        set: updateSetMock,
      } as any);

      // Transient 429 rate limit
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: 'rate_limit_exceeded: 429 Too many requests',
      });

      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 0, failed_count: 0, pending_count: 1, total_count: 1 }],
      } as any);

      const result = await processBroadcastDeliveries({
        broadcastId: 'b-1',
        limit: 10,
        workerToken: 'worker-token-abc',
      });

      expect(result.retriedCount).toBe(1);
      expect(result.failedCount).toBe(0);

      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING',
          nextAttemptAt: expect.any(Date),
          lastError: expect.stringContaining('rate_limit_exceeded'),
        })
      );
    });

    it('marks row FAILED when MAX_DELIVERY_ATTEMPTS is exhausted', async () => {
      const mockDelivery = {
        id: 'del-exhausted',
        organisationId: 'org-1',
        broadcastId: 'b-1',
        recipientEmail: 'retry@synthetic.org',
        recipientName: 'Alice',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: MAX_DELIVERY_ATTEMPTS, // 3rd attempt
        claimToken: 'worker-token-abc',
      };

      const mockBroadcast = {
        id: 'b-1',
        organisationId: 'org-1',
        subject: 'Notice',
        message: 'Class cancelled today.',
      };

      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [mockDelivery],
      } as any);

      vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast]),
        }),
      } as any);

      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'b-1', organisationId: 'org-1' }]),
        }),
      });
      vi.spyOn(db, 'update').mockReturnValue({
        set: updateSetMock,
      } as any);

      // Transient error, but attempts exhausted
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: '503 Service Unavailable',
      });

      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 0, failed_count: 1, pending_count: 0, total_count: 1 }],
      } as any);

      const result = await processBroadcastDeliveries({
        broadcastId: 'b-1',
        limit: 10,
        workerToken: 'worker-token-abc',
      });

      expect(result.failedCount).toBe(1);
      expect(result.retriedCount).toBe(0);

      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          lastError: expect.stringContaining('503 Service Unavailable'),
        })
      );
    });

    it('PM-2B.C: proves attempt 1 payload === attempt 2 retry payload for the same delivery (Resend idempotency requirement)', async () => {
      const mockDelivery = {
        id: 'del-stable-payload-1',
        organisationId: 'org-test',
        broadcastId: 'b-stable-1',
        parentId: 'p-1',
        recipientEmail: 'parent.stable@example.org',
        recipientName: 'Jane Stable',
        channel: 'email',
        status: 'PROCESSING',
        attemptCount: 1,
        claimToken: 'token-1',
      };

      const mockBroadcast = {
        id: 'b-stable-1',
        organisationId: 'org-test',
        subject: 'Immutable Broadcast Subject',
        message: 'Immutable Broadcast Body text.',
      };

      // Attempt 1: Transient 429 error
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [mockDelivery],
      } as any);
      vi.spyOn(db, 'select').mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast]),
        }),
      } as any);
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: false,
        error: '429 rate limit exceeded',
      });
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 0, failed_count: 0, pending_count: 1, total_count: 1 }],
      } as any);

      await processBroadcastDeliveries({ broadcastId: 'b-stable-1', workerToken: 'token-1' });

      // Extract payload for attempt 1
      const attempt1Payload = vi.mocked(sendEmail).mock.calls[0][0];

      // Attempt 2 (Retry): Worker claims the retried row
      const mockDeliveryAttempt2 = {
        ...mockDelivery,
        attemptCount: 2,
        claimToken: 'token-2',
      };
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [mockDeliveryAttempt2],
      } as any);
      vi.spyOn(db, 'select').mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast]),
        }),
      } as any);
      vi.mocked(sendEmail).mockResolvedValueOnce({
        success: true,
        messageId: 'msg-success-attempt2',
      });
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 1, failed_count: 0, pending_count: 0, total_count: 1 }],
      } as any);

      await processBroadcastDeliveries({ broadcastId: 'b-stable-1', workerToken: 'token-2' });

      // Extract payload for attempt 2
      const attempt2Payload = vi.mocked(sendEmail).mock.calls[1][0];

      // Assert complete equality of attempt 1 and attempt 2 payloads
      expect(attempt1Payload).toEqual(attempt2Payload);
      expect(attempt1Payload.idempotencyKey).toBe(mockDelivery.id);
      expect(attempt2Payload.idempotencyKey).toBe(mockDelivery.id);
      expect(attempt1Payload.to).toBe('parent.stable@example.org');
      expect(attempt1Payload.subject).toBe('Immutable Broadcast Subject');
      expect(attempt1Payload.html).toBe('<p>Dear Jane Stable,</p><p>Immutable Broadcast Body text.</p>');
    });

    it('PM-2B.C: proves intentional payload mutation does not silently reuse the same delivery idempotency key', async () => {
      const delivery1Id = 'del-idempotent-key-1';
      const delivery2Id = 'del-idempotent-key-2'; // Mutated broadcast requires new delivery row

      const mockBroadcast1 = {
        id: 'b-1',
        organisationId: 'org-test',
        subject: 'Version 1',
        message: 'First text',
      };

      const mockBroadcast2 = {
        id: 'b-2',
        organisationId: 'org-test',
        subject: 'Version 2 (Mutated)',
        message: 'Second text (Mutated)',
      };

      // First delivery
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{
          id: delivery1Id,
          organisationId: 'org-test',
          broadcastId: 'b-1',
          recipientEmail: 'parent@example.org',
          recipientName: 'Parent',
          channel: 'email',
          status: 'PROCESSING',
          attemptCount: 1,
          claimToken: 'tok-1',
        }],
      } as any);
      vi.spyOn(db, 'select').mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast1]),
        }),
      } as any);
      vi.mocked(sendEmail).mockResolvedValueOnce({ success: true, messageId: 'm-1' });
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 1, failed_count: 0, pending_count: 0, total_count: 1 }],
      } as any);

      await processBroadcastDeliveries({ broadcastId: 'b-1', workerToken: 'tok-1' });
      const call1 = vi.mocked(sendEmail).mock.calls[vi.mocked(sendEmail).mock.calls.length - 1][0];

      // Second delivery with mutated content
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{
          id: delivery2Id,
          organisationId: 'org-test',
          broadcastId: 'b-2',
          recipientEmail: 'parent@example.org',
          recipientName: 'Parent',
          channel: 'email',
          status: 'PROCESSING',
          attemptCount: 1,
          claimToken: 'tok-2',
        }],
      } as any);
      vi.spyOn(db, 'select').mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockBroadcast2]),
        }),
      } as any);
      vi.mocked(sendEmail).mockResolvedValueOnce({ success: true, messageId: 'm-2' });
      vi.spyOn(db, 'execute').mockResolvedValueOnce({
        rows: [{ sent_count: 1, failed_count: 0, pending_count: 0, total_count: 1 }],
      } as any);

      await processBroadcastDeliveries({ broadcastId: 'b-2', workerToken: 'tok-2' });
      const call2 = vi.mocked(sendEmail).mock.calls[vi.mocked(sendEmail).mock.calls.length - 1][0];

      // Payloads differ, and idempotency keys MUST differ
      expect(call1.html).not.toEqual(call2.html);
      expect(call1.subject).not.toEqual(call2.subject);
      expect(call1.idempotencyKey).not.toEqual(call2.idempotencyKey);
      expect(call1.idempotencyKey).toBe(delivery1Id);
      expect(call2.idempotencyKey).toBe(delivery2Id);
    });
  });
});
