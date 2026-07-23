import { pgTable, uuid, varchar, text, timestamp, pgEnum, boolean, integer, unique, numeric, index, date, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== DISCOUNT RULE TYPE ====================
export type DiscountRule = {
  id: string;
  type: 'sibling' | 'pupil_premium' | 'percentage' | 'fixed';
  label: string;
  value: number;
  valueType: 'percent' | 'fixed';
  active: boolean;
};

// ==================== ENUMS ====================
export const userRoleEnum = pgEnum('user_role', ['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']);
export const bookingStatusEnum = pgEnum('booking_status', ['confirmed', 'cancelled', 'rescheduled', 'completed', 'pending', 'signed_up']);
export const modalityEnum = pgEnum('modality', ['in_person', 'online']);
export const preferredContactEnum = pgEnum('preferred_contact', ['phone', 'email']);
export const subjectEnum = pgEnum('subject', ['Maths', 'English', 'Science', 'Other']);

export const assessmentTypeEnum = pgEnum('assessment_type', ['initial_assessment', 'progress_review', 'subject_specific']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'past_due', 'trialing']);
export const notificationTypeEnum = pgEnum('notification_type', ['booking_created', 'booking_cancelled', 'booking_rescheduled', 'assessment_reminder', 'system']);
export const registrationStatusEnum2 = pgEnum('registration_status_v2', ['awaiting_confirmation', 'signed_up', 'not_interested', 'pending']);
export const fundingTypeEnum = pgEnum('funding_type', ['tax_free_childcare', 'childcare_vouchers', 'student_finance', 'self_funded', 'other']);
export const studentSourceEnum = pgEnum('student_source', ['assessment', 'registration', 'both']);
export const parentRelationshipEnum = pgEnum('parent_relationship', ['mother', 'father', 'guardian', 'other']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'partially_paid', 'paid', 'void']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'bank_transfer', 'stripe', 'voucher', 'other', 'gocardless', 'tax_free_childcare']);
export const parentCreditTypeEnum = pgEnum('parent_credit_type', ['credit', 'debit', 'refund']);
export const instalmentStatusEnum = pgEnum('instalment_status', ['pending', 'processing', 'paid', 'failed']);
export const incidentTypeEnum = pgEnum('incident_type', ['accident', 'incident', 'medication', 'safeguarding']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'verified', 'failed']);
export const progressRatingEnum = pgEnum('progress_rating', ['excellent', 'good', 'satisfactory', 'needs_improvement', 'unsatisfactory']);
export const noteTypeEnum = pgEnum('note_type', ['general', 'progress', 'behaviour', 'subject_feedback', 'attendance_concern', 'medical']);
export const attendanceStatusEnum = pgEnum('attendance_status', ['present', 'absent', 'late', 'no_show', 'excused']);
export const sessionTypeEnum = pgEnum('session_type', ['scheduled', 'extra']);
export const absenceReasonEnum = pgEnum('absence_reason', ['illness', 'holiday', 'family', 'other']);
export const clubSessionTypeEnum = pgEnum('club_session_type', ['breakfast', 'after_school', 'holiday']);
export const bookingPlanStatusEnum = pgEnum('booking_plan_status', ['active', 'paused', 'cancelled']);
export const waitlistStatusEnum = pgEnum('waitlist_status', ['waiting', 'offered', 'accepted', 'expired', 'cancelled']);



