/**
 * Shared file-upload validation helpers.
 *
 * Originally duplicated between /api/upload/logo and /api/upload; extracted
 * during Milestone 1 so both routes (and any future upload endpoint) share
 * one magic-byte source of truth instead of drifting independently.
 */

export interface MagicSignature {
  sig: number[];
  type: string;
}

/** Magic byte signatures for common raster image types (prevents MIME-type spoofing). */
export const IMAGE_MAGIC_SIGNATURES: MagicSignature[] = [
  { sig: [0x89, 0x50, 0x4e, 0x47], type: 'image/png' }, // PNG
  { sig: [0xff, 0xd8, 0xff], type: 'image/jpeg' }, // JPEG
  { sig: [0x52, 0x49, 0x46, 0x46], type: 'image/webp' }, // WEBP (RIFF header)
];

/**
 * Detects the actual MIME type of a buffer by inspecting its magic bytes,
 * independent of whatever Content-Type the client claims. Optionally also
 * recognises SVG (XML text, no fixed magic bytes) when `allowSvg` is true.
 * Returns null if the content doesn't match any allowed signature.
 */
export function detectMimeFromBytes(buf: Buffer, allowSvg = false): string | null {
  for (const { sig, type } of IMAGE_MAGIC_SIGNATURES) {
    if (sig.every((byte, i) => buf[i] === byte)) return type;
  }
  if (allowSvg) {
    const prefix = buf.subarray(0, 100).toString('utf8').trimStart();
    if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) return 'image/svg+xml';
  }
  return null;
}

/**
 * Validates a File's declared type + actual byte content against an allow-list.
 * Returns an error message string if invalid, or null if the file passes.
 * Does not read the whole file into memory itself — caller passes the buffer
 * it already has (both current upload routes need the buffer anyway to persist it).
 */
export function validateImageContent(
  declaredType: string,
  buffer: Buffer,
  allowedTypes: string[],
  { allowSvg = false }: { allowSvg?: boolean } = {}
): string | null {
  if (!allowedTypes.includes(declaredType)) {
    return `Invalid file type. Allowed: ${allowedTypes.join(', ')}`;
  }

  const actualMime = detectMimeFromBytes(buffer, allowSvg);

  if (!actualMime) {
    return 'Could not determine file type from content';
  }

  // SVG has no binary magic bytes to cross-check against the declared type beyond
  // the XML-prefix check already performed by detectMimeFromBytes.
  if (declaredType !== 'image/svg+xml' && actualMime !== declaredType) {
    return 'File content does not match declared type';
  }

  return null;
}

/** Strips any path components and disallowed characters from a client-supplied filename. */
export function sanitiseFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  return base.replace(/[^a-zA-Z0-9.-]/g, '_');
}
