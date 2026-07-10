import { db } from '@/db';
import { parents, children, studentNotes } from '@/db/schema';
import { and, eq, ilike } from 'drizzle-orm';

export interface ParentInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  relationship?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
}

export interface ChildInput {
  id?: string | null;
  firstName: string;
  lastName: string;
  parentId: string;
  organisationId: string;
  centreId: string;
  dateOfBirth?: Date | null;
  schoolYear: string;
  notes?: string | null;
  sessions?: string[] | null;
  systemNoteContent?: string | null;
}

/**
 * Resolve or create a parent record inside a transaction block, scoped strictly to the organisation.
 */
export async function resolveOrCreateParent(
  tx: any,
  data: ParentInput,
  currentOrgId: string
) {
  if (!data.email) {
    throw new Error('Email is required for parent resolution');
  }
  const cleanEmail = data.email.trim();

  // 1. Search for existing parent by email and organisationId to enforce tenant boundary
  let parent = await tx.query.parents.findFirst({
    where: and(
      ilike(parents.email, cleanEmail),
      eq(parents.organisationId, currentOrgId)
    ),
  });

  if (!parent) {
    // 2. Insert new parent if not found
    const [newParent] = await tx.insert(parents).values({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: cleanEmail,
      phone: data.phone || null,
      organisationId: currentOrgId,
      preferredContact: 'email',
      relationship: data.relationship || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      postcode: data.postcode || null,
    }).returning();
    parent = newParent;
  } else {
    // 3. Enforce data enrichment (update phone and address fields if they were null)
    const updateFields: any = {};
    if (data.phone && !parent.phone) updateFields.phone = data.phone;
    if (data.relationship && !parent.relationship) updateFields.relationship = data.relationship;
    if (data.addressLine1 && !parent.addressLine1) updateFields.addressLine1 = data.addressLine1;
    if (data.addressLine2 && !parent.addressLine2) updateFields.addressLine2 = data.addressLine2;
    if (data.city && !parent.city) updateFields.city = data.city;
    if (data.postcode && !parent.postcode) updateFields.postcode = data.postcode;

    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await tx.update(parents)
        .set(updateFields)
        .where(eq(parents.id, parent.id));
      
      Object.assign(parent, updateFields);
    }
  }

  return parent;
}

/**
 * Resolve or create a child record inside a transaction block, scoped to the verified parent and organisation.
 */
export async function resolveOrCreateChild(
  tx: any,
  data: ChildInput
) {
  // 1. Enforce strict tenant boundary check on the referenced parent
  const parentRec = await tx.query.parents.findFirst({
    where: and(
      eq(parents.id, data.parentId),
      eq(parents.organisationId, data.organisationId)
    ),
    columns: { id: true },
  });
  if (!parentRec) {
    throw new Error('Tenant boundary violation: Parent record does not belong to this organisation');
  }

  let child;

  // 2. Check if child is uniquely identified by ID
  if (data.id) {
    child = await tx.query.children.findFirst({
      where: and(
        eq(children.id, data.id),
        eq(children.parentId, data.parentId)
      ),
    });

    if (child) {
      // Update child fields with new details
      await tx.update(children)
        .set({
          centreId: data.centreId,
          schoolYear: data.schoolYear || child.schoolYear,
          dateOfBirth: data.dateOfBirth ?? child.dateOfBirth,
          notes: data.notes ? (child.notes ? `${child.notes}\n${data.notes}` : data.notes) : child.notes,
          registeredSessions: data.sessions || child.registeredSessions,
          updatedAt: new Date(),
        })
        .where(eq(children.id, child.id));

      child = await tx.query.children.findFirst({
        where: eq(children.id, child.id)
      });
    }
  }

  // 3. Fall back to case-insensitive name match scoped to parent
  if (!child) {
    const cleanFirstName = data.firstName.trim();
    const cleanLastName = data.lastName.trim();

    child = await tx.query.children.findFirst({
      where: and(
        ilike(children.firstName, cleanFirstName),
        ilike(children.lastName, cleanLastName),
        eq(children.parentId, data.parentId)
      ),
    });

    if (child) {
      // Enrich existing child details
      await tx.update(children)
        .set({
          dateOfBirth: child.dateOfBirth ?? (data.dateOfBirth || null),
          schoolYear: data.schoolYear ?? child.schoolYear,
          notes: data.notes ? (child.notes ? `${child.notes}\n${data.notes}` : data.notes) : child.notes,
          registeredSessions: data.sessions || child.registeredSessions,
          updatedAt: new Date(),
        })
        .where(eq(children.id, child.id));

      child = await tx.query.children.findFirst({
        where: eq(children.id, child.id)
      });
    } else {
      // 4. Create new child record
      const [insertedChild] = await tx.insert(children).values({
        parentId: data.parentId,
        organisationId: data.organisationId,
        centreId: data.centreId,
        firstName: cleanFirstName,
        lastName: cleanLastName,
        dateOfBirth: data.dateOfBirth || null,
        schoolYear: data.schoolYear || 'Unknown',
        notes: data.notes || null,
        isRegistered: true,
        registeredAt: new Date(),
        registeredSessions: data.sessions || null,
      }).returning();
      child = insertedChild;
    }
  }

  // 5. Append system note if requested
  if (data.systemNoteContent && child) {
    await tx.insert(studentNotes).values({
      childId: child.id,
      content: data.systemNoteContent,
      authorName: 'System',
      category: 'General',
    });
  }

  return child;
}
