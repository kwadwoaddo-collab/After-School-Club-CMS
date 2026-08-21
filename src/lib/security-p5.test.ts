/**
 * P5 Security Fix Tests — General File Upload
 *
 * POST /api/upload previously had no authentication, authorisation, size
 * limit, or content validation (Milestone 0 security-review.md, High #1).
 * It is used by BookingForm both from the authenticated dashboard and from
 * genuinely public, unauthenticated booking pages, so the fix is not "add
 * auth()" — it's a constrained public mechanism: rate limiting, mandatory
 * centre-ID validation (mirroring /api/bookings and /api/register), a size
 * cap, and magic-byte content validation against a strict allow-list.
 *
 * All tests mock at the module boundary; no DB, network, or blob-storage
 * calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  db: {
    query: {
      centres: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, op: 'eq' })),
  };
});

vi.mock('@/lib/services/blob', () => ({
  uploadToBlob: vi.fn().mockResolvedValue('https://blob.example.com/uploads/org-1/centre-1/fake.png'),
}));

vi.mock('@/lib/rate-limit', () => ({
  apiRateLimit: {},
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(() => '203.0.113.1'),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const TEXT_BYTES = Buffer.from('this is not an image, just text pretending to be one');

function makeUploadRequest(opts: {
  file?: { bytes: Buffer; type: string; name?: string } | null;
  centreId?: string | null;
  includeFileField?: boolean;
  includeCentreField?: boolean;
}): Request {
  const {
    file,
    centreId = 'centre-1',
    includeFileField = true,
    includeCentreField = true,
  } = opts;

  const formData = new FormData();
  if (includeFileField && file) {
    const blob = new Blob([new Uint8Array(file.bytes)], { type: file.type });
    formData.append('file', blob, file.name ?? 'photo.png');
  }
  if (includeCentreField && centreId !== null) {
    formData.append('centreId', centreId);
  }

  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  });
}

async function getUploadRoute() {
  const { POST } = await import('@/app/api/upload/route');
  return POST;
}

async function mockHappyDb() {
  const { db } = await import('@/db');
  (db.query.centres.findFirst as any).mockResolvedValueOnce({
    id: 'centre-1',
    organisationId: 'org-1',
  });
}

async function mockAllowedRateLimit() {
  const { checkRateLimit } = await import('@/lib/rate-limit');
  (checkRateLimit as any).mockResolvedValueOnce({ success: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns 429 when the rate limit is exceeded (unauthenticated request)', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    (checkRateLimit as any).mockResolvedValueOnce({ success: false, reset: Date.now() + 60_000 });

    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: PNG_BYTES, type: 'image/png' } });
    const res = await POST(req as any);
    expect(res.status).toBe(429);
  });

  it('returns 400 when no file is provided', async () => {
    await mockAllowedRateLimit();
    const POST = await getUploadRoute();
    const req = makeUploadRequest({ includeFileField: false });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('No file provided');
  });

  it('returns 400 when centreId is missing', async () => {
    await mockAllowedRateLimit();
    const POST = await getUploadRoute();
    const req = makeUploadRequest({
      file: { bytes: PNG_BYTES, type: 'image/png' },
      includeCentreField: false,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Centre ID is required');
  });

  it('returns 400 when centreId does not resolve to a real centre', async () => {
    await mockAllowedRateLimit();
    const { db } = await import('@/db');
    (db.query.centres.findFirst as any).mockResolvedValueOnce(null);

    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: PNG_BYTES, type: 'image/png' }, centreId: 'nonexistent-centre' });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid centre ID');
  });

  it('returns 413 when the file exceeds the size limit', async () => {
    await mockAllowedRateLimit();
    await mockHappyDb();

    const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(6 * 1024 * 1024)]); // > 5MB
    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: oversized, type: 'image/png' } });
    const res = await POST(req as any);
    expect(res.status).toBe(413);
  });

  it('returns 400 when the declared type is not on the allow-list', async () => {
    await mockAllowedRateLimit();
    await mockHappyDb();

    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: TEXT_BYTES, type: 'application/pdf' } });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid file type');
  });

  it('returns 400 when file content does not match the declared MIME type (spoofing)', async () => {
    await mockAllowedRateLimit();
    await mockHappyDb();

    // Declares image/png but the actual bytes are plain text — magic-byte check must catch this.
    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: TEXT_BYTES, type: 'image/png' } });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/does not match declared type|Could not determine file type/);
  });

  it('rejects SVG entirely (not on this endpoint\'s allow-list, unlike the logo endpoint)', async () => {
    await mockAllowedRateLimit();
    await mockHappyDb();

    const svgBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: svgBytes, type: 'image/svg+xml' } });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('accepts a valid PNG for a valid centre and returns a namespaced blob URL', async () => {
    await mockAllowedRateLimit();
    await mockHappyDb();

    const { uploadToBlob } = await import('@/lib/services/blob');
    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: PNG_BYTES, type: 'image/png' }, centreId: 'centre-1' });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.url).toBeTruthy();

    // Filename must be namespaced by org/centre, not the client-supplied name.
    expect(uploadToBlob).toHaveBeenCalledOnce();
    const [, filename] = (uploadToBlob as any).mock.calls[0];
    expect(filename).toMatch(/^uploads\/org-1\/centre-1\/[\w-]+\.png$/);
  });

  it('accepts a valid JPEG', async () => {
    await mockAllowedRateLimit();
    await mockHappyDb();

    const POST = await getUploadRoute();
    const req = makeUploadRequest({ file: { bytes: JPEG_BYTES, type: 'image/jpeg' } });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });
});
