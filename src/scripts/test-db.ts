import { logger } from '@/lib/logger';
import * as dotenv from 'dotenv';
import { children, parents, bookings, centres, bookingAttendees, studentNotes } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

async function test() {
  dotenv.config({ path: '.env.local' });
  const { db } = await import('../db/index');
  
  try {
    logger.info("Testing student fetch...");
    const studentData = await db
        .select({
            id: children.id,
            firstName: children.firstName,
            lastName: children.lastName,
            dateOfBirth: children.dateOfBirth,
            schoolYear: children.schoolYear,
            notes: children.notes,
            parent: {
                firstName: parents.firstName,
                lastName: parents.lastName,
                phone: parents.phone,
                email: parents.email,
                organisationId: parents.organisationId,
            }
        })
        .from(children)
        .innerJoin(parents, eq(children.parentId, parents.id))
        .limit(1);
    logger.info("Student fetch success.");
    
    if (studentData.length > 0) {
        const student = studentData[0];
        logger.info("Testing bookings fetch...");
        await db
            .select({
                id: bookings.id,
                startAt: bookings.startAt,
                status: bookings.status,
                centreName: centres.name,
                attendeeId: bookingAttendees.id,
                feedbackNotes: bookingAttendees.feedbackNotes,
                feedbackScore: bookingAttendees.feedbackScore,
                feedbackStatus: bookingAttendees.feedbackStatus,
                feedbackAttachmentBase64: bookingAttendees.feedbackAttachmentBase64,
                feedbackAttachmentMime: bookingAttendees.feedbackAttachmentMime,
                feedbackSentAt: bookingAttendees.feedbackSentAt,
            })
            .from(bookings)
            .innerJoin(bookingAttendees, eq(bookings.id, bookingAttendees.bookingId))
            .innerJoin(centres, eq(bookings.centreId, centres.id))
            .where(eq(bookingAttendees.childId, student.id))
            .orderBy(desc(bookings.startAt))
            .limit(10);
        logger.info("Bookings fetch success.");
        
        logger.info("Testing notes fetch...");
        await db.query.studentNotes.findMany({
            where: eq(studentNotes.childId, student.id),
            orderBy: [desc(studentNotes.createdAt)],
        });
        logger.info("Notes fetch success.");
    } else {
        logger.info("No student found to test relationships");
    }
    
  } catch (e) {
    logger.error("DB QUERY FAILED:");
    logger.error(e);
  }
  process.exit(0);
}
test();
