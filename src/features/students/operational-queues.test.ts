import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { followUpBucket, normalizeFollowUpFilter } from './follow-up-queue';
import { studentFollowUpFilterSql, studentFollowUpOrderSql, studentLifecycleStatusSql, studentRestartBillingReviewSql } from './lifecycle-queries';
import { expectedRosterIds } from './expected-roster';
import { compileDailyRegisterSlots, type RegisterChild, type RegisterBooking } from '@/lib/attendance';
const dialect = new PgDialect();
const today = '2026-10-26';
describe('call queue dates', () => {
    it('classifies overdue, today, upcoming and unscheduled using the supplied UK date', () => {
        expect(followUpBucket('2026-10-25', today)).toBe('overdue');
        expect(followUpBucket(today, today)).toBe('today');
        expect(followUpBucket('2026-10-27', today)).toBe('upcoming');
        expect(followUpBucket(null, today)).toBe('unscheduled');
        expect(normalizeFollowUpFilter('unsafe')).toBe('all');
    });
    it('uses SQL filters before pagination and deterministic null-last due ordering', () => {
        for (const [filter, operator] of [['overdue', '<'], ['today', '='], ['upcoming', '>']] as const) {
            const query = dialect.sqlToQuery(studentFollowUpFilterSql(filter, today));
            expect(query.sql).toContain(` ${operator} `); expect(query.params).toContain(today);
            expect(query.sql).toContain('organisation_id');
        }
        expect(dialect.sqlToQuery(studentFollowUpFilterSql('unscheduled', today)).sql).toContain('IS NULL');
        expect(dialect.sqlToQuery(studentFollowUpOrderSql()).sql).toContain('ASC NULLS LAST');
    });
    it('evaluates the latest effective lifecycle event with date, tenant and tie-break guards', () => {
        const query = dialect.sqlToQuery(studentLifecycleStatusSql('2026-09-01'));
        expect(query.params).toContain('2026-09-01'); expect(query.sql).toContain('effective_date <=');
        expect(query.sql).toContain('organisation_id');
        expect(query.sql).toContain('e.effective_date DESC, e.created_at DESC, e.id DESC');
        const restart = dialect.sqlToQuery(studentRestartBillingReviewSql(today));
        expect(restart.sql).toContain("e.status = 'active' AND e.fee_review_confirmed = false");
        expect(restart.sql).toContain('false)'); expect(restart.params).toContain(today);
    });
});
const parent = { id: 'parent', firstName: 'Dummy', lastName: 'Parent', email: 'dummy@example.com', phone: '000' };
const child = { id: 'child', firstName: 'Dummy', lastName: 'Student', schoolYear: 'Y3', registeredSessions: ['Monday 3.45pm'], parent, centre: null, effectiveEnrolmentStatus: 'paused' } as unknown as RegisterChild & { effectiveEnrolmentStatus: string };
describe('expected attendance and historical evidence', () => {
    it('removes paused/stopped expected sessions while keeping active and legacy children eligible', () => {
        expect([...expectedRosterIds([{ id: 'pause', effectiveEnrolmentStatus: 'paused' }, { id: 'stop', effectiveEnrolmentStatus: 'stopped' }, { id: 'active', effectiveEnrolmentStatus: 'active' }, { id: 'legacy' }])]).toEqual(['active', 'legacy']);
        const slots = compileDailyRegisterSlots({ targetDate: new Date('2026-10-26T12:00:00Z'), allChildrenAtCentre: [child], dayBookings: [], expectedChildIds: expectedRosterIds([child]) });
        expect(slots.flatMap(slot => slot.regulars)).toHaveLength(0);
    });
    it('retains actual attendance for a paused child even when their weekly schedule matches', () => {
        const booking = { id: 'booking', startAt: new Date('2026-10-26T15:45:00Z'), parent, centre: null, attendees: [{ id: 'actual', childId: child.id, child, attendanceStatus: 'present', attendanceNote: 'Existing evidence', lateMinutes: null, checkInAt: new Date('2026-10-26T15:45:00Z'), checkOutAt: null }] } as unknown as RegisterBooking;
        const slots = compileDailyRegisterSlots({ targetDate: new Date('2026-10-26T12:00:00Z'), allChildrenAtCentre: [child], dayBookings: [booking], expectedChildIds: expectedRosterIds([child]) });
        const actual = slots.flatMap(slot => [...slot.regulars, ...slot.catchups]);
        expect(actual).toHaveLength(1); expect(actual[0].id).toBe('actual'); expect(actual[0].attendanceStatus).toBe('present'); expect(actual[0].attendanceNote).toBe('Existing evidence'); expect(actual[0].parentFirstName).toBe('Dummy');
    });
    it('a selected date before a pause still generates its expected session', () => {
        const activeThen = { ...child, effectiveEnrolmentStatus: 'active' };
        const slots = compileDailyRegisterSlots({ targetDate: new Date('2026-10-19T12:00:00Z'), allChildrenAtCentre: [activeThen], dayBookings: [], expectedChildIds: expectedRosterIds([activeThen]) });
        expect(slots.flatMap(slot => slot.regulars)).toHaveLength(1);
    });
});
