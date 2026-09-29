/**
 * DATA QUALITY QUARANTINE CONTROLS (DATA-REMEDIATION-1A)
 *
 * Provides deterministic classification and safety guards for the defective
 * legacy CSV import cohort created on 2026-07-16.
 *
 * REGISTRY LIFECYCLE & RETIREMENT ROADMAP:
 * - This 46-parent UUID registry is a deliberately TEMPORARY deterministic
 *   Stage 1A safety mechanism designed to protect the billing scheduler and
 *   family UI immediately with zero production database mutations.
 * - It is NOT intended as the permanent data-quality architecture.
 * - Lifecycle stages:
 *     * Stage 1A (Current): Fail-safe quarantine blocking automated billing runs
 *       and flagging malformed parent UI for human review.
 *     * Stage 1B (Reconciliation): Per-family audited reconciliation mapping
 *       against genuine families or confirming orphan status.
 *     * Stage 1C (Cleanup): Controlled data correction / archiving, after which
 *       this in-memory static registry will be retired/removed completely.
 * - This registry CANNOT expand dynamically based on generic heuristics.
 * - Quarantine is strictly bounded to the audited 2026-07-16 cohort and cannot
 *   affect unrelated organisations, native families, or new registrations.
 *
 * SAFETY INVARIANTS:
 * 1. Zero false positives: No generic heuristic (such as firstName === lastName
 *    or parentName === childName) is used to quarantine records.
 * 2. Deterministic provenance: Classification is bounded to the known 46 parent records
 *    originating from the 2026-07-16 CSV import runs (Batches 1 & 2).
 * 3. Legitimate single-name parents (e.g. cultural names), secondary guardians,
 *    and native families are never quarantined.
 * 4. Zero mutations: Read-time classification with no database DDL or DML.
 */

// ─── Reconciliation Status Types (Handoff to DATA-REMEDIATION-1B) ───────────

export type QuarantineReconciliationStatus =
  | 'UNRESOLVED'
  | 'MATCH_EXISTING_FAMILY'
  | 'CONFIRMED_REAL_FAMILY_NEEDS_CORRECTION'
  | 'DUPLICATE_IMPORT_RECORD'
  | 'INSUFFICIENT_INFORMATION'
  | 'CONFIRMED_SAFE_TO_ARCHIVE';

export interface QuarantineDetails {
  parentId: string;
  isQuarantined: boolean;
  cohortDate: '2026-07-16';
  batch: 1 | 2;
  billingStatus: 'DATA_REVIEW_REQUIRED';
  reconciliationStatus: QuarantineReconciliationStatus;
  userFacingMessage: string;
}

// ─── Immutable 46 Cohort Parent IDs (Audited 2026-09-29) ────────────────────

