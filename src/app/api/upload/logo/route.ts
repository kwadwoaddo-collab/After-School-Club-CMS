/**
 * Logo Upload API
 * 
 * POST: Upload organisation logo to local storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

const UPLOAD_DIR = 'public/uploads/logos';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, WebP, SVG' },
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

    // Get file extension
    const ext = file.type.split('/')[1].replace('svg+xml', 'svg');
    const filename = `logo-${nanoid(12)}.${ext}`;
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);

    // Ensure directory exists
    await mkdir(uploadPath, { recursive: true });

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(path.join(uploadPath, filename), buffer);

    // Return public URL
    const publicUrl = `/uploads/logos/${filename}`;

    console.log(`[Logo Upload] Saved ${filename}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
    });

  } catch (error) {
    console.error('[Logo Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    );
  }
}
