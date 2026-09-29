/**
 * CSV Import Validation Rules (DATA-REMEDIATION-1A)
 *
 * Implements strict client- and server-side validation to prevent recurrence of
 * the historical single-column CSV mapping and fallback corruption.
 */

export interface MappingValidationResult {
  valid: boolean;
  errors: string[];
}

export const REQUIRED_IMPORT_FIELDS: Record<string, string> = {
  studentFirstName: 'Student First Name',
  studentLastName: 'Student Last Name',
  studentSchoolYear: 'School Year',
  parentFirstName: 'Parent First Name',
  parentLastName: 'Parent Last Name',
  parentEmail: 'Parent Email',
};

export const OPTIONAL_IMPORT_FIELDS: Record<string, string> = {
  studentDoB: 'Student Date of Birth',
  studentNotes: 'Student Notes / Allergies',
  parentPhone: 'Parent Phone Number',
};

/**
 * Validates semantic column mappings.
 * Prevents mapping the same source column to mutually exclusive or semantically
 * conflicting fields (e.g. mapping column 0 to both first and last name, or to name and email).
 */
export function validateImportMappings(mappings: Record<string, string>): MappingValidationResult {
  const errors: string[] = [];

  // 1. Ensure all required fields are mapped
  for (const [key, label] of Object.entries(REQUIRED_IMPORT_FIELDS)) {
    const val = mappings[key];
    if (val === undefined || val === null || val.trim() === '') {
      errors.push(`Required field '${label}' is not mapped to any column.`);
    }
  }

  // Helper to check if two fields share the same non-empty column index
  const sharesColumn = (f1: string, f2: string): boolean => {
    const c1 = mappings[f1]?.trim();
    const c2 = mappings[f2]?.trim();
    return Boolean(c1 && c2 && c1 === c2);
  };

  // 2. Disallow destructive reuse across first and last names
  if (sharesColumn('studentFirstName', 'studentLastName')) {
    errors.push('Destructive mapping: Student First Name and Student Last Name cannot be mapped to the same column.');
  }

  if (sharesColumn('parentFirstName', 'parentLastName')) {
    errors.push('Destructive mapping: Parent First Name and Parent Last Name cannot be mapped to the same column.');
  }

  // 3. Disallow mapping name fields to contact or metadata fields
  const nameFields = ['studentFirstName', 'studentLastName', 'parentFirstName', 'parentLastName'];
  const dataFields = ['parentEmail', 'parentPhone', 'studentSchoolYear', 'studentDoB'];

  for (const nf of nameFields) {
    for (const df of dataFields) {
      if (sharesColumn(nf, df)) {
        const nLabel = REQUIRED_IMPORT_FIELDS[nf] || OPTIONAL_IMPORT_FIELDS[nf] || nf;
        const dLabel = REQUIRED_IMPORT_FIELDS[df] || OPTIONAL_IMPORT_FIELDS[df] || df;
        errors.push(`Invalid mapping: Name field '${nLabel}' cannot share the same column as '${dLabel}'.`);
      }
    }
  }

  // 4. Disallow cross-talk between email, phone, and school year
  if (sharesColumn('parentEmail', 'parentPhone')) {
    errors.push("Invalid mapping: 'Parent Email' and 'Parent Phone Number' cannot share the same column.");
  }
  if (sharesColumn('parentEmail', 'studentSchoolYear')) {
    errors.push("Invalid mapping: 'Parent Email' and 'School Year' cannot share the same column.");
  }
  if (sharesColumn('parentPhone', 'studentSchoolYear')) {
    errors.push("Invalid mapping: 'Parent Phone Number' and 'School Year' cannot share the same column.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Standard email format validator. Rejects placeholders, empty values, and malformed strings.
 */
export function isValidImportEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length > 255 || trimmed.length < 5) return false;
  // Disallow synthetic placeholder domains
  if (trimmed.endsWith('@asc-cms.local')) return false;

  // RFC 5322 compliant regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * International / UK telephone format validator.
 * Accepts digits, optional leading '+', spaces, hyphens, parentheses, and dots.
 * Must contain between 7 and 20 digits. Rejects arbitrary text words (e.g. 'Abdi').
 */
export function isValidImportPhone(phone: string | null | undefined): boolean {
  if (!phone) return true; // Optional field
  const trimmed = phone.trim();
  if (!trimmed) return true;

  // Reject if it contains letters or disallowed symbols
  if (/[a-zA-Z]/.test(trimmed)) return false;

  // Count raw digits
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 20) return false;

  // Allow standard telephone format: optional leading '+', followed by digits, spaces, hyphens, parens, dots
  const phoneRegex = /^\+?[0-9\s\-().]{7,25}$/;
  return phoneRegex.test(trimmed);
}

/**
 * School Year validator and normalizer.
 * Accepts:
 * - 'Reception', 'Rec', 'R'
 * - 'Nursery', 'Nur', 'N'
 * - 'Year 1' .. 'Year 13', 'Y1' .. 'Y13', '1' .. '13'
 * Returns normalized string (e.g. 'Reception', '1'..'13') or valid: false.
 */
export function validateAndNormalizeSchoolYear(rawYear: string | null | undefined): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!rawYear) {
    return { valid: false, error: 'School year is required.' };
  }
  const cleaned = rawYear.trim();
  if (!cleaned) {
    return { valid: false, error: 'School year is required.' };
  }

  const lower = cleaned.toLowerCase();

  // Reception
  if (lower === 'reception' || lower === 'rec' || lower === 'r') {
    return { valid: true, normalized: 'Reception' };
  }

  // Nursery
  if (lower === 'nursery' || lower === 'nur' || lower === 'n') {
    return { valid: true, normalized: 'Nursery' };
  }

  // Matches "Year 3", "Yr 3", "Y3", or plain "3"
  const match = lower.match(/^(?:year\s*|yr\s*|y)?(\d{1,2})$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 13) {
      return { valid: true, normalized: `Y${num}` };
    }
  }

  return {
    valid: false,
    error: `Invalid school year '${cleaned}'. Expected Reception, Nursery, or Year 1 to 13.`,
  };
}

