import { z } from 'zod';

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const organisationSchema = z.object({
  name: z.string().min(1, 'Organisation name is required').max(255),
  ownerEmail: z.string().email('Invalid email address'),
});

export const centreSchema = z.object({
  name: z.string().min(1, 'Centre name is required').max(255),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(32, 'Slug must be at most 32 characters')
    .regex(slugRegex, 'Slug must be lowercase letters, numbers, and hyphens only'),
  address: z.string().min(1, 'Address is required'),
  timezone: z.string().default('Europe/London'),
});

export const availabilityRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday, 6 = Saturday
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format'),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: 'End time must be after start time', path: ['endTime'] }
);

export const staffInviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']),
});

export const onboardingCompleteSchema = z.object({
  organisation: organisationSchema,
  centre: centreSchema,
  availabilityRules: z.array(availabilityRuleSchema).min(1, 'At least one availability rule is required'),
  staffInvites: z.array(staffInviteSchema).optional(),
});

export type OrganisationInput = z.infer<typeof organisationSchema>;
export type CentreInput = z.infer<typeof centreSchema>;
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>;
export type StaffInviteInput = z.infer<typeof staffInviteSchema>;
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;
