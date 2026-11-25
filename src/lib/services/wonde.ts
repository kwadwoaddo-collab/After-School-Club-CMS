import { db } from '@/db';
import { children, parents } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface WondeContact {
  id: string;
  forename: string;
  surname: string;
  email?: string;
  phone?: string;
}

export interface WondeStudent {
  id: string;
  forename: string;
  surname: string;
  date_of_birth: string; // YYYY-MM-DD
  contact_details: WondeContact[];
}

export class WondeService {
  constructor(private organisationId: string, private centreId: string) {}

  // Stubbed client method
  async fetchStudentsFromWonde(): Promise<WondeStudent[]> {
    logger.info('Fetching students from Wonde (Stubbed)');
    // In reality this would call the Wonde API using a stored token for the organisation
    return [];
  }

  async syncStudents(wondeStudents: WondeStudent[]) {
    const results = {
      matchedStudents: 0,
      createdStudents: 0,
      matchedContacts: 0,
      createdContacts: 0,
    };

    for (const ws of wondeStudents) {
      // 1. Sync Contacts (Parents) first — strictly exclude soft-deleted parents
      let parentId: string | null = null;
      
      for (const wc of ws.contact_details) {
        // Try to match active (non-deleted) parent
        const rawParents = await db.query.parents.findMany({
          where: and(
            eq(parents.organisationId, this.organisationId),
            eq(parents.firstName, wc.forename),
            eq(parents.lastName, wc.surname),
            parents.deletedAt ? isNull(parents.deletedAt) : undefined
          )
        });
        const existingParents = rawParents.filter(
          (p) => (p as { deletedAt?: Date | null }).deletedAt == null
        );

        let matchedParent = existingParents.find(p => p.email === wc.email || p.phone === wc.phone);
        if (!matchedParent && existingParents.length > 0) {
           // Fallback to name match if email/phone missing but name matches exactly
           matchedParent = existingParents[0];
        }

        if (matchedParent) {
          parentId = matchedParent.id;
          results.matchedContacts++;
        } else {
          // Create parent
          const [newParent] = await db.insert(parents).values({
            organisationId: this.organisationId,
            firstName: wc.forename,
            lastName: wc.surname,
            email: wc.email || null,
            phone: wc.phone || null,
            preferredContact: wc.email ? 'email' : 'phone',
          }).returning();
          parentId = newParent.id;
          results.createdContacts++;
        }
      }

      // Skip if no parent contact could be synced
      if (!parentId) {
        logger.warn(`Skipping Wonde student ${ws.id} because no contacts could be synced.`);
        continue;
      }

      // 2. Sync Student — strictly exclude soft-deleted children
      const dobDate = new Date(ws.date_of_birth);

      const rawStudents = await db.query.children.findMany({
        where: and(
          eq(children.organisationId, this.organisationId),
          eq(children.firstName, ws.forename),
          eq(children.lastName, ws.surname),
          children.deletedAt ? isNull(children.deletedAt) : undefined
        )
      });
      const existingStudents = rawStudents.filter(
        (s) => (s as { deletedAt?: Date | null }).deletedAt == null
      );

      // Match on Date of birth
      const matchedStudent = existingStudents.find(
        s => s.dateOfBirth && s.dateOfBirth.toISOString().split('T')[0] === ws.date_of_birth
      );

      if (matchedStudent) {
        results.matchedStudents++;
        // Link centreId if not set, scoped to organisationId and active child
        if (!matchedStudent.centreId) {
          await db.update(children)
            .set({ centreId: this.centreId })
            .where(
              and(
                eq(children.id, matchedStudent.id),
                eq(children.organisationId, this.organisationId),
                children.deletedAt ? isNull(children.deletedAt) : undefined
              )
            );
        }
      } else {
        // Create student
        await db.insert(children).values({
          organisationId: this.organisationId,
          centreId: this.centreId,
          parentId: parentId,
          firstName: ws.forename,
          lastName: ws.surname,
          dateOfBirth: dobDate,
          schoolYear: 'Unknown', // Wonde provides Year Group usually, but omitting for brevity in stub
        });
        results.createdStudents++;
      }
    }

    return results;
  }
}
