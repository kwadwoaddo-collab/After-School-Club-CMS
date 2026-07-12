'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { parents, children, studentNotes } from '@/db/schema';
import { eq, and, or, ilike } from 'drizzle-orm';

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
  defaultCentreId: string | null
): Promise<ImportResult> {
  const session = await auth();
  if (!session?.user?.organisationId) {
    throw new Error('Unauthorized');
  }

  const organisationId = session.user.organisationId;
  const stats = {
    totalRows: rows.length,
    createdParents: 0,
    matchedParents: 0,
    createdStudents: 0,
    skippedStudents: 0,
  };
  const errors: ImportResult['errors'] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    try {
      // Basic validations
      const studentFirstName = row.studentFirstName?.trim();
      const studentLastName = row.studentLastName?.trim();
      const parentFirstName = row.parentFirstName?.trim();
      const parentLastName = row.parentLastName?.trim();
      const parentEmail = row.parentEmail?.trim().toLowerCase();
      const parentPhone = row.parentPhone?.trim() || null;
      let schoolYear = row.studentSchoolYear?.trim() || '1';

      if (!studentFirstName || !studentLastName) {
        errors.push({ row: rowNumber, message: 'Student first and last names are required.' });
        continue;
      }
      if (!parentFirstName || !parentLastName || !parentEmail) {
        errors.push({ row: rowNumber, email: parentEmail, message: 'Parent first, last name, and email are required.' });
        continue;
      }

      // Normalize school year: extract number if it says "Year X"
      const yearMatch = schoolYear.match(/year\s*(\d+)/i);
      if (yearMatch) {
        schoolYear = yearMatch[1];
      }

      // Parse Date of Birth if provided
      let dob: Date | null = null;
      if (row.studentDoB) {
        const parsedDate = new Date(row.studentDoB);
        if (!isNaN(parsedDate.getTime())) {
          dob = parsedDate;
        } else {
          // Try DD/MM/YYYY format parsing
          const parts = row.studentDoB.split(/[-/]/);
          if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const testDate = new Date(year, month, day);
            if (!isNaN(testDate.getTime())) {
              dob = testDate;
            }
          }
        }
      }

      // We run parent & student resolution as an atomic transaction per row
      await db.transaction(async (tx) => {
        // 1. Resolve Parent
        let parentId: string;
        const existingParent = await tx.query.parents.findFirst({
          where: and(
            eq(parents.organisationId, organisationId),
            ilike(parents.email, parentEmail)
          ),
        });

        if (existingParent) {
          parentId = existingParent.id;
          stats.matchedParents++;
          // Optionally update phone if not set
          if (!existingParent.phone && parentPhone) {
            await tx.update(parents).set({ phone: parentPhone }).where(eq(parents.id, parentId));
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
          stats.createdParents++;
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
          stats.skippedStudents++;
          // Append notes if provided
          if (row.studentNotes?.trim()) {
            await tx.insert(studentNotes).values({
              childId: existingChild.id,
              userId: session.user.id,
              authorName: session.user.name || 'System Import',
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

          stats.createdStudents++;

          // Insert notes if provided
          if (row.studentNotes?.trim()) {
            await tx.insert(studentNotes).values({
              childId: newChild.id,
              userId: session.user.id,
              authorName: session.user.name || 'System Import',
              content: row.studentNotes.trim(),
              category: 'General',
              noteType: 'general',
            });
          }
        }
      });

    } catch (err: any) {
      console.error(`Error importing row ${rowNumber}:`, err);
      errors.push({
        row: rowNumber,
        email: row.parentEmail,
        name: `${row.studentFirstName} ${row.studentLastName}`,
        message: err.message || 'Database error occurred.',
      });
    }
  }

  return {
    success: errors.length === 0,
    stats,
    errors,
  };
}