export const KNOWN_20260716_IMPORT_PARENT_IDS: ReadonlySet<string> = new Set([
  // Batch 1 (Rows 1–30, 17:28:30Z – 17:29:18Z)
  '14087e1b-4bb8-4b10-8289-75f691fb0ad5', // Charlton Charlton
  'ac77f0e1-3c76-4c96-8ca8-4fcfde398e6b', // Abdi Abdi
  'f4f20ee5-ca9b-4690-8a0f-0ba4d613194a', // Agassi Agassi
  'd1aaa566-6dc4-43f1-9184-245214a1c7a9', // Mohamed Mohamed
  'ae5452cb-4df5-4275-a446-6ddd45282fd6', // Hussein Hussein
  '37547e6a-cbf7-4d8c-bf6d-febb13c85ad2', // Uddin Uddin
  'c72ed9ec-24de-432d-964b-c7f84de5b327', // Phillips Phillips
  'b085d933-97cd-4a44-8d04-fee6e3947d6c', // Thorpe Thorpe
  'bc84a211-1ef3-4024-881d-a6902fbd1b63', // Ebrahimy Ebrahimy
  'e6796e6b-fc49-456a-98be-8bb40c8f545d', // Le Le
  'b4282cc0-a344-4a69-a756-21c1b85c22cb', // Ayodele Ayodele
  'b6dd9b4b-d41c-4c3a-bf6e-33f3156ed60b', // Omole Omole
  '7091610e-60f1-4fb3-81f7-a9d9e753cdbd', // M Koroma M Koroma
  '6a4af699-23d2-49d9-b17d-240fb7b9ee8d', // Ofori Ofori
  '95ba4899-e8fe-4f6f-ae3e-0f15cdf3f0ae', // Yakubu Yakubu
  '9eb28935-27f0-4555-a820-3661595dbb4b', // Elbachari Elbachari
  '01d935cd-b90b-42be-9204-98f8d08745a9', // Touray Touray
  '73d1d382-e768-4539-9027-0a6a6ec53193', // Jones Jones
  '6b05538d-20df-4cc2-98c0-a1add45160d8', // Uyiekpen Uyiekpen
  '685c7051-628f-497a-915d-288540721dc8', // Sampah Sampah
  '9958d0da-77c4-4e5b-8a53-ffb4dad8ee6b', // Lewis Lewis
  '6d2da803-daa8-4446-affc-1f3c9c0550e0', // Eneboachi Eneboachi
  '4d7e3816-f43e-4406-b766-a082c089ce70', // Ogiefa Ogiefa
  '5ae582a7-4b56-423c-ae02-46b7598a288d', // Kasse Kasse
  '6ac17dbb-032e-47e1-baf3-6c15bafb208a', // Richardson Richardson
  'db313573-6ecc-4b96-b75d-e91a596a64f2', // Ramsey Ramsey
  '5ffdcb71-76ca-43d5-9cec-4d446aa55340', // Ndambi Ndambi
  '9fed3764-1c20-4b75-b8d4-82ee3a136ad7', // Mbatu Mbatu
  '10259af2-1961-4931-90ff-1ba182634488', // Donkor Donkor (Imported ghost record, NOT native Donkor family)
  'fbfc91a7-a44b-43c2-a5cb-68b2a0957487', // Adebambo Adebambo

  // Batch 2 (Rows 31–46, 17:39:51Z – 17:40:22Z)
  'ac83e098-2ff7-488c-8a33-443d247f2e4c', // Student Last Name Student Last Name (Header row artifact)
  '4d982b56-ea0d-4049-9287-ddc197b563f5', // Akyefua Plange Akyefua Plange
  '41e22c6c-da90-47f3-b7a1-50dadba62c7b', // Achiaah Boakye_Agyeman Achiaah Boakye_Agyeman
  '21daca11-37d6-4c44-9aa6-772b06e72803', // Tenewaa Boakye_Agyeman Tenewaa Boakye_Agyeman
  '49abae87-4738-4e93-a62c-5697ff1f825e', // Owusu_acheaw Owusu_acheaw
  '58c1c1a7-bc2e-4168-a59d-408eb1fadb2a', // Owusu-Acheaw Owusu-Acheaw
  '775d4759-a450-4df6-a70b-d02819456fc1', // Adom Paintsil Adom Paintsil
  'ff51b6f1-1f7b-44a3-8b2f-1b06ff51899d', // Oluwafikunayome Foye Oluwafikunayome Foye
  'ec731d9b-74fb-405f-aca1-302c8fad6215', // Omotola Ayodele Omotola Ayodele
  'cf657291-ae3f-4904-9a52-f8b52f95e4c7', // Wesley Greenidge Wesley Greenidge
  'cdd2e546-1fbb-44c7-8669-3555b21c8350', // Christian Otim Christian Otim
  '3555cb9d-3934-416f-adc1-66b9f5008583', // George Okoro George Okoro
  '943d606f-e9f5-499f-8cc7-4596de3682f1', // Daboh Seasy Daboh Seasy
  '67603b32-2950-4178-a644-f0f9b28b53e3', // Oluwadamilola Odunbaku Oluwadamilola Odunbaku
  '23972c43-6716-43ce-9dbb-f336402cbb31', // Yeside Odunbaku Yeside Odunbaku
  'dcd8f505-ed61-4305-9fd4-532d8d76fe87', // Omolola Odunbaku Omolola Odunbaku
]);

// ─── User-Facing Quarantine Notice ──────────────────────────────────────────

export const QUARANTINE_USER_NOTICE =
  'Imported family details require verification before billing can be set up.';

// ─── Classification Functions ───────────────────────────────────────────────

/**
 * Returns true if the parent ID belongs to the quarantined 2026-07-16 CSV import cohort.
 * O(1) in-memory lookup. Returns false for null, undefined, or unknown IDs.
 */
export function isQuarantinedParentId(parentId: string | null | undefined): boolean {
  if (!parentId) return false;
  return KNOWN_20260716_IMPORT_PARENT_IDS.has(parentId);
}

/**
 * Alias for isQuarantinedParentId representing the family-level safety boundary.
 */
export function isQuarantinedFamily(parentId: string | null | undefined): boolean {
  return isQuarantinedParentId(parentId);
}

