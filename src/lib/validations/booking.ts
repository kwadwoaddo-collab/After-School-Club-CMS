import { z } from 'zod';

const SCHOOL_YEARS = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y13'] as const;

export const childSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().optional(),
  schoolYear: z.enum(SCHOOL_YEARS, { message: 'Please select a valid school year' }),
  subjects: z.array(z.enum(['Maths', 'English', 'Science', 'Other'])).min(1, 'Please select at least one subject'),
  customSubject: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const parentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[\d\s\-]{7,15}$/, 'Invalid phone format').optional().or(z.literal('')),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  preferredContact: z.enum(['phone', 'email']),
}).refine(
  (data) => {
    if (data.preferredContact === 'phone') return !!data.phone && data.phone.trim().length > 0;
    if (data.preferredContact === 'email') return !!data.email && data.email.trim().length > 0;
    return false;
  },
  {
    message: 'Required field missing for selected contact method',
    path: ['preferredContact'],
  }
);

export const appointmentSchema = z.object({
  centreId: z.string().uuid('Invalid centre ID').optional(),
  modality: z.enum(['in_person', 'online']),
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
