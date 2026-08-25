import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Logo Upload API
 * 
 * POST: Upload organisation logo to local storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth';
import { validateImageContent } from '@/lib/file-validation';

import { uploadToBlob } from '@/lib/services/blob';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function POST(request: NextRequest) {
  try {
    // Auth check — only ORG_OWNERs may upload logos
    const session = await auth();
    if (!session?.user?.organisationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((session.user as any).role !== 'ORG_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 2MB' },
        { status: 400 }
      );
    }

    // Validate declared type + actual byte content (magic bytes) together —
    // prevents MIME-type spoofing (shared with /api/upload, see file-validation.ts)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentError = validateImageContent(file.type, buffer, ALLOWED_TYPES, { allowSvg: true });
    if (contentError) {
      return NextResponse.json({ error: contentError }, { status: 400 });
    }

    // Get file extension
    const ext = file.type.split('/')[1].replace('svg+xml', 'svg');
    const filename = `uploads/${session.user.organisationId}/logos/logo-${nanoid(12)}.${ext}`;

    let publicUrl: string;
    try {
      publicUrl = await uploadToBlob(file, filename);
    } catch {
      // Local development fallback if BLOB_READ_WRITE_TOKEN is not configured
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Vercel Blob storage is not configured in production');
      }
      const localDir = path.join(process.cwd(), 'public/uploads/logos');
      await mkdir(localDir, { recursive: true });
      const localFilename = `logo-${nanoid(12)}.${ext}`;
      await writeFile(path.join(localDir, localFilename), buffer);
      publicUrl = `/uploads/logos/${localFilename}`;
    }

    logger.info(`[Logo Upload] Saved ${filename}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
    });

  } catch (error) {
    logger.error('[Logo Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}
