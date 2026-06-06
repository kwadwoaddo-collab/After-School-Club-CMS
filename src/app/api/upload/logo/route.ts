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

const UPLOAD_DIR = 'public/uploads/logos';
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

// Magic bytes for each allowed type (to prevent MIME-type spoofing)
const MAGIC_SIGNATURES: { sig: number[]; type: string }[] = [
  { sig: [0x89, 0x50, 0x4e, 0x47], type: 'image/png' },  // PNG
  { sig: [0xff, 0xd8, 0xff], type: 'image/jpeg' },        // JPEG
  { sig: [0x52, 0x49, 0x46, 0x46], type: 'image/webp' },  // WEBP (RIFF header)
];

function detectMimeFromBytes(buf: Buffer): string | null {
  for (const { sig, type } of MAGIC_SIGNATURES) {
    if (sig.every((byte, i) => buf[i] === byte)) return type;
  }
  // SVG is XML text — check for '<svg' or '<?xml' prefix after stripping whitespace
  const prefix = buf.slice(0, 100).toString('utf8').trimStart();
  if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) return 'image/svg+xml';
  return null;
}

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

    // Validate file type against user-supplied MIME type first
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

    // Re-validate actual content via magic bytes (prevents MIME-type spoofing)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const actualMime = detectMimeFromBytes(buffer);
    // For SVG we allow the declared type; for binary types compare strictly
    if (file.type !== 'image/svg+xml' && actualMime !== file.type) {
      return NextResponse.json(
        { error: 'File content does not match declared type' },
        { status: 400 }
      );
    }
    if (!actualMime) {
      return NextResponse.json(
        { error: 'Could not determine file type' },
        { status: 400 }
      );
    }

    // Get file extension
    const ext = file.type.split('/')[1].replace('svg+xml', 'svg');
    const filename = `logo-${nanoid(12)}.${ext}`;
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);

    // Ensure directory exists
    await mkdir(uploadPath, { recursive: true });

    // Save the buffer (already read above for magic bytes check)
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
