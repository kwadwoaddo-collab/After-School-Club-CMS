import { pgTable, uuid, varchar, text, timestamp, pgEnum, boolean, integer, unique, numeric, index } from 'drizzle-orm/pg-core';
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
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'bank_transfer', 'stripe', 'voucher', 'other']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'verified', 'failed']);
export const progressRatingEnum = pgEnum('progress_rating', ['excellent', 'good', 'satisfactory', 'needs_improvement', 'unsatisfactory']);
export const noteTypeEnum = pgEnum('note_type', ['general', 'progress', 'behaviour', 'subject_feedback', 'attendance_concern', 'medical']);
export const attendanceStatusEnum = pgEnum('attendance_status', ['present', 'absent', 'late', 'no_show', 'excused']);

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
  subscriptionExpiresAt: timestamp('subscription_expires_at'),

  // Registration feature
  registrationTerms: text('registration_terms'),
  sessionSlots: text('session_slots'),          // JSON-encoded string[] of session time options
  registrationPricing: text('registration_pricing'), // JSON: {selfFinanceRate: number, taxCreditRate: number}

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  emailVerified: timestamp('email_verified'),
  image: varchar('image', { length: 500 }),
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpiry: timestamp('password_reset_expiry'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  expires: timestamp('expires').notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires').notNull(),
}, (table) => ({
  uniqueIdentifier: unique().on(table.identifier, table.token),
}));

export const centreMemberships = pgTable('centre_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  magicLinkExpiresAt: timestamp('magic_link_expires_at'),

  // Registration enrichment fields (added by student registration feature)
  relationship: parentRelationshipEnum('relationship'),
  addressLine1: varchar('address_line1', { length: 255 }),
  addressLine2: varchar('address_line2', { length: 255 }),
  city: varchar('city', { length: 100 }),
  postcode: varchar('postcode', { length: 10 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  dateOfBirth: timestamp('date_of_birth'),
  schoolYear: varchar('school_year', { length: 10 }).notNull(),
  notes: text('notes'),

  // Registration feature enrichment (additive)
  source: studentSourceEnum('source').default('assessment'),
  isRegistered: boolean('is_registered').default(false),
  registeredAt: timestamp('registered_at'),
  registeredSessions: text('registered_sessions').array(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  parentIdx: index('children_parent_idx').on(table.parentId),
  orgIdx: index('children_org_idx').on(table.organisationId),
  centreIdx: index('children_centre_idx').on(table.centreId),
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
  pinnedAt: timestamp('pinned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  uniqueSubject: unique().on(table.childId, table.subject),
}));



// ==================== BOOKINGS ====================
// ==================== BOOKINGS ====================
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  centreId: uuid('centre_id').references(() => centres.id),
  parentId: uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }).notNull(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }), // Deprecated: Kept for backward compatibility but nullable
  tutorId: uuid('tutor_id').references(() => users.id),
  assessmentType: assessmentTypeEnum('assessment_type').default('initial_assessment').notNull(),
  startAt: timestamp('start_at').notNull(),
  duration: integer('duration').default(30).notNull(),
  modality: modalityEnum('modality').notNull(),
  status: bookingStatusEnum('status').default('confirmed').notNull(),
  confirmationCode: varchar('confirmation_code', { length: 50 }).notNull().unique(),
  magicLinkToken: varchar('magic_link_token', { length: 255 }).notNull().unique(),
  googleCalendarEventId: varchar('google_calendar_event_id', { length: 255 }),
  communicationsConsent: boolean('communications_consent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueTimeSlot: unique('unique_time_slot').on(table.centreId, table.modality, table.startAt),
  centreIdx: index('bookings_centre_idx').on(table.centreId),
  parentIdx: index('bookings_parent_idx').on(table.parentId),
  centreStatusStartIdx: index('bookings_centre_status_start_idx').on(table.centreId, table.status, table.startAt),
  createdAtIdx: index('bookings_created_at_idx').on(table.createdAt),
}));