// ==================== ORGANISATIONS & CENTRES ====================
export const organisations = pgTable('organisations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),

  // Contact info
  logoUrl: varchar('logo_url', { length: 500 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  website: varchar('website', { length: 255 }),
  privacyPolicyUrl: varchar('privacy_policy_url', { length: 500 }),
  address: text('address'),
  description: text('description'),
  brandColor: varchar('brand_color', { length: 7 }).default('#4F46E5').notNull(),

  // Stripe subscription
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').default('active'),
  subscriptionTier: varchar('subscription_tier', { length: 50 }).default('free'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),

  // Registration feature
  registrationTerms: text('registration_terms'),
  sessionSlots: text('session_slots'),          // JSON-encoded string[] of session time options
  registrationPricing: text('registration_pricing'), // JSON: {selfFinanceRate: number, taxCreditRate: number}

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const centres = pgTable('centres', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  address: text('address'),
  timezone: varchar('timezone', { length: 50 }).default('Europe/London').notNull(),
  operatingHours: text('operating_hours'),
  sessionSlots: text('session_slots'), // JSON-encoded string[] of session time options for this specific centre
  feeSelfFinance: numeric('fee_self_finance', { precision: 10, scale: 2 }),
  feeAssistedFinance: numeric('fee_assisted_finance', { precision: 10, scale: 2 }),

  // Bank & Info (Billing Infrastructure)
  bankName: varchar('bank_name', { length: 255 }),
  sortCode: varchar('sort_code', { length: 20 }),
  accountNo: varchar('account_no', { length: 20 }),
  ofstedId: varchar('ofsted_id', { length: 50 }),
  managerName: varchar('manager_name', { length: 255 }),
  billingPhone: varchar('billing_phone', { length: 20 }),
  billingEmail: varchar('billing_email', { length: 255 }),
  signatureUrl: varchar('signature_url', { length: 500 }),
  // approvalDate: added in migration 0007 — uncomment after running: ALTER TABLE centres ADD COLUMN approval_date varchar(100)
  // approvalDate: varchar('approval_date', { length: 100 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('centres_org_idx').on(table.organisationId),
}));

// ==================== USERS & PERMISSIONS ====================
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }), // Required by NextAuth Drizzle adapter
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  role: userRoleEnum('role').default('ORG_OWNER').notNull(),

  // Auth fields
  passwordHash: varchar('password_hash', { length: 255 }),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: varchar('image', { length: 500 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpiry: timestamp('password_reset_expiry', { withTimezone: true }),

  // Compliance & Safeguarding
  dbsNumber: varchar('dbs_number', { length: 100 }),
  dbsExpiryDate: date('dbs_expiry_date'),
  firstAidExpiryDate: date('first_aid_expiry_date'),
  safeguardingExpiryDate: date('safeguarding_expiry_date'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('users_org_idx').on(table.organisationId),
}));

// NextAuth.js required tables
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
}, (table) => ({
  uniqueProvider: unique().on(table.provider, table.providerAccountId),
}));

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
}, (table) => ({
  uniqueIdentifier: unique().on(table.identifier, table.token),
}));

export const centreMemberships = pgTable('centre_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMembership: unique().on(table.centreId, table.userId),
  userIdIdx: index('centre_memberships_user_idx').on(table.userId),
}));

export const staffInvites = pgTable('staff_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==================== PARENTS & CHILDREN ====================
export const parents = pgTable('parents', {
  id: uuid('id').defaultRandom().primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  organisationId: uuid('organisation_id').references(() => organisations.id).notNull(), // Linked to Org
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  preferredContact: preferredContactEnum('preferred_contact').notNull(),

  // Magic Link / Portal Access
  magicLinkToken: varchar('magic_link_token', { length: 255 }).unique(),
  magicLinkExpiresAt: timestamp('magic_link_expires_at', { withTimezone: true }),

  // Registration enrichment fields (added by student registration feature)
  relationship: parentRelationshipEnum('relationship'),
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  postcode: varchar('postcode', { length: 10 }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  orgIdx: index('parents_org_idx').on(table.organisationId),
  emailIdx: index('parents_email_idx').on(table.email),
}));

export const children = pgTable('children', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }).notNull(),

  // Denormalised for fast scoping — always equal to parent.organisationId.
  // Eliminates a join in every student visibility query.
  organisationId: uuid('organisation_id').references(() => organisations.id),

  // Primary/home centre of the student.
  // Nullable: staff-added students may not yet be assigned to a centre.
  centreId: uuid('centre_id').references(() => centres.id),

  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  schoolYear: varchar('school_year', { length: 10 }).notNull(),
  notes: text('notes'),
  imageUrl: text('image_url'),

  // Safeguarding & Profile (Phase 3)
  allergies: text('allergies').array().default([]),
  dietaryRequirements: text('dietary_requirements'),
  medicalConditions: text('medical_conditions'),
  medicationNotes: text('medication_notes'),
  gpName: varchar('gp_name', { length: 255 }),
  gpPhone: varchar('gp_phone', { length: 50 }),
  senDetails: text('sen_details'),
  photoConsent: boolean('photo_consent').default(false).notNull(),
  sunCreamConsent: boolean('sun_cream_consent').default(false).notNull(),
  firstAidConsent: boolean('first_aid_consent').default(false).notNull(),

  // Registration feature enrichment (additive)
  source: studentSourceEnum('source').default('assessment'),
  isRegistered: boolean('is_registered').default(false),
  registeredAt: timestamp('registered_at', { withTimezone: true }),
  registeredSessions: text('registered_sessions').array(),

  // Phase 4: Childcare Payments
  tfcReference: varchar('tfc_reference', { length: 50 }),
  
  // Operational flags (shown on roll-call card)
  flagHomework: boolean('flag_homework').default(false).notNull(),
  flagBehaviour: boolean('flag_behaviour').default(false).notNull(),
  flagNote: text('flag_note'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

}, (table) => ({
  parentIdx: index('children_parent_idx').on(table.parentId),
  orgIdx: index('children_org_idx').on(table.organisationId),
  centreIdx: index('children_centre_idx').on(table.centreId),
}));

