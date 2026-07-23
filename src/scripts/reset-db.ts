import { logger } from '@/lib/logger';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE importing db
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    logger.info('🔄 Resetting database... EVERY PIECE OF DATA WILL BE GONE.');

    const { db } = await import('../db');
    const {
        auditEvents,
        slotHolds,
        calendarBusy,
        bookingAttendees,
        bookings,
        childSubjects,
        children,
        parents,
        staffInvites,
        centreMemberships,
        centreAvailabilityRules,
        centres,
        verificationTokens,
        sessions,
        accounts,
        users,
        organisations,
        terms,
        clubSessions,
        sessionExceptions,
        bookingPlans
    } = await import('../db/schema');

    // We wrap each clear in try/catch to handle cases where some tables don't exist yet (e.g. before initial migration)
    const clearTable = async (name: string, deletePromise: Promise<any>) => {
        try {
            await deletePromise;
            logger.info(`  - Cleared: ${name}`);
        } catch (e: any) {
            logger.info(`  - Skipped: ${name} (might not exist yet: ${e.message || e})`);
        }
    };

    try {
        logger.info('🔄 Clearing tables...');
        await clearTable('bookingPlans', db.delete(bookingPlans));
        await clearTable('clubSessions', db.delete(clubSessions));
        await clearTable('terms', db.delete(terms));
        await clearTable('sessionExceptions', db.delete(sessionExceptions));
        await clearTable('auditEvents', db.delete(auditEvents));
        await clearTable('slotHolds', db.delete(slotHolds));
        await clearTable('calendarBusy', db.delete(calendarBusy));
        await clearTable('bookingAttendees', db.delete(bookingAttendees));
        await clearTable('bookings', db.delete(bookings));
        await clearTable('childSubjects', db.delete(childSubjects));
        await clearTable('children', db.delete(children));
        await clearTable('parents', db.delete(parents));
        await clearTable('staffInvites', db.delete(staffInvites));
        await clearTable('centreMemberships', db.delete(centreMemberships));
        await clearTable('centreAvailabilityRules', db.delete(centreAvailabilityRules));
        await clearTable('centres', db.delete(centres));
        await clearTable('sessions', db.delete(sessions));
        await clearTable('accounts', db.delete(accounts));
        await clearTable('verificationTokens', db.delete(verificationTokens));
        await clearTable('users', db.delete(users));
        await clearTable('organisations', db.delete(organisations));

        logger.info('✨ Database cleared successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Error resetting database:', error);
        process.exit(1);
    }
}

main();