/**
 * Validates a single student import row.
 */
export function validateImportRow(
  row: {
    studentFirstName: string;
    studentLastName: string;
    studentSchoolYear: string;
    parentFirstName: string;
    parentLastName: string;
    parentEmail: string;
    parentPhone?: string;
  },
  rowNumber: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const sFirst = (row.studentFirstName || '').trim();
  const sLast = (row.studentLastName || '').trim();
  const pFirst = (row.parentFirstName || '').trim();
  const pLast = (row.parentLastName || '').trim();
  const pEmail = (row.parentEmail || '').trim();
  const pPhone = (row.parentPhone || '').trim();

  if (!sFirst) errors.push(`Row ${rowNumber}: Student First Name is required.`);
  if (!sLast) errors.push(`Row ${rowNumber}: Student Last Name is required.`);
  if (!pFirst) errors.push(`Row ${rowNumber}: Parent First Name is required.`);
  if (!pLast) errors.push(`Row ${rowNumber}: Parent Last Name is required.`);

  // Detect single-column broadcast defect across all 4 names
  if (
    sFirst && sLast && pFirst && pLast &&
    sFirst.toLowerCase() === sLast.toLowerCase() &&
    pFirst.toLowerCase() === pLast.toLowerCase() &&
    sFirst.toLowerCase() === pFirst.toLowerCase()
  ) {
    errors.push(
      `Row ${rowNumber}: Destructive name duplication detected ('${sFirst}'). A single column cannot populate student and parent first and last names.`
    );
  }

  // Email validation
  if (!pEmail) {
    errors.push(`Row ${rowNumber}: Parent Email is required.`);
  } else if (!isValidImportEmail(pEmail)) {
    errors.push(`Row ${rowNumber}: Invalid Parent Email '${pEmail}'.`);
  }

  // Phone validation
  if (pPhone && !isValidImportPhone(pPhone)) {
    errors.push(`Row ${rowNumber}: Invalid Parent Phone number '${pPhone}'. Must contain between 7 and 20 digits.`);
  }

  // School Year validation
  const yearResult = validateAndNormalizeSchoolYear(row.studentSchoolYear);
  if (!yearResult.valid) {
    errors.push(`Row ${rowNumber}: ${yearResult.error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
