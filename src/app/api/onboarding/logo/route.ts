import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, organisations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { validateImageContent } from '@/lib/file-validation';
import { uploadToBlob } from '@/lib/services/blob';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/**
 * PM-1.3A: Dedicated Scoped Logo Upload for Onboarding
 *
 * Security Model:
 *   - Requires authenticated session (auth())
 *   - Verifies user role is ORG_OWNER
 *   - Target organisation is strictly derived from DB record (zero client trust)
 *   - Allows PENDING and ACTIVE organisations (rejects SUSPENDED / REJECTED)
 *   - Strict file type and content validation (magic bytes)
 *   - Scoped strictly to the caller's own organisation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Lookup user from DB to derive target organisation authoritatively
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: { organisation: true },
    });

    if (!user?.organisationId || user.role !== 'ORG_OWNER') {
      return NextResponse.json(
        { error: 'Forbidden: Only the organisation owner can upload an onboarding logo' },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (user as any).organisation;
    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Disallow inactive states other than PENDING/ACTIVE
    if (org.approvalStatus === 'SUSPENDED' || org.approvalStatus === 'REJECTED') {
      return NextResponse.json(
        { error: `Forbidden: Organisation is ${org.approvalStatus}` },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size: 2MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentError = validateImageContent(file.type, buffer, ALLOWED_TYPES, { allowSvg: true });
    if (contentError) {
      return NextResponse.json({ error: contentError }, { status: 400 });
    }

    const ext = file.type.split('/')[1].replace('svg+xml', 'svg');
    const filename = `uploads/${user.organisationId}/logos/logo-${nanoid(12)}.${ext}`;

    let publicUrl: string;
    try {
      publicUrl = await uploadToBlob(file, filename);
    } catch {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Vercel Blob storage is not configured in production');
      }
      const localDir = path.join(process.cwd(), 'public/uploads/logos');
      await mkdir(localDir, { recursive: true });
      const localFilename = `logo-${nanoid(12)}.${ext}`;
      await writeFile(path.join(localDir, localFilename), buffer);
      publicUrl = `/uploads/logos/${localFilename}`;
    }

    // Atomically link logo to the newly created organisation
    await db
      .update(organisations)
      .set({ logoUrl: publicUrl })
      .where(eq(organisations.id, user.organisationId));

    logger.info(`[Onboarding Logo Upload] Successfully saved logo for org ${user.organisationId}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (error) {
    logger.error('[Onboarding Logo Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}