export const authorisedCollectors = pgTable('authorised_collectors', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  relationship: varchar('relationship', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  collectionPassword: varchar('collection_password', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  childIdx: index('auth_collectors_child_idx').on(table.childId),
  orgIdx: index('auth_collectors_org_idx').on(table.organisationId),
}));

export const studentNotes = pgTable('student_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  authorName: varchar('author_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).default('General').notNull(),
  // Progress tracking fields
  noteType: noteTypeEnum('note_type').default('general'),
  subject: varchar('subject', { length: 100 }),   // e.g. 'Maths', 'English', 'Science'
  rating: progressRatingEnum('rating'),            // structured progress rating
  pinnedAt: timestamp('pinned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  childIdx: index('student_notes_child_idx').on(table.childId),
  userIdIdx: index('student_notes_user_idx').on(table.userId),
}));


export const childSubjects = pgTable('child_subjects', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),
  subject: subjectEnum('subject').notNull(),
  customSubject: varchar('custom_subject', { length: 100 }),
}, (table) => ({
  uniqueSubject: unique().on(table.childId, table.subject, table.customSubject),
}));



// ==================== BOOKINGS ====================
// ==================== BOOKINGS ====================
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  centreId: uuid('centre_id').references(() => centres.id),
  parentId: uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }).notNull(),
  staffId: uuid('staff_id').references(() => users.id),
  sessionId: uuid('session_id').references(() => clubSessions.id, { onDelete: 'set null' }),
  assessmentType: assessmentTypeEnum('assessment_type'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  duration: integer('duration').default(30).notNull(),
  modality: modalityEnum('modality').notNull(),
  status: bookingStatusEnum('status').default('confirmed').notNull(),
  confirmationCode: varchar('confirmation_code', { length: 50 }).notNull().unique(),
  magicLinkToken: varchar('magic_link_token', { length: 255 }).notNull().unique(),
  googleCalendarEventId: varchar('google_calendar_event_id', { length: 255 }),
  communicationsConsent: boolean('communications_consent').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueTimeSlot: unique('unique_time_slot').on(table.centreId, table.modality, table.startAt, table.parentId),
  centreIdx: index('bookings_centre_idx').on(table.centreId),
  parentIdx: index('bookings_parent_idx').on(table.parentId),
  centreStatusStartIdx: index('bookings_centre_status_start_idx').on(table.centreId, table.status, table.startAt),
  createdAtIdx: index('bookings_created_at_idx').on(table.createdAt),
}));

export const bookingAttendees = pgTable('booking_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }).notNull(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),

  // Per-child attendance tracking
  attendanceStatus: attendanceStatusEnum('attendance_status'),
  attendanceNote: text('attendance_note'),
  lateMinutes: integer('late_minutes'),
  attendanceMarkedAt: timestamp('attendance_marked_at', { withTimezone: true }),
  attendanceMarkedBy: uuid('attendance_marked_by').references(() => users.id, { onDelete: 'set null' }),

  // Time-log fields (Phase B — check-in/out model)
  checkInAt: timestamp('check_in_at', { withTimezone: true }),
  checkOutAt: timestamp('check_out_at', { withTimezone: true }),
  sessionType: sessionTypeEnum('session_type'),             // scheduled | extra (auto-set)
  absenceReason: absenceReasonEnum('absence_reason'),       // illness | holiday | family | other
  forgivenBy: uuid('forgiven_by').references(() => users.id, { onDelete: 'set null' }),
  forgivenAt: timestamp('forgiven_at', { withTimezone: true }),
  forgivenNote: text('forgiven_note'),

  // Assessment / Feedback Fields
  feedbackNotes: text('feedback_notes'),
  feedbackScore: varchar('feedback_score', { length: 50 }),
  feedbackAttachmentBase64: text('feedback_attachment_base64'),
  feedbackAttachmentMime: varchar('feedback_attachment_mime', { length: 50 }),
  feedbackStatus: varchar('feedback_status', { length: 20 }).default('PENDING').notNull(),
  feedbackSentAt: timestamp('feedback_sent_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueAttendee: unique().on(table.bookingId, table.childId),
  bookingIdx: index('booking_attendees_booking_idx').on(table.bookingId),
  childIdx: index('booking_attendees_child_idx').on(table.childId),
}));

