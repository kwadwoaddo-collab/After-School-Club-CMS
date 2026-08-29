import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { assertSafeTrainingEnvironment } from '@/lib/training-guard';
import { logger } from '@/lib/logger';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashToken } from '@/lib/magic-link';
import * as schema from '../db/schema';

export async function seedTrainingData() {
  // 1. Hard Safety Guard Verification
  const { host } = assertSafeTrainingEnvironment();
  logger.info(`[TRAINING SEED] Starting synthetic dataset seeding on host: ${host}`);

  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString, { max: 1, ssl: 'require', connect_timeout: 10 });
  const db = drizzle(client, { schema });

  try {
    // 2. Clean previous Oakridge synthetic data if it exists
    const existingOrg = await db.query.organisations.findFirst({
      where: eq(schema.organisations.slug, 'oakridge-learning'),
    });

    if (existingOrg) {
      const orgId = existingOrg.id;
      logger.info(`[TRAINING SEED] Removing existing Oakridge synthetic organisation (${orgId}) for clean re-instantiation...`);
      await client`DELETE FROM broadcasts WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM audit_events WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM notifications WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM staff_invites WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM incidents WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM student_notes WHERE child_id IN (SELECT id FROM children WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM session_credits WHERE child_id IN (SELECT id FROM children WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM invoices WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM billing_config_children WHERE config_id IN (SELECT id FROM billing_configs WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM billing_configs WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM booking_attendees WHERE booking_id IN (SELECT id FROM bookings WHERE parent_id IN (SELECT id FROM parents WHERE organisation_id = ${orgId}))`;
      await client`DELETE FROM bookings WHERE parent_id IN (SELECT id FROM parents WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM registration_children WHERE registration_id IN (SELECT id FROM registrations WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM registration_parents WHERE registration_id IN (SELECT id FROM registrations WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM registrations WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM authorised_collectors WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM children WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM parents WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM centre_memberships WHERE centre_id IN (SELECT id FROM centres WHERE organisation_id = ${orgId})`;
      await client`DELETE FROM org_memberships WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM users WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM centres WHERE organisation_id = ${orgId}`;
      await client`DELETE FROM organisations WHERE id = ${orgId}`;
    }

    // 3. Create Oakridge Organisation
    logger.info('[TRAINING SEED] Creating Oakridge Learning Club Ltd...');
    const [org] = await db.insert(schema.organisations).values({
      name: 'Oakridge Learning Club Ltd',
      slug: 'oakridge-learning',
      contactEmail: 'support@oakridge-learning.example.test',
      contactPhone: '020 7946 0123',
      address: '12 High Street, Oakridge, London, SE1 1AA',
      brandColor: '#0284c7',
      subscriptionTier: 'professional',
      subscriptionStatus: 'active',
      registrationTerms: 'Standard Oakridge Club Terms & Safeguarding Agreement for Training Purposes.',
    }).returning();

    // 4. Create Centres
    logger.info('[TRAINING SEED] Creating Centres: Central & Riverside...');
    const [centreCentral] = await db.insert(schema.centres).values({
      organisationId: org.id,
      name: 'Oakridge Central',
      slug: 'central',
      address: "Community Hall, 14 St. Mary's Road, London, SE1 2BB",
      timezone: 'Europe/London',
      ofstedId: 'EY123456',
      bankName: 'Oakridge Central Club',
      sortCode: '20-00-00',
      accountNo: '12345678',
      managerName: 'Marcus Sterling',
      billingEmail: 'billing@oakridge-learning.example.test',
      billingPhone: '020 7946 0123',
      operatingHours: JSON.stringify({
        monday: { start: '07:30', end: '18:00' },
        tuesday: { start: '07:30', end: '18:00' },
        wednesday: { start: '07:30', end: '18:00' },
        thursday: { start: '07:30', end: '18:00' },
        friday: { start: '07:30', end: '18:00' },
      }),
    }).returning();

    const [centreRiverside] = await db.insert(schema.centres).values({
      organisationId: org.id,
      name: 'Oakridge Riverside',
      slug: 'riverside',
      address: 'Riverside School Pavilion, London, SE1 3CC',
      timezone: 'Europe/London',
      ofstedId: 'EY654321',
      managerName: 'Marcus Sterling',
      operatingHours: JSON.stringify({
        monday: { start: '15:30', end: '18:00' },
        tuesday: { start: '15:30', end: '18:00' },
        wednesday: { start: '15:30', end: '18:00' },
        thursday: { start: '15:30', end: '18:00' },
        friday: { start: '15:30', end: '18:00' },
      }),
    }).returning();

    // 5. Create Staff Personas
    logger.info('[TRAINING SEED] Creating Staff Personas...');
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const staffData = [
      { firstName: 'Eleanor', lastName: 'Vance', email: 'eleanor.vance@example.test', role: 'ORG_OWNER' as const },
      { firstName: 'Marcus', lastName: 'Sterling', email: 'marcus.sterling@example.test', role: 'MANAGER' as const },
      { firstName: 'Chloe', lastName: 'Bennett', email: 'chloe.bennett@example.test', role: 'FRONT_DESK' as const },
      { firstName: 'Liam', lastName: 'Harper', email: 'liam.harper@example.test', role: 'TUTOR' as const },
    ];

    const staffUsers: Record<string, typeof schema.users.$inferSelect> = {};

    for (const s of staffData) {
      // Upsert user
      const [u] = await db.insert(schema.users).values({
        organisationId: org.id,
        email: s.email,
        name: `${s.firstName} ${s.lastName}`,
        firstName: s.firstName,
        lastName: s.lastName,
        role: s.role,
        passwordHash,
        emailVerified: new Date(),
      }).onConflictDoUpdate({
        target: schema.users.email,
        set: {
          organisationId: org.id,
          name: `${s.firstName} ${s.lastName}`,
          role: s.role,
          passwordHash,
        },
      }).returning();

      staffUsers[s.email] = u;

      // Create org membership
      await db.insert(schema.orgMemberships).values({
        userId: u.id,
        organisationId: org.id,
        role: s.role,
      }).onConflictDoNothing();

      // Create centre memberships
      if (s.role === 'ORG_OWNER') {
        await db.insert(schema.centreMemberships).values([
          { userId: u.id, centreId: centreCentral.id, role: s.role },
          { userId: u.id, centreId: centreRiverside.id, role: s.role },
        ]).onConflictDoNothing();
      } else {
        await db.insert(schema.centreMemberships).values({
          userId: u.id,
          centreId: centreCentral.id,
          role: s.role,
        }).onConflictDoNothing();
      }
    }

    // 6. Create Parents
    logger.info('[TRAINING SEED] Creating Parents & Family Records...');
    const [parentJenkins] = await db.insert(schema.parents).values({
      organisationId: org.id,
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'sarah.jenkins@example.test',
      phone: '07700 900111',
      preferredContact: 'email',
      relationship: 'mother',
      addressLine1: '10 Elm Road',
      city: 'London',
      postcode: 'SE1 2AA',
      magicLinkToken: nanoid(32),
    }).returning();

    const [parentPatel] = await db.insert(schema.parents).values({
      organisationId: org.id,
      firstName: 'David',
      lastName: 'Patel',
      email: 'david.patel@example.test',
      phone: '07700 900222',
      preferredContact: 'email',
      relationship: 'father',
      addressLine1: '25 Maple Street',
      city: 'London',
      postcode: 'SE1 3BB',
      magicLinkToken: nanoid(32),
    }).returning();

    const [parentTaylor] = await db.insert(schema.parents).values({
      organisationId: org.id,
      firstName: 'Rachel',
      lastName: 'Taylor',
      email: 'rachel.taylor@example.test',
      phone: '07700 900333',
      preferredContact: 'phone',
      relationship: 'mother',
      addressLine1: '8 Pine Close',
      city: 'London',
      postcode: 'SE1 4DD',
      deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago in Recovery Bin
    }).returning();

    const [parentWalker] = await db.insert(schema.parents).values({
      organisationId: org.id,
      firstName: 'James',
      lastName: 'Walker',
      email: 'james.walker@example.test',
      phone: '07700 900444',
      preferredContact: 'email',
      relationship: 'father',
      addressLine1: '42 Oak Way',
      city: 'London',
      postcode: 'SE1 5EE',
    }).returning();

    // 7. Create Children
    logger.info('[TRAINING SEED] Creating Children with Medical & Dietary Flags...');
    const [childOliver] = await db.insert(schema.children).values({
      parentId: parentJenkins.id,
      organisationId: org.id,
      centreId: centreCentral.id,
      firstName: 'Oliver',
      lastName: 'Jenkins',
      dateOfBirth: new Date('2017-05-14'),
      schoolYear: '3',
      allergies: ['Peanuts (Severe)'],
      medicalConditions: 'Severe Peanut Allergy (EpiPen in Main Office)',
      dietaryRequirements: 'Nut-free',
      isRegistered: true,
      registeredAt: new Date(),
    }).returning();

    const [childEmma] = await db.insert(schema.children).values({
      parentId: parentJenkins.id,
      organisationId: org.id,
      centreId: centreCentral.id,
      firstName: 'Emma',
      lastName: 'Jenkins',
      dateOfBirth: new Date('2020-09-02'),
      schoolYear: 'Reception',
      dietaryRequirements: 'Vegetarian',
      isRegistered: true,
      registeredAt: new Date(),
    }).returning();

    const [childAria] = await db.insert(schema.children).values({
      parentId: parentPatel.id,
      organisationId: org.id,
      centreId: centreCentral.id,
      firstName: 'Aria',
      lastName: 'Patel',
      dateOfBirth: new Date('2018-11-20'),
      schoolYear: '2',
      dietaryRequirements: 'Halal',
      isRegistered: true,
      registeredAt: new Date(),
    }).returning();

    const [childNoah] = await db.insert(schema.children).values({
      parentId: parentTaylor.id,
      organisationId: org.id,
      centreId: centreCentral.id,
      firstName: 'Noah',
      lastName: 'Taylor',
      dateOfBirth: new Date('2019-03-15'),
      schoolYear: '1',
      deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // In recovery bin
    }).returning();

    const [childLucas] = await db.insert(schema.children).values({
      parentId: parentWalker.id,
      organisationId: org.id,
      centreId: centreCentral.id,
      firstName: 'Lucas',
      lastName: 'Walker',
      dateOfBirth: new Date('2017-08-10'),
      schoolYear: '3',
      isRegistered: true,
      registeredAt: new Date(),
      senDetails: 'Speech & Language support indicator',
    }).returning();

    // 8. Create Authorised Collectors
    logger.info('[TRAINING SEED] Creating Authorised Collectors...');
    await db.insert(schema.authorisedCollectors).values([
      {
        childId: childOliver.id,
        organisationId: org.id,
        name: 'Sarah Jenkins',
        relationship: 'Mother',
        phone: '07700 900111',
      },
      {
        childId: childOliver.id,
        organisationId: org.id,
        name: 'Rose Jenkins',
        relationship: 'Grandmother',
        phone: '07700 900999',
        collectionPassword: '4821',
      },
    ]);

    // 9. Create Bookings with Consent States & Attendees
    logger.info('[TRAINING SEED] Creating Bookings & Consent preferences...');
    const now = new Date();
    const sessionStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0);

    const [bookingTaylor] = await db.insert(schema.bookings).values({
      centreId: centreCentral.id,
      parentId: parentTaylor.id,
      status: 'confirmed',
      modality: 'in_person',
      startAt: sessionStart,
      duration: 150,
      confirmationCode: `CONF-${nanoid(8).toUpperCase()}`,
      magicLinkToken: `mlt-${nanoid(16)}`,
      communicationsConsent: true,
    }).returning();

    await db.insert(schema.bookingAttendees).values([
      {
        bookingId: bookingTaylor.id,
        childId: childNoah.id,
        attendanceStatus: null,
        sessionType: 'scheduled',
      },
    ]);

    const [bookingJenkins] = await db.insert(schema.bookings).values({
      centreId: centreCentral.id,
      parentId: parentJenkins.id,
      status: 'confirmed',
      modality: 'in_person',
      startAt: sessionStart,
      duration: 150,
      confirmationCode: `CONF-${nanoid(8).toUpperCase()}`,
      magicLinkToken: `mlt-${nanoid(16)}`,
      communicationsConsent: true, // Consented
    }).returning();

    await db.insert(schema.bookingAttendees).values([
      {
        bookingId: bookingJenkins.id,
        childId: childOliver.id,
        attendanceStatus: 'present',
        checkInAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 35, 0),
        attendanceMarkedBy: staffUsers['liam.harper@example.test']?.id,
        sessionType: 'scheduled',
      },
      {
        bookingId: bookingJenkins.id,
        childId: childEmma.id,
        attendanceStatus: 'present',
        checkInAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 35, 0),
        attendanceMarkedBy: staffUsers['liam.harper@example.test']?.id,
        sessionType: 'scheduled',
      },
    ]);

    const [bookingPatel] = await db.insert(schema.bookings).values({
      centreId: centreCentral.id,
      parentId: parentPatel.id,
      status: 'confirmed',
      modality: 'in_person',
      startAt: sessionStart,
      duration: 150,
      confirmationCode: `CONF-${nanoid(8).toUpperCase()}`,
      magicLinkToken: `mlt-${nanoid(16)}`,
      communicationsConsent: false, // Withdrawn consent
    }).returning();

    await db.insert(schema.bookingAttendees).values([
      {
        bookingId: bookingPatel.id,
        childId: childAria.id,
        attendanceStatus: 'absent',
        absenceReason: 'illness',
        forgivenAt: now,
        forgivenBy: staffUsers['marcus.sterling@example.test']?.id,
        forgivenNote: 'Absence excused due to medical appointment.',
        sessionType: 'scheduled',
      },
    ]);

    const [bookingWalker] = await db.insert(schema.bookings).values({
      centreId: centreCentral.id,
      parentId: parentWalker.id,
      status: 'confirmed',
      modality: 'in_person',
      startAt: sessionStart,
      duration: 150,
      confirmationCode: `CONF-${nanoid(8).toUpperCase()}`,
      magicLinkToken: `mlt-${nanoid(16)}`,
      communicationsConsent: true,
    }).returning();

    await db.insert(schema.bookingAttendees).values([
      {
        bookingId: bookingWalker.id,
        childId: childLucas.id,
        attendanceStatus: 'present',
        checkInAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 42, 0),
        attendanceMarkedBy: staffUsers['chloe.bennett@example.test']?.id,
        sessionType: 'extra',
      },
    ]);

    // 10. Create Billing Configs & Sibling Mapping
    logger.info('[TRAINING SEED] Creating Agreed-Fee Billing Configs...');
    const [billingJenkins] = await db.insert(schema.billingConfigs).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      parentId: parentJenkins.id,
      agreedMonthlyPence: 28000, // £280.00
      billingAnchorDate: '2026-09-01',
      status: 'active',
      notes: 'Agreed sibling discounted monthly tuition covering Oliver and Emma.',
    }).returning();

    await db.insert(schema.billingConfigChildren).values([
      { configId: billingJenkins.id, childId: childOliver.id },
      { configId: billingJenkins.id, childId: childEmma.id },
    ]);

    const [billingPatel] = await db.insert(schema.billingConfigs).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      parentId: parentPatel.id,
      agreedMonthlyPence: 14000, // £140.00
      billingAnchorDate: '2026-09-01',
      status: 'active',
      notes: 'Single child standard monthly plan.',
    }).returning();

    await db.insert(schema.billingConfigChildren).values([
      { configId: billingPatel.id, childId: childAria.id },
    ]);

    // 11. Create Invoices & Payments
    logger.info('[TRAINING SEED] Creating Invoices & Payment Ledger Records...');
    // Invoice 1: Paid via Bank Transfer
    const [inv1] = await db.insert(schema.invoices).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      parentId: parentJenkins.id,
      childId: childOliver.id,
      invoiceNumber: 'INV-2026-001',
      amount: '280.00',
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-08'),
      status: 'paid',
      notes: 'September 2026 Monthly Tuition (Oliver & Emma)',
    }).returning();

    await db.insert(schema.invoiceLineItems).values({
      invoiceId: inv1.id,
      description: 'Agreed Monthly Tuition — September 2026 (2 Children)',
      quantity: 1,
      unitPrice: '280.00',
      lineTotal: '280.00',
    });

    await db.insert(schema.payments).values({
      invoiceId: inv1.id,
      amount: '280.00',
      method: 'bank_transfer',
      status: 'verified',
      transactionReference: 'BACS-JENK-0926',
    });

    // Invoice 2: Partially Paid (Cash verified + TFC pending)
    const [inv2] = await db.insert(schema.invoices).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      parentId: parentPatel.id,
      childId: childAria.id,
      invoiceNumber: 'INV-2026-002',
      amount: '140.00',
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-08'),
      status: 'partially_paid',
      notes: 'September 2026 Monthly Tuition (Aria)',
    }).returning();

    await db.insert(schema.invoiceLineItems).values({
      invoiceId: inv2.id,
      description: 'Agreed Monthly Tuition — September 2026',
      quantity: 1,
      unitPrice: '140.00',
      lineTotal: '140.00',
    });

    await db.insert(schema.payments).values([
      {
        invoiceId: inv2.id,
        amount: '70.00',
        method: 'cash',
        status: 'verified',
        transactionReference: 'CASH-REC-01',
      },
      {
        invoiceId: inv2.id,
        amount: '70.00',
        method: 'tax_free_childcare',
        status: 'pending',
        transactionReference: 'TFC-PATEL-889',
      },
    ]);

    // Invoice 3: Sent (Outstanding - for Cash Payment demo)
    const [inv3] = await db.insert(schema.invoices).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      parentId: parentWalker.id,
      childId: childLucas.id,
      invoiceNumber: 'INV-2026-003',
      amount: '140.00',
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-08'),
      status: 'sent',
      notes: 'September 2026 Monthly Tuition (Lucas)',
    }).returning();

    await db.insert(schema.invoiceLineItems).values({
      invoiceId: inv3.id,
      description: 'Agreed Monthly Tuition — September 2026',
      quantity: 1,
      unitPrice: '140.00',
      lineTotal: '140.00',
    });

    // Invoice 4: Sent (Outstanding - for Bank Transfer demo)
    const [inv4] = await db.insert(schema.invoices).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      parentId: parentJenkins.id,
      childId: childOliver.id,
      invoiceNumber: 'INV-2026-004',
      amount: '120.00',
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-08'),
      status: 'sent',
      notes: 'Extended Hours Supplementary Fee (Oliver)',
    }).returning();

    await db.insert(schema.invoiceLineItems).values({
      invoiceId: inv4.id,
      description: 'Extended Hours Supplementary Fee — September 2026',
      quantity: 1,
      unitPrice: '120.00',
      lineTotal: '120.00',
    });

    // Invoice 5: Sent (Outstanding - for Void demo)
    const [inv5] = await db.insert(schema.invoices).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      parentId: parentPatel.id,
      childId: childAria.id,
      invoiceNumber: 'INV-2026-005',
      amount: '120.00',
      invoiceDate: new Date('2026-09-01'),
      dueDate: new Date('2026-09-08'),
      status: 'sent',
      notes: 'Incorrectly billed ad-hoc session package',
    }).returning();

    await db.insert(schema.invoiceLineItems).values({
      invoiceId: inv5.id,
      description: 'Ad-hoc session package adjustment',
      quantity: 1,
      unitPrice: '120.00',
      lineTotal: '120.00',
    });

    // 12. Create Session Credit for Aria Patel (Absence Forgiveness)
    logger.info('[TRAINING SEED] Creating Session Credit Forgiveness...');
    await db.insert(schema.sessionCredits).values({
      childId: childAria.id,
      academicYear: '2026-27',
      sessionsAmount: 1,
      adminId: staffUsers['marcus.sterling@example.test']?.id,
      note: 'Absence forgiven as per doctor notification.',
    });

    // 13. Create Incidents & Safeguarding Placeholder
    logger.info('[TRAINING SEED] Creating Incident & Safeguarding Fixtures...');
    await db.insert(schema.incidents).values([
      {
        organisationId: org.id,
        centreId: centreCentral.id,
        childId: childOliver.id,
        type: 'accident',
        date: new Date(),
        description: 'Minor scrape on right knee during playground activity.',
        treatment: 'Cleaned with sterile wipe and adhesive dressing applied.',
        bodyMapCoordinates: { x: 48, y: 72 },
        staffSignature: 'Liam Harper',
      },
      {
        organisationId: org.id,
        centreId: centreCentral.id,
        childId: childAria.id,
        type: 'safeguarding',
        date: new Date(),
        description: 'Observation recorded for training demonstration purposes. Follow local authority escalation procedure.',
        treatment: 'Internal confidential log only.',
        staffSignature: 'Marcus Sterling',
      },
    ]);

    // 14. Create Public Registration Intake Submission
    logger.info('[TRAINING SEED] Creating Public Intake Registration Submission...');
    const [reg] = await db.insert(schema.registrations).values({
      organisationId: org.id,
      centreId: centreCentral.id,
      status: 'awaiting_confirmation',
      fundingTypes: ['tax_free_childcare', 'self_funded'],
      hasSpecialNeeds: true,
      specialNeedsDetails: 'Speech & Language support indicator',
      emergencyContactName: 'Mark Walker',
      emergencyContactPhone: '07700 900555',
      emergencyContactRelationship: 'Uncle',
      termsAgreed: true,
      parentSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    }).returning();

    await db.insert(schema.registrationParents).values({
      registrationId: reg.id,
      parentId: parentWalker.id,
      isPrimary: true,
      submittedFirstName: 'James',
      submittedLastName: 'Walker',
      submittedEmail: 'james.walker@example.test',
      submittedPhone: '07700 900444',
      submittedRelationship: 'father',
      wasMatched: true,
    });

    await db.insert(schema.registrationChildren).values({
      registrationId: reg.id,
      childId: childLucas.id,
      submittedFirstName: 'Lucas',
      submittedLastName: 'Walker',
      submittedSchoolYear: '1',
      wasMatched: true,
    });

    // 15. Create Student Note
    logger.info('[TRAINING SEED] Creating Student Progress Note...');
    await db.insert(schema.studentNotes).values({
      childId: childOliver.id,
      userId: staffUsers['liam.harper@example.test']?.id || staffUsers['eleanor.vance@example.test'].id,
      authorName: 'Liam Harper',
      category: 'Progress',
      noteType: 'progress',
      content: 'Oliver showed great enthusiasm in science group project today.',
    });

    // 16. Create In-App Notifications for Staff
    logger.info('[TRAINING SEED] Creating Header Notifications...');
    await db.insert(schema.notifications).values([
      {
        organisationId: org.id,
        userId: staffUsers['eleanor.vance@example.test'].id,
        type: 'booking_created',
        title: 'New Session Booking',
        message: 'Sarah Jenkins booked Oliver Jenkins for Afternoon Club.',
        bookingId: bookingJenkins.id,
        isRead: false,
        createdAt: new Date(now.getTime() - 15 * 60 * 1000),
      },
      {
        organisationId: org.id,
        userId: staffUsers['eleanor.vance@example.test'].id,
        type: 'system',
        title: 'Childcare Voucher Submitted',
        message: 'David Patel submitted Tax-Free Childcare voucher £70.00 (Ref: TFC-PATEL-889).',
        isRead: false,
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
      {
        organisationId: org.id,
        userId: staffUsers['eleanor.vance@example.test'].id,
        type: 'system',
        title: 'Student Progress Note',
        message: 'Liam Harper added a new progress note for Oliver Jenkins.',
        isRead: true,
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    ]);

    // 17. Create Staff Cryptographic Invite Fixture
    logger.info('[TRAINING SEED] Creating Staff Cryptographic Invitation...');
    await db.insert(schema.staffInvites).values({
      organisationId: org.id,
      email: 'sophie.reed@example.test',
      role: 'TUTOR',
      token: hashToken('d6c-invite-token-synthetic-2026'),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    });

    // 18. Create Historical Broadcasts
    logger.info('[TRAINING SEED] Creating Historical Broadcast Records...');
    await db.insert(schema.broadcasts).values([
      {
        organisationId: org.id,
        centreId: centreCentral.id,
        subject: 'Autumn Term 2026 Welcome & Schedule Announcement',
        message: 'Welcome back to Oakridge Central! Please ensure all emergency contacts and allergy records are up to date in the parent portal.',
        recipientCount: 4,
        successCount: 4,
        failureCount: 0,
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        organisationId: org.id,
        centreId: centreCentral.id,
        subject: 'Reminder: Healthy Snack Policy & Nut-Free Zone',
        message: 'A gentle reminder that Oakridge Central is a strictly nut-free environment. Please do not pack peanut or tree nut items.',
        recipientCount: 4,
        successCount: 4,
        failureCount: 0,
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    ]);

    logger.info('✅ [TRAINING SEED COMPLETED SUCCESSFULLY] All synthetic Oakridge fixtures instantiated.');

    return {
      success: true,
      orgId: org.id,
      centreCount: 2,
      staffCount: 4,
      parentCount: 4,
      childCount: 5,
      invoiceCount: 3,
    };
  } finally {
    await client.end();
  }
}

// Allow direct CLI execution
if (require.main === module) {
  seedTrainingData()
    .then((res) => {
      logger.info('Result:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Error during training seeding:', err);
      process.exit(1);
    });
}
