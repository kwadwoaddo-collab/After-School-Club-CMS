import { z } from 'zod';

const SCHOOL_YEARS = ['Reception', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'] as const;

export const childSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().optional(),
  schoolYear: z.enum(SCHOOL_YEARS, { message: 'Please select a valid school year' }),
  // Kept in sync with BookingForm.tsx's SUBJECTS constant, the only place
  // that actually renders this list for selection. This enum previously
  // listed a different, older set of activities (from before commit
  // f1832a8 renamed the club's activities to Maths/English/Science/11+/Stem
  // Activities/Childcare) — meaning the client-side zodResolver on
  // BookingForm rejected 3 of the 6 selectable activities ('11+', 'Stem
  // Activities', 'Childcare') outright, silently blocking submission
  // whenever a parent picked one of them. See architecture-decisions.md
  // ("booking subjects enum drift").
  subjects: z.array(z.enum(['Maths', 'English', 'Science', '11+', 'Stem Activities', 'Childcare'])).min(1, 'Please select at least one activity'),
  customSubject: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
});

export const parentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[\d\s\-]{7,15}$/, 'Invalid phone format').optional().or(z.literal('')),
  email: z.union([z.string().email('Please enter a valid email address'), z.literal('')]).optional(),
  // Task 1: preferredContact is now optional — no longer a required field
  preferredContact: z.enum(['phone', 'email']).optional(),
});

export const appointmentSchema = z.object({
  centreId: z.string().uuid('Invalid centre ID').optional(),
  modality: z.enum(['in_person', 'online']),
  date: z.string().optional(),
  startAt: z.string().min(1, 'Please select a time slot'),
  duration: z.number().int().positive().default(45),
});

export const consentSchema = z.object({
  communications: z.literal(true, { message: 'You must consent to communications to proceed' }),
});

export const bookingSchema = z.object({
  parent: parentSchema,
  children: z.array(childSchema).min(1, 'Please add at least one child'),
  appointment: appointmentSchema,
  consent: consentSchema,
  rescheduleId: z.string().uuid().optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
export type ChildInput = z.infer<typeof childSchema>;
export type ParentInput = z.infer<typeof parentSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
