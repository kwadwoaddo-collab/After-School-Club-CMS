import { describe, it, expect } from 'vitest';
import {
  KNOWN_20260716_IMPORT_PARENT_IDS,
  isQuarantinedParentId,
  isQuarantinedFamily,
  isQuarantinedCohortProvenance,
  getQuarantineDetails,
  assertNotQuarantined,
  QUARANTINE_USER_NOTICE,
} from './quarantine';

describe('DATA-REMEDIATION-1A — Quarantine Classifier', () => {
  it('contains exactly 46 audited parent IDs in the immutable set', () => {
    expect(KNOWN_20260716_IMPORT_PARENT_IDS.size).toBe(46);
  });

  it('correctly classifies known 2026-07-16 import cohort parents', () => {
    // Lead examples from PO review
    expect(isQuarantinedParentId('ac77f0e1-3c76-4c96-8ca8-4fcfde398e6b')).toBe(true); // Abdi Abdi
    expect(isQuarantinedParentId('f4f20ee5-ca9b-4690-8a0f-0ba4d613194a')).toBe(true); // Agassi Agassi
    expect(isQuarantinedParentId('d1aaa566-6dc4-43f1-9184-245214a1c7a9')).toBe(true); // Mohamed Mohamed
    expect(isQuarantinedParentId('ae5452cb-4df5-4275-a446-6ddd45282fd6')).toBe(true); // Hussein Hussein
    expect(isQuarantinedParentId('37547e6a-cbf7-4d8c-bf6d-febb13c85ad2')).toBe(true); // Uddin Uddin
    expect(isQuarantinedParentId('c72ed9ec-24de-432d-964b-c7f84de5b327')).toBe(true); // Phillips Phillips
    expect(isQuarantinedParentId('b085d933-97cd-4a44-8d04-fee6e3947d6c')).toBe(true); // Thorpe Thorpe
    expect(isQuarantinedParentId('bc84a211-1ef3-4024-881d-a6902fbd1b63')).toBe(true); // Ebrahimy Ebrahimy
    expect(isQuarantinedParentId('6a4af699-23d2-49d9-b17d-240fb7b9ee8d')).toBe(true); // Ofori Ofori

    // Alias check
    expect(isQuarantinedFamily('ac77f0e1-3c76-4c96-8ca8-4fcfde398e6b')).toBe(true);
  });

  it('does NOT classify legitimate families as quarantined (zero false positives)', () => {
    // Random UUIDs
    expect(isQuarantinedParentId('00000000-0000-0000-0000-000000000000')).toBe(false);
    expect(isQuarantinedParentId('c4b12345-6789-abcd-ef01-23456789abcd')).toBe(false);

    // Empty / null / undefined inputs
    expect(isQuarantinedParentId(null)).toBe(false);
    expect(isQuarantinedParentId(undefined)).toBe(false);
    expect(isQuarantinedParentId('')).toBe(false);
  });

  it('provides rich quarantine metadata and user-facing notices', () => {
    const details = getQuarantineDetails('ac77f0e1-3c76-4c96-8ca8-4fcfde398e6b');
    expect(details).not.toBeNull();
    expect(details?.isQuarantined).toBe(true);
    expect(details?.cohortDate).toBe('2026-07-16');
    expect(details?.batch).toBe(1);
    expect(details?.billingStatus).toBe('DATA_REVIEW_REQUIRED');
    expect(details?.reconciliationStatus).toBe('UNRESOLVED');
    expect(details?.userFacingMessage).toBe(QUARANTINE_USER_NOTICE);

    // Non-quarantined returns null
    expect(getQuarantineDetails('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('assertNotQuarantined throws descriptive error on quarantined IDs', () => {
    expect(() => {
      assertNotQuarantined('ac77f0e1-3c76-4c96-8ca8-4fcfde398e6b', 'Billing configuration');
    }).toThrowError('Billing configuration blocked: Imported family details require verification before billing can be set up.');

    // Does not throw for normal IDs
    expect(() => {
      assertNotQuarantined('non-quarantined-id', 'Billing configuration');
    }).not.toThrow();
  });

  it('provenance checker correctly validates temporal boundaries', () => {
    // Inside Batch 1 window
    expect(isQuarantinedCohortProvenance({
      createdAt: '2026-07-16T17:28:35.000Z',
      organisationId: '8049f803-85e2-4bd1-bf19-49714251bea9',
    })).toBe(true);

    // Inside Batch 2 window
    expect(isQuarantinedCohortProvenance({
      createdAt: '2026-07-16T17:40:10.000Z',
      organisationId: '8049f803-85e2-4bd1-bf19-49714251bea9',
    })).toBe(true);

    // Before window
    expect(isQuarantinedCohortProvenance({
      createdAt: '2026-07-16T17:20:00.000Z',
      organisationId: '8049f803-85e2-4bd1-bf19-49714251bea9',
    })).toBe(false);

    // After window
    expect(isQuarantinedCohortProvenance({
      createdAt: '2026-07-16T18:00:00.000Z',
      organisationId: '8049f803-85e2-4bd1-bf19-49714251bea9',
    })).toBe(false);

    // Different day
    expect(isQuarantinedCohortProvenance({
      createdAt: '2026-07-15T17:30:00.000Z',
      organisationId: '8049f803-85e2-4bd1-bf19-49714251bea9',
    })).toBe(false);

    // Different org
    expect(isQuarantinedCohortProvenance({
      createdAt: '2026-07-16T17:30:00.000Z',
      organisationId: '00000000-0000-0000-0000-000000000000',
    })).toBe(false);
  });
});
