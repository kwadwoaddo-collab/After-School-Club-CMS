import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WondeService, WondeStudent } from './wonde';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    query: {
      parents: { findMany: vi.fn() },
      children: { findMany: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

describe('WondeService', () => {
  let wondeService: WondeService;

  beforeEach(() => {
    vi.clearAllMocks();
    wondeService = new WondeService('org1', 'centre1');
  });

  it('should create new parent and student if no match exists', async () => {
    (db.query.parents.findMany as any).mockResolvedValue([]);
    (db.query.children.findMany as any).mockResolvedValue([]);

    const mockData: WondeStudent[] = [
      {
        id: 'w_1',
        forename: 'Alice',
        surname: 'Smith',
        date_of_birth: '2015-05-15',
        contact_details: [{ id: 'c_1', forename: 'Bob', surname: 'Smith', email: 'bob@example.com' }]
      }
    ];

    const results = await wondeService.syncStudents(mockData);
    
    expect(results.createdContacts).toBe(1);
    expect(results.createdStudents).toBe(1);
    expect(results.matchedContacts).toBe(0);
    expect(results.matchedStudents).toBe(0);
  });

  it('should match existing parent and create student if sibling added', async () => {
    (db.query.parents.findMany as any).mockResolvedValue([{ id: 'p1', email: 'carol@jones.com' }]);
    (db.query.children.findMany as any).mockResolvedValue([]);

    const mockData: WondeStudent[] = [
      {
        id: 'w_2',
        forename: 'Charlie',
        surname: 'Jones',
        date_of_birth: '2016-06-16',
        contact_details: [{ id: 'c_2', forename: 'Carol', surname: 'Jones', email: 'carol@jones.com' }]
      }
    ];

    const results = await wondeService.syncStudents(mockData);
    
    expect(results.createdContacts).toBe(0);
    expect(results.matchedContacts).toBe(1);
    expect(results.createdStudents).toBe(1);
  });

  it('should match existing student and parent', async () => {
    (db.query.parents.findMany as any).mockResolvedValue([{ id: 'p1', email: 'carol@jones.com' }]);
    (db.query.children.findMany as any).mockResolvedValue([{ id: 'c1', dateOfBirth: new Date('2016-06-16T00:00:00.000Z') }]);

    const mockData: WondeStudent[] = [
      {
        id: 'w_2_dup',
        forename: 'Charlie',
        surname: 'Jones',
        date_of_birth: '2016-06-16', // same DOB
        contact_details: [{ id: 'c_2_dup', forename: 'Carol', surname: 'Jones', email: 'carol@jones.com' }]
      }
    ];

    const results = await wondeService.syncStudents(mockData);
    
    expect(results.createdContacts).toBe(0);
    expect(results.matchedContacts).toBe(1);
    expect(results.createdStudents).toBe(0);
    expect(results.matchedStudents).toBe(1);
  });
});
