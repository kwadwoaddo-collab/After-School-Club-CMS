import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkSessionCapacity, holdSessionSlot, releaseSlotHold } from './capacity';
import { cascadeWaitlist, addToWaitlist } from './waitlist';
import { materialiseBookingPlan } from './plan';

const { mockDb, mockValues } = vi.hoisted(() => {
  const mockValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]) });
  const mockDb = {
    query: {
      clubSessions: { findFirst: vi.fn() },
      waitlistEntries: { findMany: vi.fn() },
      bookingPlans: { findFirst: vi.fn() },
      sessionExceptions: { findMany: vi.fn() },
      children: { findFirst: vi.fn().mockResolvedValue({ parent: { phone: '123', email: 'a@b.com' } }) },
    },
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: mockValues }),
    delete: vi.fn(),
    update: vi.fn(),
  };
  return { mockDb, mockValues };
});

vi.mock('@/db', () => ({
  db: mockDb
}));

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn(),
    and: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    inArray: vi.fn(),
    sql: vi.fn().mockReturnValue('sql'),
    asc: vi.fn(),
  };
});

describe('Business Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup select chain
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 2 }]) // 2 booked/held
      })
    });
    
    // Setup insert chain
    mockDb.insert.mockReturnValue({
      values: mockValues
    });
    
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(true)
    });
  });

  describe('Capacity Service', () => {
    it('calculates remaining capacity correctly', async () => {
      mockDb.query.clubSessions.findFirst.mockResolvedValueOnce({ capacity: 10 });
      
      const result = await checkSessionCapacity('sess-1', new Date('2026-10-10'));
      
      expect(result.totalCapacity).toBe(10);
      expect(result.bookedCount).toBe(2);
      expect(result.heldCount).toBe(2); // Two calls to select count (*): one for booked, one for holds
      expect(result.remainingCapacity).toBe(6);
      expect(result.isAvailable).toBe(true);
    });

    it('throws when session not found', async () => {
      mockDb.query.clubSessions.findFirst.mockResolvedValueOnce(null);
      await expect(checkSessionCapacity('invalid', new Date())).rejects.toThrow('Session not found');
    });

    it('holds slot when capacity is available', async () => {
      mockDb.query.clubSessions.findFirst.mockResolvedValueOnce({ capacity: 10 });
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }])
        })
      });

      const holdId = await holdSessionSlot('sess-1', new Date());
      expect(holdId).toBe('test-id');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('fails to hold slot when at capacity', async () => {
      mockDb.query.clubSessions.findFirst.mockResolvedValueOnce({ capacity: 10 });
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 5 }]) // 5 booked + 5 held = 10
        })
      });

      await expect(holdSessionSlot('sess-1', new Date())).rejects.toThrow('Session is at full capacity');
    });
  });

  describe('Waitlist Service', () => {
    it('adds to waitlist with correct position', async () => {
      mockDb.query.waitlistEntries.findMany.mockResolvedValueOnce([
        { position: 1 }, { position: 2 }
      ]);

      const entry = await addToWaitlist('org-1', 'sess-1', new Date(), 'child-1');
      
      // Expected to insert with position 3
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ position: 3 }));
    });

    it('cascades waitlist when capacity frees up', async () => {
      // Setup capacity mock to return 2 remaining slots
      mockDb.query.clubSessions.findFirst.mockResolvedValue({ capacity: 10 });
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 4 }]) // 4 booked + 4 held = 8 -> 2 remaining
        })
      });

      // Setup 2 people on waitlist
      const waiting = [
        { id: 'w1', position: 1 },
        { id: 'w2', position: 2 },
      ];
      mockDb.query.waitlistEntries.findMany.mockResolvedValueOnce(waiting);

      // Should offer only to first 2 people because capacity is 2
      // We would expect to see waitlist entries updated to 'offered'
      // Wait, cascadeWaitlist updates status via db.update! Let's mock update.
      mockDb.update = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
      
      await cascadeWaitlist('sess-1', new Date());
      
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('Plan Service', () => {
    it('materialises plan correctly skipping exceptions', async () => {
      // Mock plan
      mockDb.query.bookingPlans.findFirst.mockResolvedValueOnce({
        id: 'plan-1',
        status: 'active',
        organisationId: 'org-1',
        childId: 'child-1',
        term: {
          startDate: new Date('2026-09-01'), // Tue
          endDate: new Date('2026-09-14'), // 2 weeks (2 occurrences for Tue)
        },
        clubSession: {
          id: 'sess-1',
          centreId: 'centre-1',
          weekday: 2, // Tuesday
          startTime: '15:30:00',
          endTime: '18:00:00',
          price: '15.00'
        }
      });

      // One exception on the 8th
      mockDb.query.sessionExceptions.findMany.mockResolvedValueOnce([
        { date: new Date('2026-09-08') }
      ]);

      const count = await materialiseBookingPlan('plan-1');
      
      // We expect 1 booking created (Sept 1st), because Sept 8th is an exception
      expect(count).toBe(1);
      expect(mockDb.insert).toHaveBeenCalled();
      
      const insertArg = mockValues.mock.calls[0][0];
      expect(insertArg.length).toBe(1);
      expect(insertArg[0].startAt.getHours()).toBe(15);
      expect(insertArg[0].startAt.getMinutes()).toBe(30);
    });
  });
});
