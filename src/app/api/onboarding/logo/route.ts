import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users, organisations, orgMemberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { validateImageContent } from '@/lib/file-validation';
import { uploadToBlob } from '@/lib/services/blob';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
// Strict raster images only — SVG explicitly forbidden to prevent Stored XSS / XML injection
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const EXT_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * PM-1.3A: Dedicated Scoped Logo Upload for Onboarding
 *
 * Security Model:
 *   - Requires authenticated session (auth())
 *   - Verifies user role is ORG_OWNER in users table
 *   - Verifies an authoritative orgMemberships ownership record exists
 *   - Target organisation is strictly derived from DB record (zero client trust, no client override)
 *   - Strictly restricted to PENDING organisations only (ACTIVE organisations must use /api/upload/logo)
 *   - Rejects SUSPENDED, REJECTED, or non-existent organisations (HTTP 403 / 404)
 *   - Strict binary signature verification (PNG, JPEG, WEBP magic bytes)
 *   - SVG rejected unconditionally to prevent XML/script injection attacks
 *   - Filename is generated purely server-side with nanoid (path traversal impossible)
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

    // Verify authoritative orgMemberships record
    const membership = await db.query.orgMemberships.findFirst({
      where: and(
        eq(orgMemberships.userId, user.id),
        eq(orgMemberships.organisationId, user.organisationId),
        eq(orgMemberships.role, 'ORG_OWNER')
      ),
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Forbidden: User is not an owner member of this organisation' },
        { status: 403 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = (user as any).organisation;
    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Onboarding-specific endpoint is strictly restricted to PENDING organisations
    if (org.approvalStatus !== 'PENDING') {
      return NextResponse.json(
        { error: `Forbidden: Onboarding logo upload is only permitted for organisations in PENDING status. Current status: ${org.approvalStatus}` },
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

    // Validate binary signatures — allowSvg is false (SVG rejected)
    const contentError = validateImageContent(file.type, buffer, ALLOWED_TYPES, { allowSvg: false });
    if (contentError) {
      return NextResponse.json({ error: contentError }, { status: 400 });
    }

    const ext = EXT_MAP[file.type];
    if (!ext) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

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
