/**
 * SprintScale CMS — In-App Help & Training Type System
 * Strictly distinguishes between authenticated CMS staff RBAC roles and training audience personas.
 */

/**
 * Canonical authenticated CMS staff roles.
 * Exactly matches userRoleEnum in src/db/schema.ts:
 * ['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']
 */
export const CMS_STAFF_ROLES = ['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR'] as const;
export type HelpStaffRole = (typeof CMS_STAFF_ROLES)[number];

/**
 * Training Content Audience / Persona.
 * PARENT is a training audience / portal persona only, NEVER an authenticated CMS staff RBAC role.
 */
export const HELP_AUDIENCES = [
  'ALL_STAFF',
  'ORG_OWNER',
  'MANAGER',
  'FRONT_DESK',
  'TUTOR',
  'PARENT',
] as const;
export type HelpAudience = (typeof HELP_AUDIENCES)[number];

export type HelpCategory =
  | 'getting-started'
  | 'core-operations'
  | 'safeguarding'
  | 'finance'
  | 'administration'
  | 'troubleshooting'
  | 'master-manual';

export interface HelpCategoryDefinition {
  id: HelpCategory;
  name: string;
  description: string;
  iconName: string;
  order: number;
}

export interface HelpGuideMetadata {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: HelpCategory;
  audience: string; // Human readable audience description (e.g. 'Parents & Front Desk Staff')
  targetAudience: HelpAudience[]; // Content audience personas
  recommendedStaffRoles: HelpStaffRole[]; // Authenticated CMS staff roles for recommendation
  contentPath: string; // Relative to src/content/help/
  order: number;
  readingTimeMinutes: number;
  keywords: string[];
  screenshots: string[]; // Referenced screenshot asset IDs (e.g., 'SS-D6-S001')
  videos: string[]; // Referenced video asset IDs (e.g., 'SS-D6-V001')
}

export interface HelpVideoMetadata {
  id: string; // e.g. 'SS-D6-V001'
  title: string;
  description: string;
  category: HelpCategory;
  module: string;
  videoUrl: string; // Public asset URL, e.g. '/training/assets/videos/SS-D6-V001.mp4'
  durationEstimate: string; // e.g. '0:45'
  targetGuideSlug: string;
  targetAudience: HelpAudience[]; // Content audience personas
  recommendedStaffRoles: HelpStaffRole[]; // Authenticated CMS staff roles
  workflow: string;
}

export interface HelpSearchResult {
  guides: HelpGuideMetadata[];
  videos: HelpVideoMetadata[];
}
