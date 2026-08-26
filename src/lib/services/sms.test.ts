import { describe, it, expect } from 'vitest';
import { smsService } from './sms';

describe('SMSService — Unconfigured Fail-Closed (Milestone 7F)', () => {
  it('returns false and error when Twilio is unconfigured', async () => {
    const result = await smsService.sendBookingConfirmation({
      parentPhone: '+447700900000',
      parentFirstName: 'Jane',
      childrenNames: 'Alice Doe',
      modality: 'in_person',
      startAt: new Date(),
      confirmationCode: 'TEST1234',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMS service not configured');
  });

  it('fails safely for cancellations when unconfigured', async () => {
    const result = await smsService.sendBookingCancellation({
      parentPhone: '+447700900000',
      parentFirstName: 'Jane',
      childrenNames: 'Alice Doe',
      startAt: new Date(),
      confirmationCode: 'TEST1234',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMS service not configured');
  });

  it('fails safely for reminders when unconfigured', async () => {
    const result = await smsService.sendReminder({
      parentPhone: '+447700900000',
      parentFirstName: 'Jane',
      childrenNames: 'Alice Doe',
      startAt: new Date(),
      hoursUntil: 24,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMS service not configured');
  });
});