// ==================== AVAILABILITY ====================
export const centreAvailabilityRules = pgTable('centre_availability_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueDay: unique().on(table.centreId, table.dayOfWeek),
}));

export const slotHolds = pgTable('slot_holds', {
  id: uuid('id').defaultRandom().primaryKey(),
  resourceKey: varchar('resource_key', { length: 100 }).notNull(),
  timeBucket: timestamp('time_bucket', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueSlot: unique().on(table.resourceKey, table.timeBucket),
}));

export const calendarBusy = pgTable('calendar_busy', {
  id: uuid('id').defaultRandom().primaryKey(),
  calendarId: varchar('calendar_id', { length: 255 }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==================== TERMS & SESSIONS ====================
export const terms = pgTable('terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  holidays: jsonb('holidays').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('terms_org_idx').on(table.organisationId),
}));

export const clubSessions = pgTable('club_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),
  type: clubSessionTypeEnum('type').notNull(),
  weekday: integer('weekday').notNull(), // 0 = Sunday, 1 = Monday, etc.
  startTime: varchar('start_time', { length: 5 }).notNull(), // HH:mm
  endTime: varchar('end_time', { length: 5 }).notNull(), // HH:mm
  capacity: integer('capacity').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(), // standard or full-day price
  amPrice: numeric('am_price', { precision: 10, scale: 2 }), // for holiday half-days
  pmPrice: numeric('pm_price', { precision: 10, scale: 2 }), // for holiday half-days
  activityDescription: text('activity_description'),
  earlyBirdCutoffDate: timestamp('early_bird_cutoff_date', { withTimezone: true }),
  earlyBirdPrice: numeric('early_bird_price', { precision: 10, scale: 2 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('club_sessions_org_idx').on(table.organisationId),
  centreIdx: index('club_sessions_centre_idx').on(table.centreId),
}));

export const sessionExceptions = pgTable('session_exceptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),
  exceptionDate: date('exception_date').notNull(),
  reason: varchar('reason', { length: 255 }),
  isClosure: boolean('is_closure').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('session_exceptions_org_idx').on(table.organisationId),
  centreIdx: index('session_exceptions_centre_idx').on(table.centreId),
}));

export const bookingPlans = pgTable('booking_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),
  clubSessionId: uuid('club_session_id').references(() => clubSessions.id, { onDelete: 'cascade' }).notNull(),
  termId: uuid('term_id').references(() => terms.id, { onDelete: 'cascade' }).notNull(),
  weekdayPattern: jsonb('weekday_pattern').default([]).notNull(),
  status: bookingPlanStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('booking_plans_org_idx').on(table.organisationId),
  childIdx: index('booking_plans_child_idx').on(table.childId),
  sessionIdx: index('booking_plans_session_idx').on(table.clubSessionId),
  termIdx: index('booking_plans_term_idx').on(table.termId),
}));

export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  clubSessionId: uuid('club_session_id').references(() => clubSessions.id, { onDelete: 'cascade' }).notNull(),
  sessionDate: date('session_date'), // Nullable if waiting for a whole term plan
  termId: uuid('term_id').references(() => terms.id, { onDelete: 'cascade' }), // For term bookings
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),
  position: integer('position').notNull(),
  status: waitlistStatusEnum('status').default('waiting').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('waitlist_entries_org_idx').on(table.organisationId),
  sessionIdx: index('waitlist_entries_session_idx').on(table.clubSessionId),
  childIdx: index('waitlist_entries_child_idx').on(table.childId),
}));


// ==================== FULL REGISTRATION FORMS ====================
// New tables for the multi-child, multi-parent registration form
// Linked back to children/parents tables via matching logic

export const registrations = pgTable('registrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }), // Can be null for backwards compatibility to existing incomplete registrations

  // Status
  status: registrationStatusEnum2('status').default('awaiting_confirmation').notNull(),

  // Child start date (common to all children in this submission)
  startDate: timestamp('start_date', { withTimezone: true }),

  // Funding
  fundingTypes: text('funding_types').array(), // e.g. ['tax_free_childcare', 'self_funded']
  fundingOther: text('funding_other'),           // If 'other' selected

  // Special needs (applies across all children in submission)
  hasSpecialNeeds: boolean('has_special_needs').default(false),
  specialNeedsDetails: text('special_needs_details'),

  // Emergency contact (separate person from main parents)
  emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
  emergencyContactPhone: varchar('emergency_contact_phone', { length: 20 }),
  emergencyContactRelationship: varchar('emergency_contact_relationship', { length: 50 }),

  // Consent
  termsAgreed: boolean('terms_agreed').default(false).notNull(),

  // Digital signature (base64-encoded PNG data URL captured from the signature pad)
  parentSignature: text('parent_signature'),

  submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgStatusIdx: index('registrations_org_status_idx').on(table.organisationId, table.status),
  centreIdx: index('registrations_centre_idx').on(table.centreId),
}));

