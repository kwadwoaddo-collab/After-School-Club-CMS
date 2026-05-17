/**
 * Feature Flags
 * 
 * Simple env-var backed feature flags for gradual rollout of new features.
 * Each flag defaults to `false` (disabled) unless explicitly set to 'true' in env vars.
 * 
 * Usage:
 *   import { FLAGS } from '@/lib/feature-flags';
 *   if (FLAGS.PAGINATION_ENABLED) { ... }
 * 
 * To enable a flag, add to your .env.local or Vercel env vars:
 *   FF_PAGINATION=true
 */
export const FLAGS = {
  /** Phase 2: Server-side pagination on list views */
  PAGINATION_ENABLED: process.env.FF_PAGINATION === 'true',

  /** Phase 2: DB-side search replacing client-side JS .filter() */
  NEW_SEARCH: process.env.FF_NEW_SEARCH === 'true',

  /** Phase 1: Signed JWT cookies for parent portal */
  SIGNED_PARENT_COOKIES: process.env.FF_SIGNED_COOKIES === 'true',

  /** Phase 4: Automated registration → student conversion */
  AUTO_CONVERSION: process.env.FF_AUTO_CONVERSION === 'true',

  /** Phase 5: Slot hold mechanism (capacity limits) */
  SLOT_HOLDS: process.env.FF_SLOT_HOLDS === 'true',
} as const;

/** Type-safe flag name */
export type FeatureFlag = keyof typeof FLAGS;

/** Check if a flag is enabled (useful in server components) */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FLAGS[flag];
}