/**
 * Defensive provenance check verifying if a record matches the exact temporal
 * and organizational boundaries of the 2026-07-16 import run.
 * Used for boundary verification and cross-validation in testing/audit tools.
 */
export function isQuarantinedCohortProvenance(record: {
  createdAt?: Date | string | null;
  organisationId?: string | null;
}): boolean {
  if (!record.createdAt) return false;
  const created = typeof record.createdAt === 'string' ? new Date(record.createdAt) : record.createdAt;
  if (isNaN(created.getTime())) return false;

  const iso = created.toISOString();
  // Exact window of the two July 16 batches: 2026-07-16T17:28:00Z to 2026-07-16T17:41:00Z
  const isCohortWindow = iso >= '2026-07-16T17:28:00.000Z' && iso <= '2026-07-16T17:41:00.000Z';
  const isSydenhamOrg = !record.organisationId || record.organisationId === '8049f803-85e2-4bd1-bf19-49714251bea9';

  return isCohortWindow && isSydenhamOrg;
}

/**
 * Returns detailed quarantine metadata for a parent record, or null if not quarantined.
 * Formatted for staff display and handoff to DATA-REMEDIATION-1B.
 */
export function getQuarantineDetails(parentId: string): QuarantineDetails | null {
  if (!isQuarantinedParentId(parentId)) return null;

  // Split batches based on known batch boundary (Batch 1 ends with Adebambo, Batch 2 starts with header row)
  const isBatch1 = [
    '14087e1b-4bb8-4b10-8289-75f691fb0ad5', 'ac77f0e1-3c76-4c96-8ca8-4fcfde398e6b',
    'f4f20ee5-ca9b-4690-8a0f-0ba4d613194a', 'd1aaa566-6dc4-43f1-9184-245214a1c7a9',
    'ae5452cb-4df5-4275-a446-6ddd45282fd6', '37547e6a-cbf7-4d8c-bf6d-febb13c85ad2',
    'c72ed9ec-24de-432d-964b-c7f84de5b327', 'b085d933-97cd-4a44-8d04-fee6e3947d6c',
    'bc84a211-1ef3-4024-881d-a6902fbd1b63', 'e6796e6b-fc49-456a-98be-8bb40c8f545d',
    'b4282cc0-a344-4a69-a756-21c1b85c22cb', 'b6dd9b4b-d41c-4c3a-bf6e-33f3156ed60b',
    '7091610e-60f1-4fb3-81f7-a9d9e753cdbd', '6a4af699-23d2-49d9-b17d-240fb7b9ee8d',
    '95ba4899-e8fe-4f6f-ae3e-0f15cdf3f0ae', '9eb28935-27f0-4555-a820-3661595dbb4b',
    '01d935cd-b90b-42be-9204-98f8d08745a9', '73d1d382-e768-4539-9027-0a6a6ec53193',
    '6b05538d-20df-4cc2-98c0-a1add45160d8', '685c7051-628f-497a-915d-288540721dc8',
    '9958d0da-77c4-4e5b-8a53-ffb4dad8ee6b', '6d2da803-daa8-4446-affc-1f3c9c0550e0',
    '4d7e3816-f43e-4406-b766-a082c089ce70', '5ae582a7-4b56-423c-ae02-46b7598a288d',
    '6ac17dbb-032e-47e1-baf3-6c15bafb208a', 'db313573-6ecc-4b96-b75d-e91a596a64f2',
    '5ffdcb71-76ca-43d5-9cec-4d446aa55340', '9fed3764-1c20-4b75-b8d4-82ee3a136ad7',
    '10259af2-1961-4931-90ff-1ba182634488', 'fbfc91a7-a44b-43c2-a5cb-68b2a0957487',
  ].includes(parentId);

  return {
    parentId,
    isQuarantined: true,
    cohortDate: '2026-07-16',
    batch: isBatch1 ? 1 : 2,
    billingStatus: 'DATA_REVIEW_REQUIRED',
    reconciliationStatus: 'UNRESOLVED',
    userFacingMessage: QUARANTINE_USER_NOTICE,
  };
}

/**
 * Domain boundary assertion. Throws a clear error if the parent is quarantined.
 */
export function assertNotQuarantined(parentId: string | null | undefined, actionDescription = 'Billing operation'): void {
  if (isQuarantinedParentId(parentId)) {
    throw new Error(`${actionDescription} blocked: ${QUARANTINE_USER_NOTICE}`);
  }
}
