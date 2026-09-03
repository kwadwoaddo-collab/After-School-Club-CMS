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

export const STAFF_ROLE_LABELS: Record<HelpStaffRole, string> = {
  ORG_OWNER: 'Organisation Owner',
  MANAGER: 'Centre Manager',
  FRONT_DESK: 'Front Desk',
  TUTOR: 'Tutor / Club Leader',
};

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
  slug: string; // e.g. 'registering-a-multi-child-family-via-public-portal'
  title: string; // Canonical D6 human-readable title
  description: string; // Accurate learning objective
  category: HelpCategory;
  videoUrl: string; // Public asset URL, e.g. '/training/assets/videos/SS-D6-V001.mp4'
  durationSeconds: number; // e.g. 60, 45, 30
  durationLabel: string; // e.g. '60s', '45s', '30s'
  targetGuideSlug: string; // Primary related guide slug
  recommendedStaffRoles: HelpStaffRole[]; // Authenticated CMS staff roles
  audienceLabel: string;
  relatedGuideSlugs: string[];
  order: number;
}

export interface LearningPathSectionItem {
  type: 'guide' | 'video';
  slug: string; // Resolves to HelpGuideMetadata.slug or HelpVideoMetadata.slug
  title?: string; // Optional canonical title override (defaults to resolved title)
  description?: string; // Optional objective override (defaults to resolved description)
  note?: string; // Operational context or role-specific tip
}

export interface LearningPathSection {
  id: string;
  title: string;
  description?: string;
  items: LearningPathSectionItem[];
}

export interface HelpLearningPathMetadata {
  id: string; // e.g. 'lp-organisation-owner'
  slug: string; // e.g. 'organisation-owner'
  title: string;
  description: string;
  persona: HelpAudience;
  audienceLabel: string;
  primaryStaffRole?: HelpStaffRole; // Canonical primary CMS staff role corresponding to this path
  recommendedStaffRoles: HelpStaffRole[]; // Role recommendation mapping
  isStaffReferenceOnly?: boolean; // True for parent-portal (staff reference only, NOT staff RBAC)
  order: number;
  sections: LearningPathSection[];
}

export interface HelpSearchResult {
  guides: HelpGuideMetadata[];
  videos: HelpVideoMetadata[];
  learningPaths?: HelpLearningPathMetadata[];
  totalCount?: number;
}
