import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const {
  organisations,
  centres,
  parents,
  children,
  bookings,
  bookingAttendees,
  users,
  orgMemberships,
  centreMemberships,
  invoices,
  invoiceLineItems,
  registrations,
  registrationParents,
  registrationChildren,
} = schema;

async function seed() {
  const connectionString = process.env.DATABASE_URL!;
  let client: postgres.Sql | null = null;
  let db: ReturnType<typeof drizzle> | null = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      client = postgres(connectionString, { max: 1, ssl: 'require', connect_timeout: 10 });
      await client`SELECT 1`;
      db = drizzle(client, { schema });
      break;
    } catch (err: unknown) {
      if (attempt === 10) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      logger.info(`Connection attempt ${attempt} failed (${msg}), retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!db || !client) throw new Error('Failed to connect to database');

  logger.info('🌱 Seeding database with 10 varied MVP Test Bookings...');

  const userEmail = 'kwadwoaddo@googlemail.com';

  // 1. Create/Update Organisation
  const [demoOrg] = await db.insert(organisations).values({
    name: 'Bright Star Academy',
    slug: 'bright-star-academy',
    contactEmail: userEmail,
    brandColor: '#136dec',
    // PM-1.2: Internal demo orgs are explicitly ACTIVE — they must be operational
    approvalStatus: 'ACTIVE',
  }).onConflictDoUpdate({
    target: organisations.slug,
    set: { contactEmail: userEmail, approvalStatus: 'ACTIVE' }
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

  // 2b. Create/Update Second Centre
  const [secondCentre] = await db.insert(centres).values({
    organisationId: orgId,
    name: 'Secondary Campus',
    slug: 'secondary',
    address: '456 Education Way, London',
    timezone: 'Europe/London',
    operatingHours: JSON.stringify({
      monday: { start: '09:00', end: '18:00' },
      tuesday: { start: '09:00', end: '18:00' },
      wednesday: { start: '09:00', end: '18:00' },
      thursday: { start: '09:00', end: '18:00' },
      friday: { start: '09:00', end: '18:00' },
    }),
  }).onConflictDoUpdate({
    target: centres.slug,
    set: { name: 'Secondary Campus' }
  }).returning();


  // 3. Ensure Staff Personas exist
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash('password123', 10);

  const staffPersonas = [
    { email: userEmail, name: 'Kwadwo Addo', role: 'ORG_OWNER' as const, allCentres: true },
    { email: 'manager@brightstar.example.com', name: 'Staging Manager', role: 'MANAGER' as const, allCentres: false },
    { email: 'frontdesk@brightstar.example.com', name: 'Staging FrontDesk', role: 'FRONT_DESK' as const, allCentres: false },
    { email: 'tutor@brightstar.example.com', name: 'Staging Tutor', role: 'TUTOR' as const, allCentres: false },
  ];

  for (const staff of staffPersonas) {
    const [user] = await db.insert(users).values({
      email: staff.email,
      name: staff.name,
      organisationId: orgId,
      role: staff.role,
      passwordHash,
    }).onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, organisationId: orgId, role: staff.role, name: staff.name }
    }).returning();

    if (user) {
      await db.insert(orgMemberships).values({
        userId: user.id,
        organisationId: orgId,
        role: staff.role
      }).onConflictDoUpdate({
        target: [orgMemberships.userId, orgMemberships.organisationId],
        set: { role: staff.role }
      });

      // Manager, Front Desk, Tutor assigned to Centre A (Main Campus)
      await db.insert(centreMemberships).values({
        userId: user.id,
        centreId: centreId,
        role: staff.role
      }).onConflictDoUpdate({
        target: [centreMemberships.centreId, centreMemberships.userId],
        set: { role: staff.role }
      });
    }
  }

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

  logger.info('⌛ Creating 10 test bookings with varied dates...');

  let firstParentId: string | null = null;
  let firstChildId: string | null = null;

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

    if (!firstParentId) firstParentId = parent.id;

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

    if (!firstChildId) firstChildId = child.id;

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

  // 5. Create Sample Invoice & Registration Fixtures for 5B Workflows
  const { invoices, invoiceLineItems, registrations } = await import('./schema');
  
  if (firstParentId && firstChildId) {
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + 14);

    const [invoice] = await db.insert(invoices).values({
      organisationId: orgId,
      centreId: centreId,
      parentId: firstParentId,
      childId: firstChildId,
      invoiceNumber: `INV-STG-${nanoid(6).toUpperCase()}`,
      amount: '120.00',
      status: 'sent',
      invoiceDate: today,
      dueDate,
      notes: 'Autumn Term After-School Club Booking',
    }).returning();

    await db.insert(invoiceLineItems).values({
      invoiceId: invoice.id,
      description: 'After School Sessions (4 Weeks)',
      quantity: 4,
      unitPrice: '30.00',
      lineTotal: '120.00',
    });

    const [reg] = await db.insert(registrations).values({
      organisationId: orgId,
      centreId: centreId,
      status: 'awaiting_confirmation',
      emergencyContactName: 'Ross Geller',
      emergencyContactPhone: '+44 7700 900666',
      emergencyContactRelationship: 'Father',
      termsAgreed: true,
      submittedAt: today,
    }).returning();

    await db.insert(registrationParents).values({
      registrationId: reg.id,
      submittedFirstName: 'Rachel',
      submittedLastName: 'Green',
      submittedEmail: `rachel.green@${nanoid(5)}.example.com`,
      submittedPhone: '+44 7700 900555',
      submittedRelationship: 'Mother',
      isPrimary: true,
    });

    await db.insert(registrationChildren).values({
      registrationId: reg.id,
      submittedFirstName: 'Emma',
      submittedLastName: 'Geller',
      submittedDateOfBirth: new Date(2017, 3, 15),
      submittedSchoolYear: 'Year 3',
      submittedSessions: ['Monday Afternoon', 'Wednesday Afternoon'],
    });
  }

  logger.info('');
  logger.info('✅ 10 total test bookings created with varied dates!');
  logger.info('📋 Organisation: Bright Star Academy');
  logger.info('');
  logger.info('🔗 View results: http://localhost:3000/dashboard');

  process.exit(0);
}

seed().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error(`❌ Seeding failed: ${msg}`);
  process.exit(1);
});
