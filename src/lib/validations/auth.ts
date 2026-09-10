import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;
export const MAX_EMAIL_LENGTH = 255;
export const MAX_NAME_LENGTH = 100;
export const MAX_TOKEN_LENGTH = 128;

/**
 * Validates password meets both character minimum and bcrypt UTF-8 byte maximum.
 */
export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string') return false;
  if (password.length < MIN_PASSWORD_LENGTH) return false;
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > MAX_PASSWORD_BYTES) return false;
  return true;
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return { valid: false, error: `Password must not exceed ${MAX_PASSWORD_BYTES} bytes` };
  }
  return { valid: true };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const passwordSchema = z.string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine(
    (val) => Buffer.byteLength(val, 'utf8') <= MAX_PASSWORD_BYTES,
    { message: `Password must not exceed ${MAX_PASSWORD_BYTES} bytes` }
  );

export const emailSchema = z.string()
  .min(3, 'Email is required')
  .max(MAX_EMAIL_LENGTH, `Email cannot exceed ${MAX_EMAIL_LENGTH} characters`)
  .email('Invalid email address')
  .transform(normalizeEmail);
