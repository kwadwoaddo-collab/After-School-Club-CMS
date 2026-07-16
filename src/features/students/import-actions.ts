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
      // Basic sanitisation & fallbacks to force the information through
      let studentFirstName = row.studentFirstName?.trim() || '';
      let studentLastName = row.studentLastName?.trim() || '';
      let parentFirstName = row.parentFirstName?.trim() || '';
      let parentLastName = row.parentLastName?.trim() || '';
      let parentEmail = row.parentEmail?.trim().toLowerCase() || '';
      let parentPhone = row.parentPhone?.trim() || null;
      let schoolYear = row.studentSchoolYear?.trim() || '1';

      // If the row is completely empty, skip it to avoid importing garbage
      if (!studentFirstName && !studentLastName && !parentFirstName && !parentLastName && !parentEmail && !parentPhone) {
        continue;
      }

      // Fill missing student name parameters
      if (!studentFirstName && !studentLastName) {
        studentFirstName = 'Imported';
        studentLastName = `Child ${rowNumber}`;
      } else {
        if (!studentFirstName) studentFirstName = 'Imported';
        if (!studentLastName) studentLastName = 'Child';
      }

      // Fill missing parent name parameters
      if (!parentFirstName && !parentLastName) {
        parentFirstName = 'Imported';
        parentLastName = `Parent ${rowNumber}`;
      } else {
        if (!parentFirstName) parentFirstName = 'Imported';
        if (!parentLastName) parentLastName = 'Parent';
      }

      // Fill/format missing or invalid parent email
      if (!parentEmail) {
        parentEmail = `parent-${rowNumber}-${Date.now()}@asc-cms.local`;
      } else if (!parentEmail.includes('@')) {
        const cleanPart = parentEmail.replace(/[^a-z0-9._-]/g, '');
        parentEmail = `${cleanPart || `parent-${rowNumber}`}@asc-cms.local`;
      }

      // Safeguard database length limits by truncating values
      studentFirstName = studentFirstName.slice(0, 100);
      studentLastName = studentLastName.slice(0, 100);
      parentFirstName = parentFirstName.slice(0, 100);
      parentLastName = parentLastName.slice(0, 100);
      parentEmail = parentEmail.slice(0, 255);
      
      if (parentPhone) {
        parentPhone = parentPhone.slice(0, 20);
      }

      // Normalize school year: extract number if it says "Year X", then clamp to database limits
      const yearMatch = schoolYear.match(/year\s*(\d+)/i);
      if (yearMatch) {
        schoolYear = yearMatch[1];
      } else {
        schoolYear = schoolYear.replace(/\s+/g, '');
      }
      schoolYear = schoolYear.slice(0, 10) || '1';

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
