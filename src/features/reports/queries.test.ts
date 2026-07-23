import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOccupancyStats, getAttendanceStats } from './queries';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe('Reports Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOccupancyStats', () => {
    it('calculates occupancy percentage correctly', async () => {
      (db.execute as any).mockResolvedValue([
        { session_id: 's1', type: 'after_school', capacity: 30, total_bookings: 15 },
        { session_id: 's2', type: 'breakfast', capacity: 20, total_bookings: 20 },
        { session_id: 's3', type: 'holiday', capacity: 0, total_bookings: 0 },
      ]);

      const stats = await getOccupancyStats('centre1', new Date('2026-07-01'), new Date('2026-07-31'));
      
      expect(stats.length).toBe(3);
      expect(stats[0].occupancyPercent).toBe(50); // 15 / 30
      expect(stats[1].occupancyPercent).toBe(100); // 20 / 20
      expect(stats[2].occupancyPercent).toBe(0); // division by zero handled
    });
  });

  describe('getAttendanceStats', () => {
    it('calculates attendance and no-show rates correctly', async () => {
      (db.execute as any).mockResolvedValue([
        { total_attendees: 100, present_count: 85, absent_count: 5 }, // Remaining 10 might be marked as null/late/other
      ]);

      const stats = await getAttendanceStats('centre1', new Date('2026-07-01'), new Date('2026-07-31'));
      
      expect(stats.total).toBe(100);
      expect(stats.present).toBe(85);
      expect(stats.absent).toBe(5);
      expect(stats.attendanceRate).toBe(85); // 85 / 100
      expect(stats.noShowRate).toBe(5); // 5 / 100
    });
  });
});
