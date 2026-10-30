'use server';
import { db } from '@/db';
import { auditEvents, centreDocumentFolders, centreDocuments, centres, orgMemberships, centreMemberships } from '@/db/schema';
import { requireTenantSession } from '@/lib/session';
import { getUserRoleForCentre } from '@/lib/permissions';
import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { documentIdentity, documentName, MAX_CENTRE_DOCUMENTS, validatePdf } from './validation';

async function access(centreId: string, manage = false) {
    z.string().uuid().parse(centreId);
    const session = await requireTenantSession();
    const role = await getUserRoleForCentre(session.user.id, centreId);
    const centre = await db.query.centres.findFirst({ where: and(eq(centres.id, centreId), eq(centres.organisationId, session.user.organisationId!)), columns: { id: true } });
    const orgRole = await db.query.orgMemberships.findFirst({ where: and(eq(orgMemberships.userId, session.user.id), eq(orgMemberships.organisationId, session.user.organisationId!)), columns: { role: true } });
    const canManage = !!orgRole && ['ORG_OWNER', 'MANAGER'].includes(orgRole.role) && !!role && ['ORG_OWNER', 'MANAGER'].includes(role);
    if (!centre || !role || !orgRole || (manage && !canManage)) throw new Error('You do not have permission to access these documents.');
    return { session, canManage };
}
async function lockLiveManager(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, organisationId: string, centreId: string) {
    const [membership] = await tx.select({ role: orgMemberships.role }).from(orgMemberships).where(and(eq(orgMemberships.userId, userId), eq(orgMemberships.organisationId, organisationId))).for('share');
    if (!membership || !['ORG_OWNER', 'MANAGER'].includes(membership.role)) throw new Error('You do not have permission to manage these documents.');
    const [centre] = await tx.select({ id: centres.id }).from(centres).where(and(eq(centres.id, centreId), eq(centres.organisationId, organisationId))).for('share');
    if (!centre) throw new Error('You do not have permission to manage these documents.');
    if (membership.role !== 'ORG_OWNER') {
        const [assigned] = await tx.select({ role: centreMemberships.role }).from(centreMemberships).where(and(eq(centreMemberships.userId, userId), eq(centreMemberships.centreId, centreId))).for('share');
        if (!assigned || assigned.role !== 'MANAGER') throw new Error('You do not have permission to manage these documents.');
    }
}
export async function getCentreDocuments(centreId: string) {
    const { session, canManage } = await access(centreId);
    const rows = await db.select({ id: centreDocuments.id, folderId: centreDocuments.folderId, name: centreDocuments.name, originalFilename: centreDocuments.originalFilename, sizeBytes: centreDocuments.sizeBytes, updatedAt: centreDocuments.updatedAt, removedAt: centreDocuments.removedAt, version: centreDocuments.version }).from(centreDocuments).where(and(eq(centreDocuments.organisationId, session.user.organisationId!), eq(centreDocuments.centreId, centreId), canManage ? sql`true` : isNull(centreDocuments.removedAt))).orderBy(desc(centreDocuments.updatedAt));
    const folderRows = await db.select({ id: centreDocumentFolders.id, name: centreDocumentFolders.name, parentId: centreDocumentFolders.parentId, version: centreDocumentFolders.version, updatedAt: centreDocumentFolders.updatedAt, removedAt: centreDocumentFolders.removedAt }).from(centreDocumentFolders).where(and(eq(centreDocumentFolders.organisationId, session.user.organisationId!), eq(centreDocumentFolders.centreId, centreId), canManage ? sql`true` : isNull(centreDocumentFolders.removedAt))).orderBy(desc(centreDocumentFolders.updatedAt));
    const folders = folderRows.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString(), removedAt: row.removedAt?.toISOString() ?? null }));
    const serialize = (row: typeof rows[number]) => ({ ...row, removedAt: row.removedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() });
    return { folders: folders.filter(row => !row.removedAt), removedFolders: canManage ? folders.filter(row => row.removedAt) : [], documents: rows.filter(row => !row.removedAt).map(serialize), removedDocuments: canManage ? rows.filter(row => row.removedAt).map(serialize) : [], canManage };
}
function errorResult(error: unknown) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? 'Check the document details.' };
    const known = error instanceof Error && /^(Choose|Only|This file|You do not|This document|This centre|This folder)/.test(error.message);
    return { success: false as const, error: known ? (error as Error).message : 'Could not save the document. Please try again.' };
}
export async function uploadCentreDocument(form: FormData) {
    try {
        const centreId = z.string().uuid().parse(form.get('centreId'));
        const name = documentName.parse(form.get('name'));
        const folderId = z.string().uuid().nullable().parse(form.get('folderId') || null);
        const { session } = await access(centreId, true);
        const pdf = await validatePdf(form.get('file'));
        await db.transaction(async tx => {
        await lockLiveManager(tx, session.user.id, session.user.organisationId!, centreId);
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`documents:${centreId}`}))`);
            await assertActiveFolder(tx, session.user.organisationId!, centreId, folderId);
            const [{ count, totalBytes }] = await tx.select({ count: sql<number>`count(*) filter (where ${centreDocuments.removedAt} is null)::int`, totalBytes: sql<number>`coalesce(sum(${centreDocuments.sizeBytes}) filter (where ${centreDocuments.removedAt} is null), 0)::int` }).from(centreDocuments).where(and(eq(centreDocuments.centreId, centreId), isNull(centreDocuments.removedAt)));
            if (totalBytes + pdf.sizeBytes > 60 * 1024 * 1024) throw new Error('This centre has reached its 60 MB storage limit, including removed files.');
            if (count >= MAX_CENTRE_DOCUMENTS) throw new Error('This centre already has 20 documents. Remove one before uploading another.');
            const [row] = await tx.insert(centreDocuments).values({ organisationId: session.user.organisationId!, centreId, folderId, name, ...pdf, createdBy: session.user.id }).returning({ id: centreDocuments.id });
            await tx.insert(auditEvents).values({ organisationId: session.user.organisationId!, userId: session.user.id, eventType: 'centre_document_uploaded', eventData: JSON.stringify({ centreId, documentId: row.id, name, sizeBytes: pdf.sizeBytes }) });
        });
        revalidatePath('/dashboard/documents');
        return { success: true as const };
    } catch (error) { return errorResult(error); }
}
async function mutate(input: { centreId: string; documentId: string; version: number }, changes: Partial<typeof centreDocuments.$inferInsert>, eventType: string) {
    const { centreId, documentId, version } = documentIdentity.parse(input);
    const { session } = await access(centreId, true);
    await db.transaction(async tx => {
        await lockLiveManager(tx, session.user.id, session.user.organisationId!, centreId);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`documents:${centreId}`}))`);
        if ('folderId' in changes) await assertActiveFolder(tx, session.user.organisationId!, centreId, changes.folderId ?? null);
        if (changes.content) {
            const [{ totalBytes }] = await tx.select({ totalBytes: sql<number>`coalesce(sum(${centreDocuments.sizeBytes}) filter (where ${centreDocuments.removedAt} is null),0)::int` }).from(centreDocuments).where(and(eq(centreDocuments.centreId, centreId), isNull(centreDocuments.removedAt), sql`${centreDocuments.id} <> ${documentId}`));
            if (totalBytes + (changes.sizeBytes ?? 0) > 60 * 1024 * 1024) throw new Error('This centre has reached its 60 MB storage limit, including removed files.');
        }
        if (eventType === 'centre_document_restored') {
            const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(centreDocuments).where(and(eq(centreDocuments.centreId, centreId), isNull(centreDocuments.removedAt)));
            if (count >= MAX_CENTRE_DOCUMENTS) throw new Error('This centre already has 20 documents. Remove one before restoring another.');
        }
        const [row] = await tx.update(centreDocuments).set({ ...changes, version: version + 1, updatedAt: new Date() }).where(and(eq(centreDocuments.id, documentId), eq(centreDocuments.centreId, centreId), eq(centreDocuments.organisationId, session.user.organisationId!), eq(centreDocuments.version, version), eventType === 'centre_document_restored' ? sql`${centreDocuments.removedAt} is not null` : isNull(centreDocuments.removedAt))).returning({ id: centreDocuments.id });
        if (!row) throw new Error('This document changed or was removed. Refresh the folder and try again.');
        await tx.insert(auditEvents).values({ organisationId: session.user.organisationId!, userId: session.user.id, eventType, eventData: JSON.stringify({ centreId, documentId, version: version + 1 }) });
    });
    revalidatePath('/dashboard/documents');
    return { success: true as const };
}
export async function renameCentreDocument(input: { centreId: string; documentId: string; version: number; name: string }) {
    try { return await mutate(input, { name: documentName.parse(input.name) }, 'centre_document_renamed'); } catch (error) { return errorResult(error); }
}
export async function removeCentreDocument(input: { centreId: string; documentId: string; version: number }) {
    try { return await mutate(input, { removedAt: new Date() }, 'centre_document_removed'); } catch (error) { return errorResult(error); }
}
export async function replaceCentreDocument(form: FormData) {
    try {
        const input = documentIdentity.parse({ centreId: form.get('centreId'), documentId: form.get('documentId'), version: Number(form.get('version')) });
        await access(input.centreId, true);
        const pdf = await validatePdf(form.get('file'));
        return await mutate(input, pdf, 'centre_document_replaced');
    } catch (error) { return errorResult(error); }
}

