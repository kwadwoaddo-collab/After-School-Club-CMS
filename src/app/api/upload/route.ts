import { NextRequest, NextResponse } from 'next/server';
import { uploadToBlob } from '@/lib/services/blob';
import { logger } from '@/lib/logger';
import { db } from '@/db';
import { centres } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { apiRateLimit, checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { validateImageContent } from '@/lib/file-validation';
import { nanoid } from 'nanoid';

/**
 * General file upload — used by BookingForm to upload a child's photo during
 * both the authenticated dashboard "New Booking" flow and the *unauthenticated*
 * public booking pages (/book/[orgSlug]/[centreSlug], /centre-portal/[subdomain]/book).
 *
 * This is deliberately a public endpoint: a parent booking a session for the
 * first time has no account/session yet, so requiring auth() here would break
 * the public booking flow's photo upload. Instead of the previous unrestricted
 * primitive (no auth, no size/type check at all), this is now a tightly
 * constrained public mechanism, mirroring the existing pattern already used by
 * the other public write endpoints in this app (/api/register, /api/bookings):
 * no session required, but every request must resolve to a real centre, and
 * the request itself is rate-limited, size-limited, and content-validated.
 *
 * See architecture-decisions.md ("Upload security model") for the full reasoning.
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — phone-camera child photos, not just logos
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// No SVG here: this endpoint accepts arbitrary public-submitted photos, not
// operator-supplied branding assets, so XML-based formats stay off the allow-list.

export async function POST(request: NextRequest) {
  try {
    // Rate limit: this is a public, unauthenticated endpoint.
    const ip = getClientIP(request);
    const { success: allowed } = await checkRateLimit(apiRateLimit, `upload:${ip}`);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many upload attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const centreId = formData.get('centreId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!centreId) {
      return NextResponse.json({ error: 'Centre ID is required' }, { status: 400 });
    }

    // Resolve + validate the centre the same way /api/bookings and /api/register do —
    // this is the scoping mechanism for an endpoint with no session to scope from.
    const centre = await db.query.centres.findFirst({
      where: eq(centres.id, centreId),
      columns: { id: true, organisationId: true },
    });

    if (!centre) {
      return NextResponse.json({ error: 'Invalid centre ID' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 5MB' },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const contentError = validateImageContent(file.type, buffer, ALLOWED_TYPES);
    if (contentError) {
      return NextResponse.json({ error: contentError }, { status: 400 });
    }

    // Filename: ignore the client-supplied name entirely — use a random name plus
    // the *validated* extension, namespaced by organisation/centre so files are
    // neither guessable nor able to collide across tenants.
    const ext = file.type.split('/')[1];
    const filename = `uploads/${centre.organisationId}/${centreId}/${nanoid(12)}.${ext}`;

    const url = await uploadToBlob(file, filename);

    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    logger.error('[API /upload] File upload failed:', error);
    return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
  }
}
