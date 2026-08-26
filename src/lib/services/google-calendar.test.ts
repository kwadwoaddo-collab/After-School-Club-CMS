import { describe, it, expect } from 'vitest';
import { googleCalendarService, buildBookingEventDetails } from './google-calendar';

describe('GoogleCalendarService — Unconfigured Fail-Closed (Milestone 7F)', () => {
  it('returns isAvailable: true when Google Calendar credentials are not configured', async () => {
    const result = await googleCalendarService.checkCalendarAvailability(
      new Date(),
      new Date(Date.now() + 3600000)
    );

    expect(result.isAvailable).toBe(true);
    expect(result.busy).toEqual([]);
  });

  it('returns null when attempting to create an event without credentials', async () => {
    const details = buildBookingEventDetails({
      children: [{ firstName: 'John', lastName: 'Doe', subjects: ['Maths'] }],
      parentEmail: 'parent@example.com',
      modality: 'in_person',
      startAt: new Date(),
      duration: 60,
      centreName: 'Sydenham Centre',
      centreAddress: '123 High Street',
    });

    const eventId = await googleCalendarService.createCalendarEvent(details);
    expect(eventId).toBeNull();
  });

  it('returns false when attempting to delete an event without credentials', async () => {
    const success = await googleCalendarService.deleteCalendarEvent('event-123');
    expect(success).toBe(false);
  });

  it('returns false when attempting to update an event without credentials', async () => {
    const success = await googleCalendarService.updateCalendarEvent('event-123', {
      summary: 'Updated Assessment',
    });
    expect(success).toBe(false);
  });

  it('builds event details accurately from booking input', () => {
    const details = buildBookingEventDetails({
      children: [{ firstName: 'Alice', lastName: 'Smith', subjects: ['English', 'Maths'] }],
      parentEmail: 'parent@example.com',
      parentPhone: '+447700900000',
      modality: 'in_person',
      startAt: new Date('2026-09-01T10:00:00Z'),
      duration: 45,
      centreName: 'Sydenham Centre',
      centreAddress: 'Sydenham Library',
    });

    expect(details.summary).toBe('Assessment: Alice Smith');
    expect(details.location).toBe('Sydenham Library');
    expect(details.attendeeEmail).toBe('parent@example.com');
  });
});
