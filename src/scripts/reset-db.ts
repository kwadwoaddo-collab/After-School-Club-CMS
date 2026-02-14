import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables BEFORE importing db
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    console.log('🔄 Resetting database... EVERY PIECE OF DATA WILL BE GONE.');

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
        studentRegistrations,
        staffInvites,
        centreMemberships,
        centreAvailabilityRules,
        centres,
        verificationTokens,
        sessions,
        accounts,
        users,
        organisations
    } = await import('../db/schema');

    try {
        // Order matters for cascade-less truncates, but we'll try simple delete first or just TRUNCATE CASCADE if supported
        // Drizzle delete().where(sql`true`) is a safe way to clear data

        console.log('  - Clearing Audit logs, Holds, and Busy Slots...');
        await db.delete(auditEvents);
        await db.delete(slotHolds);
        await db.delete(calendarBusy);

        console.log('  - Clearing Bookings and Attendees...');
        await db.delete(bookingAttendees);
        await db.delete(bookings);

        console.log('  - Clearing Students and Parents...');
        await db.delete(childSubjects);
        await db.delete(children);
        await db.delete(parents);

        console.log('  - Clearing Registrations and Invites...');
        await db.delete(studentRegistrations);
        await db.delete(staffInvites);

        console.log('  - Clearing Centres and Memberships...');
        await db.delete(centreMemberships);
        await db.delete(centreAvailabilityRules);
        await db.delete(centres);

        console.log('  - Clearing Auth Sessions and Accounts...');
        await db.delete(sessions);
        await db.delete(accounts);
        await db.delete(verificationTokens);

        console.log('  - Clearing Users and Organisations...');
        await db.delete(users);
        await db.delete(organisations);

        console.log('✨ Database cleared successfully!');

        // Optionally run seed if user wants? 
        // For now just clear.

        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        process.exit(1);
    }
}

main();
