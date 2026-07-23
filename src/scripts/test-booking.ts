import { logger } from '@/lib/logger';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  logger.info('Testing booking creation with environment loaded...');
  const { db } = await import('../db');
  const { BookingService } = await import('../lib/services/booking');

  const firstCentre = await db.query.centres.findFirst();
  if (!firstCentre) {
    logger.error('No centres found in database!');
    return;
  }
  logger.info(`Found centre: ${firstCentre.name} (ID: ${firstCentre.id})`);

  const bookingService = new BookingService();
  try {
    const result = await bookingService.createBooking({
      parent: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe.test@example.com',
        phone: '07700900077',
        preferredContact: 'email',
      },
      children: [
        {
          firstName: 'ALPHA',
          lastName: 'BALDE',
          schoolYear: 'Y1',
          dateOfBirth: '2016-04-12',
          subjects: ['Science & Tech', 'Homework Help'],
          notes: 'Test notes',
        }
      ],
      appointment: {
        centreId: firstCentre.id,
        modality: 'in_person',
        date: '2026-07-17',
        startAt: '2026-07-17T16:00:00.000Z',
        duration: 60,
      },
      consent: {
        communications: true,
      }
    });
    logger.info('Booking created successfully:', result);
  } catch (error) {
    logger.error('Booking failed with error:');
    logger.error(error);
  }
}

main().catch(console.error);
