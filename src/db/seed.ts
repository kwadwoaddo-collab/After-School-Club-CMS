import * as dotenv from 'dotenv';
import path from 'path';
import { nanoid } from 'nanoid';

// Load environment variables BEFORE any other imports
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function seed() {
  // Dynamically import db and schema after env is loaded
  const { db } = await import('./index');
  const {
    organisations,
    centres,
    centreAvailabilityRules,
    parents,
    children,
    bookings,
    bookingAttendees,
    users
  } = await import('./schema');

  console.log('🌱 Seeding database with 10 varied MVP Test Bookings...');

  const userEmail = 'kwadwoaddo@googlemail.com';

  // 1. Create/Update Organisation
  const [demoOrg] = await db.insert(organisations).values({
    name: 'Bright Star Academy',
    slug: 'bright-star-academy',
    contactEmail: userEmail,
    brandColor: '#136dec',
  }).onConflictDoUpdate({
    target: organisations.slug,
    set: { contactEmail: userEmail }
  }).returning();

  const orgId = demoOrg.id;

  // 2. Create/Update Centre
  const [demoCentre] = await db.insert(centres).values({
    organisationId: orgId,
    name: 'Main Campus',
    slug: 'main',
    address: '123 Education Way, London',
    timezone: 'Europe/London',
    operatingHours: JSON.stringify({
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '18:00' },
      saturday: { start: '10:00', end: '16:00' },
      sunday: { start: '10:00', end: '16:00' },
    }),
  }).onConflictDoUpdate({
    target: centres.slug,
    set: { name: 'Main Campus' }
  }).returning();

  const centreId = demoCentre.id;

  // 3. Ensure User exists
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('password123', 10);

  await db.insert(users).values({
    email: userEmail,
    name: 'Kwadwo Addo',
    organisationId: orgId,
    role: 'ORG_OWNER',
    passwordHash,
  }).onConflictDoUpdate({
    target: users.email,
    set: { passwordHash }
  });

  // 4. Varied Test Data (10 Students)
  const today = new Date();

  const testData = [
    // Tomorrow
    { firstName: 'Leo', lastName: 'Harrison', year: 'Year 5', parent: 'Sarah', offset: 1, time: 10 },
    { firstName: 'Mia', lastName: 'Chen', year: 'Year 3', parent: 'David', offset: 1, time: 11 },
    { firstName: 'Oscar', lastName: 'Wright', year: 'Year 6', parent: 'Emma', offset: 1, time: 13 },
    { firstName: 'Sophia', lastName: 'Patel', year: 'Year 4', parent: 'Raj', offset: 1, time: 14 },
    { firstName: 'Lucas', lastName: 'Muller', year: 'Year 2', parent: 'Karin', offset: 1, time: 15 },
    // Different Dates
    { firstName: 'Emily', lastName: 'Watson', year: 'Year 1', parent: 'John', offset: -1, time: 14 }, // Yesterday
    { firstName: 'Jack', lastName: 'Thompson', year: 'Year 4', parent: 'Mary', offset: 0, time: 16 },  // Today
    { firstName: 'Lily', lastName: 'Jones', year: 'Year 5', parent: 'Peter', offset: 3, time: 0 },    // 3 Days away
    { firstName: 'Noah', lastName: 'Williams', year: 'Year 3', parent: 'Lucy', offset: 5, time: 11 },  // 5 Days away
    { firstName: 'Ava', lastName: 'Brown', year: 'Reception', parent: 'Mark', offset: 7, time: 10 },    // Next Week
  ];

  console.log('⌛ Creating 10 test bookings with varied dates...');

  for (const data of testData) {
    // Create Parent
    const [parent] = await db.insert(parents).values({
      organisationId: orgId,
      firstName: data.parent,
      lastName: data.lastName,
      email: `${data.parent.toLowerCase()}.${data.lastName.toLowerCase()}@${nanoid(5)}.example.com`,
      phone: `+44 7700 900${Math.floor(Math.random() * 900) + 100}`,
      preferredContact: 'email'
    }).returning();

    // Create Child
    const [child] = await db.insert(children).values({
      parentId: parent.id,
      organisationId: orgId,
      centreId: centreId,
      firstName: data.firstName,
      lastName: data.lastName,
      schoolYear: data.year,
      dateOfBirth: new Date(2015, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      notes: data.firstName === 'Leo' ? 'Severe Nut Allergy. Epipen in office.' : null
    }).returning();

    // Calculate Date
    const bookingDate = new Date(today);
    bookingDate.setDate(today.getDate() + data.offset);
    bookingDate.setHours(data.time, 0, 0, 0);

    const [booking] = await db.insert(bookings).values({
      centreId: centreId,
      parentId: parent.id,
      startAt: bookingDate,
      modality: 'in_person',
      status: 'confirmed',
      confirmationCode: `${data.firstName.toUpperCase()}-${nanoid(4).toUpperCase()}`,
      magicLinkToken: nanoid(32),
    }).returning();

    await db.insert(bookingAttendees).values({
      bookingId: booking.id,
      childId: child.id
    });
  }

  console.log('');
  console.log('✅ 10 total test bookings created with varied dates!');
  console.log('📋 Organisation: Bright Star Academy');
  console.log('');
  console.log('🔗 View results: http://localhost:3000/dashboard');

  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
