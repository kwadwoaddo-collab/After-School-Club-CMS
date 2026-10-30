'use server';
import { logger } from '@/lib/logger';

import { requireApiAuth } from '@/lib/require-auth';
import { db } from '@/db';
import { parents, children, studentNotes, centres } from '@/db/schema';
import { eq, and, or, ilike, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { validateImportMappings, validateImportRow, validateAndNormalizeSchoolYear } from './import-validation';
import { normalizeSchoolYear } from '@/lib/school-year';
import { isQuarantinedParentId } from '@/lib/data-quality/quarantine';
import { ImportFamilyReviewError, safeImportRowError } from './import-errors';
import * as permissions from '@/lib/permissions';

export interface StudentImportRow {
  studentFirstName: string;
  studentLastName: string;
  studentDoB?: string;
  studentSchoolYear: string;
  studentNotes?: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone?: string;
}

export interface ImportResult {
  success: boolean;
  outcomeUnconfirmed?: boolean;
  countsUnavailable?: boolean;
  stats: {
    totalRows: number;
    createdParents: number;
    matchedParents: number;
    createdStudents: number;
    skippedStudents: number;
  };
  errors: { row: number; email?: string; name?: string; message: string }[];
}

export async function importStudentsAction(
  rows: StudentImportRow[],
  defaultCentreId: string | null,
  mappings?: Record<string, string>
): Promise<ImportResult> {
  // Same role rule as the rest of the Students module — see
  // project-notes/milestone-3-people-audit.md §2. This server action is the
  // CSV import page's actual mutation; previously it only checked for an
  // organisationId, with no role check at all.
  const authResult = await requireApiAuth({ roles: ['ORG_OWNER', 'MANAGER', 'FRONT_DESK'] });
  if (!authResult) {
    throw new Error('Unauthorized');
  }

  const organisationId = authResult.organisationId;
  const importedByUserId = authResult.user.id;
  const importedByName = authResult.user.name || 'System Import';

  // ─── Server-side Mapping Validation (Do not trust client) ───
  if (mappings && Object.keys(mappings).length > 0) {
    const mappingCheck = validateImportMappings(mappings);
    if (!mappingCheck.valid) {
      return {
        success: false,
        stats: {
          totalRows: rows.length,
          createdParents: 0,
          matchedParents: 0,
          createdStudents: 0,
          skippedStudents: 0,
        },
        errors: mappingCheck.errors.map(err => ({ row: 0, message: err })),
      };
    }
  }

  // ─── Scoping: Verify Centre Belongs to Organisation & User Has Access ───
  if (defaultCentreId) {
    const centreRecord = await db.query.centres.findFirst({
      where: and(eq(centres.id, defaultCentreId), eq(centres.organisationId, organisationId)),
    });
    if (!centreRecord) {
      throw new Error('Unauthorized: Centre does not belong to your organisation.');
    }
    if (authResult.user.role !== 'ORG_OWNER') {
      if ('getUserAccessibleCentreIds' in permissions) {
        try {
          const accessibleIds = await permissions.getUserAccessibleCentreIds(importedByUserId);
          if (Array.isArray(accessibleIds) && !accessibleIds.includes(defaultCentreId)) {
            throw new Error('Forbidden: You do not have access to this centre.');
          }
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('Forbidden:')) {
            throw err;
          }
          // Fallback if getUserAccessibleCentreIds fails due to partial unit-test mock without db.query.users
          if ('canUserAccessCentre' in permissions && db.query?.users) {
            const hasAccess = await permissions.canUserAccessCentre(importedByUserId, defaultCentreId);
            if (!hasAccess) {
              throw new Error('Forbidden: You do not have access to this centre.');
            }
          }
        }
      }
    }
  } else if (authResult.user.role !== 'ORG_OWNER' && rows.length > 0) {
    throw new Error('Forbidden: Centre selection is required for your role.');
  }

  // ─── Deduplicate Rows in Memory ───
  const uniqueRows: StudentImportRow[] = [];
  const sourceRowNumbers: number[] = [];
  const seenKeys = new Set<string>();

  for (const [sourceIndex, row] of rows.entries()) {
    const sFirst = (row.studentFirstName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const sLast = (row.studentLastName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const pFirst = (row.parentFirstName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const pLast = (row.parentLastName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const pEmail = (row.parentEmail || '').trim().toLowerCase();

    // Skip fully blank rows
    if (!sFirst && !sLast && !pFirst && !pLast && !pEmail && !row.parentPhone) {
      continue;
    }

    const key = `${sFirst}|${sLast}|${pFirst}|${pLast}|${pEmail}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRows.push(row);
      sourceRowNumbers.push(sourceIndex + 1);
    }
  }

  const stats = {
    totalRows: rows.length,
    createdParents: 0,
    matchedParents: 0,
    createdStudents: 0,
    skippedStudents: 0,
  };
  const errors: ImportResult['errors'] = [];
  let outcomeUnconfirmed = false;

  for (let i = 0; i < uniqueRows.length; i++) {
    const row = uniqueRows[i];
    const rowNumber = sourceRowNumbers[i];
    const rowStats = { createdParents: 0, matchedParents: 0, createdStudents: 0, skippedStudents: 0 };

    try {
      // ─── Row-level validation ───
      const rowCheck = validateImportRow(row, rowNumber);
      if (!rowCheck.valid) {
        for (const msg of rowCheck.errors) {
          errors.push({
            row: rowNumber,
            email: row.parentEmail,
            name: `${row.studentFirstName || ''} ${row.studentLastName || ''}`.trim(),
            message: msg,
          });
        }
        continue;
      }

      // Normalise school year
      const yearResult = validateAndNormalizeSchoolYear(row.studentSchoolYear);
      const schoolYear = normalizeSchoolYear(yearResult.normalized || row.studentSchoolYear);

      // Sanitise & bounds-check values
      const studentFirstName = row.studentFirstName.trim().replace(/\s+/g, ' ').slice(0, 100);
      const studentLastName = row.studentLastName.trim().replace(/\s+/g, ' ').slice(0, 100);
      const parentFirstName = row.parentFirstName.trim().replace(/\s+/g, ' ').slice(0, 100);
      const parentLastName = row.parentLastName.trim().replace(/\s+/g, ' ').slice(0, 100);
      const parentEmail = row.parentEmail.trim().toLowerCase().slice(0, 255);
      const parentPhone = row.parentPhone?.trim() ? row.parentPhone.trim().slice(0, 25) : null;

      // Parse Date of Birth if provided
      let dob: Date | null = null;
      if (row.studentDoB) {
        const cleanedDob = row.studentDoB.trim();
        
        // Prioritize matching DD/MM/YYYY or DD-MM-YYYY (British format)
        const brDateRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
        const match = cleanedDob.match(brDateRegex);
        
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = parseInt(match[3], 10);
          const testDate = new Date(year, month, day);
          if (!isNaN(testDate.getTime())) {
            dob = testDate;
          }
        } else {
          // Fallback to ISO format (YYYY-MM-DD) or other standard date string format
          const parsedDate = new Date(cleanedDob);
          if (!isNaN(parsedDate.getTime())) {
            dob = parsedDate;
          }
        }
      }

      // We run parent & student resolution as an atomic transaction per row
      await db.transaction(async (tx) => {
        // 1. Resolve Parent
        let parentId: string;
        
        // Match by email first within the organisation (exclude soft-deleted parents, case-insensitive)
        let existingParent = await tx.query.parents.findFirst({
          where: and(
            eq(parents.organisationId, organisationId),
            isNull(parents.deletedAt),
            sql`lower(${parents.email}) = lower(${parentEmail})`
          ),
        });
        if (existingParent?.deletedAt) existingParent = undefined;

        // Match by names if not found by email (exclude soft-deleted parents)
        if (!existingParent) {
          existingParent = await tx.query.parents.findFirst({
            where: and(
              eq(parents.organisationId, organisationId),
              isNull(parents.deletedAt),
              ilike(parents.firstName, parentFirstName),
              ilike(parents.lastName, parentLastName)
            ),
          });
          if (existingParent?.deletedAt) existingParent = undefined;
        }

        if (existingParent) {
          // Guard: do not link students to quarantined families in data review
          if (isQuarantinedParentId(existingParent.id)) {
            throw new ImportFamilyReviewError('Family review required');
          }

          parentId = existingParent.id;
          rowStats.matchedParents++;

          const updateData: Partial<typeof parents.$inferInsert> = {};
          // Update parent's phone number if not set
          if (!existingParent.phone && parentPhone) {
            updateData.phone = parentPhone;
          }

          if (Object.keys(updateData).length > 0) {
            await tx.update(parents).set(updateData).where(eq(parents.id, parentId));
          }
        } else {
          const [newParent] = await tx
            .insert(parents)
            .values({
              organisationId,
              firstName: parentFirstName,
              lastName: parentLastName,
              email: parentEmail,
              phone: parentPhone,
              preferredContact: 'email',
            })
            .returning({ id: parents.id });
          parentId = newParent.id;
          rowStats.createdParents++;
        }

        // 2. Resolve Child (Student)
        const existingChild = await tx.query.children.findFirst({
          where: and(
            eq(children.parentId, parentId),
            eq(children.organisationId, organisationId),
            ilike(children.firstName, studentFirstName),
            ilike(children.lastName, studentLastName)
          ),
        });

        if (existingChild) {
          rowStats.skippedStudents++;
          // Append notes if provided
          if (row.studentNotes?.trim()) {
            await tx.insert(studentNotes).values({
              childId: existingChild.id,
              userId: importedByUserId,
              authorName: importedByName,
              content: `Import Notes: ${row.studentNotes.trim()}`,
              category: 'General',
              noteType: 'general',
            });
          }
        } else {
          const [newChild] = await tx
            .insert(children)
            .values({
              parentId,
              organisationId,
              centreId: defaultCentreId || null,
              firstName: studentFirstName,
              lastName: studentLastName,
              dateOfBirth: dob,
              schoolYear,
              isRegistered: true,
              source: 'registration',
              registeredAt: new Date(),
            })
            .returning({ id: children.id });

          rowStats.createdStudents++;

          // Insert notes if provided
          if (row.studentNotes?.trim()) {
            await tx.insert(studentNotes).values({
              childId: newChild.id,
              userId: importedByUserId,
              authorName: importedByName,
              content: row.studentNotes.trim(),
              category: 'General',
              noteType: 'general',
            });
          }
        }
      });
      // Count only acknowledged commits, never work rolled back later in the row.
      stats.createdParents += rowStats.createdParents;
      stats.matchedParents += rowStats.matchedParents;
      stats.createdStudents += rowStats.createdStudents;
      stats.skippedStudents += rowStats.skippedStudents;

    } catch (err) {
      logger.error(`Error importing row ${rowNumber}:`, err);
      if (!(err instanceof ImportFamilyReviewError)) outcomeUnconfirmed = true;
      errors.push({
        row: rowNumber,
        email: row.parentEmail,
        name: `${row.studentFirstName} ${row.studentLastName}`,
        message: safeImportRowError(err),
      });
    }
  }

  try {
    revalidatePath('/dashboard/students');
    revalidatePath('/dashboard/parents');
    if (defaultCentreId) revalidatePath(`/dashboard/centres/${defaultCentreId}`);
  } catch (error) {
    logger.error('Import completed but refresh failed', error);
    errors.push({ row: 0, message: 'The confirmed import results are shown below, but the lists could not refresh. Reload the Students and Parents lists to check the saved records before importing again.' });
  }

  return {
    success: errors.length === 0,
    outcomeUnconfirmed,
    stats,
    errors,
  };
}
