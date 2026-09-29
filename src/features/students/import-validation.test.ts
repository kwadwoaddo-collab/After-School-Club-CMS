import { describe, it, expect } from 'vitest';
import {
  validateImportMappings,
  isValidImportEmail,
  isValidImportPhone,
  validateAndNormalizeSchoolYear,
  validateImportRow,
} from './import-validation';

describe('DATA-REMEDIATION-1A — Import Validation Guards (Phase 8)', () => {
  // Scenario 1: Same CSV column destructively mapped across student first/last rejected
  it('Scenario 1: rejects when student first and last name share the same column', () => {
    const mappings = {
      studentFirstName: '0',
      studentLastName: '0', // Collision!
      studentSchoolYear: '1',
      parentFirstName: '2',
      parentLastName: '3',
      parentEmail: '4',
    };
    const result = validateImportMappings(mappings);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Destructive mapping: Student First Name and Student Last Name cannot be mapped to the same column.'
    );
  });

  // Scenario 2: Destructive reuse across student and parent identity fields rejected
  it('Scenario 2: rejects when name fields share column with email or parent last name', () => {
    // Parent first & last collision
    const parentCollision = validateImportMappings({
      studentFirstName: '0',
      studentLastName: '1',
      studentSchoolYear: '2',
      parentFirstName: '3',
      parentLastName: '3', // Collision!
      parentEmail: '4',
    });
    expect(parentCollision.valid).toBe(false);
    expect(parentCollision.errors).toContain(
      'Destructive mapping: Parent First Name and Parent Last Name cannot be mapped to the same column.'
    );

    // Name and Email collision (root cause of single-column broadcast)
    const emailCollision = validateImportMappings({
      studentFirstName: '0',
      studentLastName: '1',
      studentSchoolYear: '2',
      parentFirstName: '0',
      parentLastName: '1',
      parentEmail: '0', // Column 0 mapped to both student name and email!
    });
    expect(emailCollision.valid).toBe(false);
    expect(emailCollision.errors.some(e => e.includes("cannot share the same column as 'Parent Email'"))).toBe(true);
  });

  // Scenario 3: Malformed email rejected
  it('Scenario 3: rejects malformed emails and placeholder @asc-cms.local emails', () => {
    expect(isValidImportEmail('abdi')).toBe(false);
    expect(isValidImportEmail('abdi@')).toBe(false);
    expect(isValidImportEmail('@asc-cms.local')).toBe(false);
    expect(isValidImportEmail('abdi@asc-cms.local')).toBe(false); // Silent synthetic domains rejected
    expect(isValidImportEmail('invalid.email.com')).toBe(false);
    expect(isValidImportEmail('')).toBe(false);
    expect(isValidImportEmail(null)).toBe(false);

    // Valid email
    expect(isValidImportEmail('parent@example.com')).toBe(true);
    expect(isValidImportEmail('jane.doe@school.co.uk')).toBe(true);
  });

  // Scenario 4: Arbitrary text phone value rejected appropriately
  it('Scenario 4: rejects arbitrary text words as phone numbers', () => {
    expect(isValidImportPhone('Abdi')).toBe(false);
    expect(isValidImportPhone('Thorpe')).toBe(false);
    expect(isValidImportPhone('not-a-number')).toBe(false);
    expect(isValidImportPhone('12345')).toBe(false); // Too short (< 7 digits)
  });

  // Scenario 5: Valid international phone accepted
  it('Scenario 5: accepts valid UK and international telephone numbers', () => {
    expect(isValidImportPhone('07700900077')).toBe(true);
    expect(isValidImportPhone('+44 7700 900077')).toBe(true);
    expect(isValidImportPhone('+1 (555) 123-4567')).toBe(true);
    expect(isValidImportPhone('+233 24 123 4567')).toBe(true);
    expect(isValidImportPhone('+33 1 42 68 55 00')).toBe(true);
    expect(isValidImportPhone(undefined)).toBe(true); // Optional
    expect(isValidImportPhone('')).toBe(true);
  });

  // Scenario 6: Invalid school year rejected
  it('Scenario 6: validates and normalizes school years, rejecting arbitrary words', () => {
    // Invalid
    expect(validateAndNormalizeSchoolYear('Abdi').valid).toBe(false);
    expect(validateAndNormalizeSchoolYear('Agassi').valid).toBe(false);
    expect(validateAndNormalizeSchoolYear('Year 15').valid).toBe(false);
    expect(validateAndNormalizeSchoolYear('').valid).toBe(false);

    // Valid
    expect(validateAndNormalizeSchoolYear('Reception')).toEqual({ valid: true, normalized: 'Reception' });
    expect(validateAndNormalizeSchoolYear('Rec')).toEqual({ valid: true, normalized: 'Reception' });
    expect(validateAndNormalizeSchoolYear('Year 3')).toEqual({ valid: true, normalized: '3' });
    expect(validateAndNormalizeSchoolYear('Y3')).toEqual({ valid: true, normalized: '3' });
    expect(validateAndNormalizeSchoolYear('3')).toEqual({ valid: true, normalized: '3' });
    expect(validateAndNormalizeSchoolYear('Year 11')).toEqual({ valid: true, normalized: '11' });
  });

  // Scenario 8 helper: Row-level validation checks
  it('rejects rows with single-column broadcast duplication across all names', () => {
    const row = {
      studentFirstName: 'Abdi',
      studentLastName: 'Abdi',
      studentSchoolYear: 'Abdi',
      parentFirstName: 'Abdi',
      parentLastName: 'Abdi',
      parentEmail: 'abdi',
      parentPhone: 'Abdi',
    };
    const check = validateImportRow(row, 1);
    expect(check.valid).toBe(false);
    expect(check.errors.some(e => e.includes('Destructive name duplication detected'))).toBe(true);
    expect(check.errors.some(e => e.includes('Invalid Parent Email'))).toBe(true);
    expect(check.errors.some(e => e.includes('Invalid Parent Phone'))).toBe(true);
    expect(check.errors.some(e => e.includes('Invalid school year'))).toBe(true);
  });

  it('accepts completely valid row', () => {
    const validRow = {
      studentFirstName: 'John',
      studentLastName: 'Doe',
      studentSchoolYear: 'Year 4',
      parentFirstName: 'Jane',
      parentLastName: 'Doe',
      parentEmail: 'jane.doe@example.com',
      parentPhone: '+44 7700 900077',
    };
    const check = validateImportRow(validRow, 1);
    expect(check.valid).toBe(true);
    expect(check.errors).toHaveLength(0);
  });
});
