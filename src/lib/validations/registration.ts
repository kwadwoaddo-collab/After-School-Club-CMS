import { z } from 'zod';

export const registrationSchema = z.object({
    centreId: z.string().uuid(),

    parent: z.object({
        firstName: z.string().min(2, 'First name must be at least 2 characters'),
        lastName: z.string().min(2, 'Last name must be at least 2 characters'),
        email: z.string().email('Please enter a valid email address'),
        phone: z.string().min(10, 'Please enter a valid phone number'),
        relationship: z.enum(['Mother', 'Father', 'Guardian', 'Other']),
    }),

    child: z.object({
        firstName: z.string().min(2, 'First name must be at least 2 characters'),
        lastName: z.string().min(2, 'Last name must be at least 2 characters'),
        dateOfBirth: z.string().refine((date) => new Date(date) < new Date(), {
            message: 'Date of birth must be in the past',
        }),
        schoolYear: z.string().min(1, 'Please select a school year'),
        subjects: z.array(z.string()).min(1, 'Please select at least one activity'),
        notes: z.string().optional(),
    }),

    preferences: z.object({
        preferredDays: z.array(z.string()).min(1, 'Please select at least one preferred day'),
        preferredTimes: z.array(z.string()).optional(),
        lessonType: z.enum(['Group', '1:1', 'Online']),
    }),

    consent: z.object({
        terms: z.boolean().refine((val) => val === true, {
            message: 'You must agree to the terms and conditions',
        }),
        marketing: z.boolean().optional(),
    }),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
