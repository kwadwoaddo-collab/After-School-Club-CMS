import { db } from '@/db';
import { auditEvents, bookings, centres, registrationParents, registrations, studentEnrolmentEvents, studentFollowUpContacts } from '@/db/schema';
import { and, eq, inArray, like, or } from 'drizzle-orm';
/** Called only after the role and tenant-scoped parent lookup succeeds. */
export async function getFamilyActivityRecords(organisationId:string,parentId:string,childIds:string[],invoiceIds:string[]) {
 const [assessmentRecords,registrationRecords,lifecycle,contacts,audit]=await Promise.all([
  db.select({id:bookings.id,createdAt:bookings.createdAt,startAt:bookings.startAt,status:bookings.status}).from(bookings).innerJoin(centres,eq(bookings.centreId,centres.id)).where(and(eq(centres.organisationId,organisationId),eq(bookings.parentId,parentId))),
  db.select({id:registrations.id,createdAt:registrations.createdAt,status:registrations.status}).from(registrations).innerJoin(registrationParents,eq(registrationParents.registrationId,registrations.id)).where(and(eq(registrations.organisationId,organisationId),eq(registrationParents.parentId,parentId))),
  childIds.length?db.select({id:studentEnrolmentEvents.id,childId:studentEnrolmentEvents.childId,createdAt:studentEnrolmentEvents.createdAt,effectiveDate:studentEnrolmentEvents.effectiveDate,status:studentEnrolmentEvents.status,reason:studentEnrolmentEvents.reason}).from(studentEnrolmentEvents).where(and(eq(studentEnrolmentEvents.organisationId,organisationId),inArray(studentEnrolmentEvents.childId,childIds))):Promise.resolve([]),
  childIds.length?db.select({id:studentFollowUpContacts.id,childId:studentFollowUpContacts.childId,contactedAt:studentFollowUpContacts.contactedAt,notes:studentFollowUpContacts.notes,nextContactDate:studentFollowUpContacts.nextContactDate}).from(studentFollowUpContacts).where(and(eq(studentFollowUpContacts.organisationId,organisationId),inArray(studentFollowUpContacts.childId,childIds))):Promise.resolve([]),
  // Text comparison tolerates older malformed JSON. The pure mapper additionally
  // parses and verifies the exact invoice ID before displaying any audit event.
  invoiceIds.length?db.select({id:auditEvents.id,eventType:auditEvents.eventType,eventData:auditEvents.eventData,createdAt:auditEvents.createdAt}).from(auditEvents).where(and(eq(auditEvents.organisationId,organisationId),inArray(auditEvents.eventType,['invoice_issued','invoice_voided','invoice_draft_updated','invoice_date_updated','invoice_notes_updated']),or(...invoiceIds.map(id=>like(auditEvents.eventData,`%${id}%`))))):Promise.resolve([]),
 ]);
 return {bookings:assessmentRecords,registrations:[...new Map(registrationRecords.map(row=>[row.id,row])).values()],lifecycle,contacts,audit};
}
