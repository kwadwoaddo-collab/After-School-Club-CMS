// src/lib/staff-constants.ts

export const ROLE_LABELS: Record<string, string> = {
  ORG_OWNER:  'Owner',
  MANAGER:    'Manager',
  FRONT_DESK: 'Front Desk',
  TUTOR:      'Tutor',  // "Club Leader" retired globally
};

// Avatar backgrounds — gradient-free, opacity-based
export const ROLE_AVATAR_COLORS: Record<string, string> = {
  ORG_OWNER:  'bg-warning/15 text-warning border border-warning/20',
  MANAGER:    'bg-accent-violet/15 text-accent-violet border border-accent-violet/20',
  FRONT_DESK: 'bg-info/15 text-info border border-info/20',
  TUTOR:      'bg-success/15 text-success border border-success/20',
};

export function getStaffInitials(name: string, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(' ').filter(Boolean);
    const raw = parts.map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return raw.length === 1 ? raw + raw : raw;
  }
  return (email || 'S').charAt(0).toUpperCase().repeat(2);
}