// Links each registration to the resolved children records
export const registrationChildren = pgTable('registration_children', {
  id: uuid('id').defaultRandom().primaryKey(),
  registrationId: uuid('registration_id').references(() => registrations.id, { onDelete: 'cascade' }).notNull(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'set null' }), // Nullable: set after match/create
  // Snapshot of submitted data (in case child record doesn't exist yet at submission time)
  submittedFirstName: varchar('submitted_first_name', { length: 100 }).notNull(),
  submittedLastName: varchar('submitted_last_name', { length: 100 }).notNull(),
  submittedDateOfBirth: timestamp('submitted_date_of_birth', { withTimezone: true }),
  submittedSchoolYear: varchar('submitted_school_year', { length: 10 }),
  submittedSessions: text('submitted_sessions').array(),
  wasMatched: boolean('was_matched').default(false).notNull(), // true if linked to existing child
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  registrationIdx: index('registration_children_registration_idx').on(table.registrationId),
  childIdx: index('registration_children_child_idx').on(table.childId),
}));

// Links each registration to the resolved parent records
export const registrationParents = pgTable('registration_parents', {
  id: uuid('id').defaultRandom().primaryKey(),
  registrationId: uuid('registration_id').references(() => registrations.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id').references(() => parents.id, { onDelete: 'set null' }), // Nullable: set after match/create
  isPrimary: boolean('is_primary').default(true), // First parent = primary
  // Snapshot of submitted data
  submittedFirstName: varchar('submitted_first_name', { length: 100 }).notNull(),
  submittedLastName: varchar('submitted_last_name', { length: 100 }).notNull(),
  submittedEmail: varchar('submitted_email', { length: 255 }),
  submittedPhone: varchar('submitted_phone', { length: 20 }),
  submittedRelationship: varchar('submitted_relationship', { length: 50 }),
  wasMatched: boolean('was_matched').default(false).notNull(), // true if linked to existing parent
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  registrationIdx: index('registration_parents_registration_idx').on(table.registrationId),
  parentIdx: index('registration_parents_parent_idx').on(table.parentId),
}));

// ==================== FINANCE (BILLING INFRASTRUCTURE) ====================
export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }).notNull(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }), // Now nullable for multi-child family invoices
  
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull().unique(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  invoiceDate: timestamp('invoice_date', { withTimezone: true }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  billingPeriodStart: timestamp('billing_period_start', { withTimezone: true }),
  billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }),
  
  notes: text('notes'),

  billingConfigId: uuid('billing_config_id'),
  billingPeriodLabel: varchar('billing_period_label', { length: 100 }),
  coveredChildrenJson: jsonb('covered_children_json'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgStatusIdx: index('invoices_org_status_idx').on(table.organisationId, table.status),
  parentIdx: index('invoices_parent_idx').on(table.parentId),
  centreIdx: index('invoices_centre_idx').on(table.centreId),
  childIdx: index('invoices_child_idx').on(table.childId),
}));

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum('method').notNull(),
  status: paymentStatusEnum('status').default('verified').notNull(),
  transactionReference: varchar('transaction_reference', { length: 255 }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  invoiceIdx: index('payments_invoice_idx').on(table.invoiceId),
}));

export const parentCredits = pgTable('parent_credits', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  parentId: uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }).notNull(),
  
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  type: parentCreditTypeEnum('type').notNull(),
  reason: varchar('reason', { length: 255 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('parent_credits_org_idx').on(table.organisationId),
  parentIdx: index('parent_credits_parent_idx').on(table.parentId),
}));

export const invoiceInstalments = pgTable('invoice_instalments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  status: instalmentStatusEnum('status').default('pending').notNull(),
  gocardlessPaymentId: varchar('gocardless_payment_id', { length: 255 }),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('invoice_instalments_org_idx').on(table.organisationId),
  invoiceIdx: index('invoice_instalments_invoice_idx').on(table.invoiceId),
}));

