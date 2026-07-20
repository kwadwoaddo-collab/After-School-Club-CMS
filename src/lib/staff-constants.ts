// src/lib/staff-constants.ts

export const ROLE_LABELS: Record<string, string> = {
  ORG_OWNER:  'Owner',
  MANAGER:    'Manager',
  FRONT_DESK: 'Front Desk',
  TUTOR:      'Tutor',  // "Club Leader" retired globally
};

// Opacity-based, theme-adaptive — work in light + dark without dark: variants
export const ROLE_COLORS: Record<string, string> = {
  ORG_OWNER:  'bg-warning/10 text-warning border-warning/20',
  MANAGER:    'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
  FRONT_DESK: 'bg-info/10 text-info border-info/20',
  TUTOR:      'bg-success/10 text-success border-success/20',
};

// Avatar backgrounds — gradient-free, opacity-based
export const ROLE_AVATAR_COLORS: Record<string, string> = {
  ORG_OWNER:  'bg-warning/15 text-warning border border-warning/20',
  MANAGER:    'bg-accent-violet/15 text-accent-violet border border-accent-violet/20',
  FRONT_DESK: 'bg-info/15 text-info border border-info/20',
  TUTOR:      'bg-success/15 text-success border border-success/20',
};