export async function restoreCentreDocument(input: { centreId: string; documentId: string; version: number }) {
    try { return await mutate(input, { removedAt: null }, 'centre_document_restored'); } catch (error) { return errorResult(error); }
}

const folderName = documentName.refine(value => !/[\/\\]/.test(value), 'Folder names cannot contain slashes.');
type DocumentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const folderIdentity = z.object({ centreId: z.string().uuid(), folderId: z.string().uuid(), version: z.number().int().positive() });
async function assertActiveFolder(tx: DocumentTransaction, organisationId: string, centreId: string, folderId: string | null) {
    if (folderId === null) return;
    const [folder] = await tx.select({ id: centreDocumentFolders.id }).from(centreDocumentFolders).where(and(eq(centreDocumentFolders.id, folderId), eq(centreDocumentFolders.organisationId, organisationId), eq(centreDocumentFolders.centreId, centreId), isNull(centreDocumentFolders.removedAt)));
    if (!folder) throw new Error('This folder is no longer available. Choose another folder.');
}
export async function moveCentreDocument(input: { centreId: string; documentId: string; version: number; folderId: string | null }) {
    try {
        const folderId = z.string().uuid().nullable().parse(input.folderId);
        return await mutate(input, { folderId }, 'centre_document_moved');
    } catch (error) { return errorResult(error); }
}
export async function createCentreFolder(input: { centreId: string; parentId: string | null; name: string }) {
    try {
        const { centreId, parentId, name } = z.object({ centreId: z.string().uuid(), parentId: z.string().uuid().nullable(), name: folderName }).parse(input);
        const { session } = await access(centreId, true);
        await db.transaction(async tx => {
            await lockLiveManager(tx, session.user.id, session.user.organisationId!, centreId);
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`documents:${centreId}`}))`);
            await assertActiveFolder(tx, session.user.organisationId!, centreId, parentId);
            await assertFolderNameAvailable(tx, session.user.organisationId!, centreId, parentId, name);
            let ancestor = parentId;
            let depth = 1;
            while (ancestor) {
                if (++depth > 8) throw new Error('This folder would exceed the maximum depth of 8 folders.');
                const [parent] = await tx.select({ parentId: centreDocumentFolders.parentId }).from(centreDocumentFolders).where(and(eq(centreDocumentFolders.id, ancestor), eq(centreDocumentFolders.centreId, centreId), eq(centreDocumentFolders.organisationId, session.user.organisationId!)));
                if (!parent) throw new Error('This folder is no longer available.');
                ancestor = parent.parentId;
            }
            const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(centreDocumentFolders).where(and(eq(centreDocumentFolders.centreId, centreId), isNull(centreDocumentFolders.removedAt)));
            if (count >= 100) throw new Error('This centre has reached its limit of 100 folders, including removed folders.');
            const [row] = await tx.insert(centreDocumentFolders).values({ organisationId: session.user.organisationId!, centreId, parentId, name, createdBy: session.user.id }).returning({ id: centreDocumentFolders.id });
            await tx.insert(auditEvents).values({ organisationId: session.user.organisationId!, userId: session.user.id, eventType: 'centre_document_folder_created', eventData: JSON.stringify({ centreId, folderId: row.id, parentId, name }) });
        });
        revalidatePath('/dashboard/documents'); return { success: true as const };
    } catch (error) { return errorResult(error); }
}
async function mutateFolder(input: { centreId: string; folderId: string; version: number }, operation: 'rename' | 'remove' | 'restore', name?: string) {
    const { centreId, folderId, version } = folderIdentity.parse(input);
    const { session } = await access(centreId, true);
    await db.transaction(async tx => {
        await lockLiveManager(tx, session.user.id, session.user.organisationId!, centreId);
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`documents:${centreId}`}))`);
        const [folder] = await tx.select({ parentId: centreDocumentFolders.parentId }).from(centreDocumentFolders).where(and(eq(centreDocumentFolders.id, folderId), eq(centreDocumentFolders.organisationId, session.user.organisationId!), eq(centreDocumentFolders.centreId, centreId), eq(centreDocumentFolders.version, version), operation === 'restore' ? sql`${centreDocumentFolders.removedAt} is not null` : isNull(centreDocumentFolders.removedAt)));
        if (!folder) throw new Error('This folder changed or was removed. Refresh and try again.');
        if (operation === 'restore') {
            await assertActiveFolder(tx, session.user.organisationId!, centreId, folder.parentId);
            const [current] = await tx.select({ name: centreDocumentFolders.name }).from(centreDocumentFolders).where(eq(centreDocumentFolders.id, folderId));
            await assertFolderNameAvailable(tx, session.user.organisationId!, centreId, folder.parentId, current.name, folderId);
        }
        if (operation === 'rename') await assertFolderNameAvailable(tx, session.user.organisationId!, centreId, folder.parentId, folderName.parse(name), folderId);
        if (operation === 'remove') {
            // Include removed items so their original location remains recoverable.
            const [document] = await tx.select({ id: centreDocuments.id }).from(centreDocuments).where(and(eq(centreDocuments.centreId, centreId), eq(centreDocuments.folderId, folderId))).limit(1);
            const [child] = await tx.select({ id: centreDocumentFolders.id }).from(centreDocumentFolders).where(and(eq(centreDocumentFolders.centreId, centreId), eq(centreDocumentFolders.parentId, folderId), isNull(centreDocumentFolders.removedAt))).limit(1);
            if (document || child) throw new Error('This folder is not empty. Move its PDFs and remove subfolders first. Restore and move any removed PDFs.');
        }
        await tx.update(centreDocumentFolders).set({ ...(operation === 'rename' ? { name: folderName.parse(name) } : { removedAt: operation === 'remove' ? new Date() : null }), version: version + 1, updatedAt: new Date() }).where(and(eq(centreDocumentFolders.id, folderId), eq(centreDocumentFolders.organisationId, session.user.organisationId!), eq(centreDocumentFolders.centreId, centreId), eq(centreDocumentFolders.version, version)));
        await tx.insert(auditEvents).values({ organisationId: session.user.organisationId!, userId: session.user.id, eventType: `centre_document_folder_${operation}`, eventData: JSON.stringify({ centreId, folderId, version: version + 1, ...(name ? { name } : {}) }) });
    });
    revalidatePath('/dashboard/documents'); return { success: true as const };
}
export async function renameCentreFolder(input: { centreId: string; folderId: string; version: number; name: string }) {
    try { return await mutateFolder(input, 'rename', input.name); } catch (error) { return errorResult(error); }
}
export async function removeCentreFolder(input: { centreId: string; folderId: string; version: number }) {
    try { return await mutateFolder(input, 'remove'); } catch (error) { return errorResult(error); }
}
export async function restoreCentreFolder(input: { centreId: string; folderId: string; version: number }) {
    try { return await mutateFolder(input, 'restore'); } catch (error) { return errorResult(error); }
}

async function assertFolderNameAvailable(tx: DocumentTransaction, organisationId: string, centreId: string, parentId: string | null, name: string, excludeId?: string) {
    const [existing] = await tx.select({ id: centreDocumentFolders.id }).from(centreDocumentFolders).where(and(eq(centreDocumentFolders.organisationId, organisationId), eq(centreDocumentFolders.centreId, centreId), parentId ? eq(centreDocumentFolders.parentId, parentId) : isNull(centreDocumentFolders.parentId), isNull(centreDocumentFolders.removedAt), sql`lower(${centreDocumentFolders.name}) = lower(${name})`, excludeId ? sql`${centreDocumentFolders.id} <> ${excludeId}` : sql`true`)).limit(1);
    if (existing) throw new Error('This folder already contains a folder with that name. Choose another name.');
}