export const incidents = pgTable('incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),
  
  type: incidentTypeEnum('type').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  description: text('description').notNull(),
  treatment: text('treatment'),
  witnesses: text('witnesses'),
  bodyMapCoordinates: jsonb('body_map_coordinates'), // store x, y coords on body map
  
  staffSignature: text('staff_signature'), // base64 or URL
  parentSignature: text('parent_signature'), // base64 or URL
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('incidents_org_idx').on(table.organisationId),
  centreIdx: index('incidents_centre_idx').on(table.centreId),
  childIdx: index('incidents_child_idx').on(table.childId),
}));

// ==================== SESSION CREDITS (Admin Forgiveness) ====================
export const sessionCredits = pgTable('session_credits', {
  id: uuid('id').defaultRandom().primaryKey(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),
  academicYear: varchar('academic_year', { length: 9 }).notNull(), // e.g. "2025-26"
  sessionsAmount: integer('sessions_amount').default(1).notNull(),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  childIdx: index('session_credits_child_idx').on(table.childId),
  yearIdx: index('session_credits_year_idx').on(table.academicYear),
}));

// ==================== AUDIT LOGS ====================
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventData: text('event_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgCreatedIdx: index('audit_events_org_created_idx').on(table.organisationId, table.createdAt),
}));

// ==================== NOTIFICATIONS ====================
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('notifications_org_idx').on(table.organisationId),
  userIdIdx: index('notifications_user_idx').on(table.userId),
}));

export const broadcasts = pgTable('broadcasts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }),
  
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  
  recipientCount: integer('recipient_count').default(0).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  failureCount: integer('failure_count').default(0).notNull(),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('broadcasts_org_idx').on(table.organisationId),
  centreIdx: index('broadcasts_centre_idx').on(table.centreId),
}));

// ==================== RELATIONS ====================
export const organisationsRelations = relations(organisations, ({ many }) => ({
  centres: many(centres),
  users: many(users),
  staffInvites: many(staffInvites),
  auditEvents: many(auditEvents),
  authorisedCollectors: many(authorisedCollectors),
  clubSessions: many(clubSessions),
  sessionExceptions: many(sessionExceptions),
  bookingPlans: many(bookingPlans),
  waitlistEntries: many(waitlistEntries),
}));

export const centresRelations = relations(centres, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [centres.organisationId],
    references: [organisations.id],
  }),
  bookings: many(bookings),
  availabilityRules: many(centreAvailabilityRules),
  memberships: many(centreMemberships),
}));

export const centreAvailabilityRulesRelations = relations(centreAvailabilityRules, ({ one }) => ({
  centre: one(centres, {
    fields: [centreAvailabilityRules.centreId],
    references: [centres.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [users.organisationId],
    references: [organisations.id],
  }),
  bookings: many(bookings),
  memberships: many(centreMemberships),
  auditEvents: many(auditEvents),
  accounts: many(accounts),
  sessions: many(sessions),
  studentNotes: many(studentNotes),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const parentsRelations = relations(parents, ({ many }) => ({
  children: many(children),
  bookings: many(bookings),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  parent: one(parents, {
    fields: [children.parentId],
    references: [parents.id],
  }),
  organisation: one(organisations, {
    fields: [children.organisationId],
    references: [organisations.id],
  }),
  centre: one(centres, {
    fields: [children.centreId],
    references: [centres.id],
  }),
  bookings: many(bookings),
  subjects: many(childSubjects),
  attendances: many(bookingAttendees),
  notes: many(studentNotes),
  sessionCredits: many(sessionCredits),
  authorisedCollectors: many(authorisedCollectors),
  bookingPlans: many(bookingPlans),
  waitlistEntries: many(waitlistEntries),
}));


export const studentNotesRelations = relations(studentNotes, ({ one }) => ({
  child: one(children, {
    fields: [studentNotes.childId],
    references: [children.id],
  }),
  user: one(users, {
    fields: [studentNotes.userId],
    references: [users.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  centre: one(centres, {
    fields: [bookings.centreId],
    references: [centres.id],
  }),
  parent: one(parents, {
    fields: [bookings.parentId],
    references: [parents.id],
  }),
  staff: one(users, {
    fields: [bookings.staffId],
    references: [users.id],
  }),
  session: one(clubSessions, {
    fields: [bookings.sessionId],
    references: [clubSessions.id],
  }),
  attendees: many(bookingAttendees),
}));

export const bookingAttendeesRelations = relations(bookingAttendees, ({ one }) => ({
  booking: one(bookings, {
    fields: [bookingAttendees.bookingId],
    references: [bookings.id],
  }),
  child: one(children, {
    fields: [bookingAttendees.childId],
    references: [children.id],
  }),
  markedByUser: one(users, {
    fields: [bookingAttendees.attendanceMarkedBy],
    references: [users.id],
  }),
}));


export const bookingPlanRelations = relations(bookingPlans, ({ one }) => ({
  organisation: one(organisations, {
    fields: [bookingPlans.organisationId],
    references: [organisations.id],
  }),
  child: one(children, {
    fields: [bookingPlans.childId],
    references: [children.id],
  }),
  clubSession: one(clubSessions, {
    fields: [bookingPlans.clubSessionId],
    references: [clubSessions.id],
  }),
  term: one(terms, {
    fields: [bookingPlans.termId],
    references: [terms.id],
  }),
}));

export const broadcastsRelations = relations(broadcasts, ({ one }) => ({
  organisation: one(organisations, {
    fields: [broadcasts.organisationId],
    references: [organisations.id],
  }),
  centre: one(centres, {
    fields: [broadcasts.centreId],
    references: [centres.id],
  }),
}));

export const clubSessionsRelations = relations(clubSessions, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [clubSessions.organisationId],
    references: [organisations.id],
  }),
  centre: one(centres, {
    fields: [clubSessions.centreId],
    references: [centres.id],
  }),
  bookingPlans: many(bookingPlans),
  waitlistEntries: many(waitlistEntries),
}));

export const authorisedCollectorsRelations = relations(authorisedCollectors, ({ one }) => ({
  child: one(children, {
    fields: [authorisedCollectors.childId],
    references: [children.id],
  }),
  organisation: one(organisations, {
    fields: [authorisedCollectors.organisationId],
    references: [organisations.id],
  }),
}));

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  organisation: one(organisations, {
    fields: [waitlistEntries.organisationId],
    references: [organisations.id],
  }),
  clubSession: one(clubSessions, {
    fields: [waitlistEntries.clubSessionId],
    references: [clubSessions.id],
  }),
  term: one(terms, {
    fields: [waitlistEntries.termId],
    references: [terms.id],
  }),
  child: one(children, {
    fields: [waitlistEntries.childId],
    references: [children.id],
  }),
}));