export const bookingAttendees = pgTable('booking_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'cascade' }).notNull(),
  childId: uuid('child_id').references(() => children.id, { onDelete: 'cascade' }).notNull(),

  // Per-child attendance tracking (Phase A: schema only — no UI writes yet)
  attendanceStatus: attendanceStatusEnum('attendance_status'),        // present | absent | late | no_show | excused
  attendanceNote: text('attendance_note'),                            // free-text context
  lateMinutes: integer('late_minutes'),                               // minutes late for pickup/dropoff
  attendanceMarkedAt: timestamp('attendance_marked_at'),              // when staff recorded it
  attendanceMarkedBy: uuid('attendance_marked_by').references(() => users.id, { onDelete: 'set null' }), // who recorded it

  // Assessment / Feedback Fields
  feedbackNotes: text('feedback_notes'),
  feedbackScore: varchar('feedback_score', { length: 50 }),
  feedbackAttachmentBase64: text('feedback_attachment_base64'),
  feedbackAttachmentMime: varchar('feedback_attachment_mime', { length: 50 }),
  feedbackStatus: varchar('feedback_status', { length: 20 }).default('PENDING').notNull(),
  feedbackSentAt: timestamp('feedback_sent_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueDay: unique().on(table.centreId, table.dayOfWeek),
}));

export const slotHolds = pgTable('slot_holds', {
  id: uuid('id').defaultRandom().primaryKey(),
  resourceKey: varchar('resource_key', { length: 100 }).notNull(),
  timeBucket: timestamp('time_bucket').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueSlot: unique().on(table.resourceKey, table.timeBucket),
}));

export const calendarBusy = pgTable('calendar_busy', {
  id: uuid('id').defaultRandom().primaryKey(),
  calendarId: varchar('calendar_id', { length: 255 }).notNull(),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  cachedAt: timestamp('cached_at').defaultNow().notNull(),
});

// ==================== REGISTRATIONS ====================
export const registrationStatusEnum = pgEnum('registration_status', ['pending', 'approved', 'contacted', 'rejected']);

export const studentRegistrations = pgTable('student_registrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  centreId: uuid('centre_id').references(() => centres.id, { onDelete: 'cascade' }).notNull(),

  // Parent Details
  parentFirstName: varchar('parent_first_name', { length: 100 }).notNull(),
  parentLastName: varchar('parent_last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  relationship: varchar('relationship', { length: 50 }).notNull(),

  // Child Details
  childFirstName: varchar('child_first_name', { length: 100 }).notNull(),
  childLastName: varchar('child_last_name', { length: 100 }).notNull(),
  dateOfBirth: timestamp('date_of_birth').notNull(),
  schoolYear: varchar('school_year', { length: 10 }).notNull(),
  notes: text('notes'),

  // Academic Details
  subjects: text('subjects').array().notNull(), // PostgreSQL array type

  // Preferences
  preferredDays: text('preferred_days').array().notNull(),
  preferredTimes: text('preferred_times').array(),
  lessonType: varchar('lesson_type', { length: 50 }).notNull(),

  // Metadata
  status: registrationStatusEnum('status').default('pending').notNull(),
  marketingConsent: boolean('marketing_consent').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  centreStatusIdx: index('student_registrations_centre_status_idx').on(table.centreId, table.status),
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
  startDate: timestamp('start_date'),

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

  submittedAt: timestamp('submitted_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  submittedDateOfBirth: timestamp('submitted_date_of_birth'),
  submittedSchoolYear: varchar('submitted_school_year', { length: 10 }),
  submittedSessions: text('submitted_sessions').array(),
  wasMatched: boolean('was_matched').default(false).notNull(), // true if linked to existing child
  createdAt: timestamp('created_at').defaultNow(),
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
  createdAt: timestamp('created_at').defaultNow(),
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
  invoiceDate: timestamp('invoice_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  billingPeriodStart: timestamp('billing_period_start'),
  billingPeriodEnd: timestamp('billing_period_end'),
  
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  invoiceIdx: index('payments_invoice_idx').on(table.invoiceId),
}));

// ==================== AUDIT LOGS ====================
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventData: text('event_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('notifications_org_idx').on(table.organisationId),
  userIdIdx: index('notifications_user_idx').on(table.userId),
}));

// ==================== RELATIONS ====================
export const organisationsRelations = relations(organisations, ({ many }) => ({
  centres: many(centres),
  users: many(users),
  staffInvites: many(staffInvites),
  auditEvents: many(auditEvents),
}));

export const centresRelations = relations(centres, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [centres.organisationId],
    references: [organisations.id],
  }),
  bookings: many(bookings),
  availabilityRules: many(centreAvailabilityRules),
  memberships: many(centreMemberships),
  studentRegistrations: many(studentRegistrations),
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
  // Deprecated direct relation, kept for type safety until fully removed
  child: one(children, {
    fields: [bookings.childId],
    references: [children.id],
  }),
  tutor: one(users, {
    fields: [bookings.tutorId],
    references: [users.id],
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

export const studentRegistrationsRelations = relations(studentRegistrations, ({ one }) => ({
  centre: one(centres, {
    fields: [studentRegistrations.centreId],
    references: [centres.id],
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
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));