export const registrationsRelations = relations(registrations, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [registrations.organisationId],
    references: [organisations.id],
  }),
  registrationChildren: many(registrationChildren),
  registrationParents: many(registrationParents),
}));

export const registrationChildrenRelations = relations(registrationChildren, ({ one }) => ({
  registration: one(registrations, {
    fields: [registrationChildren.registrationId],
    references: [registrations.id],
  }),
  child: one(children, {
    fields: [registrationChildren.childId],
    references: [children.id],
  }),
}));

export const registrationParentsRelations = relations(registrationParents, ({ one }) => ({
  registration: one(registrations, {
    fields: [registrationParents.registrationId],
    references: [registrations.id],
  }),
  parent: one(parents, {
    fields: [registrationParents.parentId],
    references: [parents.id],
  }),
}));

export const childSubjectsRelations = relations(childSubjects, ({ one }) => ({
  child: one(children, {
    fields: [childSubjects.childId],
    references: [children.id],
  }),
}));

export const centreMembershipsRelations = relations(centreMemberships, ({ one }) => ({
  centre: one(centres, {
    fields: [centreMemberships.centreId],
    references: [centres.id],
  }),
  user: one(users, {
    fields: [centreMemberships.userId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [invoices.organisationId],
    references: [organisations.id],
  }),
  centre: one(centres, {
    fields: [invoices.centreId],
    references: [centres.id],
  }),
  parent: one(parents, {
    fields: [invoices.parentId],
    references: [parents.id],
  }),
  child: one(children, {
    fields: [invoices.childId],
    references: [children.id],
  }),
  payments: many(payments),
  instalments: many(invoiceInstalments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const invoiceInstalmentsRelations = relations(invoiceInstalments, ({ one }) => ({
  organisation: one(organisations, {
    fields: [invoiceInstalments.organisationId],
    references: [organisations.id],
  }),
  invoice: one(invoices, {
    fields: [invoiceInstalments.invoiceId],
    references: [invoices.id],
  }),
}));

export const parentCreditsRelations = relations(parentCredits, ({ one }) => ({
  organisation: one(organisations, {
    fields: [parentCredits.organisationId],
    references: [organisations.id],
  }),
  parent: one(parents, {
    fields: [parentCredits.parentId],
    references: [parents.id],
  }),
}));

export const incidentsRelations = relations(incidents, ({ one }) => ({
  organisation: one(organisations, {
    fields: [incidents.organisationId],
    references: [organisations.id],
  }),
  centre: one(centres, {
    fields: [incidents.centreId],
    references: [centres.id],
  }),
  child: one(children, {
    fields: [incidents.childId],
    references: [children.id],
  }),
}));

export const sessionCreditsRelations = relations(sessionCredits, ({ one }) => ({
  child: one(children, {
    fields: [sessionCredits.childId],
    references: [children.id],
  }),
  admin: one(users, {
    fields: [sessionCredits.adminId],
    references: [users.id],
  }),
}));

// ==================== BILLING ====================

export const billingStatusEnum = pgEnum('billing_status', ['active', 'paused', 'cancelled']);

/**
 * One billing config per parent per centre.
 * Covers all children enrolled at that centre under this parent.
 * The agreed monthly fee is a single number agreed with the family.
 */
export const billingConfigs = pgTable('billing_configs', {
  id:             uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').notNull(),
  centreId:       uuid('centre_id').notNull(),
  parentId:       uuid('parent_id').notNull(),

  // The one agreed amount for the whole family at this centre
  agreedMonthlyPence: integer('agreed_monthly_pence').notNull().default(0),

  // Billing period anchor
  billingAnchorDate: date('billing_anchor_date').notNull(),
  billingEndDate:    date('billing_end_date'),
  invoiceLeadDays:   integer('invoice_lead_days').notNull().default(7),

  status: billingStatusEnum('status').notNull().default('active'),
  notes:  text('notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx:    index('billing_configs_org_idx').on(table.organisationId),
  centreIdx: index('billing_configs_centre_idx').on(table.centreId),
  parentIdx: index('billing_configs_parent_idx').on(table.parentId),
  // One config per parent per centre — enforced at DB level
  parentCentreUnique: unique('billing_configs_parent_centre_unique').on(table.parentId, table.centreId),
}));

/**
 * Junction table — which children are covered by a billing config.
 * Add a row here when a sibling joins. Invoice generation reads from here.
 */
export const billingConfigChildren = pgTable('billing_config_children', {
  id:       uuid('id').defaultRandom().primaryKey(),
  configId: uuid('config_id').references(() => billingConfigs.id, { onDelete: 'cascade' }).notNull(),
  childId:  uuid('child_id').references(() => children.id,        { onDelete: 'cascade' }).notNull(),
  addedAt:  timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  configIdx: index('bcc_config_idx').on(table.configId),
  childIdx:  index('bcc_child_idx').on(table.childId),
  unique:    unique('bcc_config_child_unique').on(table.configId, table.childId),
}));

/**
 * Audit log of every invoice generation run.
 * One row per invoice generated, linked to the billing config.
 */
export const billingRuns = pgTable('billing_runs', {
  id:              uuid('id').defaultRandom().primaryKey(),
  billingConfigId: uuid('billing_config_id').references(() => billingConfigs.id, { onDelete: 'restrict' }).notNull(),

  periodStart: date('period_start').notNull(),
  periodEnd:   date('period_end').notNull(),
  invoiceId:   uuid('invoice_id'),  // soft ref — no FK to avoid coupling

  amountPence: integer('amount_pence').notNull().default(0),

  runAt:  timestamp('run_at', { withTimezone: true }).defaultNow().notNull(),
  runBy:  uuid('run_by'),

  success:  boolean('success').notNull().default(true),
  errorLog: text('error_log'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  configIdx:  index('billing_runs_config_idx').on(table.billingConfigId),
  periodIdx:  index('billing_runs_period_idx').on(table.periodStart),
  invoiceIdx: index('billing_runs_invoice_idx').on(table.invoiceId),
}));

// ── Billing Relations ─────────────────────────────────────────────────────────
export const billingConfigsRelations = relations(billingConfigs, ({ one, many }) => ({
  parent: one(parents, {
    fields: [billingConfigs.parentId],
    references: [parents.id],
  }),
  centre: one(centres, {
    fields: [billingConfigs.centreId],
    references: [centres.id],
  }),
  children: many(billingConfigChildren),
  runs:     many(billingRuns),
}));

export const billingConfigChildrenRelations = relations(billingConfigChildren, ({ one }) => ({
  config: one(billingConfigs, {
    fields: [billingConfigChildren.configId],
    references: [billingConfigs.id],
  }),
  child: one(children, {
    fields: [billingConfigChildren.childId],
    references: [children.id],
  }),
}));

export const billingRunsRelations = relations(billingRuns, ({ one }) => ({
  config: one(billingConfigs, {
    fields: [billingRuns.billingConfigId],
    references: [billingConfigs.id],
  }),
}));

export const portalNotifications = pgTable('portal_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  parentId: uuid('parent_id').notNull().references(() => parents.id, { onDelete: 'cascade' }),
  organisationId: uuid('organisation_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  href: text('href'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});


